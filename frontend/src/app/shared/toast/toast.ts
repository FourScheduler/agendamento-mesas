import { DestroyRef, Injectable, inject, signal, computed } from '@angular/core';

export type ToastTipo = 'sucesso' | 'erro' | 'info' | 'aviso';

export interface Toast {
  id: number;
  tipo: ToastTipo;
  titulo: string;
  mensagem?: string;
  duracao?: number;
  fixado?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  private _proximoId = 0;
  private readonly contagens = new Map<number, {
    restante: number; inicio: number; timer?: ReturnType<typeof setTimeout>; pausas: Set<'mouse' | 'foco' | 'fixado'>;
  }>();

  readonly toasts = computed(() => this._toasts());

  constructor() {
    inject(DestroyRef).onDestroy(() => this.limpar());
  }

  mostrar(toast: Omit<Toast, 'id'>): number {
    const id = ++this._proximoId;
    const novo: Toast = { id, ...toast };
    this._toasts.update((lista) => [...lista, novo]);

    const ms = toast.duracao ?? 10000;
    this.contagens.set(id, { restante: ms, inicio: 0, pausas: new Set(ms <= 0 || toast.fixado ? ['fixado'] : []) });
    this.retomar(id);

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
    clearTimeout(this.contagens.get(id)?.timer);
    this.contagens.delete(id);
    this._toasts.update((lista) => lista.filter((t) => t.id !== id));
  }

  limpar(): void {
    for (const id of this.contagens.keys()) this.remover(id);
    this._toasts.set([]);
  }

  pausar(id: number, origem: 'mouse' | 'foco' | 'fixado', pausado: boolean) {
    const contagem = this.contagens.get(id);
    if (!contagem) return;
    if (contagem.timer !== undefined) {
      clearTimeout(contagem.timer);
      contagem.timer = undefined;
      contagem.restante = Math.max(0, contagem.restante - (Date.now() - contagem.inicio));
    }
    if (pausado) contagem.pausas.add(origem);
    else contagem.pausas.delete(origem);
    if (origem === 'fixado') this._toasts.update(lista => lista.map(t => t.id === id ? { ...t, fixado: pausado } : t));
    this.retomar(id);
  }

  private retomar(id: number) {
    const contagem = this.contagens.get(id);
    if (!contagem || contagem.pausas.size > 0 || contagem.timer !== undefined) return;
    contagem.inicio = Date.now();
    contagem.timer = setTimeout(() => this.remover(id), contagem.restante);
  }
}