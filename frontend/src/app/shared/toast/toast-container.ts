import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { ToastService } from './toast';
import { ToastItem } from './toast-item';

@Component({
  selector: 'app-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToastItem],
  template: `
    <div class="toast-container">
      @for (toast of service.toasts(); track toast.id) {
        <app-toast [tipo]="toast.tipo" [titulo]="toast.titulo" [mensagem]="toast.mensagem ?? ''"
          (fechar)="service.remover(toast.id)" />
      }
    </div>
  `,
  styles: `
    .toast-container {
      position: fixed;
      top: calc(max(50px, 6vh) + 16px);
      right: 24px;
      z-index: 1000;
      display: grid;
      gap: .75rem;
      width: min(320px, calc(100vw - 32px));
      max-height: calc(100dvh - 100px);
      overflow-y: auto;
      pointer-events: none;
    }
    app-toast { pointer-events: auto; }
    @media (max-width: 640px) { .toast-container { right: 16px; } }
  `,
})
export class ToastContainer {
  readonly service = inject(ToastService);

  constructor() {
    const router = inject(Router);
    let pagina = router.url.split(/[?#]/)[0];
    router.events.pipe(takeUntilDestroyed()).subscribe(evento => {
      if (!(evento instanceof NavigationEnd)) return;
      const destino = evento.urlAfterRedirects.split(/[?#]/)[0];
      if (destino !== pagina) this.service.limpar();
      pagina = destino;
    });
    inject(DestroyRef).onDestroy(() => this.service.limpar());
  }
}
