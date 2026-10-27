import { TestBed } from '@angular/core/testing';
import { Notificacao } from './notificacao';

describe('Notificação de reserva', () => {
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function abrir(tipo: 'erro' | 'sucesso', mensagem: string) {
    const fixture = TestBed.createComponent(Notificacao);
    vi.useFakeTimers();
    fixture.componentRef.setInput('tipo', tipo);
    fixture.componentRef.setInput('mensagem', mensagem);
    const fechar = vi.fn();
    fixture.componentInstance.fechar.subscribe(fechar);
    fixture.detectChanges();
    return { fixture, fechar, painel: fixture.nativeElement.querySelector('.notificacao') as HTMLElement };
  }

  for (const tipo of ['sucesso', 'erro'] as const) {
    it(`fecha a notificação de ${tipo} após dez segundos`, () => {
      const { fixture, fechar } = abrir(tipo, 'Mensagem da reserva.');
      expect(fixture.nativeElement.querySelector('.notificacao__progresso').style.width).toBe('100%');
      expect(fixture.nativeElement.querySelector('.notificacao__tempo')).toBeNull();
      vi.advanceTimersByTime(9999);
      expect(fechar).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(fechar).toHaveBeenCalledOnce();
    });
  }

  it('pausa com o mouse e retoma somente o tempo que faltava, sem reiniciar dez segundos', () => {
    const { fixture, fechar, painel } = abrir('erro', 'Você já possui uma reserva.');
    vi.advanceTimersByTime(3750);
    painel.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.notificacao__progresso').style.width).toBe('62.5%');
    vi.advanceTimersByTime(20000);
    fixture.detectChanges();
    expect(fechar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.notificacao__progresso').style.width).toBe('62.5%');
    painel.dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(6249);
    expect(fechar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fechar).toHaveBeenCalledOnce();
  });

  it('mantém a pausa ao tirar o mouse se o botão ainda está focado pelo teclado', () => {
    const { fixture, fechar, painel } = abrir('sucesso', 'Reserva confirmada.');
    vi.advanceTimersByTime(2000);
    painel.dispatchEvent(new MouseEvent('mouseenter'));
    const botao = painel.querySelector('button')!;
    botao.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    painel.dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(15000);
    expect(fechar).not.toHaveBeenCalled();
    botao.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
    fixture.detectChanges();
    vi.advanceTimersByTime(7999);
    expect(fechar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fechar).toHaveBeenCalledOnce();
  });

  it('inicia dez segundos para a nova mensagem e cancela o temporizador anterior', () => {
    const { fixture, fechar } = abrir('sucesso', 'Reserva confirmada.');
    vi.advanceTimersByTime(3000);
    fixture.componentRef.setInput('tipo', 'erro');
    fixture.componentRef.setInput('mensagem', 'Você já possui uma reserva.');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain('Você já possui uma reserva');
    vi.advanceTimersByTime(7000);
    expect(fechar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(fechar).toHaveBeenCalledOnce();
  });

  it('permite fechar manualmente sem emitir um segundo fechamento ao vencer o prazo', () => {
    const { fixture, fechar } = abrir('erro', 'Você já possui uma reserva.');
    vi.advanceTimersByTime(3000);
    fixture.nativeElement.querySelector('button').click();
    expect(fechar).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(20000);
    expect(fechar).toHaveBeenCalledOnce();
  });

  it('cancela a contagem ao sair da página', () => {
    const { fixture, fechar } = abrir('sucesso', 'Reserva confirmada.');
    vi.advanceTimersByTime(3000);
    fixture.destroy();
    vi.advanceTimersByTime(20000);
    expect(fechar).not.toHaveBeenCalled();
  });
});
