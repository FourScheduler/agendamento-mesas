import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-paginacao',
  template: `
    <nav aria-label="Paginação" [attr.aria-busy]="carregando()">
      <span role="status" [attr.aria-label]="total() + ' registros, página ' + (pagina() + 1) + ' de ' + paginas()">
        {{ total() }} registros · {{ pagina() + 1 }}/{{ paginas() }}
      </span>
      <select aria-label="Itens por página" [value]="tamanho()" (change)="alterarTamanho($event)" [disabled]="carregando()">
        @for (valor of [10, 20, 50]; track valor) { <option [value]="valor">{{ valor }}</option> }
      </select>
      <button type="button" (click)="paginaAlterada.emit(pagina() - 1)"
        [disabled]="carregando() || pagina() <= 0" aria-label="Página anterior">Anterior</button>
      <button type="button" (click)="paginaAlterada.emit(pagina() + 1)"
        [disabled]="carregando() || pagina() + 1 >= paginas()" aria-label="Próxima página">Próxima</button>
    </nav>
  `,
  styles: `
    :host { display: block; }
    nav { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap;
      gap: 1rem 1.5rem; padding: 1rem 0; color: var(--muted); font-size: .8125rem; }
    button, select { min-height: 44px; padding: .5rem .75rem; font: inherit; border: 1px solid var(--border);
      border-radius: var(--radius); background: var(--card-bg); color: var(--navy); }
    button { cursor: pointer; } button:disabled { opacity: .5; cursor: not-allowed; }
    @media (max-width: 520px) {
      nav { justify-content: center; gap: .75rem 1rem; }
    }
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
