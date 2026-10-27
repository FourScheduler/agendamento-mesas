import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, Router, provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { LoginGuard } from './login.guard';

const usuario = { id: 7, nome: 'Maria', email: 'maria@teste.com', perfil: 'USUARIO' };

describe('Sessão compartilhada e guards', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });
  afterEach(() => { localStorage.clear(); http.verify(); });
  const executar = (guard: typeof AuthGuard) => TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

  it('redireciona visitante ao login e permite abrir a tela de login', async () => {
    expect((await executar(AuthGuard)).toString()).toBe('/login');
    expect(await executar(LoginGuard)).toBe(true);
    http.expectNone('/api/auth/perfil');
  });

  it('restaura o perfil real uma única vez antes de liberar as telas protegidas', async () => {
    localStorage.setItem('agendamento_mesas_token', 'token');
    const auth = TestBed.inject(AuthService);
    expect(auth.usuario()).toBeNull();
    const protegida = executar(AuthGuard);
    const login = executar(LoginGuard);
    const request = http.expectOne('/api/auth/perfil');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    request.flush(usuario);
    expect(await protegida).toBe(true);
    expect((await login).toString()).toBe('/agendamento');
    expect(auth.usuario()).toEqual(usuario);
  });

  it('remove token expirado sem criar loop entre login e agendamento', async () => {
    localStorage.setItem('agendamento_mesas_token', 'expirado');
    const result = executar(AuthGuard);
    http.expectOne('/api/auth/perfil').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect((await result).toString()).toBe('/login');
    expect(localStorage.getItem('agendamento_mesas_token')).toBeNull();
    expect(await executar(LoginGuard)).toBe(true);
    expect(TestBed.inject(AuthService).usuario()).toBeNull();
  });

  it('persiste o login antes de navegar e limpa a sessão sincronamente ao sair', async () => {
    const auth = TestBed.inject(AuthService);
    auth.login(' maria@teste.com ', 'senha-teste').subscribe();
    const request = http.expectOne('/api/auth/login');
    expect(request.request.body).toEqual({ email: 'maria@teste.com', senha: 'senha-teste' });
    request.flush({ token: 'token', tipo: 'Bearer', usuario });
    expect(localStorage.getItem('agendamento_mesas_token')).toBe('token');
    expect(await executar(AuthGuard)).toBe(true);
    http.expectNone('/api/auth/perfil');
    auth.logout();
    expect(auth.usuario()).toBeNull();
    expect(auth.token()).toBe('');
    expect(localStorage.getItem('agendamento_mesas_token')).toBeNull();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/login'], { queryParams: {} });
  });

  it('não restaura a sessão com uma resposta que chega depois do logout', async () => {
    localStorage.setItem('agendamento_mesas_token', 'token');
    const auth = TestBed.inject(AuthService);
    const result = auth.restaurarSessaoSeValida();
    const request = http.expectOne('/api/auth/perfil');
    auth.logout();
    request.flush(usuario);
    expect(await result).toBe(false);
    expect(auth.usuario()).toBeNull();
    expect(auth.token()).toBe('');
  });
});
