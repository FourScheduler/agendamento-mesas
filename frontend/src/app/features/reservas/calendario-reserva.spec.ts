import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CalendarioReserva } from './calendario-reserva';

@Component({
  imports: [CalendarioReserva],
  template: `
    <app-calendario-reserva data="2026-10-30" minima="2026-10-26" maxima="2026-11-10"
      (dataSelecionada)="selecionada = $event">
      <input type="date" readonly value="2026-10-30" />
    </app-calendario-reserva>
  `,
})
class HostCalendario {
  selecionada = '';
}

describe('CalendarioReserva', () => {
  it('bloqueia sábados, domingos e datas fora da janela e permite escolher dia útil em outro mês', () => {
    const fixture = TestBed.createComponent(HostCalendario);
    fixture.detectChanges();
    const dialogo = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialogo.showModal = vi.fn(() => dialogo.setAttribute('open', ''));
    dialogo.close = vi.fn(() => dialogo.removeAttribute('open'));
    fixture.nativeElement.querySelector('input').click();
    fixture.detectChanges();
    expect(dialogo.open).toBe(true);
    const dia = (data: string) => dialogo.querySelector(`[aria-label="${data}"]`) as HTMLButtonElement;
    expect(dia('31/10/2026').disabled).toBe(true);
    expect(dia('01/11/2026').disabled).toBe(true);
    expect(dia('25/10/2026').disabled).toBe(true);
    expect(dia('30/10/2026').disabled).toBe(false);
    dia('31/10/2026').click();
    expect(fixture.componentInstance.selecionada).toBe('');
    (dialogo.querySelector('[aria-label="Próximo mês"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(dia('01/11/2026').disabled).toBe(true);
    expect(dia('07/11/2026').disabled).toBe(true);
    expect(dia('11/11/2026').disabled).toBe(true);
    dia('02/11/2026').click();
    expect(fixture.componentInstance.selecionada).toBe('2026-11-02');
    expect(dialogo.open).toBe(false);
  });

  it('impede emissão de final de semana e abertura quando desabilitado', () => {
    const fixture = TestBed.createComponent(CalendarioReserva);
    fixture.componentRef.setInput('data', '2026-10-30');
    fixture.componentRef.setInput('minima', '2026-10-26');
    fixture.componentRef.setInput('maxima', '2026-11-10');
    fixture.detectChanges();
    const emitir = vi.fn();
    fixture.componentInstance.dataSelecionada.subscribe(emitir);
    fixture.componentInstance.selecionar('2026-10-31');
    fixture.componentInstance.selecionar('2026-11-01');
    expect(emitir).not.toHaveBeenCalled();
    fixture.componentRef.setInput('desabilitado', true);
    fixture.detectChanges();
    fixture.componentInstance.selecionar('2026-10-30');
    expect(emitir).not.toHaveBeenCalled();
  });
});
