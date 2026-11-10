import { Component, computed, input, output, signal } from '@angular/core';

/** Estado local para coleções já carregadas; a identidade e os filtros ficam na página. */
export class EstadoPaginacao {
  readonly pagina = signal(1);
  readonly tamanho = signal(12);
  reiniciar() { this.pagina.set(1); }
  alterarTamanho(valor: number) {
    if (![6, 12, 24, 48].includes(valor)) return;
    this.tamanho.set(valor);
    this.reiniciar();
  }
  atual(total: number): number {
    return Math.max(1, Math.min(this.pagina(), Math.ceil(total / this.tamanho()) || 1));
  }
  recortar<T>(itens: readonly T[]): readonly T[] {
    const pagina = this.atual(itens.length);
    return itens.slice((pagina - 1) * this.tamanho(), pagina * this.tamanho());
  }
}

@Component({
  selector: 'app-paginacao',
  template: `
    <nav class="paginacao" aria-label="Paginação">
      <span role="status">{{ total() }} registros · Página {{ atual() }} de {{ paginas() }}</span>
      <label>Por página <select [value]="tamanho()" [disabled]="desabilitado()" (change)="tamanhoAlterado.emit(+$any($event.target).value)">
        @for (opcao of [6, 12, 24, 48]; track opcao) { <option [value]="opcao">{{ opcao }}</option> }
      </select></label>
      <button type="button" aria-label="Página anterior" [disabled]="desabilitado() || atual() <= 1" (click)="paginaAlterada.emit(atual() - 1)">Anterior</button>
      <button type="button" aria-label="Próxima página" [disabled]="desabilitado() || atual() >= paginas()" (click)="paginaAlterada.emit(atual() + 1)">Próxima</button>
    </nav>
  `,
  styles: `
    .paginacao { display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:.75rem; padding:1rem 0; color:var(--muted); font-size:.8125rem; }
    .paginacao > span { margin-right:auto; }
    button,select { min-height:40px; padding:.375rem .75rem; border:1px solid var(--border); border-radius:8px; background:var(--card-bg); color:var(--navy); font:inherit; }
    button:not(:disabled) { cursor:pointer; } button:disabled { opacity:.5; }
    label { display:flex; align-items:center; gap:.5rem; }
  `,
})
export class Paginacao {
  readonly pagina = input(1);
  readonly tamanho = input(12);
  readonly total = input(0);
  readonly desabilitado = input(false);
  readonly paginaAlterada = output<number>();
  readonly tamanhoAlterado = output<number>();
  readonly paginas = computed(() => Math.max(1, Math.ceil(this.total() / this.tamanho())));
  readonly atual = computed(() => Math.min(this.pagina(), this.paginas()));
}
