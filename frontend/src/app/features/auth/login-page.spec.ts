import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { LoginPage } from './login-page';
import { authInterceptor } from '../../core/auth/auth.interceptor';

describe('Login separado do mapa', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });
  afterEach(() => { localStorage.clear(); http.verify(); });

  it.each(['USUARIO', 'ADMIN'])('autentica como %s e abre o mapa com a identidade e o token preservados', async perfil => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.componentInstance.email = 'maria@teste.com';
    fixture.componentInstance.senha = 'senha-teste';
    const entrando = fixture.componentInstance.entrar();
    const usuario = { id: 7, nome: 'Maria', email: 'maria@teste.com', perfil };
    const request = http.expectOne('/api/auth/login');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ token: 'token', tipo: 'Bearer', usuario });
    await entrando;
    expect(TestBed.inject(AuthService).usuario()).toEqual(usuario);
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/mapa'], { queryParams: {} });
    expect(fixture.componentInstance.senha).toBe('');
  });

  it('mantém o login em caso de 401 e apaga a senha digitada', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.componentInstance.email = 'maria@teste.com';
    fixture.componentInstance.senha = 'incorreta';
    const entrando = fixture.componentInstance.entrar();
    http.expectOne('/api/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });
    await entrando;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain('E-mail ou senha inválidos');
    expect(fixture.componentInstance.senha).toBe('');
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it.each(['USUARIO', 'ADMIN'])('preserva retorno explícito para a lista com data e mesa como %s', async perfil => {
    TestBed.inject(ActivatedRoute).snapshot.queryParams = {
      retorno: 'agendamento', data: '2026-10-29', mesaId: '44',
    };
    const fixture = TestBed.createComponent(LoginPage);
    fixture.componentInstance.email = 'maria@teste.com';
    fixture.componentInstance.senha = 'senha-teste';
    const entrando = fixture.componentInstance.entrar();
    http.expectOne('/api/auth/login').flush({
      token: 'token', tipo: 'Bearer',
      usuario: { id: 7, nome: 'Maria', email: 'maria@teste.com', perfil },
    });
    await entrando;
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/agendamento'], {
      queryParams: { data: '2026-10-29', mesaId: '44' },
    });
  });
});
