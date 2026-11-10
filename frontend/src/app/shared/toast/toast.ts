import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

export type ToastTipo = 'sucesso' | 'erro' | 'info' | 'aviso';

export interface Toast {
  id: number;
  tipo: ToastTipo;
  titulo: string;
  mensagem?: string;
  duracao?: number;
  fixado?: boolean;
}

interface ContagemToast {
  restante: number;
  inicio: number;
  timer?: ReturnType<typeof setTimeout>;
  pausas: Set<'mouse' | 'foco' | 'fixado'>;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly itens = signal<Toast[]>([]);
  private readonly contagens = new Map<number, ContagemToast>();
  private proximoId = 0;
  readonly toasts = computed(() => this.itens());

  constructor() {
    inject(DestroyRef).onDestroy(() => this.limpar());
  }

  mostrar(toast: Omit<Toast, 'id'>): number {
    const id = ++this.proximoId;
    const duracao = toast.duracao ?? 10000;
    const fixado = toast.fixado === true || duracao <= 0;
    this.itens.update(lista => [...lista, { ...toast, id, fixado }]);
    this.contagens.set(id, {
      restante: Math.max(0, duracao),
      inicio: 0,
      pausas: new Set<'mouse' | 'foco' | 'fixado'>(fixado ? ['fixado'] : []),
    });
    this.agendar(id);
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

  pausar(id: number, origem: 'mouse' | 'foco' | 'fixado', pausado: boolean): void {
    const contagem = this.contagens.get(id);
    if (!contagem) return;
    if (contagem.timer !== undefined) {
      clearTimeout(contagem.timer);
      contagem.timer = undefined;
      contagem.restante = Math.max(0, contagem.restante - (Date.now() - contagem.inicio));
    }
    if (pausado) contagem.pausas.add(origem);
    else contagem.pausas.delete(origem);
    if (origem === 'fixado') {
      this.itens.update(lista => lista.map(item => item.id === id ? { ...item, fixado: pausado } : item));
    }
    this.agendar(id);
  }

  remover(id: number): void {
    const timer = this.contagens.get(id)?.timer;
    if (timer !== undefined) clearTimeout(timer);
    this.contagens.delete(id);
    this.itens.update(lista => lista.filter(item => item.id !== id));
  }

  limpar(): void {
    for (const id of [...this.contagens.keys()]) this.remover(id);
  }

  private agendar(id: number): void {
    const contagem = this.contagens.get(id);
    if (!contagem || contagem.pausas.size > 0 || contagem.timer !== undefined) return;
    contagem.inicio = Date.now();
    contagem.timer = setTimeout(() => this.remover(id), contagem.restante);
  }
}
