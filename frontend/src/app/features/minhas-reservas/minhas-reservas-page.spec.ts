import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { AuthService } from '../../core/auth/auth.service';
import { Mesa } from '../mesas/mesa';
import { CalendarioReserva } from '../reservas/calendario-reserva';
import { MinhasReservasPage } from './minhas-reservas-page';
import { ToastService } from '../../shared/toast/toast';

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

  function carregarReservas(conteudo: readonly unknown[], admin = false) {
    http.expectOne(r => r.url === (admin ? '/api/admin/reservas/pagina' : '/api/reservas/minhas/pagina'))
      .flush({ conteudo, pagina: 0, tamanho: 10, totalRegistros: conteudo.length, totalPaginas: conteudo.length ? 1 : 0 });
  }

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

  it('mantém não canceladas nas ativas na virada de São Paulo sem perder filtros', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T01:30:00Z'));
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();
    const reserva = {
      id: 31, usuarioId: 7, status: 'CONFIRMADA', data: '2026-11-06',
      criadaEm: '2026-11-05T12:00:00',
      mesa: { id: 44, codigo: '044', regiao: 'TAMBORÉ' },
    };
    carregarReservas([
      reserva, { ...reserva, id: 32, data: '2026-11-09' },
      { ...reserva, id: 30, data: '2026-11-05' },
    ]);
    http.expectOne('/api/mesas').flush([]);
    fixture.detectChanges();
    const pagina = fixture.componentInstance;
    expect(pagina.visiveis().map(r => r.data)).toEqual(['2026-11-06', '2026-11-09', '2026-11-05']);
    const cartaoHoje = pagina.cartoes()[0];
    expect(pagina.podeCancelar(cartaoHoje)).toBe(true);
    pagina.statusFiltro.set('CONFIRMADA');
    vi.advanceTimersByTime(90 * 60 * 1000);
    fixture.detectChanges();
    expect(pagina.visiveis().map(r => r.data)).toEqual(['2026-11-06', '2026-11-09', '2026-11-05']);
    expect(pagina.statusFiltro()).toBe('CONFIRMADA');
    expect(pagina.filtro()).toBe('ativas');
    expect(pagina.podeCancelar(cartaoHoje)).toBe(false);
    http.expectNone(r => r.url === '/api/reservas/minhas/pagina');
  });

  it.each(['2026-11-07T02:59:59Z', '2026-11-07T02:59:59.999Z'])(
    'preserva período personalizado e revalida cancelamento após virada do dia em São Paulo a partir de %s',
    (instante) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(instante));
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();
    carregarReservas([{
      id: 31, usuarioId: 7, status: 'CONFIRMADA', data: '2026-11-06',
      criadaEm: '2026-11-05T12:00:00', mesa: { id: 44, codigo: '044', regiao: 'TAMBORÉ' },
    }]);
    http.expectOne('/api/mesas').flush([]);
    fixture.detectChanges();
    const pagina = fixture.componentInstance;
    const cartao = pagina.cartoes()[0];
    expect(pagina.podeCancelar(cartao)).toBe(true);
    pagina.periodoFiltro.set({ inicio: '2026-11-01', fim: '2026-11-09' });
    pagina.solicitarCancelamento(cartao);
    vi.setSystemTime(new Date('2026-11-07T03:00:01Z'));
    pagina.cancelarReserva(cartao);
    expect(pagina.podeCancelar(cartao)).toBe(false);
    http.expectNone('/api/reservas/31/cancelamento');
    expect(pagina.periodoFiltro()).toEqual({ inicio: '2026-11-01', fim: '2026-11-09' });
    expect(pagina.visiveis()).toHaveLength(1);
  });

  it('exibe a mesa fixa do usuário sem oferecer cancelamento', () => {
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();

    carregarReservas([]);
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

  it('usa o calendário compartilhado nos dois filtros e permite escolher datas históricas', () => {
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();
    carregarReservas([]);
    http.expectOne('/api/mesas').flush([]);
    fixture.detectChanges();

    const calendarios = fixture.debugElement.queryAll(By.directive(CalendarioReserva));
    expect(calendarios).toHaveLength(2);
    const dialogo = calendarios[0].nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialogo.close = vi.fn();
    calendarios[0].componentInstance.selecionar('2020-10-31');
    fixture.detectChanges();

    expect((fixture.nativeElement.querySelector('#filtro-data-inicio') as HTMLInputElement).value)
      .toBe('2020-10-31');
    const consulta = http.expectOne(r => r.url === '/api/reservas/minhas/pagina');
    expect(consulta.request.params.get('dataInicio')).toBe('2020-10-31');
    consulta.flush({ conteudo: [], pagina: 0, tamanho: 10, totalRegistros: 0, totalPaginas: 0 });
    expect(calendarios[1].componentInstance.bloquearFinaisDeSemana()).toBe(false);
  });

  it('informa quando não consegue consultar as mesas atribuídas', () => {
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();

    carregarReservas([]);
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

    carregarReservas([]);
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
    carregarReservas([]);
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

  it('permite ao beneficiário cancelar diária criada pelo administrador sem remover sua mesa fixa', () => {
    const sucesso = vi.spyOn(TestBed.inject(ToastService), 'sucesso');
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();

    const diaria = {
      id: 21,
      usuarioId: 7,
      status: 'CONFIRMADA',
      data: '2099-01-01',
      criadaEm: '2098-12-20T12:00:00',
      criador: { id: 9, nome: 'Admin', perfil: 'ADMIN' },
      mesa: { id: 9, codigo: '009', regiao: 'TAMBORÉ' },
      solicitante: { id: 7, nome: 'Maria', email: 'maria@teste.com' },
    };
    carregarReservas([diaria]);
    http.expectOne('/api/mesas').flush([mesaDaMaria]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Reserva realizada pelo administrador em seu nome.');
    expect(fixture.nativeElement.textContent).not.toContain('Para alterações, entre em contato com a administração.');
    expect(fixture.nativeElement.querySelector('.minhas-reservas__linha > .minhas-reservas__status')).not.toBeNull();
    fixture.nativeElement.querySelector('.minhas-reservas__acao--cancelar').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cancelar esta reserva?');
    fixture.nativeElement.querySelector('.minhas-reservas__acao--perigo').click();
    fixture.detectChanges();
    const cancelamento = http.expectOne('/api/reservas/21/cancelamento');
    expect(cancelamento.request.method).toBe('PATCH');
    expect(sucesso).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.minhas-reservas__acao--perigo').disabled).toBe(true);
    cancelamento.flush(null);
    carregarReservas([]);
    fixture.detectChanges();
    expect(sucesso).toHaveBeenCalledExactlyOnceWith('Reserva cancelada', 'Mesa 009 foi liberada.');
    expect(fixture.nativeElement.querySelector('.minhas-reservas__acao--cancelar')).toBeNull();
    expect(fixture.nativeElement.querySelector('.minhas-reservas__cartao--fixa')?.textContent).toContain('Mesa 001');
    expect(fixture.nativeElement.querySelector('.minhas-reservas__cartao--fixa button')).toBeNull();
    http.expectNone(request => request.url.startsWith('/api/admin/mesas'));
  });

  it('identifica cancelada administrativa sem prometer novo cancelamento', () => {
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.componentInstance.filtro.set('canceladas');
    fixture.detectChanges();
    carregarReservas([{
      id: 21, usuarioId: 7, status: 'CANCELADA', data: '2026-10-28',
      criador: { id: 9, nome: 'Admin', perfil: 'ADMIN' },
      mesa: { id: 9, codigo: '009', regiao: 'TAMBORÉ' },
      solicitante: { id: 7, nome: 'Maria', email: 'maria@teste.com' },
    }]);
    http.expectOne('/api/mesas').flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Reserva realizada pelo administrador em seu nome.');
    expect(fixture.nativeElement.textContent).not.toContain('Você pode cancelá-la.');
    expect(fixture.nativeElement.querySelector('.minhas-reservas__acao--cancelar')).toBeNull();
    http.expectNone(request => request.url.startsWith('/api/admin/mesas'));
  });

  it.each([
    { usuarioId: 8, data: '2099-01-01', status: 'CONFIRMADA', motivo: 'reserva de terceiro' },
    { usuarioId: 7, data: '2099-01-01', status: 'CANCELADA', motivo: 'reserva cancelada' },
  ])('preserva a restrição de cancelamento para $motivo', caso => {
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();
    const diaria = {
      id: 21, ...caso, criadaEm: '1999-12-20T12:00:00',
      criador: { id: 9, nome: 'Admin', perfil: 'ADMIN' },
      mesa: { id: 9, codigo: '009', regiao: 'TAMBORÉ' },
    };
    if (caso.status === 'CANCELADA') fixture.componentInstance.filtro.set('canceladas');
    carregarReservas([diaria]);
    http.expectOne('/api/mesas').flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.minhas-reservas__acao--cancelar')).toBeNull();
    fixture.componentInstance.cancelarReserva(fixture.componentInstance.cartoes()[0]);
    http.expectNone('/api/reservas/21/cancelamento');
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

    carregarReservas([{
      id: 22,
      usuarioId: 8,
      status: 'CONFIRMADA',
      data: '2099-01-01',
      criadaEm: '2098-12-20T12:00:00',
      criador: { id: 9, nome: 'Admin', perfil: 'ADMIN' },
      mesa: { id: 10, codigo: '010', regiao: 'TAMBORÉ' },
      solicitante: { id: 8, nome: 'João', email: 'joao@teste.com' },
    }], true);
    http.expectOne('/api/mesas').flush([mesaAtribuidaAoAdmin]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Gerenciar reservas');
    expect(fixture.nativeElement.textContent).toContain('Para João');
    expect(fixture.nativeElement.querySelector('.minhas-reservas__acao--cancelar')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Esta mesa é gerenciada pelo administrador.');
  });

  it('combina situação e datas, reseta página e cancela consultas anteriores', () => {
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();
    const primeira = http.expectOne(r => r.url === '/api/reservas/minhas/pagina');
    http.expectOne('/api/mesas').flush([]);
    fixture.componentInstance.trocarFiltro('canceladas');
    expect(primeira.cancelled).toBe(true);
    const canceladas = http.expectOne(r => r.url === '/api/reservas/minhas/pagina');
    expect(canceladas.request.params.get('canceladas')).toBe('true');
    canceladas.flush({ conteudo: [], pagina: 0, tamanho: 10, totalRegistros: 25, totalPaginas: 3 });
    fixture.componentInstance.trocarPagina(2);
    const pagina = http.expectOne(r => r.url === '/api/reservas/minhas/pagina');
    expect(pagina.request.params.get('pagina')).toBe('2');
    fixture.componentInstance.selecionarData('inicio', '2020-01-01');
    expect(pagina.cancelled).toBe(true);
    const comPeriodo = http.expectOne(r => r.url === '/api/reservas/minhas/pagina');
    expect(comPeriodo.request.params.get('pagina')).toBe('0');
    expect(comPeriodo.request.params.get('canceladas')).toBe('true');
    expect(comPeriodo.request.params.get('dataInicio')).toBe('2020-01-01');
    comPeriodo.flush({ conteudo: [], pagina: 0, tamanho: 10, totalRegistros: 0, totalPaginas: 0 });
    expect(fixture.componentInstance.filtro()).toBe('canceladas');
  });

  it('mantém reservas passadas em ativas sem permitir cancelá-las e usa IDs distintos', () => {
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();
    const reserva = { usuarioId: 7, data: '2020-01-01', criadaEm: '2019-12-20T12:00:00',
      mesa: { id: 9, codigo: '009', regiao: 'TAMBORÉ' } };
    carregarReservas([{ ...reserva, id: 31, status: 'CONFIRMADA' }, { ...reserva, id: 32, status: 'PENDENTE' }]);
    http.expectOne('/api/mesas').flush([]);
    fixture.detectChanges();
    expect(fixture.componentInstance.cartoes().map(c => c.chave)).toEqual(['31', '32']);
    expect(fixture.nativeElement.querySelectorAll('.minhas-reservas__acao--cancelar')).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain('Ativas');
  });
});
