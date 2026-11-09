import { Component, inject } from '@angular/core';
import { ReservaDiaria } from './reserva-diaria';

@Component({
  selector: 'app-confirmacao-pendente',
  template: `
    @if (reserva.tentativaPendente()) {
      <section class="confirmacao-pendente" aria-label="Resultado da confirmação" role="status">
        <span>{{ reserva.confirmando() ? 'Aguardando confirmação do servidor…' : 'Uma confirmação precisa ser verificada.' }}</span>
        <button type="button" class="botao botao--contorno" (click)="reserva.verificarConfirmacao()"
          [disabled]="reserva.confirmando() || reserva.cancelando()">Verificar confirmação</button>
        <button type="button" class="botao" (click)="reserva.repetirConfirmacao()"
          [disabled]="reserva.confirmando() || reserva.cancelando()">Repetir com segurança</button>
      </section>
    }
  `,
})
export class ConfirmacaoPendente {
  readonly reserva = inject(ReservaDiaria);
}
