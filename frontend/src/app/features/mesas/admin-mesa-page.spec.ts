import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
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
  it('consulta o dia de São Paulo e atualiza ocupação na virada preservando busca e filtro', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T01:30:00Z'));
    TestBed.configureTestingModule({
      imports: [AdminMesaPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(AdminMesaPage);
    const http = TestBed.inject(HttpTestingController);
    try {
      fixture.detectChanges();
      vi.advanceTimersByTime(250);
      http.expectOne(r => r.url === '/api/mesas/com-ocupacao'
        && r.params.get('data') === '2026-11-06').flush([mesa]);
      fixture.detectChanges();
      const pagina = fixture.componentInstance;
      pagina.filtroTipo.set('reservada');
      const busca = fixture.nativeElement.querySelector('#busca') as HTMLInputElement;
      busca.value = '044';
      busca.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(250);
      http.expectOne(r => r.url === '/api/mesas/com-ocupacao'
        && r.params.get('termo') === '044' && r.params.get('data') === '2026-11-06')
        .flush([{ ...mesa, ocupada: true }]);
      fixture.detectChanges();
      expect(pagina.mesasFiltradas()).toHaveLength(1);
      vi.advanceTimersByTime(90 * 60 * 1000 - 500);
      fixture.detectChanges();
      expect(pagina.carregando()).toBe(true);
      vi.advanceTimersByTime(250);
      http.expectOne(r => r.url === '/api/mesas/com-ocupacao'
        && r.params.get('termo') === '044' && r.params.get('data') === '2026-11-07')
        .flush([mesa]);
      expect(pagina.busca()).toBe('044');
      expect(pagina.filtroTipo()).toBe('reservada');
      expect(pagina.mesasFiltradas()).toHaveLength(0);
      http.verify();
    } finally {
      fixture.destroy();
      TestBed.resetTestingModule();
      vi.useRealTimers();
    }
  });

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
        expect(botoes.length).toBe(indice === 2 ? 2 : 3);
        expect(botoes[botoes.length - 2].getAttribute('aria-label')).toContain(indice === 2 ? 'Ativar' : 'Inativar');
        expect(botoes[botoes.length - 1].getAttribute('aria-label')).toContain('Alterar responsável');
        expect(botoes[botoes.length - 1].disabled).toBe(indice !== 1);
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

  it('atribui responsável por ID em fixa legada e preserva a mesa quando a API recusa', async () => {
    TestBed.configureTestingModule({
      imports: [AdminMesaPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(AuthService).sessao.set({
      token: 'token-admin', tipo: 'Bearer',
      usuario: { id: 9, nome: 'Admin', email: 'admin@teste.com', perfil: 'ADMIN' },
    });
    const http = TestBed.inject(HttpTestingController);
    const toast = TestBed.inject(ToastService);
    const sucesso = vi.spyOn(toast, 'sucesso');
    const legada: Mesa = { ...mesa, tipo: 'FIXA', ocupante: 'Maria' };
    const homonimas = [
      { id: 7, nome: 'Maria', email: 'maria.um@teste.com' },
      { id: 8, nome: 'Maria', email: 'maria.dois@teste.com' },
    ];
    const fixture = TestBed.createComponent(AdminMesaPage);
    try {
      fixture.detectChanges();
      await new Promise<void>(resolve => setTimeout(resolve, 300));
      http.expectOne(r => r.url === '/api/mesas/com-ocupacao').flush([
        legada, { ...legada, id: 45, codigo: '045', ativa: false },
      ]);
      fixture.detectChanges();
      const atribuir = fixture.nativeElement.querySelector('[aria-label="Atribuir responsável da mesa 044"]') as HTMLButtonElement;
      expect(atribuir.disabled).toBe(false);
      expect((fixture.nativeElement.querySelector('[aria-label="Atribuir responsável da mesa 045"]') as HTMLButtonElement).disabled).toBe(true);
      atribuir.click();
      http.expectOne('/api/admin/usuarios').flush(homonimas);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#modal-titulo').textContent).toContain('Atribuir responsável');
      fixture.nativeElement.querySelector('#usuario-busca').dispatchEvent(new FocusEvent('focus'));
      fixture.detectChanges();
      const opcoes = Array.from(fixture.nativeElement.querySelectorAll('#usuario-resultados button')) as HTMLButtonElement[];
      expect(opcoes).toHaveLength(2);
      opcoes.find(botao => botao.textContent?.includes('maria.dois@teste.com'))!.click();
      fixture.detectChanges();
      const confirmar = () => (fixture.nativeElement.querySelector('.modal__rodape .botao--primario') as HTMLButtonElement).click();
      confirmar();
      const recusada = http.expectOne('/api/admin/mesas/44/responsavel');
      expect(recusada.request.body).toEqual({ usuarioId: 8 });
      fixture.componentInstance.confirmarAcao();
      fixture.componentInstance.fecharModal();
      fixture.detectChanges();
      http.expectNone('/api/admin/mesas/44/responsavel');
      expect(fixture.componentInstance.mesaSelecionadaParaAcao()?.id).toBe(44);
      expect(fixture.nativeElement.querySelector('.modal__responsavel-atual')).not.toBeNull();
      recusada.flush({ detail: 'O usuário possui reservas não canceladas.' }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(fixture.componentInstance.mesas()[0].responsavel).toBeNull();
      expect(fixture.nativeElement.querySelector('.modal__erro').textContent).toContain('reservas não canceladas');
      expect(sucesso).not.toHaveBeenCalled();
      confirmar();
      const { ocupada, ...cadastro } = { ...legada, responsavel: homonimas[1] };
      http.expectOne('/api/admin/mesas/44/responsavel').flush(cadastro);
      fixture.detectChanges();
      expect(fixture.componentInstance.mesas()[0].responsavel?.id).toBe(8);
      expect(fixture.componentInstance.mesas()[0].ocupada).toBe(ocupada);
      expect(fixture.nativeElement.querySelector('.admin-mesa-page__responsavel').textContent).toContain('maria.dois@teste.com');
      expect(fixture.nativeElement.querySelector('.modal')).toBeNull();
      expect(sucesso).toHaveBeenCalledWith('Sucesso', 'Responsável atribuído com sucesso.');
      http.verify();
    } finally {
      toast.limpar();
      fixture.destroy();
      TestBed.resetTestingModule();
    }
  });

  it('combina nome parcial sem distinguir caixa, local, tipo, ordenação e paginação', async () => {
    const mesas = Array.from({ length: 25 }, (_, i): Mesa => ({ ...mesa, id: i + 1,
      codigo: String(i + 1).padStart(3, '0'), tipo: 'FIXA', regiao: i < 20 ? 'Local A' : 'Local B',
      responsavel: { id: i + 10, nome: i % 2 ? 'Ana Silva' : 'Bruna Costa', email: 'teste@exemplo.com' } }));
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: AdminMesaService, useValue: { listarComOcupacao: () => of(mesas) } }] });
    const fixture = TestBed.createComponent(AdminMesaPage);
    fixture.detectChanges();
    await new Promise<void>(resolve => setTimeout(resolve, 300));
    fixture.detectChanges();
    expect(fixture.componentInstance.mesasPaginadas()).toHaveLength(10);
    fixture.componentInstance.pagina.set(2);
    fixture.detectChanges();
    expect(fixture.componentInstance.mesasPaginadas()).toHaveLength(5);
    fixture.componentInstance.nomeResponsavel.set('sILVa');
    fixture.componentInstance.local.set('Local A');
    fixture.componentInstance.filtroTipo.set('fixa');
    fixture.componentInstance.descendente.set(true);
    fixture.detectChanges();
    expect(fixture.componentInstance.paginaAtual()).toBe(0);
    expect(fixture.componentInstance.mesasFiltradas()).toHaveLength(10);
    expect(fixture.componentInstance.mesasPaginadas()[0].codigo).toBe('020');
    fixture.destroy();
    TestBed.resetTestingModule();
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
