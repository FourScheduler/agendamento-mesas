import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AgendamentoPage } from './agendamento-page';
import { Mesa } from '../mesas/mesa';

const mesa: Mesa = { id: 44, codigo: '044', regiao: 'DEMO', tipo: 'LIVRE', ativa: true,
  referenciaVisual: { planta: 'DEMO', x: 24, y: 24 } };
const usuario = { id: 7, nome: 'Maria', email: 'maria@teste.com', perfil: 'USUARIO' };

describe('Agendamento integrado à reserva diária', () => {
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

  function consulta(data = '2026-10-28') {
    return http.expectOne(r => r.url === '/api/mesas/disponiveis' && r.params.get('data') === data);
  }
  function alterarCampo(fixture: ReturnType<typeof TestBed.createComponent<AgendamentoPage>>, data: string) {
    const campo = fixture.nativeElement.querySelector('#data-reserva') as HTMLInputElement;
    campo.value = data;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }
  function abrir(perfil = 'USUARIO') {
    TestBed.inject(AuthService).sessao.set({ token: 'token', tipo: 'Bearer', usuario: { ...usuario, perfil } });
    const fixture = TestBed.createComponent(AgendamentoPage);
    fixture.componentInstance.onDataChange('2026-10-28');
    fixture.detectChanges();
    const request = consulta();
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    request.flush([mesa]);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.mesa-item').click();
    fixture.detectChanges();
    return fixture;
  }

  it('confirma uma vez e mostra sucesso somente após a resposta persistida', async () => {
    const fixture = abrir();
    fixture.nativeElement.querySelector('.botao--confirmar').click();
    fixture.componentInstance.confirmarReserva();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('#data-reserva').disabled).toBe(true);
    expect(fixture.componentInstance.reserva.sucesso()).toBe('');
    const request = http.expectOne('/api/reservas');
    expect(request.request.body).toEqual({ mesaId: 44, data: '2026-10-28' });
    request.flush({ id: 9, status: 'CONFIRMADA', data: '2026-10-28', mesa, solicitante: usuario });
    fixture.detectChanges();
    consulta().flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.notificacao--sucesso').textContent).toContain('Reserva #9 confirmada');
    expect(fixture.componentInstance.mesaSelecionada()).toBeNull();
    http.expectNone(r => r.url.includes('/confirmacao'));
  });

  for (const status of [400, 409]) {
    it(`trata ${status} sem falso sucesso e reconsulta a disponibilidade`, () => {
      const fixture = abrir();
      fixture.componentInstance.confirmarReserva();
      http.expectOne('/api/reservas').flush({ detail: 'Reserva recusada.' }, { status, statusText: 'Erro' });
      fixture.detectChanges();
      consulta().flush([]);
      fixture.detectChanges();
      expect(fixture.componentInstance.erro()).toContain('Reserva recusada');
      expect(fixture.componentInstance.reserva.sucesso()).toBe('');
      expect(fixture.componentInstance.mesaSelecionada()).toBeNull();
      expect(fixture.nativeElement.querySelector('.notificacao--erro[role=alert]').textContent).toContain('Reserva recusada');
      expect(fixture.nativeElement.querySelectorAll('[role=alert]').length).toBe(1);
    });
  }

  it('encerra a sessão e retorna ao login quando a confirmação recebe 401', () => {
    const fixture = abrir();
    fixture.componentInstance.confirmarReserva();
    http.expectOne('/api/reservas').flush({}, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
    expect(TestBed.inject(AuthService).autenticado()).toBe(false);
    expect(fixture.componentInstance.reserva.sucesso()).toBe('');
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/login'], { queryParams: { sessao: 'expirada' } });
  });

  it('cancela a consulta anterior ao trocar de data e impede selecionar resultados antigos', () => {
    TestBed.inject(AuthService).sessao.set({ token: 'token', tipo: 'Bearer', usuario });
    const fixture = TestBed.createComponent(AgendamentoPage);
    fixture.componentInstance.onDataChange('2026-10-28');
    fixture.detectChanges();
    const antiga = consulta();
    alterarCampo(fixture, '2026-10-29');
    expect(antiga.cancelled).toBe(true);
    fixture.componentInstance.selecionarMesa(mesa);
    expect(fixture.componentInstance.mesaSelecionada()).toBeNull();
    expect(fixture.componentInstance.dataSelecionada()).toBe('2026-10-29');
    consulta('2026-10-29').flush([]);
  });

  it('preserva a data na navegação para a planta', () => {
    const fixture = abrir();
    fixture.componentInstance.irParaMapa();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/mapa'], { queryParams: { data: '2026-10-28' } });
  });

  it('identifica o próprio administrador sem oferecer reserva em nome de terceiros', () => {
    const fixture = abrir('ADMIN');
    const valores = fixture.nativeElement.querySelectorAll('.resumo__info-value');
    // O 5º item é o Solicitante (Data, Mesa, Capacidade, Recursos, Solicitante)
    expect(valores[4].textContent).toContain('Maria');
    expect(fixture.nativeElement.textContent).not.toContain('reservar para outros');
  });

  it('usa a data digitada no campo na consulta, no resumo e na confirmação diária', () => {
    const fixture = abrir();
    alterarCampo(fixture, '2026-10-29');
    expect(fixture.componentInstance.mesaSelecionada()).toBeNull();
    expect(fixture.componentInstance.carregandoMesas()).toBe(true);
    expect(fixture.nativeElement.querySelector('.mesa-item')).toBeNull();
    fixture.componentInstance.selecionarMesa(mesa);
    fixture.componentInstance.confirmarReserva();
    http.expectNone('/api/reservas');
    const novaMesa = { ...mesa, id: 53, codigo: '053' };
    consulta('2026-10-29').flush([novaMesa]);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.mesa-item').click();
    fixture.detectChanges();
    // Data aparece no primeiro item do grid (label "Data")
    const valores = fixture.nativeElement.querySelectorAll('.resumo__info-value');
    expect(valores[0].textContent).toContain('29 de outubro');
    fixture.nativeElement.querySelector('.botao--confirmar').click();
    const confirmacao = http.expectOne('/api/reservas');
    expect(confirmacao.request.body).toEqual({ mesaId: 53, data: '2026-10-29' });
    confirmacao.flush({ id: 9, status: 'CONFIRMADA', data: '2026-10-29', mesa: novaMesa, solicitante: usuario });
    fixture.detectChanges();
    consulta('2026-10-29').flush([]);
  });

  for (const [data, mensagem] of [
    ['', 'Informe a data'], ['2026-10-26', 'hoje ou futura'],
    ['2026-10-31', 'segunda a sexta'], ['2026-11-01', 'segunda a sexta'], ['2026-11-12', '15 dias'],
  ]) {
    it(`valida a data "${data}" pelo campo e invalida os resultados anteriores`, () => {
      const fixture = abrir();
      alterarCampo(fixture, data);
      expect(fixture.nativeElement.querySelector('#erro-data').textContent).toContain(mensagem);
      expect(fixture.componentInstance.mesasLivres()).toEqual([]);
      expect(fixture.componentInstance.mesaSelecionada()).toBeNull();
      expect(fixture.nativeElement.querySelector('#atualizar-disponibilidade').disabled).toBe(true);
      fixture.componentInstance.confirmarReserva();
      http.expectNone(r => r.url === '/api/mesas/disponiveis');
      http.expectNone('/api/reservas');
    });
  }

  it('informa disponibilidade vazia sem deixar confirmar uma seleção anterior', () => {
    const fixture = abrir();
    alterarCampo(fixture, '2026-10-29');
    consulta('2026-10-29').flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhuma mesa disponível para a data selecionada');
    expect(fixture.nativeElement.querySelector('.botao--confirmar')).toBeNull();
    fixture.componentInstance.confirmarReserva();
    http.expectNone('/api/reservas');
  });

  it('mostra falha de disponibilidade e permite nova tentativa pelo botão', () => {
    const fixture = abrir();
    fixture.nativeElement.querySelector('#atualizar-disponibilidade').click();
    // Mesmo antes do próximo render, um clique no resultado antigo não pode confirmar.
    fixture.componentInstance.selecionarMesa(mesa);
    fixture.componentInstance.confirmarReserva();
    http.expectNone('/api/reservas');
    fixture.detectChanges();
    consulta().flush({}, { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.filtro-data__erro').textContent).toContain('Não foi possível carregar');
    expect(fixture.nativeElement.textContent).not.toContain('Nenhuma mesa disponível');
    fixture.nativeElement.querySelector('#atualizar-disponibilidade').click();
    fixture.detectChanges();
    consulta().flush([mesa]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.filtro-data__erro')).toBeNull();
    fixture.nativeElement.querySelector('.mesa-item').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.botao--confirmar').disabled).toBe(false);
  });

  it('exibe a validação retornada pela API e mantém os resultados antigos inutilizáveis', () => {
    const fixture = abrir();
    alterarCampo(fixture, '2026-10-29');
    consulta('2026-10-29').flush({ detail: 'Data recusada pelo servidor.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.filtro-data__erro').textContent).toContain('Data recusada pelo servidor');
    expect(fixture.componentInstance.reserva.disponibilidadeAtual()).toBe(false);
    expect(fixture.nativeElement.querySelector('.mesa-item')).toBeNull();
  });
});
