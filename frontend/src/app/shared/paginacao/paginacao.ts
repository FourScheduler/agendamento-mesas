import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-paginacao',
  template: `
    <nav aria-label="Paginação" [attr.aria-busy]="carregando()">
      <span role="status">{{ total() }} registros · Página {{ pagina() + 1 }} de {{ paginas() }}</span>
      <label>Por página
        <select [value]="tamanho()" (change)="alterarTamanho($event)" [disabled]="carregando()">
          @for (valor of [10, 20, 50]; track valor) { <option [value]="valor">{{ valor }}</option> }
        </select>
      </label>
      <button type="button" (click)="paginaAlterada.emit(pagina() - 1)"
        [disabled]="carregando() || pagina() <= 0" aria-label="Página anterior">Anterior</button>
      <button type="button" (click)="paginaAlterada.emit(pagina() + 1)"
        [disabled]="carregando() || pagina() + 1 >= paginas()" aria-label="Próxima página">Próxima</button>
    </nav>
  `,
  styles: `
    :host { display: block; }
    nav { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap;
      gap: .75rem; padding: 1rem 0; color: var(--muted); font-size: .8125rem; }
    label { display: flex; align-items: center; gap: .5rem; }
    button, select { min-height: 44px; padding: .5rem .75rem; font: inherit; border: 1px solid var(--border);
      border-radius: var(--radius); background: var(--card-bg); color: var(--navy); }
    button { cursor: pointer; } button:disabled { opacity: .5; cursor: not-allowed; }
  `,
})
export class Paginacao {
  readonly total = input.required<number>();
  readonly pagina = input(0);
  readonly tamanho = input(10);
  readonly carregando = input(false);
  readonly paginas = computed(() => Math.max(1, Math.ceil(this.total() / this.tamanho())));
  readonly paginaAlterada = output<number>();
  readonly tamanhoAlterado = output<number>();

  alterarTamanho(event: Event) {
    if (!(event.target instanceof HTMLSelectElement)) return;
    const tamanho = Number(event.target.value);
    if ([10, 20, 50].includes(tamanho)) this.tamanhoAlterado.emit(tamanho);
  }
}
