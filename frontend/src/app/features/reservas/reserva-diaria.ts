import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ReservaService } from '../agendamento/reserva.service';
import { Mesa } from '../mesas/mesa';
import { ToastService } from '../../shared/toast/toast';
import { adicionarDias, proximoDiaUtil, validarDataReserva } from './data-reserva';
import { CalendarioSaoPaulo } from './calendario-sao-paulo';

/** Estado por página, compartilhando as regras de confirmação entre lista e planta. */
@Injectable()
export class ReservaDiaria {
  private readonly auth = inject(AuthService);
  private readonly reservas = inject(ReservaService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly calendario = inject(CalendarioSaoPaulo);

  readonly dataMinima = this.calendario.hoje;
  readonly dataMaxima = computed(() => adicionarDias(this.dataMinima(), 15));
  readonly data = signal(this.dataInicial());
  readonly erroData = computed(() => validarDataReserva(this.data(), this.dataMinima()));
  private readonly dataConsultada = signal<{ data: string; hoje: string } | null>(null);
  readonly disponibilidadeAtual = computed(() => !this.erroData()
    && this.dataConsultada()?.data === this.data()
    && this.dataConsultada()?.hoje === this.dataMinima());
  readonly selecionada = signal<Mesa | null>(null);
  readonly confirmando = signal(false);
  readonly cancelando = signal(false);
  readonly erro = signal('');
  readonly sucesso = signal('');
  readonly atualizacao = signal(0);
  private readonly reservaParaCancelar = signal<{ id: number; mesaId: number } | null>(null);

  constructor() {
    this.calendario.atualizar();
    effect(() => {
      this.dataMinima();
      untracked(() => {
        this.iniciarConsulta();
        this.atualizacao.update(valor => valor + 1);
      });
    });
  }

  fecharMensagem() {
    this.erro.set('');
    this.sucesso.set('');
  }

  alterarData(data: string) {
    if (this.confirmando() || this.cancelando()) return;
    this.calendario.atualizar();
    this.data.set(data ?? '');
    this.iniciarConsulta();
    this.erro.set('');
    this.sucesso.set('');
    this.sincronizarContexto(null);
  }

  atualizarDisponibilidade() {
    if (this.confirmando() || this.cancelando()) return;
    this.calendario.atualizar();
    this.iniciarConsulta();
    this.atualizacao.update(valor => valor + 1);
  }

  iniciarConsulta() {
    this.selecionada.set(null);
    this.dataConsultada.set(null);
  }

  registrarDisponibilidade(data: string) {
    this.calendario.atualizar();
    if (data === this.data() && !this.erroData()) {
      this.dataConsultada.set({ data, hoje: this.dataMinima() });
    }
  }

  selecionar(mesa: Mesa) {
    this.calendario.atualizar();
    if (!this.confirmando() && !this.cancelando() && this.disponibilidadeAtual()) {
      this.selecionada.set(mesa);
      this.sincronizarContexto(mesa.id);
    }
  }

  restaurarSelecao(mesasDisponiveis: readonly Mesa[]) {
    const mesaId = Number(this.route.snapshot.queryParamMap.get('mesaId'));
    if (!Number.isSafeInteger(mesaId) || mesaId <= 0) return;
    const mesa = mesasDisponiveis.find(item => item.id === mesaId);
    if (mesa && this.disponibilidadeAtual()) this.selecionada.set(mesa);
    else this.sincronizarContexto(null);
  }

  limparSelecao() {
    if (this.confirmando() || this.cancelando()) return;
    this.selecionada.set(null);
    this.sincronizarContexto(null);
  }

  confirmar() {
    this.confirmarComSolicitante(null);
  }

  confirmarComSolicitante(solicitanteId: number | null, aposConfirmar?: () => void) {
    if (this.confirmando()) return;
    this.calendario.atualizar();
    if (this.erroData()) {
      this.iniciarConsulta();
      return;
    }

    const mesa = this.selecionada();
    const sessao = this.auth.sessao();
    if (!mesa || !sessao || !this.disponibilidadeAtual()) return;
    this.confirmando.set(true);
    this.erro.set('');
    this.sucesso.set('');
    this.reservas.criar(mesa.id, this.data(), solicitanteId ?? undefined)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.confirmando.set(false);
          if (this.auth.sessao()?.token !== sessao.token) return;
          aposConfirmar?.();
          this.toast.sucesso('Reserva Confirmada');
          this.calendario.atualizar();
          this.data.set(proximoDiaUtil(this.dataMinima()));
          this.iniciarConsulta();
          this.sincronizarContexto(null);
          this.atualizarDisponibilidade();
        },
        error: (erro: HttpErrorResponse) => {
          this.confirmando.set(false);
          if (this.auth.sessao()?.token !== sessao.token) return;
          const detalhe = typeof erro.error?.detail === 'string' ? erro.error.detail : '';
          this.sincronizarContexto(null);
          if (erro.status === 409) {
            if (erro.error?.code === 'USUARIO_COM_RESERVA_NA_DATA') {
              const codigo = erro.error?.mesa?.codigo;
              this.toast.erro(typeof codigo === 'string' && codigo.trim()
                ? `Você já tem uma reserva para a mesa ${codigo.trim()}.`
                : detalhe || 'O solicitante já possui uma reserva nessa data.');
            } else if (erro.error?.code === 'USUARIO_COM_MESA_FIXA') {
              const codigo = erro.error?.mesa?.codigo;
              this.toast.erro('Reserva não permitida', typeof codigo === 'string' && codigo.trim()
                ? `Você já possui a mesa ${codigo.trim()} vinculada ao seu nome. Entre em contato com o administrador`
                : detalhe || 'Existe uma mesa fixa vinculada ao beneficiário.');
            } else {
              this.toast.erro(detalhe || 'Não foi possível reservar esta mesa.');
            }
          } else {
            this.erro.set(erro.status === 400 ? (detalhe || 'Verifique a data e a mesa selecionadas.')
              : 'Não foi possível confirmar a reserva. Atualize a disponibilidade antes de tentar novamente.');
          }
          this.atualizarDisponibilidade();
        },
      });
  }

  /** Cancela uma reserva pelo ID. */
  cancelarReserva(reservaId: number, mesaId: number, aposCancelar?: () => void) {
    if (this.cancelando() || this.confirmando()) return;
    this.cancelando.set(true);
    this.erro.set('');
    this.sucesso.set('');
    this.reservaParaCancelar.set({ id: reservaId, mesaId });
    this.reservas.cancelar(reservaId)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.cancelando.set(false);
          this.reservaParaCancelar.set(null);
          aposCancelar?.();
          this.toast.cancelamento('Reserva cancelada');
          this.atualizarDisponibilidade();
        },
        error: (erro: HttpErrorResponse) => {
          this.cancelando.set(false);
          this.reservaParaCancelar.set(null);
          const detalhe = typeof erro.error?.detail === 'string' ? erro.error.detail : '';
          if (erro.status === 409) {
            this.erro.set(detalhe || 'A reserva já está cancelada.');
          } else if (erro.status === 403) {
            this.erro.set('Você não tem permissão para cancelar esta reserva.');
          } else if (erro.status === 404) {
            this.erro.set('Reserva não encontrada.');
          } else {
            this.erro.set(detalhe || 'Não foi possível cancelar a reserva. Tente novamente.');
          }
          this.atualizarDisponibilidade();
        },
      });
  }

  /** Busca o ID da reserva para uma mesa e data (para o usuário atual ou admin). */
  buscarReservaId(mesaId: number, data: string) {
    return this.reservas.buscarReservaPorMesaEData(mesaId, data);
  }

  private dataInicial(): string {
    this.calendario.atualizar();
    return this.route.snapshot.queryParamMap.get('data') ?? proximoDiaUtil(this.dataMinima());
  }

  private sincronizarContexto(mesaId: number | null) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { data: this.data(), mesaId: mesaId ? String(mesaId) : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
