import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MapaPage } from './mapa-page';
import { AuthService } from '../../core/auth/auth.service';
import { Mesa } from '../mesas/mesa';
import { provideRouter, Router } from '@angular/router';
import { ToastService } from '../../shared/toast/toast';
import { AgendamentoPage } from '../agendamento/agendamento-page';

const mesa: Mesa = {
  id: 44, codigo: '044', regiao: 'DEMO', tipo: 'LIVRE', ativa: true,
  ocupante: 'Teste', referenciaVisual: { planta: 'DEMO', x: 24, y: 24 }, ocupada: false,
};
const usuario = { id: 7, nome: 'Maria', email: 'maria@teste.com', perfil: 'USUARIO' };

const mockToastService = {
  mostrar: vi.fn(),
  sucesso: vi.fn(),
  cancelamento: vi.fn(),
  erro: vi.fn(),
  info: vi.fn(),
  aviso: vi.fn(),
  remover: vi.fn(),
  limpar: vi.fn(),
  toasts: () => [],
};

describe('Reserva diária pela planta', () => {
  let http: HttpTestingController;
  beforeAll(() => {
    Object.defineProperties(HTMLElement.prototype, {
      showPopover: { configurable: true, writable: true, value: vi.fn() },
      hidePopover: { configurable: true, writable: true, value: vi.fn() },
    });
  });
  afterAll(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'showPopover');
    Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover');
  });

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-27T12:00:00Z'));
    TestBed.configureTestingModule({ 
      providers: [
        provideRouter([]), 
        provideHttpClient(), 
        provideHttpClientTesting(),
        { provide: ToastService, useValue: mockToastService },
      ] 
    });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
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

  function carregar(
    disponiveis: readonly Mesa[] = [mesa],
    data = '2026-10-28',
    endpoint = '/api/mesas/com-ocupacao',
  ) {
    http.expectOne(r => r.url === endpoint).flush([mesa]);
    const consulta = http.expectOne(r => r.url === '/api/mesas/disponiveis');
    expect(consulta.request.params.get('data')).toBe(data);
    consulta.flush(disponiveis);
  }

  function abrir() {
    const fixture = TestBed.createComponent(MapaPage);
    TestBed.inject(AuthService).sessao.set({ token: 'token', tipo: 'Bearer', usuario });
    fixture.componentInstance.reserva.alterarData('2026-10-28');
    fixture.detectChanges();
    carregar();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.mesa').click();
    fixture.detectChanges();
    http.expectNone('/api/mesas');
    http.expectNone(r => r.url === '/api/mesas/disponiveis');
    return fixture;
  }

  function alterarCampo(fixture: ReturnType<typeof TestBed.createComponent<MapaPage>>, data: string) {
    const campo = fixture.nativeElement.querySelector('#data-reserva') as HTMLInputElement;
    campo.value = data;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  describe.each([
    ['lista', AgendamentoPage, '/api/mesas'],
    ['mapa', MapaPage, '/api/mesas/com-ocupacao'],
  ] as const)('virada de dia na %s', (_nome, componente, endpoint) => {
    it('atualiza limites e bloqueia a data que ficou no passado sem escolher outro dia', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-11-07T02:59:59.900Z'));
      TestBed.inject(AuthService).sessao.set({ token: 'token', tipo: 'Bearer', usuario });
      const fixture = TestBed.createComponent<AgendamentoPage | MapaPage>(componente);
      fixture.detectChanges();
      carregar([mesa], '2026-11-06', endpoint);
      fixture.detectChanges();
      const reserva = fixture.componentInstance.reserva;
      reserva.selecionar(mesa);
      expect(reserva.selecionada()?.id).toBe(mesa.id);
      vi.advanceTimersByTime(100);
      fixture.detectChanges();
      expect(reserva.data()).toBe('2026-11-06');
      expect(reserva.erroData()).toContain('hoje ou futura');
      expect(reserva.disponibilidadeAtual()).toBe(false);
      expect(reserva.selecionada()).toBeNull();
      const campo = fixture.nativeElement.querySelector('#data-reserva') as HTMLInputElement;
      expect(campo.min).toBe('2026-11-07');
      expect(campo.max).toBe('2026-11-22');
      reserva.confirmar();
      http.expectNone('/api/reservas');
      http.expectNone(r => r.url === '/api/mesas/disponiveis');
      fixture.destroy();
    });

    it('preserva a segunda-feira escolhida e reconsulta a mesma data ao retornar à aba', () => {
      vi.setSystemTime(new Date('2026-11-06T12:00:00Z'));
      TestBed.inject(AuthService).sessao.set({ token: 'token', tipo: 'Bearer', usuario });
      const fixture = TestBed.createComponent<AgendamentoPage | MapaPage>(componente);
      fixture.componentInstance.reserva.alterarData('2026-11-09');
      fixture.detectChanges();
      carregar([mesa], '2026-11-09', endpoint);
      fixture.detectChanges();
      const pagina = fixture.componentInstance;
      if (pagina instanceof AgendamentoPage) pagina.busca.set('044');
      vi.setSystemTime(new Date('2026-11-09T03:00:01Z'));
      window.dispatchEvent(new Event('focus'));
      fixture.detectChanges();
      if (pagina instanceof MapaPage) {
        http.expectOne(r => r.url === endpoint).flush([mesa]);
      }
      http.expectOne(r => r.url === '/api/mesas/disponiveis'
        && r.params.get('data') === '2026-11-09').flush([mesa]);
      fixture.detectChanges();
      expect(pagina.reserva.data()).toBe('2026-11-09');
      expect(pagina.reserva.erroData()).toBe('');
      expect(pagina.reserva.disponibilidadeAtual()).toBe(true);
      if (pagina instanceof AgendamentoPage) expect(pagina.busca()).toBe('044');
      const campo = fixture.nativeElement.querySelector('#data-reserva') as HTMLInputElement;
      expect(campo.min).toBe('2026-11-09');
      expect(campo.max).toBe('2026-11-24');
      fixture.destroy();
    });

    it('revalida o dia antes do POST mesmo se o temporizador não tiver executado', () => {
      vi.setSystemTime(new Date('2026-11-07T02:59:59Z'));
      TestBed.inject(AuthService).sessao.set({ token: 'token', tipo: 'Bearer', usuario });
      const fixture = TestBed.createComponent<AgendamentoPage | MapaPage>(componente);
      fixture.detectChanges();
      carregar([mesa], '2026-11-06', endpoint);
      fixture.detectChanges();
      const reserva = fixture.componentInstance.reserva;
      reserva.selecionar(mesa);
      vi.setSystemTime(new Date('2026-11-07T03:00:01Z'));
      reserva.confirmar();
      expect(reserva.erroData()).toContain('hoje ou futura');
      http.expectNone('/api/reservas');
      fixture.destroy();
    });
  });

  it.each(['2026-10-31T12:00:00Z', '2026-11-01T12:00:00Z'])(
    'abre o mapa no próximo dia útil em %s e mantém essa data após reservar', instante => {
      vi.setSystemTime(new Date(instante));
      const fixture = TestBed.createComponent(MapaPage);
      TestBed.inject(AuthService).sessao.set({ token: 'token', tipo: 'Bearer', usuario });
      fixture.detectChanges();
      carregar([mesa], '2026-11-02');
      fixture.detectChanges();
      expect(fixture.componentInstance.reserva.data()).toBe('2026-11-02');
      expect(fixture.componentInstance.reserva.erroData()).toBe('');
      fixture.nativeElement.querySelector('.mesa').click();
      fixture.detectChanges();
      fixture.nativeElement.querySelector('.confirmar').click();
      http.expectOne('/api/reservas').flush({ id: 1 });
      fixture.detectChanges();
      carregar([mesa], '2026-11-02');
      fixture.detectChanges();
      expect(fixture.componentInstance.reserva.data()).toBe('2026-11-02');
      expect(fixture.componentInstance.reserva.erroData()).toBe('');
    },
  );

  it.each(['2026-10-31T12:00:00Z', '2026-11-01T12:00:00Z'])(
    'abre o agendamento no próximo dia útil em %s', async instante => {
      vi.setSystemTime(new Date(instante));
      const fixture = TestBed.createComponent(AgendamentoPage);
      TestBed.inject(AuthService).sessao.set({ token: 'token', tipo: 'Bearer', usuario });
      fixture.detectChanges();
      carregar([mesa], '2026-11-02', '/api/mesas');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fixture.componentInstance.reserva.data()).toBe('2026-11-02');
      expect(fixture.componentInstance.reserva.erroData()).toBe('');
      expect((fixture.nativeElement.querySelector('#data-reserva') as HTMLInputElement).value).toBe('2026-11-02');
    },
  );

  it('envia só mesa e data, bloqueia duplo clique e só exibe sucesso após resposta', async () => {
    const fixture = abrir();
    expect(fixture.componentInstance.reserva.data()).toBe('2026-10-28');
    expect(fixture.nativeElement.querySelector('.detalhes').textContent).toContain('Maria');
    fixture.nativeElement.querySelector('.confirmar').click();
    fixture.componentInstance.reserva.confirmar();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.confirmar').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('#data-reserva').disabled).toBe(true);
    expect(fixture.componentInstance.reserva.sucesso()).toBe('');
    const request = http.expectOne('/api/reservas');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ mesaId: 44, data: '2026-10-28' });
    request.flush({ id: 9, data: '2026-10-28', status: 'CONFIRMADA', mesa, solicitante: usuario });
    fixture.detectChanges();
    // Após sucesso, a data volta para hoje (2026-10-27)
    carregar([mesa], '2026-10-27');
    fixture.detectChanges();
    expect(mockToastService.sucesso).toHaveBeenCalledWith('Reserva Confirmada');
    expect(mockToastService.sucesso).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.reserva.data()).toBe('2026-10-27');
    expect(fixture.nativeElement.querySelector('.mesa').disabled).toBe(false);
    expect(fixture.componentInstance.mesaSelecionada()).toBeNull();

    // A reserva ocupa apenas o dia confirmado, sem bloquear os outros dias.
    alterarCampo(fixture, '2026-10-28');
    carregar([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mesa').disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('.mesa').getAttribute('aria-disabled')).toBe('true');
    expect(fixture.nativeElement.querySelector('.mesa').classList.contains('ocupada')).toBe(true);
    expect(fixture.nativeElement.querySelector('.mesa').getAttribute('aria-label')).toContain('Reservada');
    // Outras reservas não mostram mais rótulo "Diária" na mesa
    expect(fixture.nativeElement.querySelector('.mesa__estado')).toBeNull();
    expect(fixture.componentInstance.mesaSelecionada()).toBeNull();
  });

  it('trata erro 400 sem sucesso e atualiza a disponibilidade', () => {
      const fixture = abrir();
      fixture.componentInstance.reserva.confirmar();
      const request = http.expectOne('/api/reservas');
      request.flush({ detail: 'Reserva recusada.' }, { status: 400, statusText: 'Erro' });
      fixture.detectChanges();
      carregar([]);
      fixture.detectChanges();
      expect(fixture.componentInstance.reserva.sucesso()).toBe('');
      expect(fixture.componentInstance.reserva.erro()).not.toBe('');
      expect(fixture.componentInstance.reserva.confirmando()).toBe(false);
      expect(fixture.componentInstance.mesaSelecionada()).toBeNull();
      expect(fixture.nativeElement.querySelector('.toast--sucesso')).toBeNull();
      expect(fixture.nativeElement.querySelector('.toast--erro[role=alert]')).not.toBeNull();
    });

  it('trata erro 409 sem sucesso e atualiza a disponibilidade', () => {
      const fixture = abrir();
      fixture.componentInstance.reserva.confirmar();
      const request = http.expectOne('/api/reservas');
      request.flush({ detail: 'Reserva recusada.' }, { status: 409, statusText: 'Erro' });
      fixture.detectChanges();
      carregar([]);
      fixture.detectChanges();
      expect(fixture.componentInstance.reserva.sucesso()).toBe('');
      // 409 usa toast, não erro local
      expect(fixture.componentInstance.reserva.erro()).toBe('');
      expect(fixture.componentInstance.reserva.confirmando()).toBe(false);
      expect(fixture.componentInstance.mesaSelecionada()).toBeNull();
      expect(mockToastService.erro).toHaveBeenCalledWith('Reserva recusada.');
      expect(mockToastService.erro).toHaveBeenCalledTimes(1);
      expect(mockToastService.sucesso).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelectorAll('[role=alert]').length).toBe(0);
    });

  it('trata erro 500 sem sucesso e atualiza a disponibilidade', () => {
      const fixture = abrir();
      fixture.componentInstance.reserva.confirmar();
      const request = http.expectOne('/api/reservas');
      request.flush({ detail: 'Reserva recusada.' }, { status: 500, statusText: 'Erro' });
      fixture.detectChanges();
      carregar([]);
      fixture.detectChanges();
      expect(fixture.componentInstance.reserva.sucesso()).toBe('');
      expect(fixture.componentInstance.reserva.erro()).not.toBe('');
      expect(fixture.componentInstance.reserva.confirmando()).toBe(false);
      expect(fixture.componentInstance.mesaSelecionada()).toBeNull();
      expect(fixture.nativeElement.querySelector('.toast--sucesso')).toBeNull();
      expect(fixture.nativeElement.querySelector('.toast--erro[role=alert]')).not.toBeNull();
    });

  it('trata erro 0 sem sucesso e atualiza a disponibilidade', () => {
      const fixture = abrir();
      fixture.componentInstance.reserva.confirmar();
      const request = http.expectOne('/api/reservas');
      request.error(new ProgressEvent('error'));
      fixture.detectChanges();
      carregar([]);
      fixture.detectChanges();
      expect(fixture.componentInstance.reserva.sucesso()).toBe('');
      expect(fixture.componentInstance.reserva.erro()).not.toBe('');
      expect(fixture.componentInstance.reserva.confirmando()).toBe(false);
      expect(fixture.componentInstance.mesaSelecionada()).toBeNull();
      expect(fixture.nativeElement.querySelector('.toast--sucesso')).toBeNull();
      expect(fixture.nativeElement.querySelector('.toast--erro[role=alert]')).not.toBeNull();
    });

  it('limpa a seleção ao mudar de dia e consulta a nova data', () => {
    const fixture = abrir();
    alterarCampo(fixture, '2026-10-29');
    expect(fixture.componentInstance.mesaSelecionada()).toBeNull();
    http.expectOne(r => r.url === '/api/mesas/com-ocupacao').flush([mesa]);
    http.expectOne(r => r.url === '/api/mesas/disponiveis' && r.params.get('data') === '2026-10-29').flush([mesa]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mesa').disabled).toBe(false);
    http.expectNone('/api/reservas');
  });

  it('revalida o dia antes do POST no mapa mesmo se o temporizador não tiver executado', () => {
    const fixture = abrir();
    vi.setSystemTime(new Date('2026-10-29T04:01:00Z'));

    fixture.nativeElement.querySelector('.confirmar').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('hoje ou futura');
    expect(fixture.componentInstance.reserva.selecionada()).toBeNull();
    http.expectNone('/api/reservas');
  });

  it('bloqueia seleção enquanto a disponibilidade não foi carregada ou falhou', () => {
    const fixture = TestBed.createComponent(MapaPage);
    TestBed.inject(AuthService).sessao.set({ token: 'token', tipo: 'Bearer', usuario });
    fixture.componentInstance.reserva.alterarData('2026-10-28');
    fixture.detectChanges();
    http.expectOne(r => r.url === '/api/mesas/com-ocupacao').flush([mesa]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mesa')).toBeNull();
    http.expectOne(r => r.url === '/api/mesas/disponiveis').flush({ detail: 'Data inválida.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Data inválida');
    expect(fixture.nativeElement.querySelector('.mesa')).toBeNull();
  });

  it('leva a data escolhida ao voltar para a lista de agendamento', () => {
    const fixture = abrir();
    const botao = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(item => item.textContent?.trim() === 'Listar mesas');
    expect(botao).toBeDefined();
    expect(botao!.getAttribute('aria-label') ?? botao!.textContent?.trim()).toBe('Listar mesas');
    botao!.click();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/agendamento'], { queryParams: { data: '2026-10-28', mesaId: 44 } });
  });

  it.each(['USUARIO', 'ADMIN'])('mostra a mesa da reserva existente do beneficiário para %s', perfil => {
    const fixture = abrir();
    TestBed.inject(AuthService).sessao.set({ token: 'token', tipo: 'Bearer', usuario: { ...usuario, perfil } });
    fixture.componentInstance.reserva.confirmarComSolicitante(perfil === 'ADMIN' ? 8 : null);
    const request = http.expectOne('/api/reservas');
    expect(request.request.body.mesaId).toBe(44);
    expect(request.request.body.solicitanteId).toBe(perfil === 'ADMIN' ? 8 : undefined);
    request.flush({
      code: 'USUARIO_COM_RESERVA_NA_DATA',
      detail: 'Duplicidade do solicitante na data.',
      mesa: { id: 53, codigo: '053' },
    }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    carregar([]);
    fixture.detectChanges();
    expect(mockToastService.erro).toHaveBeenCalledWith('Você já tem uma reserva para a mesa 053.');
    expect(mockToastService.erro).toHaveBeenCalledTimes(1);
    expect(mockToastService.sucesso).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('[role=alert]').length).toBe(0);
  });

  it.each([
    'A mesa 044 já possui uma reserva não cancelada em 2026-10-28.',
    'Mesa 044 é fixa e não pode ser reservada.',
    'Mesa 044 está inativa.',
    'Não foi possível concluir a confirmação concorrente.',
  ])('preserva outro conflito sem classificá-lo como duplicidade: %s', detalhe => {
    const fixture = abrir();
    fixture.componentInstance.reserva.confirmar();
    http.expectOne('/api/reservas').flush({
      detail: detalhe,
      mesa: { id: 53, codigo: '053' },
    }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    carregar([]);
    fixture.detectChanges();
    expect(mockToastService.erro).toHaveBeenCalledExactlyOnceWith(detalhe);
    expect(mockToastService.sucesso).not.toHaveBeenCalled();
  });

  it.each([undefined, null, '', '  ', 53])('não inventa código para duplicidade com código inválido %s', codigo => {
    const fixture = abrir();
    fixture.componentInstance.reserva.confirmar();
    http.expectOne('/api/reservas').flush({
      code: 'USUARIO_COM_RESERVA_NA_DATA',
      detail: 'O solicitante já possui uma reserva nessa data.',
      mesa: { codigo },
    }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    carregar([]);
    fixture.detectChanges();
    expect(mockToastService.erro).toHaveBeenCalledExactlyOnceWith('O solicitante já possui uma reserva nessa data.');
    expect(mockToastService.sucesso).not.toHaveBeenCalled();
  });

  it.each(['USUARIO', 'ADMIN'])('informa a mesa vinculada no mapa para %s sem falso sucesso', perfil => {
    const fixture = abrir();
    TestBed.inject(AuthService).sessao.set({ token: 'token', tipo: 'Bearer', usuario: { ...usuario, perfil } });
    if (perfil === 'ADMIN') {
      fixture.componentInstance.selecionarSolicitante({ id: 8, nome: 'Outra Pessoa', email: 'outra@teste.com', perfil: 'USUARIO', ativo: true });
    }
    fixture.componentInstance.confirmarReserva();
    const request = http.expectOne('/api/reservas');
    expect(request.request.body.solicitanteId).toBe(perfil === 'ADMIN' ? 8 : undefined);
    const detalhe = perfil === 'ADMIN'
      ? 'Outra Pessoa já possui a mesa fixa 067 vinculada. Remova o vínculo antes de realizar uma reserva para essa pessoa.'
      : 'Você já possui a mesa fixa 067 vinculada ao seu nome. Para reservar outra mesa, solicite à administração a remoção desse vínculo.';
    request.flush({ code: 'USUARIO_COM_MESA_FIXA', detail: detalhe, mesa: { id: 67, codigo: '067' } },
      { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    carregar();
    fixture.detectChanges();
    expect(mockToastService.erro).toHaveBeenCalledWith('Reserva não permitida', detalhe);
    expect(mockToastService.erro).toHaveBeenCalledTimes(1);
    expect(mockToastService.sucesso).not.toHaveBeenCalled();
  });

  it('cancela respostas anteriores ao alterar rapidamente a data pelo campo', () => {
    const fixture = abrir();
    alterarCampo(fixture, '2026-10-29');
    const catalogoAntigo = http.expectOne(r => r.url === '/api/mesas/com-ocupacao');
    const antiga = http.expectOne(r => r.url === '/api/mesas/disponiveis' && r.params.get('data') === '2026-10-29');
    alterarCampo(fixture, '2026-10-30');
    expect(antiga.cancelled).toBe(true);
    expect(catalogoAntigo.cancelled).toBe(true);
    // Ignora uma conclusão antiga e um evento de seleção antigo enquanto a nova data carrega.
    fixture.componentInstance.reserva.registrarDisponibilidade('2026-10-29');
    fixture.componentInstance.onMesaSelecionada({ mesa, disponivel: true });
    fixture.componentInstance.reserva.confirmar();
    http.expectNone('/api/reservas');
    expect(fixture.componentInstance.reserva.disponibilidadeAtual()).toBe(false);
    http.expectOne(r => r.url === '/api/mesas/com-ocupacao').flush([mesa]);
    http.expectOne(r => r.url === '/api/mesas/disponiveis' && r.params.get('data') === '2026-10-30').flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mesa').getAttribute('aria-disabled')).toBe('true');
    expect(fixture.componentInstance.mesaSelecionada()).toBeNull();
    expect(fixture.componentInstance.reserva.data()).toBe('2026-10-30');
    expect(fixture.nativeElement.textContent).toContain('Nenhuma mesa disponível para a data selecionada');
  });

  it('limpa a planta e a seleção ao apagar a data, sem consultar ou confirmar', () => {
    const fixture = abrir();
    alterarCampo(fixture, '');
    expect(fixture.nativeElement.querySelector('#data-reserva-erro').textContent)
      .toContain('Informe a data');
    expect(fixture.nativeElement.querySelector('app-planta-mesas')).toBeNull();
    expect(fixture.componentInstance.mesaSelecionada()).toBeNull();
    fixture.componentInstance.reserva.confirmar();
    http.expectNone('/api/mesas');
    http.expectNone(r => r.url === '/api/mesas/disponiveis');
    http.expectNone('/api/reservas');
  });

  it('permite repetir uma consulta que falhou e só então selecionar pela planta', () => {
    const fixture = abrir();
    fixture.nativeElement.querySelector('#atualizar-disponibilidade').click();
    fixture.componentInstance.onMesaSelecionada({ mesa, disponivel: true });
    expect(fixture.componentInstance.mesaSelecionada()).toBeNull();
    fixture.detectChanges();
    http.expectOne(r => r.url === '/api/mesas/com-ocupacao').flush([mesa]);
    http.expectOne(r => r.url === '/api/mesas/disponiveis').flush({}, { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar a disponibilidade');
    expect(fixture.componentInstance.reserva.disponibilidadeAtual()).toBe(false);
    fixture.nativeElement.querySelector('#atualizar-disponibilidade').click();
    fixture.detectChanges();
    carregar();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.mesa').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.confirmar').disabled).toBe(false);
  });
});
