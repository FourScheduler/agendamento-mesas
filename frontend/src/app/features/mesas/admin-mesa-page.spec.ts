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
  it('mantém o lápis após ativar/inativar e centraliza o responsável fixo', async () => {
    const responsavel = { id: 7, nome: 'Pessoa Responsável', email: 'responsavel@teste.com' };
    const mesas: Mesa[] = [
      mesa,
      { ...mesa, id: 45, codigo: '045', tipo: 'FIXA', responsavel },
      { ...mesa, id: 46, codigo: '046', ativa: false },
    ];
    TestBed.configureTestingModule({
      imports: [AdminMesaPage],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AdminMesaService, useValue: {
          listarComOcupacao: vi.fn(() => of(mesas)),
          listarUsuariosAtivos: vi.fn(() => of([responsavel])),
        } },
        { provide: ToastService, useValue: { sucesso: vi.fn(), erro: vi.fn() } },
      ],
    });
    TestBed.inject(AuthService).sessao.set({
      token: 'token-admin', tipo: 'Bearer',
      usuario: { id: 9, nome: 'Admin', email: 'admin@teste.com', perfil: 'ADMIN' },
    });
    const fixture = TestBed.createComponent(AdminMesaPage);
    try {
      fixture.detectChanges();
      await new Promise<void>(resolve => setTimeout(resolve, 300));
      fixture.detectChanges();
      const linhas = fixture.nativeElement.querySelectorAll('tbody tr') as NodeListOf<HTMLElement>;
      expect(linhas.length).toBe(3);
      linhas.forEach((linha, indice) => {
        const botoes = linha.querySelectorAll('.admin-mesa-page__acoes button') as NodeListOf<HTMLButtonElement>;
        expect(botoes.length).toBe(3);
        expect(botoes[1].getAttribute('aria-label')).toContain(indice === 2 ? 'Ativar' : 'Inativar');
        expect(botoes[2].getAttribute('aria-label')).toContain('Alterar responsável');
        expect(botoes[2].disabled).toBe(indice !== 1);
        const coluna = linha.querySelector('.admin-mesa-page__responsavel') as HTMLElement;
        expect(getComputedStyle(coluna).textAlign).toBe('center');
      });
      (linhas[1].querySelector('.admin-mesa-page__acoes button:last-child') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(fixture.componentInstance.acaoEmAndamento()).toBe('alterar-responsavel');
      expect(fixture.componentInstance.mesaSelecionadaParaAcao()?.id).toBe(45);
    } finally {
      fixture.destroy();
      TestBed.resetTestingModule();
    }
  });

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
