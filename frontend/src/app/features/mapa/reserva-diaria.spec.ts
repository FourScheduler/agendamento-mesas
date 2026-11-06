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
  erro: vi.fn(),
  info: vi.fn(),
  aviso: vi.fn(),
  remover: vi.fn(),
  limpar: vi.fn(),
  toasts: () => [],
};

describe('Reserva diária pela planta', () => {
  let http: HttpTestingController;
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
      expect(fixture.nativeElement.querySelector('.notificacao--sucesso')).toBeNull();
      expect(fixture.nativeElement.querySelector('.notificacao--erro[role=alert]')).not.toBeNull();
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
      expect(fixture.nativeElement.querySelector('.notificacao--sucesso')).toBeNull();
      expect(fixture.nativeElement.querySelector('.notificacao--erro[role=alert]')).not.toBeNull();
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
      expect(fixture.nativeElement.querySelector('.notificacao--sucesso')).toBeNull();
      expect(fixture.nativeElement.querySelector('.notificacao--erro[role=alert]')).not.toBeNull();
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
    fixture.componentInstance.voltarParaAgendamento();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/agendamento'], { queryParams: { data: '2026-10-28', mesaId: 44 } });
  });

  it.each(['USUARIO', 'ADMIN'])('informa a reserva diária existente do beneficiário no mapa para %s', perfil => {
    const fixture = abrir();
    TestBed.inject(AuthService).sessao.set({ token: 'token', tipo: 'Bearer', usuario: { ...usuario, perfil } });
    if (perfil === 'ADMIN') {
      fixture.componentInstance.selecionarSolicitante({ id: 8, nome: 'João', email: 'joao@teste.com', perfil: 'USUARIO', ativo: true });
    }
    fixture.componentInstance.confirmarReserva();
    const request = http.expectOne('/api/reservas');
    expect(request.request.body.solicitanteId).toBe(perfil === 'ADMIN' ? 8 : undefined);
    const detalhe = perfil === 'ADMIN'
      ? 'João já tem uma reserva para a mesa 082 nesta data. Cancele a reserva atual antes de realizar outra para essa pessoa.'
      : 'Você já tem uma reserva para a mesa 082 nesta data. Para reservar outra mesa, cancele a reserva atual.';
    request.flush({ code: 'RESERVA_JA_EXISTENTE_USUARIO', detail: detalhe,
      mesa: { id: 82, codigo: '082' }, reserva: { id: 94, data: '2026-10-28' } },
      { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    carregar();
    fixture.detectChanges();
    expect(mockToastService.erro).toHaveBeenCalledExactlyOnceWith('Reserva já existente', detalhe);
    expect(mockToastService.sucesso).not.toHaveBeenCalled();
    expect(fixture.componentInstance.reserva.selecionada()).toBeNull();
    fixture.componentInstance.confirmarReserva();
    http.expectNone('/api/reservas');
  });

  it('usa orientação geral no mapa se o detalhe da duplicidade estiver ausente', () => {
    const fixture = abrir();
    fixture.componentInstance.reserva.confirmar();
    http.expectOne('/api/reservas').flush({ code: 'RESERVA_JA_EXISTENTE_USUARIO' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    carregar([]);
    expect(mockToastService.erro).toHaveBeenCalledExactlyOnceWith('Reserva já existente', 'Já existe uma reserva para o beneficiário nesta data.');
    expect(mockToastService.sucesso).not.toHaveBeenCalled();
  });

  it('mostra a crítica de reserva existente uma única vez pelo toast global', () => {
    const fixture = abrir();
    fixture.componentInstance.reserva.confirmar();
    http.expectOne('/api/reservas').flush({ detail: 'Você já possui uma reserva nessa data.' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    carregar([]);
    fixture.detectChanges();
    expect(mockToastService.erro).toHaveBeenCalledWith('Você já possui uma reserva nessa data.');
    expect(mockToastService.erro).toHaveBeenCalledTimes(1);
    expect(mockToastService.sucesso).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('[role=alert]').length).toBe(0);
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
    expect(fixture.nativeElement.querySelector('#erro-data').textContent).toContain('Informe a data');
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
