import { TestBed } from '@angular/core/testing';
import { CalendarioSaoPaulo } from './calendario-sao-paulo';

describe('Calendário compartilhado de São Paulo', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('não troca o dia na meia-noite UTC e troca na meia-noite de São Paulo', () => {
    vi.setSystemTime(new Date('2026-11-06T23:59:59.750Z'));
    const calendario = TestBed.inject(CalendarioSaoPaulo);
    vi.advanceTimersByTime(250);
    expect(calendario.hoje()).toBe('2026-11-06');
    vi.advanceTimersByTime(3 * 60 * 60 * 1000);
    expect(calendario.hoje()).toBe('2026-11-07');
  });

  it.each([
    ['2026-11-07T02:59:59.900Z', '2026-11-06', '2026-11-07'],
    ['2026-11-09T02:59:59.900Z', '2026-11-08', '2026-11-09'],
    ['2027-01-01T02:59:59.900Z', '2026-12-31', '2027-01-01'],
  ])('atualiza automaticamente em %s', (instante, antes, depois) => {
    vi.setSystemTime(new Date(instante));
    const calendario = TestBed.inject(CalendarioSaoPaulo);
    expect(calendario.hoje()).toBe(antes);
    vi.advanceTimersByTime(100);
    expect(calendario.hoje()).toBe(depois);
  });

  it('recupera o dia e reagenda a virada ao retornar de uma aba suspensa', () => {
    vi.setSystemTime(new Date('2026-11-06T12:00:00Z'));
    const calendario = TestBed.inject(CalendarioSaoPaulo);
    vi.setSystemTime(new Date('2026-11-09T12:00:00Z'));
    window.dispatchEvent(new Event('focus'));
    expect(calendario.hoje()).toBe('2026-11-09');
    const visibilidade = vi.spyOn(document, 'visibilityState', 'get');
    visibilidade.mockReturnValue('hidden');
    vi.setSystemTime(new Date('2026-11-10T12:00:00Z'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(calendario.hoje()).toBe('2026-11-09');
    visibilidade.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(calendario.hoje()).toBe('2026-11-10');
    vi.advanceTimersByTime(15 * 60 * 60 * 1000);
    expect(calendario.hoje()).toBe('2026-11-11');
  });

  it('remove temporizador e eventos quando o serviço é destruído', () => {
    vi.setSystemTime(new Date('2026-11-06T12:00:00Z'));
    const calendario = TestBed.inject(CalendarioSaoPaulo);
    const atualizar = vi.spyOn(calendario, 'atualizar');
    TestBed.resetTestingModule();
    vi.advanceTimersByTime(48 * 60 * 60 * 1000);
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(atualizar).not.toHaveBeenCalled();
  });
});
