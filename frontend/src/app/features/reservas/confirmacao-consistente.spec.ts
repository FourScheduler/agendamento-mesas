import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { LoggerService } from '../../core/logging/logger.service';
import { ToastService } from '../../shared/toast/toast';
import { ReservaDiaria } from './reserva-diaria';
import { Mesa } from '../mesas/mesa';

describe('Confirmação consistente', () => {
  let http: HttpTestingController;
  let estado: ReservaDiaria;
  const mesa: Mesa = { id: 44, codigo: '044', regiao: 'TESTE', tipo: 'LIVRE', ativa: true, ocupante: null,
    ocupada: false, referenciaVisual: { planta: 'TESTE', x: 0, y: 0 } };
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-09T12:00:00Z'));
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: LoggerService, useValue: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }] });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    TestBed.inject(AuthService).sessao.set({ token: 'teste', tipo: 'Bearer', usuario: { id: 7, nome: 'Teste', email: 't@example.com', perfil: 'USUARIO' } });
    http = TestBed.inject(HttpTestingController);
    estado = TestBed.runInInjectionContext(() => new ReservaDiaria());
    estado.alterarData('2026-11-12'); estado.registrarDisponibilidade('2026-11-12'); estado.selecionar(mesa);
  });
  afterEach(() => { http.verify(); TestBed.resetTestingModule(); vi.useRealTimers(); localStorage.clear(); });

  it('mantém a data futura, aguarda resposta e barra duplo clique', () => {
    estado.confirmar(); estado.confirmar();
    const post = http.expectOne('/api/reservas');
    expect(estado.confirmando()).toBe(true);
    expect(post.request.body).toEqual({ mesaId: 44, data: '2026-11-12' });
    expect(post.request.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    post.flush({ id: 10, status: 'CONFIRMADA', data: '2026-11-12', usuarioId: 7, mesa });
    expect(estado.data()).toBe('2026-11-12');
    expect(estado.ultimaConfirmada()?.id).toBe(10);
    expect(estado.confirmando()).toBe(false);
    expect(estado.disponibilidadeAtual()).toBe(false);
  });

  it('reconcilia timeout após commit pela mesma chave sem repetir POST', () => {
    estado.confirmar();
    const post = http.expectOne('/api/reservas');
    const chave = post.request.headers.get('Idempotency-Key');
    vi.advanceTimersByTime(15001);
    expect(post.cancelled).toBe(true);
    expect(estado.confirmando()).toBe(true);
    http.expectOne(`/api/reservas/confirmacoes/${encodeURIComponent(chave!)}`).flush(
      { id: 15, status: 'CONFIRMADA', data: '2026-11-12', usuarioId: 7, mesa },
    );
    expect(estado.ultimaConfirmada()?.id).toBe(15);
    expect(estado.data()).toBe('2026-11-12');
    http.expectNone('/api/reservas');
  });

  it('resultado ainda desconhecido conserva chave para uma tentativa explícita', () => {
    estado.confirmar();
    const primeiro = http.expectOne('/api/reservas');
    const chave = primeiro.request.headers.get('Idempotency-Key');
    primeiro.error(new ProgressEvent('error'));
    http.expectOne(`/api/reservas/confirmacoes/${encodeURIComponent(chave!)}`).flush(
      { detail: 'Reserva não encontrada.' }, { status: 404, statusText: 'Not Found' },
    );
    expect(TestBed.inject(ToastService).toasts().some(t => t.tipo === 'aviso')).toBe(true);
    estado.registrarDisponibilidade('2026-11-12'); estado.selecionar(mesa); estado.repetirConfirmacao();
    const segundo = http.expectOne('/api/reservas');
    expect(segundo.request.headers.get('Idempotency-Key')).toBe(chave);
    segundo.flush({ id: 16, status: 'CONFIRMADA', data: '2026-11-12', usuarioId: 7, mesa });
  });
});
