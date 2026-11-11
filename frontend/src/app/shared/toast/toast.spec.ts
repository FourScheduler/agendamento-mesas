import { TestBed } from '@angular/core/testing';
import { NavigationCancel, NavigationEnd, NavigationStart, Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { ToastContainer } from './toast-container';
import { ToastService } from './toast';

describe('Toast padronizado', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('renderiza as variantes com título, descrição e sem HTML injetado', () => {
    const fixture = TestBed.createComponent(ToastContainer);
    const service = TestBed.inject(ToastService);
    service.sucesso('Reserva confirmada!', 'Sua mesa foi reservada com sucesso.');
    service.erro('Erro', '<b>Mensagem</b>');
    service.info('Informação');
    service.aviso('Atenção');
    service.cancelamento('Reserva cancelada');
    fixture.detectChanges();
    const paineis = fixture.nativeElement.querySelectorAll('.toast') as NodeListOf<HTMLElement>;
    expect(paineis).toHaveLength(5);
    expect(paineis[0].classList.contains('toast--sucesso')).toBe(true);
    expect(paineis[0].getAttribute('role')).toBe('status');
    expect(paineis[0].querySelector('.toast__titulo')?.textContent).toBe('Reserva confirmada!');
    expect(paineis[0].querySelector('.toast__mensagem')?.textContent).toBe('Sua mesa foi reservada com sucesso.');
    expect(paineis[1].getAttribute('role')).toBe('alert');
    expect(paineis[1].textContent).toContain('<b>Mensagem</b>');
    expect(paineis[1].querySelector('b')).toBeNull();
    expect(paineis[2].classList.contains('toast--info')).toBe(true);
    expect(paineis[3].classList.contains('toast--aviso')).toBe(true);
    expect(paineis[4].classList.contains('toast--cancelamento')).toBe(true);
    expect(paineis[4].getAttribute('role')).toBe('status');
    expect(paineis[4].querySelector('.toast__titulo')?.textContent).toBe('Reserva cancelada');
  });

  it('pausa apenas o toast sob o mouse e retoma o tempo restante', () => {
    const fixture = TestBed.createComponent(ToastContainer);
    const service = TestBed.inject(ToastService);
    const primeiro = service.sucesso('Primeiro');
    service.info('Segundo');
    fixture.detectChanges();
    vi.advanceTimersByTime(1000);
    const painel = fixture.nativeElement.querySelector('.toast') as HTMLElement;
    painel.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(5000);
    fixture.detectChanges();
    expect(service.toasts().map(toast => toast.id)).toEqual([primeiro]);
    painel.dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(4999);
    expect(service.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(service.toasts()).toEqual([]);
  });

  it('fecha manualmente, limpa a fila e cancela temporizadores ao destruir', () => {
    const fixture = TestBed.createComponent(ToastContainer);
    const service = TestBed.inject(ToastService);
    service.sucesso('Primeiro');
    service.erro('Segundo');
    fixture.detectChanges();
    const botao = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(botao.getAttribute('aria-label')).toBe('Fechar notificação');
    botao.click();
    fixture.detectChanges();
    expect(service.toasts().map(toast => toast.titulo)).toEqual(['Segundo']);
    service.limpar();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.toast')).toBeNull();
    service.info('Terceiro');
    fixture.detectChanges();
    fixture.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('não encerra com o foco dentro e retoma os seis segundos restantes ao sair', () => {
    const fixture = TestBed.createComponent(ToastContainer);
    const service = TestBed.inject(ToastService);
    service.info('Temporário');
    fixture.detectChanges();
    const paineis = fixture.nativeElement.querySelectorAll('.toast') as NodeListOf<HTMLElement>;
    const texto = paineis[0].querySelector('.toast__conteudo') as HTMLElement;
    const fechar = paineis[0].querySelector('button') as HTMLButtonElement;
    texto.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    texto.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: fechar }));
    fechar.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    vi.advanceTimersByTime(20000);
    expect(service.toasts()).toHaveLength(1);
    fechar.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
    vi.advanceTimersByTime(5999);
    expect(service.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(service.toasts()).toEqual([]);
  });

  it('encerra todas as variantes exatamente após seis segundos', () => {
    const fixture = TestBed.createComponent(ToastContainer);
    const service = TestBed.inject(ToastService);
    for (const tipo of ['sucesso', 'erro', 'aviso', 'info', 'cancelamento'] as const) {
      service.mostrar({ tipo, titulo: tipo });
    }
    fixture.detectChanges();
    vi.advanceTimersByTime(5999);
    expect(service.toasts()).toHaveLength(5);
    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(service.toasts()).toEqual([]);
    expect(fixture.nativeElement.querySelector('.toast')).toBeNull();
  });

  it('limpa notificações ao mudar de página, mas preserva mudanças de data e navegações canceladas', () => {
    const eventos = new Subject<NavigationStart | NavigationEnd | NavigationCancel>();
    TestBed.overrideProvider(Router, { useValue: { url: '/mapa?data=2026-11-11', events: eventos } });
    const fixture = TestBed.createComponent(ToastContainer);
    const service = TestBed.inject(ToastService);
    service.sucesso('Reserva confirmada');
    fixture.detectChanges();
    eventos.next(new NavigationEnd(1, '/mapa?data=2026-11-12', '/mapa?data=2026-11-12'));
    eventos.next(new NavigationStart(2, '/admin/mesas'));
    eventos.next(new NavigationCancel(2, '/admin/mesas', 'Sem acesso'));
    expect(service.toasts()).toHaveLength(1);
    eventos.next(new NavigationEnd(3, '/minhas-reservas', '/minhas-reservas'));
    fixture.detectChanges();
    expect(service.toasts()).toEqual([]);
    expect(fixture.nativeElement.querySelector('.toast')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    service.aviso('Aviso da nova página');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aviso da nova página');
    fixture.destroy();
    expect(service.toasts()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
