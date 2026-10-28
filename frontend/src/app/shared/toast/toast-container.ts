import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from './toast';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container" [class.pausado]="pausar()">
      @for (toast of toasts(); track toast.id) {
        <div class="toast" [class]="toast.tipo" role="alert" aria-live="polite"
             (mouseenter)="pausar.set(true)" (mouseleave)="pausar.set(false)">
          <svg class="toast__icone" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path [attr.d]="icone(toast.tipo)" />
          </svg>
          <div class="toast__conteudo">
            <p class="toast__titulo">{{ toast.titulo }}</p>
            @if (toast.mensagem) {
              <p class="toast__mensagem">{{ toast.mensagem }}</p>
            }
          </div>
          <button class="toast__fechar" type="button" (click)="remover(toast.id)" aria-label="Fechar notificação">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 6rem;
      right: 1.5rem;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      max-width: 22rem;
      pointer-events: none;
    }

    .toast-container.pausado .toast {
      animation-play-state: paused;
    }

    .toast {
      pointer-events: auto;
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      border-radius: 10px;
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      animation: toast-entrar 0.3s ease-out;
      color: var(--navy);
    }

    @keyframes toast-entrar {
      from { opacity: 0; transform: translateX(100%); }
      to { opacity: 1; transform: translateX(0); }
    }

    .toast.sucesso {
      background: #07bc0c;
      color: #ffffff;
    }

    .toast.erro {
      background: #dc2626;
      color: #ffffff;
    }

    .toast.aviso {
      border-left: 4px solid #f59e0b;
    }

    .toast.info {
      border-left: 4px solid #3b82f6;
    }

    .toast__icone {
      flex: none;
      margin-top: 0.125rem;
    }

    .toast.sucesso .toast__icone,
    .toast.erro .toast__icone { color: currentColor; }
    .toast.aviso .toast__icone { color: #f59e0b; }
    .toast.info .toast__icone { color: #3b82f6; }

    .toast__conteudo {
      flex: 1;
      min-width: 0;
    }

    .toast__titulo {
      margin: 0 0 0.25rem;
      color: inherit;
      font-size: 0.875rem;
      font-weight: 700;
      line-height: 1.3;
    }

    .toast__mensagem {
      margin: 0;
      color: inherit;
      opacity: 0.9;
      font-size: 0.8125rem;
      line-height: 1.4;
    }

    .toast__fechar {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      color: currentColor;
      opacity: 0.8;
      cursor: pointer;
      border-radius: 4px;
    }

    .toast__fechar:hover {
      opacity: 1;
      background: rgba(0, 0, 0, 0.1);
    }

    @media (max-width: 640px) {
      .toast-container {
        left: 1rem;
        right: 1rem;
        max-width: none;
        top: auto;
        bottom: 1rem;
      }
    }
  `],
})
export class ToastContainer {
  private readonly toastService = inject(ToastService);

  readonly toasts = computed(() => this.toastService.toasts());
  readonly pausar = signal(false);

  remover(id: number): void {
    this.toastService.remover(id);
  }

  icone(tipo: Toast['tipo']): string {
    switch (tipo) {
      case 'sucesso':
        return 'M10 16.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM6.5 10l2.5 2.5 4-4';
      case 'erro':
        return 'M10 16.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM10 5.5v5M10 13.5v.5';
      case 'aviso':
        return 'M10 3.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM10 6v4M10 12.5v.5';
      default:
        return 'M10 16.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM10 5.5v5M10 13.5v.5';
    }
  }
}