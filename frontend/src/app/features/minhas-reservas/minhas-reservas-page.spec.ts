import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { AuthService } from '../../core/auth/auth.service';
import { Mesa } from '../mesas/mesa';
import { CalendarioReserva } from '../reservas/calendario-reserva';
import { CalendarioSaoPaulo } from '../reservas/calendario-sao-paulo';
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

function esperarReservas(http: HttpTestingController, resposta: object | object[], extras: Record<string, string> = {}) {
  const params = { pagina: '0', tamanho: '10', canceladas: 'false', ...extras };
  http.expectOne(r => r.url === '/api/reservas/minhas/pagina' && Object.entries(params).every(([k, v]) => r.params.get(k) === v)).flush(
    Array.isArray(resposta) ? { conteudo: resposta, pagina: 0, tamanho: 10, totalRegistros: resposta.length, totalPaginas: 1 } : resposta
  );
}

function esperarAdminReservas(http: HttpTestingController, resposta: object | object[], extras: Record<string, string> = {}) {
  const params = { pagina: '0', tamanho: '10', canceladas: 'false', ...extras };
  http.expectOne(r => r.url === '/api/admin/reservas/pagina' && Object.entries(params).every(([k, v]) => r.params.get(k) === v)).flush(
    Array.isArray(resposta) ? { conteudo: resposta, pagina: 0, tamanho: 10, totalRegistros: resposta.length, totalPaginas: 1 } : resposta
  );
}

