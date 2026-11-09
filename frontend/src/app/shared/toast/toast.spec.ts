import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast';
import { ToastContainer } from './toast-container';

describe('Notificações unificadas', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('pausa o tempo restante com foco e hover e só retoma sem motivos de pausa', () => {
    const service = TestBed.inject(ToastService);
    const id = service.sucesso('Confirmada', undefined, 1000);
    vi.advanceTimersByTime(400);
    service.pausar(id, 'mouse', true);
    service.pausar(id, 'foco', true);
    vi.advanceTimersByTime(3000);
    service.pausar(id, 'mouse', false);
    vi.advanceTimersByTime(3000);
    expect(service.toasts()).toHaveLength(1);
    service.pausar(id, 'foco', false);
    vi.advanceTimersByTime(599);
    expect(service.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(service.toasts()).toHaveLength(0);
  });

  it('fixa com clique, não expira e fecha manualmente sem afetar outro toast', () => {
    const fixture = TestBed.createComponent(ToastContainer);
    const service = TestBed.inject(ToastService);
    service.aviso('Resultado incerto', undefined, 1000);
    service.info('Consulta', undefined, 500);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.toast') as HTMLElement).click();
    vi.advanceTimersByTime(5000);
    fixture.detectChanges();
    expect(service.toasts()).toHaveLength(1);
    expect(service.toasts()[0].fixado).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Mantida aberta');
    (fixture.nativeElement.querySelector('.toast__fechar') as HTMLButtonElement).click();
    expect(service.toasts()).toHaveLength(0);
  });
});
