import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PainelArrastavel } from './painel-arrastavel.directive';

@Component({
  standalone: true,
  imports: [PainelArrastavel],
  template: `<aside appPainelArrastavel style="position: fixed">
    <header data-arrastar-painel tabindex="0">Detalhes <button (click)="fechou = true">Fechar</button></header>
    <p>Dados da reserva</p><button class="confirmar" (click)="confirmou = true">Confirmar</button>
  </aside>`,
})
class PainelTeste {
  fechou = false;
  confirmou = false;
}

describe('Painel de detalhes arrastável', () => {
  beforeEach(() => {
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 800);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  function abrir() {
    const fixture = TestBed.createComponent(PainelTeste);
    fixture.detectChanges();
    const painel = fixture.nativeElement.querySelector('aside') as HTMLElement;
    const cabecalho = painel.querySelector('header')!;
    Object.assign(painel, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn(), hasPointerCapture: () => true });
    vi.spyOn(painel, 'getBoundingClientRect').mockImplementation(() => ({
      left: painel.style.left ? parseFloat(painel.style.left) : 600,
      top: painel.style.top ? parseFloat(painel.style.top) : 300,
      width: 360, height: 400,
    } as DOMRect));
    return { fixture, painel, cabecalho };
  }

  function ponteiro(alvo: Element, tipo: string, x: number, y: number, button = 0) {
    alvo.dispatchEvent(new PointerEvent(tipo, {
      bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button, clientX: x, clientY: y,
    }));
  }

  it('move pelo cabeçalho, mantém captura e para ao soltar o ponteiro', () => {
    const { painel, cabecalho } = abrir();
    ponteiro(cabecalho, 'pointerdown', 620, 320);
    ponteiro(painel, 'pointermove', 520, 220);
    expect(painel.style.left).toBe('500px');
    expect(painel.style.top).toBe('200px');
    expect(painel.setPointerCapture).toHaveBeenCalledWith(1);
    ponteiro(painel, 'pointerup', 520, 220);
    expect(painel.releasePointerCapture).toHaveBeenCalledWith(1);
    ponteiro(painel, 'pointermove', 20, 20);
    expect(painel.style.left).toBe('500px');
  });

  it('não permite esconder o cartão fora da tela', () => {
    const { painel, cabecalho } = abrir();
    ponteiro(cabecalho, 'pointerdown', 620, 320);
    ponteiro(painel, 'pointermove', 3000, 3000);
    expect(painel.style.left).toBe('632px');
    expect(painel.style.top).toBe('392px');
    ponteiro(painel, 'pointermove', -3000, -3000);
    expect(painel.style.left).toBe('8px');
    expect(painel.style.top).toBe('8px');
  });

  it('preserva fechar, confirmar e selecionar conteúdo sem iniciar arraste', () => {
    const { fixture, painel, cabecalho } = abrir();
    const fechar = cabecalho.querySelector('button')!;
    ponteiro(fechar, 'pointerdown', 620, 320);
    fechar.click();
    ponteiro(painel.querySelector('p')!, 'pointerdown', 620, 380);
    const confirmar = painel.querySelector<HTMLButtonElement>('.confirmar')!;
    ponteiro(confirmar, 'pointerdown', 620, 500);
    confirmar.click();
    ponteiro(cabecalho, 'pointerdown', 620, 320, 2);
    ponteiro(painel, 'pointermove', 400, 200);
    expect(fixture.componentInstance.fechou).toBe(true);
    expect(fixture.componentInstance.confirmou).toBe(true);
    expect(painel.setPointerCapture).not.toHaveBeenCalled();
    expect(painel.style.left).toBe('');
  });

  it('reajusta a posição ao reduzir a janela e restaura o layout de celular', () => {
    const { painel, cabecalho } = abrir();
    ponteiro(cabecalho, 'pointerdown', 620, 320);
    ponteiro(painel, 'pointermove', 520, 220);
    vi.stubGlobal('innerWidth', 800);
    vi.stubGlobal('innerHeight', 600);
    window.dispatchEvent(new Event('resize'));
    expect(painel.style.left).toBe('432px');
    expect(painel.style.top).toBe('192px');
    painel.style.position = 'static';
    window.dispatchEvent(new Event('resize'));
    expect(painel.style.left).toBe('');
    expect(painel.style.top).toBe('');
    expect(painel.style.right).toBe('');
    ponteiro(cabecalho, 'pointerdown', 620, 320);
    ponteiro(painel, 'pointermove', 400, 200);
    expect(painel.style.left).toBe('');
  });

  it('permite mover com as setas sem afetar os botões', () => {
    const { painel, cabecalho } = abrir();
    cabecalho.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(painel.style.left).toBe('590px');
    cabecalho.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true }));
    expect(painel.style.top).toBe('260px');
    cabecalho.querySelector('button')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(painel.style.left).toBe('590px');
  });
});
