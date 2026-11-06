import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Mesa } from '../mesas/mesa';
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
    http.verify();
    TestBed.resetTestingModule();
  });

  it('exibe a mesa fixa do usuário sem oferecer cancelamento', () => {
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();

    http.expectOne('/api/reservas/minhas').flush([]);
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

  it('informa quando não consegue consultar as mesas atribuídas', () => {
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();

    http.expectOne('/api/reservas/minhas').flush([]);
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

    http.expectOne('/api/reservas/minhas').flush([]);
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
    http.expectOne('/api/reservas/minhas').flush([]);
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

  it('permite ao beneficiário cancelar diária criada pelo administrador sem remover sua mesa fixa', () => {
    const sucesso = vi.spyOn(TestBed.inject(ToastService), 'sucesso');
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();

    const diaria = {
      id: 21,
      usuarioId: 7,
      status: 'CONFIRMADA',
      data: '2099-01-01',
      criadaEm: '2098-12-20T12:00:00',
      criador: { id: 9, nome: 'Admin', perfil: 'ADMIN' },
      mesa: { id: 9, codigo: '009', regiao: 'TAMBORÉ' },
      solicitante: { id: 7, nome: 'Maria', email: 'maria@teste.com' },
    };
    http.expectOne('/api/reservas/minhas').flush([diaria]);
    http.expectOne('/api/mesas').flush([mesaDaMaria]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Reserva realizada pelo administrador.');
    expect(fixture.nativeElement.textContent).not.toContain('Para alterações, entre em contato com a administração.');
    fixture.nativeElement.querySelector('.minhas-reservas__acao--cancelar').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cancelar esta reserva?');
    fixture.nativeElement.querySelector('.minhas-reservas__acao--perigo').click();
    fixture.detectChanges();
    const cancelamento = http.expectOne('/api/reservas/21/cancelamento');
    expect(cancelamento.request.method).toBe('PATCH');
    expect(sucesso).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.minhas-reservas__acao--perigo').disabled).toBe(true);
    cancelamento.flush(null);
    http.expectOne('/api/reservas/minhas').flush([{ ...diaria, status: 'CANCELADA', canceladaEm: '2098-12-20T13:00:00' }]);
    fixture.detectChanges();
    expect(sucesso).toHaveBeenCalledExactlyOnceWith('Reserva cancelada', 'Mesa 009 foi liberada.');
    expect(fixture.nativeElement.querySelector('.minhas-reservas__acao--cancelar')).toBeNull();
    expect(fixture.nativeElement.querySelector('.minhas-reservas__cartao--fixa')?.textContent).toContain('Mesa 001');
    expect(fixture.nativeElement.querySelector('.minhas-reservas__cartao--fixa button')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Reserva realizada pelo administrador.');
    http.expectNone(request => request.url.startsWith('/api/admin/mesas'));
  });

  it.each([
    { usuarioId: 8, data: '2099-01-01', status: 'CONFIRMADA', motivo: 'reserva de terceiro' },
    { usuarioId: 7, data: '2099-01-01', status: 'CANCELADA', motivo: 'reserva cancelada' },
    { usuarioId: 7, data: '2000-01-01', status: 'CONFIRMADA', motivo: 'critério de data existente' },
  ])('preserva a restrição de cancelamento para $motivo', caso => {
    const fixture = TestBed.createComponent(MinhasReservasPage);
    fixture.detectChanges();
    http.expectOne('/api/reservas/minhas').flush([{
      id: 21, ...caso, criadaEm: '1999-12-20T12:00:00',
      criador: { id: 9, nome: 'Admin', perfil: 'ADMIN' },
      mesa: { id: 9, codigo: '009', regiao: 'TAMBORÉ' },
    }]);
    http.expectOne('/api/mesas').flush([]);
    if (caso.data === '2000-01-01') fixture.componentInstance.trocarFiltro('passadas');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.minhas-reservas__acao--cancelar')).toBeNull();
    fixture.componentInstance.cancelarReserva(fixture.componentInstance.cartoes()[0]);
    http.expectNone('/api/reservas/21/cancelamento');
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

    http.expectOne('/api/admin/reservas').flush([{
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
