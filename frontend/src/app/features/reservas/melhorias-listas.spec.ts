import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AgendamentoPage } from '../agendamento/agendamento-page';
import { AdminMesaPage } from '../mesas/admin-mesa-page';
import { AdminMesaService } from '../mesas/admin-mesa.service';
import { MinhasReservasPage } from '../minhas-reservas/minhas-reservas-page';
import { Mesa } from '../mesas/mesa';

const usuario = { id: 7, nome: 'Maria Silva', email: 'm@example.com', perfil: 'USUARIO' };
const mesas: Mesa[] = Array.from({ length: 15 }, (_, indice) => ({
  id: indice + 1, codigo: String(indice + 1).padStart(3, '0'), regiao: indice < 8 ? 'Local A' : 'Local B',
  tipo: 'LIVRE', ativa: true, ocupada: false, ocupante: null,
  referenciaVisual: { planta: 'DEMO', x: indice * 120, y: 10 },
}));

describe('Filtros, categorias e paginação', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-09T12:00:00Z'));
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    TestBed.inject(AuthService).sessao.set({ token: 'teste', tipo: 'Bearer', usuario });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    try { http.verify(); }
    finally { TestBed.resetTestingModule(); localStorage.clear(); vi.useRealTimers(); }
  });

  it('pagina mesas e combina local/busca, reiniciando a página e permitindo limpar', () => {
    const fixture = TestBed.createComponent(AgendamentoPage); fixture.detectChanges();
    http.expectOne('/api/mesas').flush(mesas);
    http.expectOne(r => r.url === '/api/mesas/disponiveis').flush(mesas);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.mesa-card')).toHaveLength(12);
    fixture.nativeElement.querySelector('[aria-label="Próxima página"]').click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.mesa-card')).toHaveLength(3);
    const local = fixture.nativeElement.querySelector('#filtro-local') as HTMLSelectElement;
    local.value = 'Local B'; local.dispatchEvent(new Event('change')); fixture.detectChanges();
    expect(fixture.componentInstance.paginacao.pagina()).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('.mesa-card')).toHaveLength(7);
    fixture.componentInstance.busca.set('mesa 010'); fixture.detectChanges();
    expect(fixture.componentInstance.mesasFiltradas().map(m => m.codigo)).toEqual(['010']);
    fixture.componentInstance.limparFiltros(); fixture.detectChanges();
    expect(fixture.componentInstance.mesasFiltradas()).toHaveLength(15);
  });

  it('classifica histórico confirmado e pendente como ativo e canceladas somente por status', () => {
    const fixture = TestBed.createComponent(MinhasReservasPage); fixture.detectChanges();
    const reserva = { usuarioId: 7, criadaEm: '2020-01-01T08:00:00', mesa: mesas[0], solicitante: usuario };
    const cancelada = { ...reserva, id: 3, status: 'CANCELADA', data: '2027-01-01' };
    http.expectOne(r => r.url === '/api/reservas/minhas/pagina').flush({
      conteudo: [
      { ...reserva, id: 2, status: 'PENDENTE', data: '2026-11-12' },
      { ...reserva, id: 1, status: 'CONFIRMADA', data: '2020-01-01' }, cancelada,
      ], pagina: 0, tamanho: 10, totalRegistros: 3, totalPaginas: 1,
    });
    http.expectOne('/api/mesas').flush([]); fixture.detectChanges();
    expect(fixture.componentInstance.cartoes().map(c => c.chave)).toEqual(['2', '1']);
    fixture.componentInstance.trocarFiltro('canceladas');
    http.expectOne(r => r.url === '/api/reservas/minhas/pagina' && r.params.get('canceladas') === 'true')
      .flush({ conteudo: [cancelada], pagina: 0, tamanho: 10, totalRegistros: 1, totalPaginas: 1 });
    fixture.detectChanges();
    expect(fixture.componentInstance.cartoes().map(c => c.chave)).toEqual(['3']);
    expect(fixture.nativeElement.querySelector('.minhas-reservas__acao--cancelar')).toBeNull();
  });

  it('descarta a consulta anterior de histórico quando os filtros mudam', () => {
    const fixture = TestBed.createComponent(MinhasReservasPage); fixture.detectChanges();
    const antiga = http.expectOne(r => r.url === '/api/reservas/minhas/pagina');
    http.expectOne('/api/mesas').flush([]);
    fixture.componentInstance.definirData('inicio', '2020-01-01');
    const intermediaria = http.expectOne(r => r.url === '/api/reservas/minhas/pagina'
      && r.params.get('dataInicio') === '2020-01-01');
    fixture.componentInstance.definirData('fim', '2020-01-31');
    expect(antiga.cancelled).toBe(true); expect(intermediaria.cancelled).toBe(true);
    http.expectOne(r => r.url === '/api/reservas/minhas/pagina'
      && r.params.get('dataInicio') === '2020-01-01' && r.params.get('dataFim') === '2020-01-31')
      .flush({ conteudo: [], pagina: 0, tamanho: 10, totalRegistros: 0, totalPaginas: 0 });
    fixture.detectChanges(); expect(fixture.componentInstance.carregando()).toBe(false);
  });
});

describe('Gestão com revisão do responsável', () => {
  afterEach(() => { TestBed.resetTestingModule(); localStorage.clear(); vi.useRealTimers(); });
  it('combina nome parcial sem caixa/local/tipo, ordena e impede fechar uma gravação pendente', async () => {
    vi.useFakeTimers();
    const atual = { id: 7, nome: 'Maria Silva', email: 'm@example.com' };
    const novo = { id: 8, nome: 'João Souza', email: 'j@example.com' };
    const fixas = mesas.map(m => ({ ...m, tipo: 'FIXA' as const, responsavel: atual }));
    const gravacao = new Subject<Mesa>();
    const alterar = vi.fn(() => gravacao);
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: AdminMesaService, useValue: { listarComOcupacao: () => of(fixas), listarUsuariosAtivos: () => of([atual, novo]), alterarResponsavel: alterar } }] });
    TestBed.inject(AuthService).sessao.set({ token: 'admin', tipo: 'Bearer', usuario: { ...usuario, perfil: 'ADMIN' } });
    const fixture = TestBed.createComponent(AdminMesaPage); fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(251); fixture.detectChanges();
    fixture.componentInstance.paginacao.pagina.set(2); fixture.detectChanges();
    expect(fixture.componentInstance.mesasPaginadas()).toHaveLength(3);
    fixture.componentInstance.nomeResponsavel.set('sILvA'); fixture.componentInstance.local.set('Local B');
    fixture.componentInstance.filtroTipo.set('fixa'); fixture.componentInstance.descendente.set(true); fixture.detectChanges();
    expect(fixture.componentInstance.paginacao.pagina()).toBe(1);
    expect(fixture.componentInstance.mesasFiltradas().map(m => m.codigo)).toEqual(['015','014','013','012','011','010','009']);
    fixture.componentInstance.abrirModalAlterarResponsavel(fixas[14]); fixture.componentInstance.selecionarUsuario(8); fixture.detectChanges();
    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Mesa 015: alterar de Maria Silva para João Souza');
    fixture.componentInstance.confirmarAcao(); fixture.componentInstance.confirmarAcao(); fixture.componentInstance.fecharModal();
    expect(alterar).toHaveBeenCalledTimes(1); expect(fixture.componentInstance.acaoEmAndamento()).toBe('alterar-responsavel');
    gravacao.next({ ...fixas[14], responsavel: novo }); gravacao.complete(); fixture.detectChanges();
    expect(fixture.componentInstance.acaoEmAndamento()).toBeNull();
  });
});
