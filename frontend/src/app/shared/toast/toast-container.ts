import { Component, computed, inject } from '@angular/core';
import { ToastService, ToastTipo } from './toast';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  template: `
    <div class="toast-container" aria-label="Notificações">
      @for (toast of toasts(); track toast.id) {
        <div class="toast" [class]="'toast toast--' + toast.tipo"
          [attr.role]="toast.tipo === 'erro' ? 'alert' : 'status'" tabindex="0"
          (click)="fixar(toast.id)" (keydown.enter)="fixar(toast.id)"
          (keydown.space)="$event.preventDefault(); fixar(toast.id)"
          (mouseenter)="pausar(toast.id, 'mouse', true)" (mouseleave)="pausar(toast.id, 'mouse', false)"
          (focusin)="pausar(toast.id, 'foco', true)" (focusout)="sairFoco(toast.id, $event)">
          <svg class="toast__icone" viewBox="0 0 24 24" width="20" height="20" fill="none"
            stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path [attr.d]="icone(toast.tipo)" />
          </svg>
          <div class="toast__conteudo">
            <p class="toast__titulo">{{ toast.titulo }}</p>
            @if (toast.mensagem) { <p class="toast__mensagem">{{ toast.mensagem }}</p> }
            @if (toast.fixado) { <span class="toast__fixado">Mantida aberta</span> }
          </div>
          <button class="toast__fechar" type="button" (click)="$event.stopPropagation(); remover(toast.id)"
            (keydown)="$event.stopPropagation()" aria-label="Fechar notificação">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
              stroke-width="2" aria-hidden="true">
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
      top: var(--notificacao-topo);
      right: var(--notificacao-margem);
      z-index: 2000;
      display: flex;
      flex-direction: column;
      gap: .75rem;
      width: min(var(--notificacao-largura), calc(100vw - 2 * var(--notificacao-margem)));
      max-height: min(40dvh, calc(100dvh - var(--notificacao-topo) - 1rem));
      overflow-y: auto;
      pointer-events: none;
    }

    .toast {
      pointer-events: auto;
      display: flex;
      align-items: flex-start;
      gap: .75rem;
      padding: 1rem;
      border-radius: 8px;
      flex-shrink: 0;
      background: #fff;
      box-shadow: 0 4px 12px rgba(0, 0, 0, .1);
      animation: toast-entrar .3s ease-out;
      color: var(--navy);
      cursor: pointer;
    }

    @keyframes toast-entrar {
      from { opacity: 0; transform: translateX(100%); }
      to { opacity: 1; transform: translateX(0); }
    }

    .toast--sucesso { background: var(--toast-sucesso); color: #fff; }
    .toast--erro { background: var(--toast-erro); color: #fff; }
    .toast--aviso { background: var(--toast-aviso); color: #fff; }
    .toast--info { background: var(--toast-info); color: #fff; }
    .toast__icone { flex: none; margin-top: .125rem; }
    .toast__conteudo { flex: 1; min-width: 0; overflow-wrap: anywhere; }
    .toast__titulo { margin: 0 0 .25rem; font-size: .875rem; font-weight: 700; line-height: 1.3; }
    .toast__mensagem { margin: 0; opacity: .9; font-size: .8125rem; line-height: 1.4; }
    .toast__fechar {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      margin: -.5rem;
      border: 0;
      border-radius: 4px;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
    .toast__fechar:hover { background: rgba(0, 0, 0, .1); }
    .toast__fixado { font-size: .75rem; }
    .toast:focus-visible, .toast__fechar:focus-visible { outline: 2px solid currentColor; outline-offset: -3px; }
    @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
  `],
})
export class ToastContainer {
  private readonly toastService = inject(ToastService);
  readonly toasts = computed(() => this.toastService.toasts());

  pausar(id: number, origem: 'mouse' | 'foco', pausado: boolean): void {
    this.toastService.pausar(id, origem, pausado);
  }

  fixar(id: number): void {
    this.toastService.pausar(id, 'fixado', true);
  }

  sairFoco(id: number, event: FocusEvent): void {
    if (event.currentTarget instanceof HTMLElement && event.relatedTarget instanceof Node
      && event.currentTarget.contains(event.relatedTarget)) return;
    this.pausar(id, 'foco', false);
  }

  remover(id: number): void {
    this.toastService.remover(id);
  }

  icone(tipo: ToastTipo): string {
    switch (tipo) {
      case 'sucesso': return 'M10 16.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM6.5 10l2.5 2.5 4-4';
      case 'erro': return 'M10 16.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM10 5.5v5M10 13.5v.5';
      case 'aviso': return 'M10 3.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM10 6v4M10 12.5v.5';
      default: return 'M10 16.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM10 5.5v5M10 13.5v.5';
    }
  }
}
