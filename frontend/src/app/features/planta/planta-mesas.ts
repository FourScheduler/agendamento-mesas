import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  afterNextRender,
  DestroyRef,
  ElementRef,
  viewChild,
} from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { Mesa } from "../mesas/mesa";
import { MesaService } from "../mesas/mesa.service";
import { forkJoin, of } from 'rxjs';
import {
  PLANTA_TAMBORE,
  TAMANHO_MESA,
  TAMANHO_MESA_LEGADO,
} from "./planta-layout";

@Component({
  selector: "app-planta-mesas",
  standalone: true,
  templateUrl: "./planta-mesas.html",
  styleUrl: "./planta-mesas.css",
})
export class PlantaMesas {
  readonly data = input('');
  readonly atualizacao = input(0);
  readonly mesaInicialId = input<number | null>(null);
  readonly mesaSelecionada = output<Mesa>();
  readonly disponibilidadeConsultada = output<string>();
  readonly mesaInicialInvalidada = output<void>();
  readonly mesas = signal<readonly Mesa[]>([]);
  readonly disponiveis = signal<ReadonlySet<number> | null>(null);
  readonly carregando = signal(false);
  readonly erro = signal("");
  readonly selecionada = signal<number | null>(null);
  readonly mostrarRotulos = signal(false);
  readonly layoutTambore = PLANTA_TAMBORE;
  private readonly larguraViewport = signal(0);
  private readonly viewport =
    viewChild.required<ElementRef<HTMLElement>>("viewport");
  private readonly destroyRef = inject(DestroyRef);
  readonly plantas = computed(() =>
    [...new Set(this.mesas().map((m) => m.referenciaVisual.planta))].map(
      (nome) => {
        const mesas = this.mesas().filter(
          (m) => m.referenciaVisual.planta === nome,
        );
        const tambore = nome === "TAMBORÉ";
        // Compatibilidade com servidores que ainda não aplicaram a migration V4.
        // Não misturar cartões e estruturas do SVG com a grade compacta do seed V2.
        const legado =
          tambore &&
          mesas.every(
            ({ referenciaVisual: p }) =>
              p.x >= 100 &&
              p.x <= 820 &&
              (p.x - 100) % 80 === 0 &&
              p.y >= 80 &&
              p.y <= 740 &&
              (p.y - 80) % 60 === 0,
          );
        const tamanhoMesa = legado ? TAMANHO_MESA_LEGADO : TAMANHO_MESA;
        const exibirEstruturas = tambore && !legado;
        return {
          nome,
          mesas,
          tambore: exibirEstruturas,
          legado,
          tamanhoMesa,
          largura: Math.max(
            exibirEstruturas ? PLANTA_TAMBORE.largura : 0,
            ...mesas.map(
              (m) => m.referenciaVisual.x + tamanhoMesa.largura + 24,
            ),
          ),
          altura: Math.max(
            exibirEstruturas ? PLANTA_TAMBORE.altura : 0,
            ...mesas.map((m) => m.referenciaVisual.y + tamanhoMesa.altura + 24),
          ),
        };
      },
    ),
  );
  readonly larguraDesenho = computed(() =>
    Math.max(1000, ...this.plantas().map((planta) => planta.largura)),
  );
  // Escala todo o desenho junto; cabeçalho e legenda mantêm a fonte do Portal.
  readonly escala = computed(() =>
    Math.min(1, Math.max(1000, this.larguraViewport()) / this.larguraDesenho()),
  );
  private readonly catalogo = inject(MesaService);

  constructor() {
    afterNextRender(() => {
      const elemento = this.viewport().nativeElement;
      const ajustar = (largura: number) => {
        if (largura > 0) this.larguraViewport.set(largura);
      };
      ajustar(elemento.clientWidth);
      if (typeof ResizeObserver !== "undefined") {
        const observador = new ResizeObserver(([entrada]) =>
          ajustar(entrada.contentRect.width),
        );
        observador.observe(elemento);
        this.destroyRef.onDestroy(() => observador.disconnect());
      }
    });
    effect((onCleanup) => {
      const data = this.data();
      this.atualizacao();
      this.mesas.set([]);
      this.disponiveis.set(null);
      this.selecionada.set(null);
      this.erro.set("");
      this.carregando.set(false);
      this.carregando.set(true);
      const consulta = forkJoin({
        mesas: this.catalogo.listar(),
        disponiveis: data ? this.catalogo.listarDisponiveis(data) : of(null),
      }).subscribe({
        next: ({ mesas, disponiveis }) => {
          this.mesas.set(mesas);
          this.disponiveis.set(disponiveis ? new Set(disponiveis.map(m => m.id)) : null);
          this.carregando.set(false);
          if (data) {
            this.disponibilidadeConsultada.emit(data);
            const mesaInicialId = this.mesaInicialId();
            if (mesaInicialId !== null) {
              const mesaInicial = mesas.find(mesa => mesa.id === mesaInicialId);
              if (mesaInicial && this.estaDisponivel(mesaInicial)) this.selecionar(mesaInicial);
              else this.mesaInicialInvalidada.emit();
            }
          }
        },
        error: (erro: HttpErrorResponse) => {
          this.carregando.set(false);
          this.erro.set(
            erro.status === 401
              ? "Sessão inválida ou expirada. Entre novamente."
              : erro.status === 400 ? (erro.error?.detail ?? 'Escolha uma data válida.')
              : "Não foi possível carregar a disponibilidade. Tente atualizar a consulta.",
          );
        },
      });
      onCleanup(() => consulta.unsubscribe());
    });
  }

  selecionar(mesa: Mesa) {
    if (this.carregando() || !this.estaDisponivel(mesa)) return;
    this.selecionada.set(mesa.id);
    this.mesaSelecionada.emit(mesa);
  }

  estaDisponivel(mesa: Mesa): boolean {
    return mesa.ativa && mesa.tipo === 'LIVRE'
      && (!this.data() || this.disponiveis()?.has(mesa.id) === true);
  }

  estaOcupada(mesa: Mesa): boolean {
    return mesa.ativa && mesa.tipo === 'LIVRE' && !!this.data()
      && this.disponiveis() !== null && !this.disponiveis()!.has(mesa.id);
  }

  alternarRotulos() {
    this.mostrarRotulos.update((v) => !v);
  }

  codigoExibido(codigo: string) {
    return codigo.replace(/^0+(?=\d)/, "");
  }
}
