import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-vazio',
  standalone: true,
  template: `
    <div class="vazio">
      <span class="vazio__icone" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="34" height="34">
          <rect
            x="2"
            y="5"
            width="28"
            height="25"
            rx="4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          />
          <path d="M2 13h28" fill="none" stroke="currentColor" stroke-width="2" />
          <path
            d="M10 1v7M22 1v7"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </span>
      <p class="vazio__titulo">{{ titulo() }}</p>
      @if (mensagem()) {
        <p class="vazio__mensagem">{{ mensagem() }}</p>
      }
      @if (acao(); as rotulo) {
        <button type="button" class="botao" (click)="aoClicar()">{{ rotulo }}</button>
      }
    </div>
  `,
  styles: [`
    .vazio {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 3rem 1.5rem;
      text-align: center;
    }

    .vazio__icone {
      color: var(--muted-soft);
    }

    .vazio__titulo {
      color: var(--navy);
      font-size: 1.125rem;
      font-weight: 700;
    }

    .vazio__mensagem {
      max-width: 34rem;
      color: var(--muted);
      font-size: 0.9375rem;
    }

    .vazio .botao {
      margin-top: 0.75rem;
    }
  `],
})
export class Vazio {
  readonly titulo = input('Nenhuma reserva encontrada');
  readonly mensagem = input('As suas reservas aparecerão aqui assim que forem criadas.');
  readonly acao = input<string | null>(null);

  readonly acaoClicada = output<void>();

  aoClicar(): void {
    this.acaoClicada.emit();
  }
}