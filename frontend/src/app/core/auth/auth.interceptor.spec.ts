import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    TestBed.inject(AuthService).sessao.set({
      token: 'token-secreto', tipo: 'Bearer',
      usuario: { id: 4, nome: 'Maria', email: 'maria@teste.com', perfil: 'USUARIO' },
    });
  });

  afterEach(() => { localStorage.clear(); http.verify(); });

  it('envia o token na API, limpa a sessão em 401 e preserva a retomada da reserva', () => {
    const router = TestBed.inject(Router);
    Object.defineProperty(router, 'url', { configurable: true, value: '/mapa?data=2026-10-28&mesaId=44' });
    TestBed.inject(HttpClient).get('/api/mesas/disponiveis?data=2026-10-28').subscribe({ error: () => {} });

    const request = http.expectOne('/api/mesas/disponiveis?data=2026-10-28');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-secreto');
    request.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(TestBed.inject(AuthService).sessao()).toBeNull();
    expect(TestBed.inject(AuthService).token()).toBe('');
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { sessao: 'expirada', retorno: 'mapa', data: '2026-10-28', mesaId: '44' },
    });
  });

  it('não envia o token ao endpoint público de login', () => {
    TestBed.inject(HttpClient).post('/api/auth/login', { email: 'maria@teste.com', senha: 'senha' }).subscribe();
    const request = http.expectOne('/api/auth/login');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });
});
