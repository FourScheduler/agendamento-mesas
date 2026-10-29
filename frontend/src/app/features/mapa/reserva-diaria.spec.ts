import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MapaPage } from './mapa-page';
import { AuthService } from '../../core/auth/auth.service';
import { Mesa } from '../mesas/mesa';
import { provideRouter, Router } from '@angular/router';
import { ToastService } from '../../shared/toast/toast';

const mesa: Mesa = {
  id: 44, codigo: '044', regiao: 'DEMO', tipo: 'LIVRE', ativa: true,
  ocupante: 'Teste', referenciaVisual: { planta: 'DEMO', x: 24, y: 24 },
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

  function carregar(disponiveis: readonly Mesa[] = [mesa], data = '2026-10-28') {
    http.expectOne('/api/mesas').flush([mesa]);
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

  it('envia só mesa e data, bloqueia duplo clique e só exibe sucesso após resposta', async () => {
    const fixture = abrir();
    expect(fixture.nativeElement.querySelector('.detalhes').textContent).toContain('28/10/2026');
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
    expect(fixture.nativeElement.querySelector('.mesa').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.mesa').textContent).toContain('Ocupada');
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
      expect(mockToastService.erro).toHaveBeenCalledWith('Você já possui uma reserva nessa data.');
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
    http.expectOne('/api/mesas').flush([mesa]);
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
    http.expectOne('/api/mesas').flush([mesa]);
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

  it('cancela respostas anteriores ao alterar rapidamente a data pelo campo', () => {
    const fixture = abrir();
    alterarCampo(fixture, '2026-10-29');
    const catalogoAntigo = http.expectOne('/api/mesas');
    const antiga = http.expectOne(r => r.url === '/api/mesas/disponiveis' && r.params.get('data') === '2026-10-29');
    alterarCampo(fixture, '2026-10-30');
    expect(antiga.cancelled).toBe(true);
    expect(catalogoAntigo.cancelled).toBe(true);
    // Ignora uma conclusão antiga e um evento de seleção antigo enquanto a nova data carrega.
    fixture.componentInstance.reserva.registrarDisponibilidade('2026-10-29');
    fixture.componentInstance.onMesaSelecionada(mesa);
    fixture.componentInstance.reserva.confirmar();
    http.expectNone('/api/reservas');
    expect(fixture.componentInstance.reserva.disponibilidadeAtual()).toBe(false);
    http.expectOne('/api/mesas').flush([mesa]);
    http.expectOne(r => r.url === '/api/mesas/disponiveis' && r.params.get('data') === '2026-10-30').flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mesa').disabled).toBe(true);
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
    fixture.componentInstance.onMesaSelecionada(mesa);
    expect(fixture.componentInstance.mesaSelecionada()).toBeNull();
    fixture.detectChanges();
    http.expectOne('/api/mesas').flush([mesa]);
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
