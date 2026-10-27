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
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });
  afterEach(() => { localStorage.clear(); http.verify(); });

  function carregar(disponiveis: readonly Mesa[] = [mesa]) {
    http.expectOne('/api/mesas').flush([mesa]);
    const consulta = http.expectOne(r => r.url === '/api/mesas/disponiveis');
    expect(consulta.request.params.get('data')).toBe('2026-10-28');
    expect(consulta.request.headers.get('Authorization')).toBe('Bearer token');
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
    return fixture;
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
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    request.flush({ id: 9, data: '2026-10-28', status: 'CONFIRMADA', mesa, solicitante: usuario });
    fixture.detectChanges();
    carregar([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.resultado--sucesso').textContent).toContain('Reserva #9 confirmada');
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
      expect(fixture.nativeElement.querySelector('.resultado--sucesso')).toBeNull();
    });
  }

  it('encerra a sessão em 401 da confirmação sem exibir sucesso', () => {
    const fixture = abrir();
    fixture.componentInstance.reserva.confirmar();
    http.expectOne('/api/reservas').flush({}, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
    expect(TestBed.inject(AuthService).sessao()).toBeNull();
    expect(TestBed.inject(AuthService).token()).toBe('');
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/login'], { queryParams: { sessao: 'expirada' } });
    expect(fixture.componentInstance.reserva.sucesso()).toBe('');
    http.expectNone('/api/mesas');
  });

  it('limpa a seleção ao mudar de dia e consulta a nova data', () => {
    const fixture = abrir();
    fixture.componentInstance.reserva.alterarData('2026-10-29');
    fixture.detectChanges();
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
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/agendamento'], { queryParams: { data: '2026-10-28' } });
  });
});
