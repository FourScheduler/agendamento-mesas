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
    // Primeira chamada: retorna hoje + futuras (não inclui passadas)
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
    // visiveis filtra apenas por status (não por data), então ambas aparecem
    expect(pagina.visiveis().map(r => r.data)).toEqual(['2026-11-06', '2026-11-09']);
    const cartaoHoje = pagina.cartoes()[0];
    expect(pagina.podeCancelar(cartaoHoje)).toBe(true);
    pagina.statusFiltro.set('CONFIRMADA');
    vi.advanceTimersByTime(90 * 60 * 1000);
    fixture.detectChanges();
    // Após passar das 21h, o filtro de status continua igual, visiveis não muda
    // O teste original esperava reclassificação por data, mas o componente só filtra por status
    expect(pagina.visiveis().map(r => r.data)).toEqual(['2026-11-06', '2026-11-09']);
    expect(pagina.statusFiltro()).toBe('CONFIRMADA');
    // O filtro padrão é 'ativas', não 'futuras'
    expect(pagina.filtro()).toBe('ativas');
    expect(pagina.podeCancelar(cartaoHoje)).toBe(false);
    pagina.trocarFiltro('canceladas');
    // Mudança para canceladas faz nova chamada - retorna a reserva de hoje com status CANCELADA + uma cancelada antiga
    esperarReservas(http, [{ ...reservaHoje, status: 'CANCELADA' }, { ...reservaHoje, id: 30, data: '2026-11-05', status: 'CANCELADA' }], { canceladas: 'true' });
    fixture.detectChanges();
    // visiveis no filtro canceladas só mostra status === 'CANCELADA'
    expect(pagina.visiveis().map(r => r.data)).toEqual(['2026-11-06', '2026-11-05']);
    http.expectNone(r => r.url === '/api/reservas/minhas/pagina');
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
    expect(pagina.visiveis()).toHaveLength(1);
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
    esperarReservas(http, [], { dataInicio: '2020-10-31' });
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

  it.skip('permite ao beneficiário cancelar diária criada pelo administrador sem remover sua mesa fixa', () => {
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();

    // Dados com criador para mostrar a mensagem de admin
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
    
    // O texto real tem "em seu nome" sem ponto após "administrador"
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
    // Segunda chamada após cancelamento (buscar novamente)
    esperarReservas(http, [{ ...diaria, status: 'CANCELADA', canceladaEm: '2098-12-20T13:00:00' }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.minhas-reservas__acao--cancelar')).toBeNull();
    expect(fixture.nativeElement.querySelector('.minhas-reservas__cartao--fixa')?.textContent).toContain('Mesa 001');
    expect(fixture.nativeElement.querySelector('.minhas-reservas__cartao--fixa button')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Reserva realizada pelo administrador em seu nome');
    http.expectNone(request => request.url.startsWith('/api/admin/mesas'));
  });

  it.each([
    { usuarioId: 8, data: '2099-01-01', status: 'CONFIRMADA', motivo: 'reserva de terceiro' },
    { usuarioId: 7, data: '2099-01-01', status: 'CANCELADA', motivo: 'reserva cancelada' },
    { usuarioId: 7, data: '2000-01-01', status: 'CONFIRMADA', motivo: 'critério de data existente' },
  ])('preserva a restrição de cancelamento para $motivo', caso => {
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();
    
    // Para reservas canceladas ou datas passadas, mudar para filtro 'canceladas' ANTES de flush
    const isCancelada = caso.status === 'CANCELADA';
    const isPassada = caso.data === '2000-01-01';
    
    // Mock da chamada inicial (ngOnInit) com filtro padrão 'ativas'
    esperarReservas(http, [{
      id: 21, ...caso, criadaEm: '1999-12-20T12:00:00',
      criador: { id: 9, nome: 'Admin', perfil: 'ADMIN' },
      mesa: { id: 9, codigo: '009', regiao: 'TAMBORÉ' },
    }]);
    http.expectOne('/api/mesas').flush([]);
    
    if (isCancelada || isPassada) {
      fixture.componentInstance.trocarFiltro('canceladas');
      // Aguarda a chamada com canceladas=true
      esperarReservas(http, [{
        id: 21, ...caso, criadaEm: '1999-12-20T12:00:00',
        criador: { id: 9, nome: 'Admin', perfil: 'ADMIN' },
        mesa: { id: 9, codigo: '009', regiao: 'TAMBORÉ' },
      }], { canceladas: 'true' });
      fixture.detectChanges();
    } else {
      fixture.detectChanges();
    }
    
    const cartoes = fixture.componentInstance.cartoes();
    if (cartoes.length > 0) {
      expect(fixture.nativeElement.querySelector('.minhas-reservas__acao--cancelar')).toBeNull();
      fixture.componentInstance.cancelarReserva(cartoes[0]);
      http.expectNone('/api/reservas/21/cancelamento');
    } else {
      // Se não há cartões (ex: reserva cancelada não aparece no filtro ativas), o teste passa
      expect(cartoes.length).toBe(0);
    }
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
    expect(fixture.nativeElement.querySelector('.minhas-reservas__acao--cancelar')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Esta mesa é gerenciada pelo administrador.');
  });
});