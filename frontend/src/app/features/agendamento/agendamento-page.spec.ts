import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AgendamentoPage } from './agendamento-page';
import { Mesa } from '../mesas/mesa';
import { authInterceptor } from '../../core/auth/auth.interceptor';
import { ToastService } from '../../shared/toast/toast';

const mesa: Mesa = { id: 44, codigo: '044', regiao: 'DEMO', tipo: 'LIVRE', ativa: true,
  ocupante: 'Teste', referenciaVisual: { planta: 'DEMO', x: 24, y: 24 } };
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

describe('Agendamento integrado à reserva diária', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-27T12:00:00Z'));
    TestBed.configureTestingModule({ 
      providers: [
        provideRouter([]), 
        provideHttpClient(withInterceptors([authInterceptor])), 
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
    http.expectOne('/api/mesas').flush([mesa]);
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
    // Após sucesso, a data volta para hoje (2026-10-27)
    http.expectOne(r => r.url === '/api/mesas/disponiveis' && r.params.get('data') === '2026-10-27').flush([]);
    fixture.detectChanges();
    // Sucesso agora via toast
    expect(mockToastService.sucesso).toHaveBeenCalledWith('Reserva Confirmada');
    expect(fixture.componentInstance.mesaSelecionada()).toBeNull();
    http.expectNone(r => r.url.includes('/confirmacao'));
  });

  it('trata 400 sem falso sucesso e reconsulta a disponibilidade', () => {
    const fixture = abrir();
    fixture.componentInstance.confirmarReserva();
    http.expectOne('/api/reservas').flush({ detail: 'Reserva recusada.' }, { status: 400, statusText: 'Erro' });
    fixture.detectChanges();
    consulta().flush([]);
    fixture.detectChanges();
    expect(fixture.componentInstance.erro()).toContain('Reserva recusada');
    expect(fixture.componentInstance.reserva.sucesso()).toBe('');
    expect(fixture.componentInstance.mesaSelecionada()).toBeNull();
    // 400 ainda usa notificação local
    expect(fixture.nativeElement.querySelector('.notificacao--erro[role=alert]').textContent).toContain('Reserva recusada');
    expect(fixture.nativeElement.querySelectorAll('[role=alert]').length).toBe(1);
  });

  it('trata 409 sem falso sucesso e reconsulta a disponibilidade', () => {
    const fixture = abrir();
    fixture.componentInstance.confirmarReserva();
    http.expectOne('/api/reservas').flush({ detail: 'Reserva recusada.' }, { status: 409, statusText: 'Erro' });
    fixture.detectChanges();
    consulta().flush([]);
    fixture.detectChanges();
    expect(fixture.componentInstance.reserva.sucesso()).toBe('');
    expect(fixture.componentInstance.mesaSelecionada()).toBeNull();
    // 409 usa toast
    expect(mockToastService.erro).toHaveBeenCalledWith('Você já possui uma reserva nessa data.');
    expect(mockToastService.erro).toHaveBeenCalledTimes(1);
    expect(mockToastService.sucesso).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('[role=alert]').length).toBe(0);
  });

  it('encerra a sessão e retorna ao login quando a confirmação recebe 401', () => {
    const fixture = abrir();
    fixture.componentInstance.confirmarReserva();
    http.expectOne('/api/reservas').flush({}, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
    expect(TestBed.inject(AuthService).autenticado()).toBe(false);
    expect(fixture.componentInstance.reserva.sucesso()).toBe('');
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/login'], { queryParams: { sessao: 'expirada', retorno: 'agendamento' } });
  });

  it('cancela a consulta anterior ao trocar de data e impede selecionar resultados antigos', () => {
    TestBed.inject(AuthService).sessao.set({ token: 'token', tipo: 'Bearer', usuario });
    const fixture = TestBed.createComponent(AgendamentoPage);
    http.expectOne('/api/mesas').flush([mesa]);
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
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/mapa'], { queryParams: { data: '2026-10-28', mesaId: 44 } });
  });

  it('identifica o próprio administrador sem oferecer reserva em nome de terceiros', () => {
    const fixture = abrir('ADMIN');
    
    // Mock da chamada de usuários ativos para admin
    http.expectOne('/api/admin/usuarios').flush([
      { id: 7, nome: 'Maria', email: 'maria@teste.com' },
      { id: 8, nome: 'João', email: 'joao@teste.com' }
    ]);
    fixture.detectChanges();
    
    // Para admin, o solicitante padrão é o próprio usuário (Maria, id=7)
    expect(fixture.componentInstance.solicitanteSelecionado()).toBe(7);
    
    // Foca o input para abrir o dropdown e verificar a seleção
    const solicitanteInput = fixture.nativeElement.querySelector('#solicitante-busca');
    solicitanteInput.focus();
    fixture.detectChanges();
    
    // O dropdown deve mostrar Maria como selecionada
    const opcaoSelecionada = fixture.nativeElement.querySelector('.solicitante-busca__opcao--selecionado');
    expect(opcaoSelecionada).toBeTruthy();
    expect(opcaoSelecionada.textContent).toContain('Maria');
    
    // Não deve mostrar texto "reservar para outros"
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
    const novaMesa = { ...mesa, id: 53, codigo: '053', ocupante: 'Teste' };
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
    // Após sucesso, a data volta para hoje (2026-10-27)
    http.expectOne(r => r.url === '/api/mesas/disponiveis' && r.params.get('data') === '2026-10-27').flush([]);
    fixture.detectChanges();
    expect(mockToastService.sucesso).toHaveBeenCalledWith('Reserva Confirmada');
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
