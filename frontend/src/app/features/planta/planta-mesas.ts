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
  Injector,
  ElementRef,
  viewChild,
  HostListener,
} from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { NgTemplateOutlet } from "@angular/common";
import { Mesa } from "../mesas/mesa";
import { MesaService } from "../mesas/mesa.service";
import { forkJoin, of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { hojeSaoPaulo } from '../reservas/data-reserva';
import {
  PLANTA_TAMBORE_EXIBICAO,
  TAMANHO_MESA,
  TAMANHO_MESA_LEGADO,
  agruparFileiras,
  contornosBancadas,
} from "./planta-layout";

@Component({
  selector: "app-planta-mesas",
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: "./planta-mesas.html",
  styleUrl: "./planta-mesas.css",
})
export class PlantaMesas {
  private readonly auth = inject(AuthService);
  readonly decoracaoNatal = input(true);
  readonly mostrarArvore = computed(() => this.decoracaoNatal() && hojeSaoPaulo().slice(5, 7) === '12');
  readonly minhaMesaId = computed(() => {
    const usuarioId = this.auth.usuario()?.id;
    if (usuarioId == null) return null;
    return this.mesas().find(m => m.ativa && (m.ocupanteNaData?.id === usuarioId
      || m.responsavel?.id === usuarioId))?.id ?? null;
  });
  readonly tooltip = signal<{ texto: string; x: number; y: number } | null>(null);
  private ultimoFocoAutomatico = '';
  readonly data = input('');
  readonly atualizacao = input(0);
  readonly mesaInicialId = input<number | null>(null);
  readonly mesaSelecionadaId = input<number | null>(null);
  readonly mesaSelecionada = output<{ readonly mesa: Mesa; readonly disponivel: boolean }>();
  readonly mesaInicialSelecionada = output<Mesa>();
  readonly mesasCarregadas = output<readonly Mesa[]>();
  readonly mesasDisponiveisCarregadas = output<ReadonlySet<number> | null>();
  readonly disponibilidadeConsultada = output<string>();
  readonly mesaInicialInvalidada = output<void>();
  readonly mesas = signal<readonly Mesa[]>([]);
  readonly disponiveis = signal<ReadonlySet<number> | null>(null);
  readonly carregando = signal(false);
  readonly erro = signal("");
  readonly selecionada = signal<number | null>(null);
  readonly mostrarNomes = signal(false);
  readonly mostrarDataMapa = signal(false);
  readonly zoom = signal(1);
  readonly mapaAmpliado = signal(false);
  readonly zoomMapaAmpliado = signal(1);
  readonly relevo = true;
  readonly layoutTambore = PLANTA_TAMBORE_EXIBICAO;
  private readonly larguraViewport = signal(0);
  private readonly viewport =
    viewChild.required<ElementRef<HTMLElement>>("viewport");
  private readonly modalMapa =
    viewChild.required<ElementRef<HTMLElement>>("modalMapa");
  private readonly botaoAmpliarMapa =
    viewChild.required<ElementRef<HTMLButtonElement>>("botaoAmpliarMapa");
  private readonly botaoFecharMapa =
    viewChild<ElementRef<HTMLButtonElement>>("botaoFecharMapa");
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  /** Mesas disponíveis para navegação por teclado (ordenadas por planta, y, x) */
  private readonly mesasNavegaveis = computed(() =>
    this.mesas()
      .filter((m) => this.estaDisponivel(m))
      .sort((a, b) => {
        const pa = a.referenciaVisual.planta.localeCompare(b.referenciaVisual.planta);
        if (pa !== 0) return pa;
        const ya = a.referenciaVisual.y - b.referenciaVisual.y;
        if (ya !== 0) return ya;
        return a.referenciaVisual.x - b.referenciaVisual.x;
      })
  );

  /** Índice da mesa focada na lista de navegáveis */
  private focoIndex = signal(-1);
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
        const posicoes = agruparFileiras(mesas, tamanhoMesa, exibirEstruturas);
        return {
          nome,
          mesas,
          tambore: exibirEstruturas,
          legado,
          tamanhoMesa,
          posicoes,
          bancadas: contornosBancadas(posicoes, tamanhoMesa),
          largura: Math.max(
            exibirEstruturas ? this.layoutTambore.largura : 0,
            ...mesas.map(
              (m) => posicoes.get(m.id)!.x + tamanhoMesa.largura + 24,
            ),
          ),
          altura: Math.max(
            exibirEstruturas ? this.layoutTambore.altura : 0,
            ...mesas.map((m) => posicoes.get(m.id)!.y + tamanhoMesa.altura + 24),
          ),
        };
      },
    ),
  );
  readonly larguraDesenho = computed(() =>
    Math.max(1000, ...this.plantas().map((planta) => planta.largura)),
  );
  readonly alturaDesenho = computed(() =>
    this.plantas().reduce(
      (altura, planta) => altura + planta.altura + (this.plantas().length > 1 ? 50 : 0),
      0,
    ),
  );
  // Escala todo o desenho junto; cabeçalho e legenda mantêm a fonte do Portal.
  readonly escala = computed(() => {
    if (this.mapaAmpliado() && this.alturaDesenho() > 0) {
      const larguraDisponivel = this.larguraViewport();
      const alturaDisponivel = this.alturaViewport();
      if (larguraDisponivel > 0 && alturaDisponivel > 0) {
        return this.zoomMapaAmpliado() * 2.6 * Math.min(
          larguraDisponivel / (this.larguraDesenho() + 132),
          alturaDisponivel / (this.alturaDesenho() + 132),
        );
      }
    }

    return Math.min(1, Math.max(1000, this.larguraViewport()) / this.larguraDesenho()) * 0.72 * this.zoom();
  });
  private arraste: { x: number; y: number; left: number; top: number; pointerId: number } | null = null;
  readonly arrastando = signal(false);

  private readonly alturaViewport = signal(0);

  ajustarZoom(delta: number) {
    this.zoom.update(valor => Math.max(0.5, Math.min(1.5, Math.round((valor + delta) * 10) / 10)));
  }

  centralizarMapa() {
    this.zoom.set(1);
    this.viewport().nativeElement.scrollTo({ left: 0, top: 0 });
  }

  ampliarMapa() {
    this.zoomMapaAmpliado.set(1);
    this.mostrarDataMapa.set(false);
    this.mapaAmpliado.set(true);
    afterNextRender(() => this.botaoFecharMapa()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  ajustarZoomMapaAmpliado(delta: number) {
    this.zoomMapaAmpliado.update(valor =>
      Math.max(0.5, Math.min(2.5, Math.round((valor + delta) * 10) / 10)),
    );
  }

  restaurarZoomMapaAmpliado() {
    this.zoomMapaAmpliado.set(1);
    this.viewport().nativeElement.scrollTo({ left: 0, top: 0 });
  }

  alternarDataMapa() {
    this.mostrarDataMapa.update(visible => !visible);
  }

  fecharMapaAmpliado() {
    if (!this.mapaAmpliado()) return;
    this.mapaAmpliado.set(false);
    afterNextRender(() => this.botaoAmpliarMapa().nativeElement.focus(), {
      injector: this.injector,
    });
  }

  onMapaModalKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      this.fecharMapaAmpliado();
      return;
    }

    if (event.key !== "Tab") return;
    const modal = this.modalMapa().nativeElement;
    const elementosFocaveis = modal.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (elementosFocaveis.length === 0) {
      event.preventDefault();
      return;
    }

    const primeiro = elementosFocaveis[0];
    const ultimo = elementosFocaveis[elementosFocaveis.length - 1];
    if (event.shiftKey && (document.activeElement === primeiro || !modal.contains(document.activeElement))) {
      event.preventDefault();
      ultimo.focus();
    } else if (!event.shiftKey && (document.activeElement === ultimo || !modal.contains(document.activeElement))) {
      event.preventDefault();
      primeiro.focus();
    }
  }

  fecharMapaAoClicarFora(event: MouseEvent) {
    if (event.target === event.currentTarget) this.fecharMapaAmpliado();
  }

  iniciarArraste(event: PointerEvent) {
    if (event.pointerType === 'touch' || this.arraste || event.button !== 0 || !(event.target instanceof HTMLElement)
      || event.target.closest('button')) return;
    const viewport = this.viewport().nativeElement;
    this.arraste = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft,
      top: viewport.scrollTop, pointerId: event.pointerId };
    viewport.setPointerCapture(event.pointerId);
    this.arrastando.set(true);
  }

  moverMapa(event: PointerEvent) {
    if (!this.arraste || event.pointerId !== this.arraste.pointerId) return;
    const viewport = this.viewport().nativeElement;
    viewport.scrollLeft = this.arraste.left - (event.clientX - this.arraste.x);
    viewport.scrollTop = this.arraste.top - (event.clientY - this.arraste.y);
  }

  finalizarArraste(event: PointerEvent) {
    if (event.pointerId !== this.arraste?.pointerId) return;
    const viewport = this.viewport().nativeElement;
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    this.arraste = null;
    this.arrastando.set(false);
  }
  private readonly catalogo = inject(MesaService);

  constructor() {
    effect(() => this.selecionada.set(this.mesaSelecionadaId()));
    afterNextRender(() => {
      const elemento = this.viewport().nativeElement;
      const ajustar = (largura: number, altura: number) => {
        if (largura > 0) this.larguraViewport.set(largura);
        if (altura > 0) this.alturaViewport.set(altura);
      };
      ajustar(elemento.clientWidth, elemento.clientHeight);
      if (typeof ResizeObserver !== "undefined") {
        const observador = new ResizeObserver(([entrada]) =>
          ajustar(entrada.contentRect.width, entrada.contentRect.height),
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
      this.mesasDisponiveisCarregadas.emit(null);
      this.selecionada.set(null);
      this.tooltip.set(null);
      this.erro.set("");
      this.carregando.set(false);
      this.carregando.set(true);
      const consulta = forkJoin({
        mesas: data ? this.catalogo.listarComOcupacao(data) : this.catalogo.listar(),
        disponiveis: data ? this.catalogo.listarDisponiveis(data) : of(null),
      }).subscribe({
        next: ({ mesas, disponiveis }) => {
          this.mesas.set(mesas);
          this.mesasCarregadas.emit(mesas);
          this.disponiveis.set(disponiveis ? new Set(disponiveis.map(m => m.id)) : null);
          this.mesasDisponiveisCarregadas.emit(this.disponiveis());
          this.carregando.set(false);
          if (data) {
            this.disponibilidadeConsultada.emit(data);
            const mesaInicialId = this.mesaInicialId();
            if (mesaInicialId !== null) {
              const mesaInicial = mesas.find(mesa => mesa.id === mesaInicialId);
              if (mesaInicial && this.estaDisponivel(mesaInicial)) {
                this.selecionada.set(mesaInicial.id);
                this.mesaInicialSelecionada.emit(mesaInicial);
                afterNextRender(() => {
                  if (this.selecionada() !== mesaInicial.id) return;
                  const viewport = this.viewport().nativeElement;
                  const mesa = viewport.querySelector<HTMLElement>(
                    `button.mesa[data-mesa-id="${mesaInicial.id}"]`,
                  );
                  if (!mesa) return;
                  const area = viewport.getBoundingClientRect();
                  const alvo = mesa.getBoundingClientRect();
                  viewport.scrollTo({
                    left: viewport.scrollLeft + alvo.left - area.left - viewport.clientLeft
                      - (viewport.clientWidth - alvo.width) / 2,
                    top: viewport.scrollTop + alvo.top - area.top - viewport.clientTop
                      - (viewport.clientHeight - alvo.height) / 2,
                    behavior: 'instant',
                  });
                }, { injector: this.injector });
              }
              else this.mesaInicialInvalidada.emit();
            }
            if (mesaInicialId === null && this.minhaMesaId() !== null) {
              const id = this.minhaMesaId()!;
              const contexto = `${data}:${id}`;
              if (this.ultimoFocoAutomatico !== contexto) {
                this.ultimoFocoAutomatico = contexto;
                afterNextRender(() => {
                  if (this.data() !== data || this.minhaMesaId() !== id) return;
                  this.centralizarMesa(id);
                }, { injector: this.injector });
              }
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
    if (this.carregando()) return;
    this.selecionada.set(mesa.id);
    this.mesaSelecionada.emit({ mesa, disponivel: this.estaDisponivel(mesa) });
  }

  estaDisponivel(mesa: Mesa): boolean {
    return mesa.ativa && mesa.tipo === 'LIVRE'
      && (!this.data() || this.disponiveis()?.has(mesa.id) === true);
  }

  estaOcupada(mesa: Mesa): boolean {
    return mesa.ativa && mesa.tipo === 'LIVRE' && !!this.data()
      && this.disponiveis() !== null && !this.disponiveis()!.has(mesa.id);
  }

  nomeOcupante(mesa: Mesa): string | null {
    return mesa.ocupanteNaData?.nome || mesa.responsavel?.nome || mesa.ocupante || null;
  }

  mostrarTooltip(mesa: Mesa, evento: Event) {
    if (!(evento.currentTarget instanceof HTMLElement)) return;
    const alvo = evento.currentTarget.getBoundingClientRect();
    const nome = this.nomeOcupante(mesa);
    this.tooltip.set({
      texto: `Mesa ${mesa.codigo} · ${nome ? nome : this.estaDisponivel(mesa) ? 'Disponível' : !mesa.ativa ? 'Inativa' : 'Indisponível'}`,
      x: Math.max(8, Math.min(alvo.left, window.innerWidth - 288)),
      y: Math.max(8, Math.min(alvo.bottom + 8, window.innerHeight - 80)),
    });
  }

  private centralizarMesa(id: number) {
    const viewport = this.viewport().nativeElement;
    const mesa = viewport.querySelector<HTMLElement>(`button.mesa[data-mesa-id="${id}"]`);
    if (!mesa) return;
    const area = viewport.getBoundingClientRect();
    const alvo = mesa.getBoundingClientRect();
    viewport.scrollTo({
      left: viewport.scrollLeft + alvo.left - area.left - viewport.clientLeft - (viewport.clientWidth - alvo.width) / 2,
      top: viewport.scrollTop + alvo.top - area.top - viewport.clientTop - (viewport.clientHeight - alvo.height) / 2,
      behavior: 'instant',
    });
  }

  alternarNomes() {
    this.mostrarNomes.update((v) => !v);
  }

  codigoExibido(codigo: string) {
    return codigo.replace(/^0+(?=\d)/, "");
  }

  /** Move o foco para a próxima/anteior mesa disponível (wrap around) */
  private moverFoco(delta: number) {
    const navegaveis = this.mesasNavegaveis();
    if (navegaveis.length === 0) return;

    let idx = this.focoIndex();
    if (idx === -1) {
      // Se nada focado, foca a primeira ou a selecionada
      const sel = this.selecionada();
      idx = sel ? navegaveis.findIndex(m => m.id === sel) : -1;
      if (idx === -1) idx = 0;
    }
    idx = (idx + delta + navegaveis.length) % navegaveis.length;
    this.focoIndex.set(idx);

    // Scroll para trazer a mesa focada para a vista
    const mesa = navegaveis[idx];
    const el = this.viewport()?.nativeElement.querySelector(
      `button.mesa[data-mesa-id="${mesa.id}"]`
    ) as HTMLElement;
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }

  /** Seleciona a mesa atualmente focada */
  private selecionarFocada() {
    const navegaveis = this.mesasNavegaveis();
    const idx = this.focoIndex();
    if (idx >= 0 && idx < navegaveis.length) {
      this.selecionar(navegaveis[idx]);
    }
  }

  /** Handler de teclado no viewport da planta */
  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    // Só processa se o viewport ou algum botão de mesa tiver foco
    const target = event.target as HTMLElement;
    const isViewport = target === this.viewport()?.nativeElement;
    const isMesa = target.closest('button.mesa') !== null;

    if (!isViewport && !isMesa) return;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        this.moverFoco(1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        this.moverFoco(-1);
        break;
      case 'Enter':
      case ' ':
        if (isMesa) {
          event.preventDefault();
          const mesaId = Number(target.dataset['mesaId']);
          const mesa = this.mesas().find(item => item.id === mesaId);
          if (mesa) this.selecionar(mesa);
        } else if (this.focoIndex() >= 0) {
          event.preventDefault();
          this.selecionarFocada();
        }
        break;
      case 'Home':
        event.preventDefault();
        this.focoIndex.set(0);
        break;
      case 'End':
        event.preventDefault();
        const navegaveis = this.mesasNavegaveis();
        this.focoIndex.set(navegaveis.length - 1);
        break;
      case 'Escape':
        // Limpa seleção e foco
        this.selecionada.set(null);
        this.focoIndex.set(-1);
        break;
    }
  }

  /** Chamado quando uma mesa recebe foco (mouse ou teclado) */
  onMesaFocus(mesa: Mesa) {
    const navegaveis = this.mesasNavegaveis();
    const idx = navegaveis.findIndex(m => m.id === mesa.id);
    if (idx >= 0) this.focoIndex.set(idx);
  }
}
