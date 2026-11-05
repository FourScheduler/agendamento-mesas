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
  it('aplica cada filtro, combina com a busca e atualiza contagem e estado vazio', async () => {
    const mesas: Mesa[] = [
      mesa,
      { ...mesa, id: 45, codigo: '045', tipo: 'FIXA', ocupada: true },
      { ...mesa, id: 46, codigo: '046', ativa: false },
      { ...mesa, id: 47, codigo: '047', ocupada: true },
      { ...mesa, id: 48, codigo: '048', tipo: 'FIXA', ativa: false },
      { ...mesa, id: 49, codigo: '049', ativa: false, ocupada: true },
    ];
    const listar = vi.fn((termo: string) => of(
      termo ? mesas.filter(item => item.codigo.includes(termo)) : mesas,
    ));
    TestBed.configureTestingModule({
      imports: [AdminMesaPage],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AdminMesaService, useValue: { listarComOcupacao: listar } },
        { provide: ToastService, useValue: { sucesso: vi.fn(), erro: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(AdminMesaPage);
    try {
      fixture.detectChanges();
      await new Promise<void>(resolve => setTimeout(resolve, 300));
      fixture.detectChanges();
      const codigos = () => Array.from(
        fixture.nativeElement.querySelectorAll('.admin-mesa-page__numero') as NodeListOf<HTMLElement>,
        elemento => elemento.textContent?.trim(),
      );
      const contagem = () => fixture.nativeElement.querySelector('.admin-mesa-page__contagem').textContent;
      const botoes = fixture.nativeElement.querySelectorAll('.admin-mesa-page__filtro-botao') as NodeListOf<HTMLButtonElement>;
      const esperados = [['045', '048'], ['044'], ['046', '048', '049'], ['047']];
      botoes.forEach((botao, indice) => {
        botao.click();
        fixture.detectChanges();
        expect(codigos()).toEqual(esperados[indice]);
        expect(contagem()).toContain(`${esperados[indice].length}`);
        expect(botao.getAttribute('aria-pressed')).toBe('true');
        botao.click();
        fixture.detectChanges();
        expect(codigos()).toHaveLength(6);
        expect(botao.getAttribute('aria-pressed')).toBe('false');
      });

      botoes[0].click();
      const busca = fixture.nativeElement.querySelector('#busca') as HTMLInputElement;
      busca.value = '045';
      busca.dispatchEvent(new Event('input'));
      await new Promise<void>(resolve => setTimeout(resolve, 300));
      fixture.detectChanges();
      expect(listar).toHaveBeenLastCalledWith('045', expect.any(String));
      expect(codigos()).toEqual(['045']);
      expect(contagem()).toContain('1 mesa encontrada');

      botoes[1].click();
      fixture.detectChanges();
      expect(codigos()).toEqual([]);
      expect(contagem()).toContain('0 mesas encontradas');
      expect(fixture.nativeElement.textContent).toContain('Nenhuma mesa corresponde aos filtros selecionados.');

      botoes[1].click();
      fixture.detectChanges();
      expect(codigos()).toEqual(['045']);
    } finally {
      fixture.destroy();
      TestBed.resetTestingModule();
    }
  });

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
        { id: 8, nome: 'Bruna Silva', email: 'bruna@teste.com' },
        { id: 10, nome: 'Carla Souza', email: 'carla@teste.com' },
        { id: 11, nome: 'Daniela Lima', email: 'daniela@teste.com' },
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
    const busca = fixture.nativeElement.querySelector('#usuario-busca') as HTMLInputElement;
    busca.dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
    const resultados = fixture.nativeElement.querySelector('#usuario-resultados') as HTMLElement;
    const estiloLista = getComputedStyle(resultados);
    expect(['', 'static']).toContain(estiloLista.position);
    expect(estiloLista.maxHeight).toBe('192px');
    expect(estiloLista.overflowY).toBe('auto');
    expect(resultados.querySelectorAll('button').length).toBe(4);
    expect(getComputedStyle(resultados.querySelector('button')!).minHeight).toBe('64px');
    (resultados.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#usuario-busca')).toBeNull();
    const selecionado = fixture.nativeElement.querySelector('.usuario-selecionado') as HTMLElement;
    expect(selecionado.textContent).toContain('Alessandra Rocha');
    expect(selecionado.textContent).toContain('alessandra@teste.com');
    expect(selecionado.querySelector('.modal__mesa-icone')?.textContent).toBe('AR');
    expect(getComputedStyle(fixture.nativeElement.querySelector('.modal')).overflow).toBe('visible');

    const trocar = fixture.nativeElement.querySelector('.modal__resumo button') as HTMLButtonElement;
    trocar.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#usuario-busca')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Selecione quem ficará responsável por esta mesa.');
    fixture.destroy();
    TestBed.resetTestingModule();
  });
});
