import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NavigationEnd, Router, provideRouter } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from './core/auth/auth.service';
import { routes } from './app.routes';

describe('Entrada e navegação entre mapa e lista de mesas', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-27T12:00:00Z'));
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    localStorage.clear();
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
      vi.useRealTimers();
    }
  });

  function autenticar(perfil: string) {
    TestBed.inject(AuthService).sessao.set({
      token: 'token', tipo: 'Bearer',
      usuario: { id: 7, nome: 'Maria', email: 'maria@teste.com', perfil },
    });
  }

  function carregarMapa(data = '2026-10-27') {
    http.expectOne(r => r.url === '/api/mesas/com-ocupacao' && r.params.get('data') === data).flush([]);
    http.expectOne(r => r.url === '/api/mesas/disponiveis' && r.params.get('data') === data).flush([]);
  }

  function carregarLista(harness: RouterTestingHarness, data = '2026-10-27') {
    harness.detectChanges();
    http.expectOne('/api/mesas').flush([]);
    http.expectOne(r => r.url === '/api/mesas/disponiveis' && r.params.get('data') === data).flush([]);
  }

  function botaoListar(harness: RouterTestingHarness, rotulo = 'Listar mesas'): HTMLButtonElement {
    const botoes = Array.from(harness.routeNativeElement!.querySelectorAll('button'));
    const nomeAcessivel = (item: HTMLButtonElement) => {
      if (item.hasAttribute('aria-label')) return item.getAttribute('aria-label');
      const copia = item.cloneNode(true) as HTMLButtonElement;
      copia.querySelectorAll('[aria-hidden="true"]').forEach(icone => icone.remove());
      return copia.textContent?.trim();
    };
    const botao = botoes.find(item => nomeAcessivel(item) === rotulo);
    expect(botao).toBeDefined();
    expect(botao!.textContent).toContain(rotulo);
    return botao!;
  }

  function proximaNavegacao() {
    return firstValueFrom(TestBed.inject(Router).events.pipe(filter(event => event instanceof NavigationEnd)));
  }

  it.each(['USUARIO', 'ADMIN'])('abre o mapa pela raiz e pelo login já autenticado como %s', async perfil => {
    autenticar(perfil);
    const harness = await RouterTestingHarness.create('/');
    carregarMapa();
    expect(TestBed.inject(Router).url).toBe('/mapa');
    await harness.navigateByUrl('/login');
    expect(TestBed.inject(Router).url).toBe('/mapa');
    http.expectNone('/api/auth/perfil');
  });

  it.each(['USUARIO', 'ADMIN'])('restaura a sessão após recarregar um link direto como %s', async perfil => {
    localStorage.setItem('agendamento_mesas_token', 'token');
    const url = '/mapa?data=2026-10-29&mesaId=44';
    const abrindo = RouterTestingHarness.create(url);
    await vi.waitFor(() => {
      http.expectOne('/api/auth/perfil').flush({
        id: 7, nome: 'Maria', email: 'maria@teste.com', perfil,
      });
    });
    const harness = await abrindo;
    carregarMapa('2026-10-29');
    expect(TestBed.inject(Router).url).toBe(url);
    expect(TestBed.inject(AuthService).usuario()?.perfil).toBe(perfil);
    expect((harness.routeNativeElement?.querySelector('#data-reserva') as HTMLInputElement).value).toBe('2026-10-29');
    http.expectNone('/api/auth/perfil');
  });

  it('redireciona sessão expirada ao login sem perder data e mesa do link direto', async () => {
    localStorage.setItem('agendamento_mesas_token', 'expirado');
    const abrindo = RouterTestingHarness.create('/mapa?data=2026-10-29&mesaId=44');
    await vi.waitFor(() => {
      http.expectOne('/api/auth/perfil').flush({}, { status: 401, statusText: 'Unauthorized' });
    });
    await abrindo;
    const url = TestBed.inject(Router).parseUrl(TestBed.inject(Router).url);
    expect(url.queryParams).toEqual({ retorno: 'mapa', data: '2026-10-29', mesaId: '44' });
    expect(url.root.children['primary'].segments[0].path).toBe('login');
    expect(localStorage.getItem('agendamento_mesas_token')).toBeNull();
    http.expectNone(r => r.url.startsWith('/api/mesas'));
  });

  it.each(['USUARIO', 'ADMIN'])('preserva a data ao listar mesas e voltar/avançar no histórico como %s', async perfil => {
    autenticar(perfil);
    TestBed.inject(Router).setUpLocationChangeListener();
    const harness = await RouterTestingHarness.create('/mapa?data=2026-10-29');
    carregarMapa('2026-10-29');
    const indoParaLista = proximaNavegacao();
    botaoListar(harness).click();
    await indoParaLista;
    carregarLista(harness, '2026-10-29');
    expect(TestBed.inject(Router).url).toBe('/agendamento?data=2026-10-29');

    const voltando = proximaNavegacao();
    TestBed.inject(Location).back();
    await voltando;
    harness.detectChanges();
    carregarMapa('2026-10-29');
    expect(TestBed.inject(Router).url).toBe('/mapa?data=2026-10-29');
    const avancando = proximaNavegacao();
    TestBed.inject(Location).forward();
    await avancando;
    carregarLista(harness, '2026-10-29');
    expect(TestBed.inject(Router).url).toBe('/agendamento?data=2026-10-29');
  });

  it.each(['USUARIO', 'ADMIN'])('Ver Mapa em Minhas reservas abre o mapa como %s', async perfil => {
    autenticar(perfil);
    const harness = await RouterTestingHarness.create('/minhas-reservas');
    const endpoint = perfil === 'ADMIN' ? '/api/admin/reservas/pagina' : '/api/reservas/minhas/pagina';
    http.expectOne(r => r.url === endpoint).flush({
      conteudo: [], pagina: 0, tamanho: 10, totalRegistros: 0, totalPaginas: 0,
    });
    http.expectOne('/api/mesas').flush([]);
    const navegando = proximaNavegacao();
    botaoListar(harness, 'Ver Mapa').click();
    await navegando;
    harness.detectChanges();
    carregarMapa();
    expect(TestBed.inject(Router).url).toBe('/mapa');
  });

  it('Listar mesas na administração abre a lista', async () => {
    autenticar('ADMIN');
    const harness = await RouterTestingHarness.create('/admin/mesas');
    await vi.waitFor(() => {
      http.expectOne(r => r.url === '/api/mesas/com-ocupacao').flush([]);
    });
    harness.detectChanges();
    const navegando = proximaNavegacao();
    botaoListar(harness).click();
    await navegando;
    carregarLista(harness);
    expect(TestBed.inject(Router).url).toBe('/agendamento');
  });

  it('impede USUARIO de abrir a administração pelo link direto', async () => {
    autenticar('USUARIO');
    const harness = await RouterTestingHarness.create('/admin/mesas');
    carregarLista(harness);
    expect(TestBed.inject(Router).url).toBe('/agendamento');
    http.expectNone(r => r.url === '/api/mesas/com-ocupacao');
  });

  it('abre o login ao acessar a rota inicial sem autenticação', async () => {
    const harness = await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/login?retorno=mapa');
    expect(harness.routeNativeElement?.textContent).toContain('Entre para acessar');
  });

  it('mantém a página de minhas reservas e a navegação para agendamento', async () => {
    TestBed.inject(AuthService).sessao.set({ token: 'token', tipo: 'Bearer', usuario: { id: 7, nome: 'Maria', email: '', perfil: 'USUARIO' } });
    const harness = await RouterTestingHarness.create('/minhas-reservas');
    http.expectOne(r => r.url === '/api/reservas/minhas/pagina' && r.params.get('pagina') === '0' && r.params.get('tamanho') === '10' && r.params.get('canceladas') === 'false').flush({ conteudo: [], pagina: 0, tamanho: 10, totalRegistros: 0, totalPaginas: 0 });
    http.expectOne('/api/mesas').flush([]);
    expect(harness.routeNativeElement?.textContent).toContain('Minhas reservas');
    expect(harness.routeNativeElement?.textContent).toContain('Acompanhe suas reservas e as mesas atribuídas a você');
  });

  it('preserva a data na abertura direta do mapa e consulta disponibilidade diária', async () => {
    TestBed.inject(AuthService).sessao.set({ token: 'token', tipo: 'Bearer', usuario: { id: 7, nome: 'Maria', email: '', perfil: 'USUARIO' } });
    const harness = await RouterTestingHarness.create('/mapa?data=2026-10-29');
    http.expectOne(r => r.url === '/api/mesas/com-ocupacao'
      && r.params.get('data') === '2026-10-29').flush([]);
    http.expectOne(r => r.url === '/api/mesas/disponiveis' && r.params.get('data') === '2026-10-29').flush([]);
    expect(harness.routeNativeElement?.querySelector('.mapa__cabecalho h1')?.textContent)
      .toBe('Mapa de mesas');
    expect((harness.routeNativeElement?.querySelector('#data-reserva') as HTMLInputElement).value).toBe('2026-10-29');
  });
});
