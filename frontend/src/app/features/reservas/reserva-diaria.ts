import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ReservaService } from '../agendamento/reserva.service';
import { Mesa } from '../mesas/mesa';
import { adicionarDias, formatarData, hojeSaoPaulo, proximoDiaUtil, validarDataReserva } from './data-reserva';

/** Estado por página, compartilhando as regras de confirmação entre lista e planta. */
@Injectable()
export class ReservaDiaria {
  private readonly auth = inject(AuthService);
  private readonly reservas = inject(ReservaService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);

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
    if (!this.confirmando() && this.disponibilidadeAtual()) this.selecionada.set(mesa);
  }

  confirmar() {
    const mesa = this.selecionada();
    const sessao = this.auth.sessao();
    if (this.confirmando() || !mesa || !sessao || !this.disponibilidadeAtual()) return;
    this.confirmando.set(true);
    this.erro.set('');
    this.sucesso.set('');
    this.reservas.criar(sessao.token, mesa.id, this.data())
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: reserva => {
          this.confirmando.set(false);
          if (this.auth.sessao()?.token !== sessao.token) return;
          this.sucesso.set(`Reserva #${reserva.id} confirmada: mesa ${reserva.mesa.codigo}, dia ${formatarData(reserva.data)}, para ${reserva.solicitante.nome}.`);
          this.atualizarDisponibilidade();
        },
        error: (erro: HttpErrorResponse) => {
          this.confirmando.set(false);
          if (this.auth.sessao()?.token !== sessao.token) return;
          if (erro.status === 401) {
            this.auth.logout(true);
            return;
          }
          const detalhe = typeof erro.error?.detail === 'string' ? erro.error.detail : '';
          this.erro.set(erro.status === 409
            ? (detalhe || 'A mesa ou o seu dia já possui uma reserva. Revise a disponibilidade e selecione novamente.')
            : erro.status === 400 ? (detalhe || 'Verifique a data e a mesa selecionadas.')
            : 'Não foi possível confirmar a reserva. Atualize a disponibilidade antes de tentar novamente.');
          this.atualizarDisponibilidade();
        },
      });
  }

  private dataInicial(): string {
    return this.route.snapshot.queryParamMap.get('data') ?? proximoDiaUtil(this.dataMinima);
  }
}
