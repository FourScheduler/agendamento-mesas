import { hojeSaoPaulo, proximoDiaUtil, validarDataReserva } from './data-reserva';

describe('Datas de reserva diária', () => {
  afterEach(() => vi.useRealTimers());

  it('usa o calendário de São Paulo mesmo quando o dia já virou em UTC', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-28T01:30:00Z'));
    expect(hojeSaoPaulo()).toBe('2026-10-27');
    expect(validarDataReserva('2026-10-27')).toBe('');
    expect(validarDataReserva('2026-11-11')).toBe('');
    expect(validarDataReserva('2026-11-12')).toContain('15 dias');
  });

  it('aceita hoje e o limite inclusivo de quinze dias quando são dias úteis', () => {
    expect(validarDataReserva('2026-10-27', '2026-10-27')).toBe('');
    expect(validarDataReserva('2026-11-11', '2026-10-27')).toBe('');
  });

  it('recusa campo vazio, formato inválido e datas inexistentes', () => {
    expect(validarDataReserva('', '2026-10-27')).toContain('Informe a data');
    for (const data of ['27/10/2026', '2026-02-30', '2026-13-01']) {
      expect(validarDataReserva(data, '2026-10-27')).toContain('data válida');
    }
  });

  it('recusa datas passadas e fins de semana', () => {
    expect(validarDataReserva('2026-10-26', '2026-10-27')).toContain('hoje ou futura');
    expect(validarDataReserva('2026-10-31', '2026-10-27')).toContain('segunda a sexta');
    expect(validarDataReserva('2026-11-01', '2026-10-27')).toContain('segunda a sexta');
  });

  it('inicia no próximo dia útil quando a página é aberta no fim de semana', () => {
    expect(proximoDiaUtil('2026-10-31')).toBe('2026-11-02');
    expect(proximoDiaUtil('2026-11-01')).toBe('2026-11-02');
  });

  it('reavalia hoje, o fim de semana e o limite inclusivo após a virada de domingo para segunda', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-09T02:59:59Z'));
    expect(hojeSaoPaulo()).toBe('2026-11-08');
    expect(validarDataReserva('2026-11-08')).toContain('segunda a sexta');
    expect(validarDataReserva('2026-11-23')).toBe('');
    expect(validarDataReserva('2026-11-24')).toContain('15 dias');
    vi.setSystemTime(new Date('2026-11-09T03:00:00Z'));
    expect(validarDataReserva('2026-11-09')).toBe('');
    expect(validarDataReserva('2026-11-24')).toBe('');
    expect(validarDataReserva('2026-11-25')).toContain('15 dias');
  });
});
