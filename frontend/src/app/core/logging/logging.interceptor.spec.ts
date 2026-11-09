import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LoggerService } from './logger.service';
import { loggingInterceptor } from './logging.interceptor';

describe('Logging HTTP seguro', () => {
  it('correlaciona chamadas sem registrar URL, consultas, corpo, token ou dados pessoais', () => {
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([loggingInterceptor])), provideHttpClientTesting(),
      { provide: LoggerService, useValue: logger },
    ] });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(HttpClient).post('/api/reservas?nome=confidencial', { senha: 'nao-registrar' },
      { headers: { Authorization: 'Bearer segredo' } }).subscribe();
    const request = http.expectOne('/api/reservas?nome=confidencial');
    expect(request.request.headers.get('X-Correlation-ID')).toMatch(/^[a-f0-9-]{36}$/);
    request.flush({ email: 'privado@teste.com' });
    const mensagens = JSON.stringify([logger.debug.mock.calls, logger.info.mock.calls, logger.error.mock.calls]);
    for (const proibido of ['confidencial', 'nao-registrar', 'segredo', 'privado@teste.com']) {
      expect(mensagens).not.toContain(proibido);
    }
    http.verify();
    TestBed.resetTestingModule();
  });
});
