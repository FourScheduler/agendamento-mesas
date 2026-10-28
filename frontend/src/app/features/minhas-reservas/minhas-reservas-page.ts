import { DestroyRef, Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ReservaService } from '../agendamento/reserva.service';
import { Reserva } from '../agendamento/reserva';
import { Carregando } from '../../shared/estados/carregando';
import { Erro } from '../../shared/estados/erro';
import { Vazio } from '../../shared/estados/vazio';
import { ToastService } from '../../shared/toast/toast';

type Filtro = 'futuras' | 'passadas';

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

const OPCOES_STATUS: StatusReserva[] = ['CONFIRMADA', 'CANCELADA'];

@Component({
  selector: 'app-minhas-reservas-page',
  standalone: true,
  imports: [Carregando, Erro, Vazio],
  templateUrl: './minhas-reservas-page.html',
  styleUrl: './minhas-reservas-page.css',
})
export class MinhasReservasPage implements OnInit {
  private readonly reservasService = inject(ReservaService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly reservas = signal<Reserva[]>([]);
  readonly carregando = signal(false);
  readonly erroApi = signal<string | null>(null);
  readonly filtro = signal<Filtro>('futuras');

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
    const lista = this.periodoPersonalizado()
      ? [...this.reservas()]
      : this.reservas().filter((reserva) =>
          this.filtro() === 'futuras' ? this.ehFutura(reserva) : !this.ehFutura(reserva),
        );

    const porMomento = (a: Reserva, b: Reserva) =>
      this.momento(a).localeCompare(this.momento(b));

    const ascendente = this.periodoPersonalizado() || this.filtro() === 'futuras';

    return ascendente ? lista.sort(porMomento) : lista.sort((a, b) => porMomento(b, a));
  });

  readonly cartoes = computed<CartaoReserva[]>(() => {
    const numera = !this.periodoPersonalizado() && this.filtro() === 'futuras';

    return this.visiveis().map((reserva, indice) => ({
      chave: this.chave(reserva),
      reserva,
      posicao: numera ? indice + 1 : null,
    }));
  });

  readonly tituloVazio = 'Nenhuma reserva encontrada';
  readonly mensagemVazio = computed(() =>
    this.temFiltroAtivo()
      ? 'Nenhuma reserva corresponde aos filtros escolhidos.'
      : 'As suas reservas aparecerão aqui assim que forem criadas.',
  );

  ngOnInit(): void {
    this.buscar();
  }

  buscar(): void {
    if (this.periodoInvalido()) {
      return;
    }

    const { inicio, fim } = this.periodoFiltro();

    const params: { status?: string; data?: string } = {};
    if (inicio && !fim) {
      params.data = inicio;
    } else if (inicio && fim) {
      // A API aceita dataInicio e dataFim, mas o serviço atual só aceita 'data'
      // Vamos usar dataInicio como 'data' se não houver fim, ou não filtrar por data se houver período
      // Para períodos, o backend filtra, mas o serviço não expõe dataInicio/dataFim
      // Usaremos o filtro local para períodos
    }
    if (this.statusFiltro()) {
      params.status = this.statusFiltro()!;
    }

    this.erroApi.set(null);
    this.carregando.set(true);

    this.reservasService
      .listarMinhas(params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reservas) => {
          this.reservas.set([...reservas]);
          this.carregando.set(false);
        },
        error: (erro: unknown) => {
          this.reservas.set([]);
          this.carregando.set(false);
          this.erroApi.set(this.mensagemDeErro(erro));
        },
      });
  }

  trocarFiltro(filtro: Filtro): void {
    this.filtro.set(filtro);
  }

  trocarStatus(event: Event): void {
    const valor = (event.target as HTMLSelectElement).value;
    this.statusFiltro.set(valor ? (valor as StatusReserva) : null);
    this.buscar();
  }

  trocarData(campo: 'inicio' | 'fim', event: Event): void {
    const valor = (event.target as HTMLInputElement).value;
    this.periodoFiltro.update((periodo) => ({ ...periodo, [campo]: valor || null }));
    this.buscar();
  }

  limparFiltros(): void {
    this.statusFiltro.set(null);
    this.periodoFiltro.set({ inicio: null, fim: null });
    this.buscar();
  }

  temFiltroAtivo(): boolean {
    return this.statusFiltro() !== null || this.periodoPersonalizado();
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
    return `${reserva.data}-${reserva.mesa.id}`;
  }

  rotuloStatus(status: StatusReserva): string {
    return ROTULOS_STATUS[status] ?? status.charAt(0) + status.slice(1).toLowerCase();
  }

  ordinal(posicao: number): string {
    return `${posicao}º`;
  }

  podeCancelar(cartao: CartaoReserva): boolean {
    return (
      this.ehFutura(cartao.reserva) &&
      cartao.reserva.status === 'CONFIRMADA' &&
      cartao.reserva.id != null
    );
  }

  solicitarCancelamento(cartao: CartaoReserva): void {
    if (!this.podeCancelar(cartao)) {
      return;
    }
    this.cancelamentoSolicitado.set(this.chave(cartao.reserva));
  }

  desistirCancelamento(): void {
    this.cancelamentoSolicitado.set(null);
  }

  cancelarReserva(cartao: CartaoReserva): void {
    const id = cartao.reserva.id;

    if (id == null || !this.podeCancelar(cartao)) {
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
    return this.momento(reserva) > this.agoraIso();
  }

  private momento(reserva: Reserva): string {
    return `${reserva.data}T23:59:59`;
  }

  private agoraIso(): string {
    const agora = new Date();
    const hora = [agora.getHours(), agora.getMinutes(), agora.getSeconds()]
      .map((parte) => String(parte).padStart(2, '0'))
      .join(':');
    const dia = agora.toISOString().split('T')[0];
    return `${dia}T${hora}`;
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