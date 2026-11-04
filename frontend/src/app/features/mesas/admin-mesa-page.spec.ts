import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../shared/toast/toast';
import { AdminMesaService } from './admin-mesa.service';
import { Mesa } from './mesa';
import { AdminMesaPage } from './admin-mesa-page';

const mesa: Mesa = {
  id: 44,
  codigo: '044',
  regiao: 'TAMBORÉ',
  tipo: 'LIVRE',
  ativa: true,
  ocupada: false,
  responsavel: null,
  ocupante: null,
  referenciaVisual: { planta: 'TAMBORÉ', x: 24, y: 24 },
};

describe('AdminMesaPage', () => {
  it('esconde a busca após selecionar responsável e a reabre ao trocar', async () => {
    const adminMesa = {
      listarComOcupacao: vi.fn(() => of([])),
      listarUsuariosAtivos: vi.fn(() => of([
        { id: 7, nome: 'Alessandra Rocha', email: 'alessandra@teste.com' },
      ])),
    };

    TestBed.configureTestingModule({
      imports: [AdminMesaPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AdminMesaService, useValue: adminMesa },
        { provide: ToastService, useValue: { sucesso: vi.fn(), erro: vi.fn() } },
      ],
    });
    TestBed.inject(AuthService).sessao.set({
      token: 'token-admin',
      tipo: 'Bearer',
      usuario: { id: 9, nome: 'Admin', email: 'admin@teste.com', perfil: 'ADMIN' },
    });

    const fixture = TestBed.createComponent(AdminMesaPage);
    fixture.detectChanges();
    await new Promise<void>(resolve => setTimeout(resolve, 300));
    fixture.detectChanges();

    fixture.componentInstance.abrirModalFixar(mesa);
    fixture.detectChanges();
    fixture.componentInstance.selecionarUsuario(7);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#usuario-busca')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Atribuir esta mesa para Alessandra Rocha?');

    const trocar = fixture.nativeElement.querySelector('.modal__resumo button') as HTMLButtonElement;
    trocar.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#usuario-busca')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Selecione quem ficará responsável por esta mesa.');
    fixture.destroy();
    TestBed.resetTestingModule();
  });
});
