import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Mesa } from '../mesas/mesa';
import { MinhasReservasPage } from './minhas-reservas-page';

const mesaDaMaria: Mesa = {
  id: 1,
  codigo: '001',
  regiao: 'TAMBORÉ',
  tipo: 'FIXA',
  ativa: true,
  ocupante: 'Livre',
  ocupada: false,
  responsavel: { id: 7, nome: 'Maria', email: 'maria@teste.com' },
  referenciaVisual: { planta: 'TAMBORÉ', x: 10, y: 20 },
};

const mesaDeOutroUsuario: Mesa = {
  ...mesaDaMaria,
  id: 2,
  codigo: '002',
  responsavel: { id: 8, nome: 'João', email: 'joao@teste.com' },
};

describe('MinhasReservasPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(AuthService).sessao.set({
      token: 'token',
      tipo: 'Bearer',
      usuario: { id: 7, nome: 'Maria', email: 'maria@teste.com', perfil: 'USUARIO' },
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
      vi.useRealTimers();
    }
  });

  it('mantém hoje nas futuras após 21h e reclassifica na virada sem recarregar nem perder filtros', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T01:30:00Z'));
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();
    const reserva = {
      id: 31, usuarioId: 7, status: 'CONFIRMADA', data: '2026-11-06',
      criadaEm: '2026-11-05T12:00:00',
      mesa: { id: 44, codigo: '044', regiao: 'TAMBORÉ' },
    };
    http.expectOne('/api/reservas/minhas').flush([
      reserva, { ...reserva, id: 32, data: '2026-11-09' },
      { ...reserva, id: 30, data: '2026-11-05' },
    ]);
    http.expectOne('/api/mesas').flush([]);
    fixture.detectChanges();
    const pagina = fixture.componentInstance;
    expect(pagina.visiveis().map(r => r.data)).toEqual(['2026-11-06', '2026-11-09']);
    const cartaoHoje = pagina.cartoes()[0];
    expect(pagina.podeCancelar(cartaoHoje)).toBe(true);
    pagina.statusFiltro.set('CONFIRMADA');
    vi.advanceTimersByTime(90 * 60 * 1000);
    fixture.detectChanges();
    expect(pagina.visiveis().map(r => r.data)).toEqual(['2026-11-09']);
    expect(pagina.statusFiltro()).toBe('CONFIRMADA');
    expect(pagina.filtro()).toBe('futuras');
    expect(pagina.podeCancelar(cartaoHoje)).toBe(false);
    pagina.trocarFiltro('passadas');
    expect(pagina.visiveis().map(r => r.data)).toEqual(['2026-11-06', '2026-11-05']);
    http.expectNone('/api/reservas/minhas');
  });

  it('preserva período personalizado e revalida a data antes de confirmar cancelamento em aba suspensa', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-07T02:59:59Z'));
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();
    http.expectOne('/api/reservas/minhas').flush([{
      id: 31, usuarioId: 7, status: 'CONFIRMADA', data: '2026-11-06',
      criadaEm: '2026-11-05T12:00:00', mesa: { id: 44, codigo: '044', regiao: 'TAMBORÉ' },
    }]);
    http.expectOne('/api/mesas').flush([]);
    fixture.detectChanges();
    const pagina = fixture.componentInstance;
    const cartao = pagina.cartoes()[0];
    pagina.periodoFiltro.set({ inicio: '2026-11-01', fim: '2026-11-09' });
    pagina.solicitarCancelamento(cartao);
    vi.setSystemTime(new Date('2026-11-07T03:00:01Z'));
    pagina.cancelarReserva(cartao);
    http.expectNone('/api/reservas/31/cancelamento');
    expect(pagina.periodoFiltro()).toEqual({ inicio: '2026-11-01', fim: '2026-11-09' });
    expect(pagina.visiveis()).toHaveLength(1);
  });

  it('exibe a mesa fixa do usuário sem oferecer cancelamento', () => {
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();

    http.expectOne('/api/reservas/minhas').flush([]);
    http.expectOne('/api/mesas').flush([mesaDaMaria, mesaDeOutroUsuario]);
    fixture.detectChanges();

    const conteudo = fixture.nativeElement.textContent as string;
    expect(fixture.nativeElement.querySelector('.minhas-reservas__status--atribuida')?.textContent).toContain(
      'Mesa fixa',
    );
    expect(conteudo).toContain('Mesa 001 - TAMBORÉ');
    expect(conteudo).not.toContain('Mesa 002 - TAMBORÉ');
    expect(conteudo).toContain('Para reservar outra mesa, solicite à administração a remoção deste vínculo.');
    expect(fixture.nativeElement.querySelector('.minhas-reservas__cartao--fixa button')).toBeNull();
  });

  it('informa quando não consegue consultar as mesas atribuídas', () => {
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();

    http.expectOne('/api/reservas/minhas').flush([]);
    http.expectOne('/api/mesas').flush({}, { status: 500, statusText: 'Erro' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Não foi possível carregar sua mesa atribuída. Tente novamente.',
    );
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('não atribui mesas por nome, mesmo com homônimos ou texto legado', () => {
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();

    http.expectOne('/api/reservas/minhas').flush([]);
    http.expectOne('/api/mesas').flush([
      { ...mesaDaMaria, id: 3, codigo: '003', responsavel: null, ocupante: ' maria ' },
      { ...mesaDaMaria, id: 4, codigo: '004', responsavel: null, ocupante: 'João' },
      { ...mesaDeOutroUsuario, id: 5, codigo: '005', ocupante: 'Maria' },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Mesa 003 - TAMBORÉ');
    expect(fixture.nativeElement.textContent).not.toContain('Mesa 004 - TAMBORÉ');
    expect(fixture.nativeElement.textContent).not.toContain('Mesa 005 - TAMBORÉ');
  });

  it('exibe vínculo pelo ID mesmo inativo ou com nome alterado, incluindo tipo legado inconsistente', () => {
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();
    http.expectOne('/api/reservas/minhas').flush([]);
    http.expectOne('/api/mesas').flush([
      { ...mesaDaMaria, ativa: false, ocupante: 'Outro texto',
        responsavel: { ...mesaDaMaria.responsavel!, nome: 'Nome atualizado', email: 'novo@teste.com' } },
      { ...mesaDaMaria, id: 6, codigo: '006', tipo: 'LIVRE' },
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Mesa 001 - TAMBORÉ');
    expect(fixture.nativeElement.textContent).toContain('Mesa 006 - TAMBORÉ');
    expect(fixture.nativeElement.textContent).toContain('Mesa vinculada');
  });

  it('mostra reservas criadas pelo administrador sem permitir cancelamento ao beneficiário', () => {
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();

    http.expectOne('/api/reservas/minhas').flush([{
      id: 21,
      usuarioId: 7,
      status: 'CONFIRMADA',
      data: '2099-01-01',
      criadaEm: '2098-12-20T12:00:00',
      criador: { id: 9, nome: 'Admin', perfil: 'ADMIN' },
      mesa: { id: 9, codigo: '009', regiao: 'TAMBORÉ' },
      solicitante: { id: 7, nome: 'Maria', email: 'maria@teste.com' },
    }]);
    http.expectOne('/api/mesas').flush([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Reserva realizada pelo administrador.');
    expect(fixture.nativeElement.querySelector('.minhas-reservas__acao--cancelar')).toBeNull();
  });

  it('administra a lista geral e consegue cancelar reservas de outros usuários', () => {
    TestBed.inject(AuthService).sessao.set({
      token: 'token-admin',
      tipo: 'Bearer',
      usuario: { id: 9, nome: 'Admin', email: 'admin@teste.com', perfil: 'ADMIN' },
    });
    const mesaAtribuidaAoAdmin: Mesa = {
      ...mesaDaMaria,
      responsavel: { id: 9, nome: 'Admin', email: 'admin@teste.com' },
    };

    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();

    http.expectOne('/api/admin/reservas').flush([{
      id: 22,
      usuarioId: 8,
      status: 'CONFIRMADA',
      data: '2099-01-01',
      criadaEm: '2098-12-20T12:00:00',
      criador: { id: 9, nome: 'Admin', perfil: 'ADMIN' },
      mesa: { id: 10, codigo: '010', regiao: 'TAMBORÉ' },
      solicitante: { id: 8, nome: 'João', email: 'joao@teste.com' },
    }]);
    http.expectOne('/api/mesas').flush([mesaAtribuidaAoAdmin]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Gerenciar reservas');
    expect(fixture.nativeElement.textContent).toContain('Para João');
    expect(fixture.nativeElement.querySelector('.minhas-reservas__acao--cancelar')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Esta mesa é gerenciada pelo administrador.');
  });
});
