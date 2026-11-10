import { DestroyRef, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ReservaService } from '../agendamento/reserva.service';
import { Reserva } from '../agendamento/reserva';
import { Carregando } from '../../shared/estados/carregando';
import { Erro } from '../../shared/estados/erro';
import { Vazio } from '../../shared/estados/vazio';
import { ToastService } from '../../shared/toast/toast';
import { AuthService } from '../../core/auth/auth.service';
import { Mesa } from '../mesas/mesa';
import { MesaService } from '../mesas/mesa.service';
import { CalendarioReserva } from '../reservas/calendario-reserva';
import { CalendarioSaoPaulo } from '../reservas/calendario-sao-paulo';
import { Paginacao } from '../../shared/paginacao/paginacao';

type Filtro = 'ativas' | 'canceladas';

type StatusReserva = 'CONFIRMADA' | 'CANCELADA' | 'PENDENTE';

interface PeriodoPersonalizado {
  inicio: string | null;
  fim: string | null;
}

interface CartaoReserva {
  chave: string;
  reserva: Reserva;
  posicao: number | null;
}

const ROTULOS_STATUS: Record<StatusReserva, string> = {
  CONFIRMADA: 'Confirmada',
  CANCELADA: 'Cancelada',
  PENDENTE: 'Pendente',
};

const OPCOES_STATUS: StatusReserva[] = ['CONFIRMADA', 'PENDENTE'];

