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
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });
  afterEach(() => { localStorage.clear(); http.verify(); });

  function consulta(data = '2026-10-28') {
    return http.expectOne(r => r.url === '/api/mesas/disponiveis' && r.params.get('data') === data);
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
    fixture.nativeElement.querySelector('.botao--primario').click();
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
    fixture.componentInstance.onDataChange('2026-10-29');
    fixture.detectChanges();
    expect(antiga.cancelled).toBe(true);
    fixture.componentInstance.selecionarMesa(mesa);
    expect(fixture.componentInstance.mesaSelecionada()).toBeNull();
    consulta('2026-10-29').flush([]);
  });

  it('preserva a data na navegação para a planta', () => {
    const fixture = abrir();
    fixture.componentInstance.irParaMapa();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/mapa'], { queryParams: { data: '2026-10-28' } });
  });

  it('identifica o próprio administrador sem oferecer reserva em nome de terceiros', () => {
    const fixture = abrir('ADMIN');
    expect(fixture.nativeElement.querySelector('.resumo__detalhes').textContent).toContain('Maria');
    expect(fixture.nativeElement.textContent).not.toContain('reservar para outros');
  });
});
