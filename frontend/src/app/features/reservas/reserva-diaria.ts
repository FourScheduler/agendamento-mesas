import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ReservaService } from '../agendamento/reserva.service';
import { Mesa } from '../mesas/mesa';
import { ToastService } from '../../shared/toast/toast';
import { adicionarDias, formatarData, hojeSaoPaulo, proximoDiaUtil, validarDataReserva } from './data-reserva';

/** Estado por página, compartilhando as regras de confirmação entre lista e planta. */
@Injectable()
export class ReservaDiaria {
  private readonly auth = inject(AuthService);
  private readonly reservas = inject(ReservaService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly dataMinima = hojeSaoPaulo();
  readonly dataMaxima = adicionarDias(this.dataMinima, 15);
  readonly data = signal(this.dataInicial());
  readonly erroData = computed(() => validarDataReserva(this.data(), this.dataMinima));
  private readonly dataConsultada = signal<string | null>(null);
  readonly disponibilidadeAtual = computed(() => !this.erroData() && this.dataConsultada() === this.data());
  readonly selecionada = signal<Mesa | null>(null);
  readonly confirmando = signal(false);
  readonly erro = signal('');
  readonly sucesso = signal('');
  readonly atualizacao = signal(0);

  fecharMensagem() {
    this.erro.set('');
    this.sucesso.set('');
  }

  alterarData(data: string) {
    if (this.confirmando()) return;
    this.data.set(data ?? '');
    this.iniciarConsulta();
    this.erro.set('');
    this.sucesso.set('');
    this.sincronizarContexto(null);
  }

  atualizarDisponibilidade() {
    if (this.confirmando()) return;
    this.iniciarConsulta();
    this.atualizacao.update(valor => valor + 1);
  }

  iniciarConsulta() {
    this.selecionada.set(null);
    this.dataConsultada.set(null);
  }

  registrarDisponibilidade(data: string) {
    if (data === this.data() && !this.erroData()) this.dataConsultada.set(data);
  }

  selecionar(mesa: Mesa) {
    if (!this.confirmando() && this.disponibilidadeAtual()) {
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
    if (this.confirmando()) return;
    this.selecionada.set(null);
    this.sincronizarContexto(null);
  }

  confirmar() {
    this.confirmarComSolicitante(null);
  }

  confirmarComSolicitante(solicitanteId: number | null) {
    const mesa = this.selecionada();
    const sessao = this.auth.sessao();
    if (this.confirmando() || !mesa || !sessao || !this.disponibilidadeAtual()) return;
    this.confirmando.set(true);
    this.erro.set('');
    this.sucesso.set('');
    this.reservas.criar(mesa.id, this.data(), solicitanteId ?? undefined)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: reserva => {
          this.confirmando.set(false);
          if (this.auth.sessao()?.token !== sessao.token) return;
          this.toast.sucesso('Reserva Confirmada');
          this.data.set(this.dataMinima);
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
            this.toast.erro('Você já possui uma reserva nessa data.');
          } else {
            this.erro.set(erro.status === 409
              ? (detalhe || 'A mesa ou o seu dia já possui uma reserva. Revise a disponibilidade e selecione novamente.')
              : erro.status === 400 ? (detalhe || 'Verifique a data e a mesa selecionadas.')
              : 'Não foi possível confirmar a reserva. Atualize a disponibilidade antes de tentar novamente.');
          }
          this.atualizarDisponibilidade();
        },
      });
  }

  private dataInicial(): string {
    return this.route.snapshot.queryParamMap.get('data') ?? proximoDiaUtil(this.dataMinima);
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
