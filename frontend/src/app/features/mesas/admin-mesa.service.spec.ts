import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AdminMesaService } from './admin-mesa.service';
import { Mesa } from './mesa';

const mesa: Mesa = {
  id: 44,
  codigo: '044',
  regiao: 'TAMBORÉ',
  tipo: 'FIXA',
  ativa: true,
  ocupada: false,
  responsavel: { id: 7, nome: 'Pessoa Teste', email: 'pessoa@example.com' },
  ocupante: null,
  referenciaVisual: { planta: 'TAMBORÉ', x: 24, y: 24 },
};

describe('AdminMesaService', () => {
  let service: AdminMesaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminMesaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the date and code filter to the occupancy endpoint', () => {
    service.listarComOcupacao(' Mesa 44 ', '2026-11-04').subscribe(mesas => {
      expect(mesas[0].ocupada).toBe(true);
      expect(mesas[0].responsavel).toEqual(mesa.responsavel);
    });
    const request = http.expectOne(r => r.url === '/api/mesas/com-ocupacao');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('termo')).toBe('Mesa 44');
    expect(request.request.params.get('data')).toBe('2026-11-04');
    request.flush([{ ...mesa, ocupada: true }]);
  });

  it('uses the implemented endpoint to list active users', () => {
    service.listarUsuariosAtivos().subscribe();
    const request = http.expectOne('/api/admin/usuarios');
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('sends management actions to their matching backend endpoints', () => {
    service.fixarMesa(44, { usuarioId: 7 }).subscribe();
    const fixar = http.expectOne('/api/admin/mesas/44/fixar');
    expect(fixar.request.method).toBe('PATCH');
    expect(fixar.request.body).toEqual({ usuarioId: 7 });
    fixar.flush(mesa);

    service.desfixarMesa(44).subscribe();
    const desfixar = http.expectOne('/api/admin/mesas/44/desfixar');
    expect(desfixar.request.method).toBe('PATCH');
    desfixar.flush({ ...mesa, tipo: 'LIVRE', responsavel: null });

    service.alterarAtivacao(44, { ativa: false }).subscribe();
    const inativar = http.expectOne('/api/admin/mesas/44/ativacao');
    expect(inativar.request.method).toBe('PATCH');
    expect(inativar.request.body).toEqual({ ativa: false });
    inativar.flush({ ...mesa, ativa: false });
  });
});
