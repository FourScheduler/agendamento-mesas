import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { adicionarDias, formatarData, validarDataReserva } from './data-reserva';

@Component({
  selector: 'app-calendario-reserva',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(click)': 'abrir($event)',
    '(keydown.enter)': 'abrir($event)',
    '(keydown.space)': 'abrir($event)',
    '(keydown.arrowdown)': 'abrir($event)',
  },
  template: `
    <ng-content />
    <dialog #dialogo aria-label="Escolher dia da reserva" (click)="fecharSeFora($event)"
      (keydown)="$event.stopPropagation()">
      <header>
        <button type="button" aria-label="Mês anterior" [disabled]="mes() <= minima().slice(0, 7)"
          (click)="mudarMes(-1)">‹</button>
        <strong aria-live="polite">{{ tituloMes() }}</strong>
        <button type="button" aria-label="Próximo mês" [disabled]="mes() >= maxima().slice(0, 7)"
          (click)="mudarMes(1)">›</button>
      </header>
      <div class="dias">
        @for (dia of ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']; track dia) {
          <span aria-hidden="true">{{ dia }}</span>
        }
        @for (dia of dias(); track dia.data) {
          <button type="button" [disabled]="dia.bloqueado" [attr.aria-label]="dia.rotulo"
            [attr.aria-pressed]="dia.data === data()" (click)="selecionar(dia.data)">
            {{ dia.numero }}
          </button>
        }
      </div>
      <button class="fechar" type="button" (click)="dialogo.close()">Fechar</button>
    </dialog>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    dialog { position: fixed; margin: 0; width: min(296px, calc(100vw - 1rem));
      max-height: calc(100dvh - 1rem); overflow: auto; box-sizing: border-box; padding: .75rem;
      border: 1px solid var(--border-soft); border-radius: 14px; color: var(--text);
      background: var(--card-bg); box-shadow: 0 16px 40px rgb(34 34 57 / 24%); font-size: .8125rem; }
    dialog::backdrop { background: transparent; }
    header { display: flex; justify-content: space-between; align-items: center; gap: .5rem; margin-bottom: .5rem; }
    header strong { color: var(--navy); font-size: .875rem; text-transform: capitalize; }
    .dias { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: .25rem; text-align: center; }
    .dias span { color: var(--muted); font-size: .6875rem; font-weight: 700; padding: .375rem 0; }
    button { min-width: 0; min-height: 36px; border: 1px solid transparent; border-radius: 8px;
      background: var(--card-bg); color: var(--text); font: inherit; cursor: pointer; }
    header button { width: 36px; min-height: 36px; border-color: var(--border-soft); font-size: 1.25rem; }
    .dias button:hover:not(:disabled):not([aria-pressed=true]),
    header button:hover:not(:disabled) { border-color: #f3b69e; background: var(--orange-soft); }
    button:disabled { opacity: .4; cursor: not-allowed; background: var(--page-bg); }
    button[aria-pressed=true] { border-color: var(--orange); background: var(--orange); color: #fff; font-weight: 700; }
    button:focus-visible { outline: 2px solid var(--orange); outline-offset: 1px; }
    .fechar { display: block; min-height: 34px; margin: .5rem 0 0 auto; padding: 0 .625rem;
      border-color: var(--border-soft); font-weight: 700; }
    .fechar:hover { border-color: var(--orange); color: var(--orange-dark); }
  `,
})
export class CalendarioReserva {
  readonly data = input.required<string>();
  readonly minima = input.required<string>();
  readonly maxima = input.required<string>();
  readonly desabilitado = input(false);
  readonly dataSelecionada = output<string>();
  readonly mes = signal('');
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  readonly tituloMes = computed(() => this.mes()
    ? new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${this.mes()}-01T12:00:00Z`)) : '');
  readonly dias = computed(() => {
    if (!this.mes()) return [];
    const primeiro = `${this.mes()}-01`;
    const deslocamento = (new Date(`${primeiro}T12:00:00Z`).getUTCDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, indice) => {
      const data = adicionarDias(primeiro, indice - deslocamento);
      return {
        data,
        numero: Number(data.slice(8)),
        bloqueado: this.bloqueado(data) || data.slice(0, 7) !== this.mes(),
        rotulo: formatarData(data),
      };
    });
  });

  abrir(event: Event) {
    if (!(event.target instanceof HTMLInputElement) || this.desabilitado()) return;
    event.preventDefault();
    const data = this.data() >= this.minima() && this.data() <= this.maxima() ? this.data() : this.minima();
    this.mes.set(data.slice(0, 7));
    const dialogo = this.dialogo().nativeElement;
    const campo = event.target.getBoundingClientRect();
    const largura = Math.min(280, window.innerWidth - 16);
    const altura = 310;
    const topo = campo.bottom + altura + 4 <= window.innerHeight - 8
      ? campo.bottom + 4 : Math.max(8, campo.top - altura - 4);
    dialogo.style.left = `${Math.max(8, Math.min(campo.left, window.innerWidth - largura - 8))}px`;
    dialogo.style.top = `${topo}px`;
    dialogo.showModal();
  }

  fecharSeFora(event: MouseEvent) {
    event.stopPropagation();
    const dialogo = this.dialogo().nativeElement;
    const area = dialogo.getBoundingClientRect();
    if (event.target === dialogo && (event.clientX < area.left || event.clientX > area.right
      || event.clientY < area.top || event.clientY > area.bottom)) dialogo.close();
  }

  mudarMes(delta: number) {
    const data = new Date(`${this.mes()}-01T12:00:00Z`);
    data.setUTCMonth(data.getUTCMonth() + delta);
    this.mes.set(data.toISOString().slice(0, 7));
  }

  selecionar(data: string) {
    if (this.desabilitado() || this.bloqueado(data)) return;
    this.dataSelecionada.emit(data);
    this.dialogo().nativeElement.close();
  }

  private bloqueado(data: string) {
    return !!validarDataReserva(data, this.minima()) || data > this.maxima();
  }
}
