import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { CalendarioSaoPaulo } from './calendario-sao-paulo';
import { LoggerService } from '../../core/logging/logger.service';
import { Reserva } from '../agendamento/reserva';
import { ReservaService } from '../agendamento/reserva.service';
import { Mesa } from '../mesas/mesa';
import { ToastService } from '../../shared/toast/toast';
import { adicionarDias, formatarData, proximoDiaUtil, validarDataReserva } from './data-reserva';
import { EMPTY, TimeoutError, catchError, finalize, timeout } from 'rxjs';

interface TentativaReserva {
  chave: string;
  autorId: number;
  mesaId: number;
  data: string;
  solicitanteId: number | null;
}

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
  private readonly logger = inject(LoggerService);
  private aposConfirmar?: () => void;

  readonly dataMinima = this.calendario.hoje;
  readonly dataMaxima = computed(() => adicionarDias(this.dataMinima(), 15));
  readonly tentativaPendente = signal<TentativaReserva | null>(this.lerTentativa());
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
  readonly ultimaConfirmada = signal<Reserva | null>(null);
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
    effect(() => {
      const erro = this.erro();
      if (erro) this.toast.erro('Não foi possível concluir', erro);
    });
  }

  fecharMensagem() {
    this.erro.set('');
    this.sucesso.set('');
  }

  alterarData(data: string) {
    if (this.confirmando() || this.cancelando()) return;
    this.calendario.atualizar();
    if (data === this.data()) return;
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
    if (this.confirmando() || this.cancelando() || !mesa || !sessao || !this.disponibilidadeAtual()) return;
    const pendente = this.tentativaPendente();
    if (pendente) {
      this.toast.aviso('Existe uma confirmação pendente', 'Verifique o resultado ou repita a tentativa com a mesma chave.');
      return;
    }
    const tentativa: TentativaReserva = {
      chave: crypto.randomUUID(), autorId: sessao.usuario.id, mesaId: mesa.id, data: this.data(), solicitanteId,
    };
    this.aposConfirmar = aposConfirmar;
    this.salvarTentativa(tentativa);
    this.executarTentativa(tentativa);
  }

  repetirConfirmacao() {
    const tentativa = this.tentativaPendente();
    if (tentativa && !this.confirmando() && !this.cancelando()) this.executarTentativa(tentativa);
  }

  verificarConfirmacao() {
    const tentativa = this.tentativaPendente();
    const sessao = this.auth.sessao();
    if (!tentativa || !sessao || tentativa.autorId !== sessao.usuario.id || this.confirmando() || this.cancelando()) return;
    this.confirmando.set(true);
    this.reservas.consultarConfirmacao(tentativa.chave).pipe(
      timeout(10000),
      finalize(() => this.confirmando.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: reserva => {
        if (this.auth.sessao()?.token === sessao.token) this.concluirConfirmacao(reserva);
      },
      error: () => {
        if (this.auth.sessao()?.token === sessao.token) this.informarConfirmacaoIncerta();
      },
    });
  }

  private executarTentativa(tentativa: TentativaReserva) {
    const sessao = this.auth.sessao();
    if (!sessao || tentativa.autorId !== sessao.usuario.id) return;
    this.confirmando.set(true);
    this.erro.set('');
    this.sucesso.set('');
    this.logger.info('reserva.confirmacao.inicio', { correlationId: tentativa.chave });
    this.reservas.criar(tentativa.mesaId, tentativa.data, tentativa.solicitanteId ?? undefined, tentativa.chave).pipe(
      timeout(15000),
      catchError((erro: unknown) => {
        if (this.auth.sessao()?.token !== sessao.token) return EMPTY;
        if (erro instanceof TimeoutError || erro instanceof HttpErrorResponse && (erro.status === 0 || erro.status >= 500)) {
          this.logger.warn('reserva.confirmacao.incerta', { correlationId: tentativa.chave });
          return this.reservas.consultarConfirmacao(tentativa.chave).pipe(
            timeout(10000),
            catchError(() => {
              this.informarConfirmacaoIncerta();
              return EMPTY;
            }),
          );
        }
        this.salvarTentativa(null);
        this.aposConfirmar = undefined;
        if (erro instanceof HttpErrorResponse) {
          const detalhe = typeof erro.error?.detail === 'string' ? erro.error.detail : '';
          this.sincronizarContexto(null);
          if (erro.status === 409) {
            if (erro.error?.code === 'USUARIO_COM_RESERVA_NA_DATA') {
              const codigo = erro.error?.mesa?.codigo;
              this.toast.erro(typeof codigo === 'string' && codigo.trim()
                ? `Você já tem uma reserva para a mesa ${codigo.trim()}.`
                : detalhe || 'O solicitante já possui uma reserva nessa data.');
            } else if (erro.error?.code === 'USUARIO_COM_MESA_FIXA') {
              this.toast.erro('Reserva não permitida', detalhe || 'Existe uma mesa fixa vinculada ao beneficiário.');
            } else {
              this.toast.erro(detalhe || 'Não foi possível reservar esta mesa.');
            }
          } else {
            this.erro.set(erro.status === 400 ? (detalhe || 'Verifique a data e a mesa selecionadas.')
              : 'Não foi possível confirmar a reserva. Atualize a disponibilidade antes de tentar novamente.');
          }
        } else {
          this.erro.set('Não foi possível confirmar a reserva.');
          this.logger.error('reserva.confirmacao.falha');
        }
        this.iniciarConsulta();
        this.atualizacao.update(valor => valor + 1);
        return EMPTY;
      }),
      finalize(() => this.confirmando.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(reserva => {
      if (this.auth.sessao()?.token === sessao.token) this.concluirConfirmacao(reserva);
    });
  }

  private concluirConfirmacao(reserva: Reserva) {
    const chave = this.tentativaPendente()?.chave;
    this.salvarTentativa(null);
    this.ultimaConfirmada.set(reserva.status === 'CONFIRMADA' ? reserva : null);
    this.logger.info('reserva.confirmacao.reconciliada', { correlationId: chave });
    const aposConfirmar = this.aposConfirmar;
    this.aposConfirmar = undefined;
    aposConfirmar?.();
    if (reserva.status === 'CANCELADA') this.toast.aviso('Reserva já cancelada', 'A tentativa foi localizada, mas a reserva não está mais ativa.');
    else this.toast.sucesso('Reserva Confirmada', `Reserva para ${formatarData(reserva.data)}.`);
    this.calendario.atualizar();
    this.data.set(reserva.data);
    this.iniciarConsulta();
    this.sincronizarContexto(null);
    this.atualizacao.update(valor => valor + 1);
  }

  private informarConfirmacaoIncerta() {
    this.logger.warn('reserva.confirmacao.verificacao-pendente');
    this.toast.aviso('Confirmação ainda não verificada', 'A resposta pode ter se perdido após a gravação. Verifique o resultado ou repita com segurança.');
  }

  private salvarTentativa(tentativa: TentativaReserva | null) {
    this.tentativaPendente.set(tentativa);
    const id = this.auth.usuario()?.id;
    if (!id) return;
    try {
      if (tentativa) sessionStorage.setItem(`confirmacao-reserva-${id}`, JSON.stringify(tentativa));
      else sessionStorage.removeItem(`confirmacao-reserva-${id}`);
    } catch {
      this.logger.warn('reserva.confirmacao.armazenamento-indisponivel');
    }
  }

  private lerTentativa(): TentativaReserva | null {
    const id = this.auth.usuario()?.id;
    if (!id) return null;
    try {
      const texto = sessionStorage.getItem(`confirmacao-reserva-${id}`);
      if (!texto) return null;
      const valor: unknown = JSON.parse(texto);
      if (valor && typeof valor === 'object' && 'chave' in valor && typeof valor.chave === 'string'
        && /^[a-f0-9-]{36}$/i.test(valor.chave) && 'autorId' in valor && valor.autorId === id
        && 'mesaId' in valor && typeof valor.mesaId === 'number' && Number.isSafeInteger(valor.mesaId) && valor.mesaId > 0
        && 'data' in valor && typeof valor.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor.data)
        && 'solicitanteId' in valor && (valor.solicitanteId === null
          || typeof valor.solicitanteId === 'number' && Number.isSafeInteger(valor.solicitanteId) && valor.solicitanteId > 0)) {
        return { chave: valor.chave, autorId: id, mesaId: valor.mesaId, data: valor.data, solicitanteId: valor.solicitanteId };
      }
      sessionStorage.removeItem(`confirmacao-reserva-${id}`);
      this.logger.warn('reserva.confirmacao.armazenamento-invalido');
    } catch {
      this.logger.warn('reserva.confirmacao.leitura-indisponivel');
    }
    return null;
  }

  /** Cancela uma reserva pelo ID. */
  cancelarReserva(reservaId: number, mesaId: number, aposCancelar?: () => void) {
    const token = this.auth.token();
    if (!token || this.cancelando() || this.confirmando()) return;
    this.cancelando.set(true);
    this.erro.set('');
    this.sucesso.set('');
    this.logger.info('reserva.cancelamento.inicio', { reservaId, mesaId });
    this.reservas.cancelar(reservaId)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.cancelando.set(false);
          if (this.auth.token() !== token) return;
          aposCancelar?.();
          this.toast.sucesso('Reserva cancelada');
          this.atualizarDisponibilidade();
        },
        error: (erro: HttpErrorResponse) => {
          this.cancelando.set(false);
          if (this.auth.token() !== token) return;
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
    return this.tentativaPendente()?.data
      ?? this.route.snapshot.queryParamMap.get('data')
      ?? proximoDiaUtil(this.dataMinima());
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
