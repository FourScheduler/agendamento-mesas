import { Component, input, output } from '@angular/core';
import { ToastItem } from '../toast/toast-item';

@Component({
  selector: 'app-notificacao',
  imports: [ToastItem],
  templateUrl: './notificacao.html',
  styleUrl: './notificacao.css',
})
export class Notificacao {
  readonly mensagem = input('');
  readonly tipo = input<'sucesso' | 'erro'>('sucesso');
  readonly fechar = output<void>();
}