describe('MinhasReservasPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-10T15:00:00Z'));
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

  it.each(['USUARIO', 'ADMIN'])('cancela consultas anteriores ao trocar filtros como %s', perfil => {
    TestBed.inject(AuthService).sessao.update(sessao => sessao && ({
      ...sessao, usuario: { ...sessao.usuario, perfil },
    }));
    const endpoint = perfil === 'ADMIN' ? '/api/admin/reservas/pagina' : '/api/reservas/minhas/pagina';
    const consultar = (status?: string) => http.expectOne(r =>
      r.url === endpoint && r.params.get('dataInicio') === '2026-11-10' &&
      r.params.get('status') === (status ?? null) &&
      r.params.get('pagina') === '0' && r.params.get('tamanho') === '10',
    );
    const vazia = { conteudo: [], totalRegistros: 0, totalPaginas: 0, pagina: 0, tamanho: 10 };
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();
    http.expectOne('/api/mesas').flush([]);
    const inicial = consultar();
    const pagina = fixture.componentInstance;

    pagina.selecionarData('inicio', '2026-11-10');
    expect(inicial.cancelled).toBe(true);
    const porData = consultar();
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = 'CONFIRMADA';
    select.dispatchEvent(new Event('change'));
    expect(porData.cancelled).toBe(true);
    const porStatus = consultar('CONFIRMADA');
    pagina.limparFiltros();
    expect(porStatus.cancelled).toBe(true);
    const atual = consultar();
    expect(pagina.carregando()).toBe(true);
    expect(pagina.erroApi()).toBeNull();
    expect(() => inicial.flush([])).toThrow();
    expect(pagina.carregando()).toBe(true);
    atual.flush(vazia);
    expect(pagina.carregando()).toBe(false);
    expect(pagina.reservas()).toEqual([]);
    expect(pagina.erroApi()).toBeNull();

    pagina.buscar();
    consultar().flush({}, { status: 500, statusText: 'Erro' });
    expect(pagina.erroApi()).not.toBeNull();
    pagina.buscar();
    consultar().flush(vazia);
    expect(pagina.erroApi()).toBeNull();
    expect(pagina.carregando()).toBe(false);
  });

  it('cancela a consulta pendente ao informar período inválido e permite corrigir', () => {
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();
    http.expectOne('/api/mesas').flush([]);
    const inicial = http.expectOne(r => r.url === '/api/reservas/minhas/pagina');
    const pagina = fixture.componentInstance;
    pagina.selecionarData('inicio', '2026-11-10');
    expect(inicial.cancelled).toBe(true);
    const pendente = http.expectOne(r => r.url === '/api/reservas/minhas/pagina');
    pagina.selecionarData('fim', '2026-11-09');
    expect(pendente.cancelled).toBe(true);
    expect(pagina.periodoInvalido()).toBe(true);
    expect(pagina.carregando()).toBe(false);
    expect(pagina.reservas()).toEqual([]);
    http.expectNone(request => request.url === '/api/reservas/minhas/pagina');
    pagina.selecionarData('fim', '2026-11-11');
    esperarReservas(http, [], { dataInicio: '2026-11-10', dataFim: '2026-11-11' });
    expect(pagina.periodoInvalido()).toBe(false);
    expect(pagina.carregando()).toBe(false);
    pagina.buscar();
    const aoDestruir = http.expectOne(r => r.url === '/api/reservas/minhas/pagina');
    fixture.destroy();
    expect(aoDestruir.cancelled).toBe(true);
  });

  it('pagina com contagem e numeração globais, cancelando a página anterior', () => {
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();
    http.expectOne('/api/mesas').flush([]);
    esperarReservas(http, {
      conteudo: [], pagina: 0, tamanho: 10, totalRegistros: 25, totalPaginas: 3,
    }, { dataInicio: '2026-11-10' });
    const pagina = fixture.componentInstance;
    expect(pagina.totalRegistros()).toBe(25);
    pagina.trocarPagina(1);
    const anterior = http.expectOne(r =>
      r.url === '/api/reservas/minhas/pagina' && r.params.get('pagina') === '1',
    );
    pagina.trocarPagina(2);
    expect(anterior.cancelled).toBe(true);
    esperarReservas(http, {
      conteudo: [{
        id: 21, usuarioId: 7, data: '2026-11-20', status: 'CONFIRMADA',
        mesa: { id: 44, codigo: '044', regiao: 'TAMBORÉ' },
      }],
      pagina: 2, tamanho: 10, totalRegistros: 25, totalPaginas: 3,
    }, { pagina: '2' });
    expect(pagina.cartoes()[0].posicao).toBe(21);
    pagina.trocarTamanho(20);
    esperarReservas(http, [], { pagina: '0', tamanho: '20' });
    expect(pagina.paginaAtual()).toBe(0);
    expect(pagina.tamanhoPagina()).toBe(20);
    expect(pagina.totalRegistros()).toBe(0);
  });

  it('volta à última página válida e não consulta datas passadas na aba Ativas', () => {
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();
    http.expectOne('/api/mesas').flush([]);
    esperarReservas(http, []);
    const pagina = fixture.componentInstance;
    pagina.trocarPagina(2);
    esperarReservas(http, {
      conteudo: [], pagina: 2, tamanho: 10, totalRegistros: 11, totalPaginas: 2,
    }, { pagina: '2' });
    esperarReservas(http, [], { pagina: '1' });
    expect(pagina.paginaAtual()).toBe(1);
    pagina.selecionarData('inicio', '2020-01-01');
    esperarReservas(http, [], { dataInicio: '2026-11-10' });
    pagina.selecionarData('fim', '2020-01-31');
    http.expectNone(r => r.url === '/api/reservas/minhas/pagina');
    expect(pagina.totalRegistros()).toBe(0);
    expect(pagina.carregando()).toBe(false);
    pagina.trocarFiltro('canceladas');
    esperarReservas(http, [], {
      canceladas: 'true', dataInicio: '2020-01-01', dataFim: '2020-01-31',
    });
  });

  it('mantém hoje nas ativas após 21h e remove na virada sem recarregar nem perder filtros', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T01:30:00Z'));
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();
    const reservaHoje = {
      id: 31, usuarioId: 7, status: 'CONFIRMADA', data: '2026-11-06',
      criadaEm: '2026-11-05T12:00:00',
      mesa: { id: 44, codigo: '044', regiao: 'TAMBORÉ' },
    };
    const reservaFutura = { ...reservaHoje, id: 32, data: '2026-11-09' };
    esperarReservas(http, [reservaHoje, reservaFutura]);
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
    expect(pagina.filtro()).toBe('ativas');
    expect(pagina.podeCancelar(cartaoHoje)).toBe(false);
    pagina.trocarFiltro('canceladas');
    esperarReservas(http, [], { canceladas: 'true' });
    expect(pagina.visiveis()).toEqual([]);
    http.expectNone('/api/reservas/minhas');
  });

  it.each(['2026-11-07T02:59:59Z', '2026-11-07T02:59:59.999Z'])(
    'preserva período personalizado e revalida cancelamento em aba suspensa a partir de %s', (instante) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(instante));
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();
    esperarReservas(http, [{
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
    expect(pagina.visiveis()).toHaveLength(0);
  });

  it('separa ativas de canceladas e mantém as abas combinadas com o período', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T15:00:00Z'));
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();
    const base = {
      usuarioId: 7, criadaEm: '2026-11-01T12:00:00',
      mesa: { id: 44, codigo: '044', regiao: 'TAMBORÉ' },
    };
    const reservas = [
      { ...base, id: 1, data: '2026-11-09', status: 'CONFIRMADA' },
      { ...base, id: 2, data: '2026-11-10', status: 'CONFIRMADA' },
      { ...base, id: 3, data: '2026-11-12', status: 'CONFIRMADA' },
      { ...base, id: 4, data: '2026-11-08', status: 'CANCELADA' },
      { ...base, id: 5, data: '2026-11-13', status: 'CANCELADA' },
    ];
    esperarReservas(http, reservas.filter(r => r.status === 'CONFIRMADA' && r.data >= '2026-11-10'),
      { dataInicio: '2026-11-10' });
    http.expectOne('/api/mesas').flush([]);
    fixture.detectChanges();
    const pagina = fixture.componentInstance;
    const abas = fixture.nativeElement.querySelectorAll('.minhas-reservas__filtro') as NodeListOf<HTMLButtonElement>;
    expect(abas[0].textContent?.trim()).toBe('Ativas');
    expect(abas[1].textContent?.trim()).toBe('Canceladas');
    expect(pagina.visiveis().map(r => r.id)).toEqual([2, 3]);
    const statusConfirmada = fixture.nativeElement.querySelector(
      '.minhas-reservas__linha--reserva > .minhas-reservas__status--confirmada',
    ) as HTMLElement;
    expect(statusConfirmada.textContent?.trim()).toBe('Confirmada');
    expect(statusConfirmada.closest('.minhas-reservas__identificacao')).toBeNull();
    abas[1].click();
    esperarReservas(http, reservas.filter(r => r.status === 'CANCELADA'), { canceladas: 'true' });
    fixture.detectChanges();
    expect(abas[1].getAttribute('aria-pressed')).toBe('true');
    expect(pagina.visiveis().map(r => r.id)).toEqual([5, 4]);
    expect(fixture.nativeElement.querySelector(
      '.minhas-reservas__linha--reserva > .minhas-reservas__status--cancelada',
    )?.textContent.trim()).toBe('Cancelada');
    pagina.selecionarData('inicio', '2026-11-10');
    esperarReservas(http, reservas.filter(r => r.status === 'CANCELADA' && r.data >= '2026-11-10'),
      { canceladas: 'true', dataInicio: '2026-11-10' });
    fixture.detectChanges();
    expect(pagina.visiveis().map(r => r.id)).toEqual([5]);
    expect(abas[0].disabled).toBe(false);
    abas[0].click();
    esperarReservas(http, reservas.filter(r => r.status === 'CONFIRMADA' && r.data >= '2026-11-10'),
      { dataInicio: '2026-11-10' });
    fixture.detectChanges();
    expect(pagina.visiveis().map(r => r.id)).toEqual([2, 3]);
    pagina.limparFiltros();
    esperarReservas(http, reservas.filter(r => r.status === 'CONFIRMADA' && r.data >= '2026-11-10'));
    fixture.detectChanges();
    expect(pagina.filtro()).toBe('ativas');
    expect(pagina.visiveis().map(r => r.id)).toEqual([2, 3]);
  });

  it('exibe a mesa fixa do usuário sem oferecer cancelamento', () => {
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();

    esperarReservas(http, []);
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
    esperarReservas(http, []);
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
    esperarReservas(http, [], { dataInicio: TestBed.inject(CalendarioSaoPaulo).hoje() });
    expect(calendarios[1].componentInstance.bloquearFinaisDeSemana()).toBe(false);
  });

  it('informa quando não consegue consultar as mesas atribuídas', () => {
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();

    esperarReservas(http, []);
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

    esperarReservas(http, []);
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
    esperarReservas(http, []);
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
    };
    esperarReservas(http, [diaria]);
    http.expectOne('/api/mesas').flush([mesaDaMaria]);
    fixture.detectChanges();
    
    expect(fixture.nativeElement.textContent).toContain('Reserva realizada pelo administrador em seu nome');
    expect(fixture.nativeElement.textContent).not.toContain('Para alterações, entre em contato com a administração.');
    fixture.nativeElement.querySelector('.minhas-reservas__acao--cancelar').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cancelar esta reserva?');
    fixture.nativeElement.querySelector('.minhas-reservas__acao--perigo').click();
    fixture.detectChanges();
    const cancelamento = http.expectOne('/api/reservas/21/cancelamento');
    expect(cancelamento.request.method).toBe('PATCH');
    cancelamento.flush(null);
    expect(TestBed.inject(ToastService).toasts()).toEqual([
      expect.objectContaining({ tipo: 'cancelamento', titulo: 'Reserva cancelada' }),
    ]);
    esperarReservas(http, []);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.minhas-reservas__acao--cancelar')).toBeNull();
    expect(fixture.nativeElement.querySelector('.minhas-reservas__cartao--fixa')?.textContent).toContain('Mesa 001');
    expect(fixture.nativeElement.querySelector('.minhas-reservas__cartao--fixa button')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Reserva realizada pelo administrador em seu nome.');
    fixture.componentInstance.trocarFiltro('canceladas');
    esperarReservas(http, [{ ...diaria, status: 'CANCELADA', canceladaEm: '2098-12-20T13:00:00' }],
      { canceladas: 'true' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Reserva realizada pelo administrador em seu nome.');
    http.expectNone(request => request.url.startsWith('/api/admin/mesas'));
  });

  it.each([
    { usuarioId: 8, data: '2099-01-01', status: 'CONFIRMADA', motivo: 'reserva de terceiro' },
    { usuarioId: 7, data: '2099-01-01', status: 'CANCELADA', motivo: 'reserva cancelada' },
    { usuarioId: 7, data: '2000-01-01', status: 'CONFIRMADA', motivo: 'critério de data existente' },
  ])('preserva a restrição de cancelamento para $motivo', caso => {
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();
    
    esperarReservas(http, [{
      id: 21, ...caso, criadaEm: '1999-12-20T12:00:00',
      criador: { id: 9, nome: 'Admin', perfil: 'ADMIN' },
      mesa: { id: 9, codigo: '009', regiao: 'TAMBORÉ' },
    }]);
    http.expectOne('/api/mesas').flush([]);
    if (caso.status === 'CANCELADA') {
      fixture.componentInstance.trocarFiltro('canceladas');
      esperarReservas(http, [], { canceladas: 'true' });
    }
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.minhas-reservas__acao--cancelar')).toBeNull();
    fixture.componentInstance.cancelarReserva({
      chave: 'reserva-teste', posicao: null,
      reserva: {
        id: 21, usuarioId: caso.usuarioId, data: caso.data,
        status: caso.status as 'CONFIRMADA' | 'CANCELADA',
        criadaEm: '1999-12-20T12:00:00',
        mesa: { id: 9, codigo: '009', regiao: 'TAMBORÉ' },
      },
    });
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

    esperarAdminReservas(http, [{
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
    const beneficiario = fixture.nativeElement.querySelector(
      '.minhas-reservas__linha--reserva .minhas-reservas__detalhes',
    ) as HTMLElement;
    expect(beneficiario.nextElementSibling?.classList.contains('minhas-reservas__meta')).toBe(true);
    expect(fixture.nativeElement.querySelector('.minhas-reservas__acao--cancelar')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Esta mesa é gerenciada pelo administrador.');
  });
});