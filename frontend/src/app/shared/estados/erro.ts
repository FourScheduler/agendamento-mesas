import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-erro',
  standalone: true,
  template: `
    <div class="erro" role="alert">
      <span class="erro__icone" aria-hidden="true">!</span>
      <div class="erro__conteudo">
        <p class="erro__titulo">{{ titulo() }}</p>
        <p class="erro__mensagem">{{ mensagem() }}</p>
      </div>
      <button type="button" class="botao botao--contorno" (click)="aoTentar()">
        Tentar novamente
      </button>
    </div>
  `,
  styles: [`
    .erro {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem 1.5rem;
      border: 1px solid #fecaca;
      border-radius: 10px;
      background: #fef2f2;
    }

    .erro__icone {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #fee2e2;
      color: #dc2626;
      font-weight: 700;
    }

    .erro__conteudo {
      flex: 1;
    }

    .erro__titulo {
      color: var(--navy);
      font-size: 0.9375rem;
      font-weight: 700;
    }

    .erro__mensagem {
      color: var(--muted);
      font-size: 0.875rem;
    }

    @media (max-width: 640px) {
      .erro {
        flex-wrap: wrap;
      }
    }
  `],
})
export class Erro {
  readonly titulo = input('Não foi possível carregar suas reservas');
  readonly mensagem = input('Verifique sua conexão e tente novamente.');

  readonly tentarNovamente = output<void>();

  aoTentar(): void {
    this.tentarNovamente.emit();
  }
}