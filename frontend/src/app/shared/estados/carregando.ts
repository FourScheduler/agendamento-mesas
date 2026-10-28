import { Component, input } from '@angular/core';

@Component({
  selector: 'app-carregando',
  standalone: true,
  template: `
    <p class="carregando" role="status" aria-live="polite">
      <span class="carregando__ponto" aria-hidden="true"></span>
      {{ texto() }}
    </p>
  `,
  styles: [`
    .carregando {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      margin: 0;
      padding: 2.5rem 0;
      color: var(--muted);
      font-size: 0.9375rem;
      justify-content: center;
    }

    .carregando__ponto {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--orange);
      animation: carregando-pulso 1s ease-in-out infinite;
    }

    @keyframes carregando-pulso {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 1; }
    }
  `],
})
export class Carregando {
  readonly texto = input('Buscando suas reservas...');
}