@Component({
  selector: 'app-minhas-reservas-page',
  standalone: true,
  imports: [Carregando, Erro, Vazio, CalendarioReserva, Paginacao],
  templateUrl: './minhas-reservas-page.html',
  styleUrl: './minhas-reservas-page.css',
})
export class MinhasReservasPage implements OnInit {
  private readonly reservasService = inject(ReservaService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly mesasService = inject(MesaService);
  private readonly calendario = inject(CalendarioSaoPaulo);
  private consultaReservas: Subscription | undefined;

  readonly reservas = signal<Reserva[]>([]);
  readonly ehAdmin = computed(() => this.auth.usuario()?.perfil === 'ADMIN');
  readonly mesasAtribuidas = signal<readonly Mesa[]>([]);
  readonly carregandoMesaAtribuida = signal(false);
  readonly erroMesaAtribuida = signal<string | null>(null);
  readonly carregando = signal(false);
  readonly erroApi = signal<string | null>(null);
  readonly filtro = signal<Filtro>('ativas');

  readonly statusFiltro = signal<StatusReserva | null>(null);
  readonly periodoFiltro = signal<PeriodoPersonalizado>({ inicio: null, fim: null });

  readonly opcoesStatus = OPCOES_STATUS;

  readonly periodoPersonalizado = computed(
    () => this.periodoFiltro().inicio !== null || this.periodoFiltro().fim !== null,
  );

  readonly periodoInvalido = computed(() => {
    const { inicio, fim } = this.periodoFiltro();
    return Boolean(inicio && fim && inicio > fim);
  });

  readonly cancelamentoSolicitado = signal<string | null>(null);
  readonly cancelamentoEmAndamento = signal<string | null>(null);

  readonly visiveis = computed(() => {
    const lista = this.reservas().filter((reserva) =>
      this.filtro() === 'ativas'
        ? !this.ehCancelada(reserva.status) && this.ehFutura(reserva)
        : this.ehCancelada(reserva.status),
    );

    const porMomento = (a: Reserva, b: Reserva) =>
      this.momento(a).localeCompare(this.momento(b));

    const ascendente = this.filtro() === 'ativas';

    return ascendente ? lista.sort(porMomento) : lista.sort((a, b) => porMomento(b, a));
  });
  readonly paginaAtual = this.pagina;

  readonly cartoes = computed<CartaoReserva[]>(() => {
    const numera = !this.periodoPersonalizado() && this.filtro() === 'ativas';

    return this.visiveis().map((reserva, indice) => ({
      chave: this.chave(reserva),
      reserva,
      posicao: numera ? this.paginaAtual() * this.tamanhoPagina() + indice + 1 : null,
    }));
  });

  readonly tituloVazio = 'Nenhuma reserva encontrada';
  readonly mensagemVazio = computed(() =>
    this.temFiltroAtivo()
      ? 'Nenhuma reserva corresponde aos filtros escolhidos.'
      : this.ehAdmin()
        ? 'As reservas dos usuários aparecerão aqui assim que forem criadas.'
        : 'As suas reservas aparecerão aqui assim que forem criadas.',
  );

  ngOnInit(): void {
    this.buscar();
    this.buscarMesaAtribuida();
  }

  buscarMesaAtribuida(): void {
    const usuario = this.auth.usuario();
    if (usuario == null) {
      this.erroMesaAtribuida.set('Não foi possível identificar o usuário autenticado.');
      return;
    }

    this.carregandoMesaAtribuida.set(true);
    this.erroMesaAtribuida.set(null);
    this.mesasService.listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (mesas) => {
          this.mesasAtribuidas.set(
            mesas.filter((mesa) =>
              mesa.responsavel?.id === usuario.id,
            ),
          );
          this.carregandoMesaAtribuida.set(false);
        },
        error: () => {
          this.mesasAtribuidas.set([]);
          this.carregandoMesaAtribuida.set(false);
          this.erroMesaAtribuida.set('Não foi possível carregar sua mesa atribuída. Tente novamente.');
        },
      });
  }

  buscar(): void {
    this.consultaReservas?.unsubscribe();
    this.calendario.atualizar();
    this.consulta?.unsubscribe();
    if (this.periodoInvalido()) {
      this.reservas.set([]);
      this.erroApi.set(null);
      this.carregando.set(false);
      return;
    }

    const { inicio, fim } = this.periodoFiltro();

    const params: { status?: string; dataInicio?: string; dataFim?: string } = {};
    if (inicio) params.dataInicio = inicio;
    if (fim) params.dataFim = fim;
    if (this.statusFiltro()) {
      params.status = this.statusFiltro()!;
    }

    this.erroApi.set(null);
    this.carregando.set(true);

    const consulta = this.ehAdmin()
      ? this.reservasService.listarTodas(params)
      : this.reservasService.listarMinhas(params);
    this.consultaReservas = consulta
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          if (resultado.totalRegistros > 0 && this.pagina() >= resultado.totalPaginas) {
            this.pagina.set(resultado.totalPaginas - 1);
            this.buscar();
            return;
          }
          this.reservas.set([...resultado.conteudo]);
          this.totalRegistros.set(resultado.totalRegistros);
          this.carregando.set(false);
        },
        error: (erro: unknown) => {
          this.reservas.set([]);
          this.totalRegistros.set(0);
          this.carregando.set(false);
          this.erroApi.set(this.mensagemDeErro(erro));
        },
      });
  }

  trocarFiltro(filtro: Filtro): void {
    this.filtro.set(filtro);
    this.statusFiltro.set(null);
    this.pagina.set(0);
    this.buscar();
  }

  trocarPagina(pagina: number) {
    this.pagina.set(pagina);
    this.buscar();
  }

  trocarTamanho(tamanho: number) {
    this.tamanhoPagina.set(tamanho);
    this.pagina.set(0);
    this.buscar();
  }

  trocarStatus(event: Event): void {
    const valor = (event.target as HTMLSelectElement).value;
    this.statusFiltro.set(valor ? (valor as StatusReserva) : null);
    this.pagina.set(0);
    this.buscar();
  }

  trocarData(campo: 'inicio' | 'fim', event: Event): void {
    const valor = (event.target as HTMLInputElement).value;
    this.selecionarData(campo, valor);
  }

  selecionarData(campo: 'inicio' | 'fim', valor: string): void {
    this.periodoFiltro.update((periodo) => ({ ...periodo, [campo]: valor || null }));
    this.pagina.set(0);
    this.buscar();
  }

  limparFiltros(): void {
    this.pagina.set(0);
    this.statusFiltro.set(null);
    this.periodoFiltro.set({ inicio: null, fim: null });
    this.buscar();
  }

  temFiltroAtivo(): boolean {
    return this.statusFiltro() !== null || this.periodoPersonalizado();
  }

  irParaMapa(): void {
    void this.router.navigate(['/mapa']);
  }

  irParaAgendamento(): void {
    void this.router.navigate(['/agendamento']);
  }

  formatarData(iso: string): string {
    if (!iso) return '';
    const data = new Date(iso + 'T12:00:00Z').toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    });
    return data.charAt(0).toUpperCase() + data.slice(1);
  }

  chave(reserva: Reserva): string {
    return String(reserva.id);
  }

  rotuloStatus(status: StatusReserva): string {
    return ROTULOS_STATUS[status] ?? status.charAt(0) + status.slice(1).toLowerCase();
  }

  ordinal(posicao: number): string {
    return `${posicao}º`;
  }

  podeCancelar(cartao: CartaoReserva): boolean {
    const reserva = cartao.reserva;
    const podeGerenciar = this.ehAdmin() || (
      reserva.usuarioId === this.auth.usuario()?.id && this.ehFutura(reserva)
    );
    return (
      podeGerenciar &&
      reserva.status !== 'CANCELADA' &&
      reserva.id != null
    );
  }

  reservaCriadaPorAdmin(cartao: CartaoReserva): boolean {
    const criador = cartao.reserva.criador;
    return criador?.perfil === 'ADMIN' && criador.id !== cartao.reserva.usuarioId;
  }

  solicitarCancelamento(cartao: CartaoReserva): void {
    this.calendario.atualizar();
    if (!this.podeCancelar(cartao)) {
      return;
    }
    this.cancelamentoSolicitado.set(this.chave(cartao.reserva));
  }

  desistirCancelamento(): void {
    this.cancelamentoSolicitado.set(null);
  }

  cancelarReserva(cartao: CartaoReserva): void {
    this.calendario.atualizar();
    const id = cartao.reserva.id;

    if (id == null || !this.podeCancelar(cartao) || this.cancelamentoEmAndamento() !== null) {
      return;
    }

    const chave = this.chave(cartao.reserva);
    const rotulo = `Mesa ${cartao.reserva.mesa.codigo}`;

    this.cancelamentoEmAndamento.set(chave);

    this.reservasService
      .cancelar(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cancelamentoEmAndamento.set(null);
          this.cancelamentoSolicitado.set(null);
          this.toast.sucesso('Reserva cancelada', `${rotulo} foi liberada.`);
          this.buscar();
        },
        error: (erro: unknown) => {
          this.cancelamentoEmAndamento.set(null);
          this.cancelamentoSolicitado.set(null);
          this.toast.erro('Não foi possível cancelar', this.mensagemDeErro(erro));
        },
      });
  }

  ehCancelada(status: StatusReserva): boolean {
    return status === 'CANCELADA';
  }

  ehPendente(status: StatusReserva): boolean {
    return status !== 'CONFIRMADA' && !this.ehCancelada(status);
  }

  private ehFutura(reserva: Reserva): boolean {
    return reserva.data >= this.calendario.hoje();
  }

  private mensagemDeErro(erro: unknown): string {
    if (erro && typeof erro === 'object' && 'status' in erro) {
      const response = erro as { status: number; error?: { detail?: string } };
      if (response.status === 401) {
        return 'Sua sessão expirou. Faça login novamente.';
      }
      if (response.status === 403) {
        return 'Acesso negado.';
      }
      if (response.status === 404) {
        return 'Reserva não encontrada.';
      }
      if (response.status === 409) {
        return response.error?.detail ?? 'A reserva já está cancelada ou não pode ser cancelada.';
      }
      if (response.error?.detail) {
        return response.error.detail;
      }
    }
    return 'Ocorreu um erro inesperado. Tente novamente.';
  }
}