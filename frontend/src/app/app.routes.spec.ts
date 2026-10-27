import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from './core/auth/auth.service';
import { routes } from './app.routes';

describe('Rotas da develop integradas à issue 7', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { localStorage.clear(); http.verify(); });

  it('abre o login ao acessar a rota inicial sem autenticação', async () => {
    const harness = await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(harness.routeNativeElement?.textContent).toContain('Entre para acessar');
  });

  it('mantém a página de minhas reservas e a navegação para agendamento', async () => {
    TestBed.inject(AuthService).sessao.set({ token: 'token', tipo: 'Bearer', usuario: { id: 7, nome: 'Maria', email: '', perfil: 'USUARIO' } });
    const harness = await RouterTestingHarness.create('/minhas-reservas');
    expect(harness.routeNativeElement?.textContent).toContain('Minhas Reservas');
    expect(harness.routeNativeElement?.textContent).toContain('Funcionalidade em desenvolvimento');
  });

  it('preserva a data na abertura direta do mapa e consulta disponibilidade diária', async () => {
    TestBed.inject(AuthService).sessao.set({ token: 'token', tipo: 'Bearer', usuario: { id: 7, nome: 'Maria', email: '', perfil: 'USUARIO' } });
    const harness = await RouterTestingHarness.create('/mapa?data=2026-10-29');
    http.expectOne('/api/mesas').flush([]);
    http.expectOne(r => r.url === '/api/mesas/disponiveis' && r.params.get('data') === '2026-10-29').flush([]);
    expect(harness.routeNativeElement?.textContent).toContain('Mapa de Mesas');
    expect((harness.routeNativeElement?.querySelector('#data-reserva') as HTMLInputElement).value).toBe('2026-10-29');
  });
});
