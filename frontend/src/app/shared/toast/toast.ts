import { Injectable, signal, computed } from '@angular/core';

export type ToastTipo = 'sucesso' | 'erro' | 'info' | 'aviso';

export interface Toast {
  id: number;
  tipo: ToastTipo;
  titulo: string;
  mensagem?: string;
  duracao?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  private _proximoId = 0;

  readonly toasts = computed(() => this._toasts());

  mostrar(toast: Omit<Toast, 'id'>): number {
    const id = ++this._proximoId;
    const novo: Toast = { id, ...toast };
    this._toasts.update((lista) => [...lista, novo]);

    const ms = toast.duracao ?? 4000;
    setTimeout(() => this.remover(id), ms);

    return id;
  }

  sucesso(titulo: string, mensagem?: string, duracao?: number): number {
    return this.mostrar({ tipo: 'sucesso', titulo, mensagem, duracao });
  }

  erro(titulo: string, mensagem?: string, duracao?: number): number {
    return this.mostrar({ tipo: 'erro', titulo, mensagem, duracao });
  }

  info(titulo: string, mensagem?: string, duracao?: number): number {
    return this.mostrar({ tipo: 'info', titulo, mensagem, duracao });
  }

  aviso(titulo: string, mensagem?: string, duracao?: number): number {
    return this.mostrar({ tipo: 'aviso', titulo, mensagem, duracao });
  }

  remover(id: number): void {
    this._toasts.update((lista) => lista.filter((t) => t.id !== id));
  }

  limpar(): void {
    this._toasts.set([]);
  }
}