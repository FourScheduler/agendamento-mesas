import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MapaPage } from './mapa-page';
import { AuthService } from '../../core/auth/auth.service';
import { Mesa } from '../mesas/mesa';
import { provideRouter, Router } from '@angular/router';

const mesa: Mesa = {
  id: 44, codigo: '044', regiao: 'DEMO', tipo: 'LIVRE', ativa: true,
  referenciaVisual: { planta: 'DEMO', x: 24, y: 24 },
};
const usuario = { id: 7, nome: 'Maria', email: 'maria@teste.com', perfil: 'USUARIO' };

describe('Reserva diária pela planta', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-27T12:00:00Z'));
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });
  afterEach(() => { localStorage.clear(); try { http.verify(); } finally { vi.useRealTimers(); } });

  function carregar(disponiveis: readonly Mesa[] = [mesa]) {
    http.expectOne('/api/mesas').flush([mesa]);
    const consulta = http.expectOne(r => r.url === '/api/mesas/disponiveis');
    expect(consulta.request.params.get('data')).toBe('2026-10-28');
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
    carregar([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.notificacao--sucesso').textContent).toContain('Reserva #9 confirmada');
    expect(fixture.nativeElement.querySelector('.mesa').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.mesa').textContent).toContain('Ocupada');
    expect(fixture.componentInstance.mesaSelecionada()).toBeNull();
  });

  for (const status of [400, 409, 500, 0]) {
    it(`trata erro ${status} sem sucesso e atualiza a disponibilidade`, () => {
      const fixture = abrir();
      fixture.componentInstance.reserva.confirmar();
      const request = http.expectOne('/api/reservas');
      if (status === 0) request.error(new ProgressEvent('error'));
      else request.flush({ detail: 'Reserva recusada.' }, { status, statusText: 'Erro' });
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
  }

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

  it('mostra a crítica de reserva existente uma única vez e permite fechar o popup', () => {
    const fixture = abrir();
    fixture.componentInstance.reserva.confirmar();
    const mensagem = 'Você já possui uma reserva em 28/10/2026, para agendar outra mesa na mesma data é necessário cancelar a reserva atual.';
    http.expectOne('/api/reservas').flush({ detail: mensagem }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    carregar([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.notificacao__mensagem').textContent).toBe(mensagem);
    expect(fixture.nativeElement.querySelectorAll('[role=alert]').length).toBe(1);
    fixture.nativeElement.querySelector('[aria-label="Fechar notificação"]').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.notificacao')).toBeNull();
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
