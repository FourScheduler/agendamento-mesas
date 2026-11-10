import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { PlantaMesas } from "./planta-mesas";
import { Mesa } from "../mesas/mesa";
import { AuthService } from "../../core/auth/auth.service";
import { agruparFileiras, TAMANHO_MESA, PLANTA_TAMBORE_EXIBICAO } from "./planta-layout";

describe("PlantaMesas", () => {
  let http: HttpTestingController;

  it.each(['LIVRE', 'FIXA'] as const)('centraliza a mesa %s do usuário na primeira consulta sem selecionar', (tipo) => {
    TestBed.inject(AuthService).sessao.set({
      token: 'teste', tipo: 'Bearer',
      usuario: { id: 7, nome: 'Maria', email: 'maria@example.com', perfil: 'USUARIO' },
    });
    const fixture = TestBed.createComponent(PlantaMesas);
    fixture.componentRef.setInput('data', '2026-11-10');
    fixture.detectChanges();
    const viewport = fixture.nativeElement.querySelector('.mapa__viewport') as HTMLElement;
    viewport.scrollTo = vi.fn();
    const pessoa = { id: 7, nome: 'Maria', email: 'maria@example.com' };
    http.expectOne('/api/mesas/com-ocupacao?data=2026-11-10').flush([{
      id: 91, codigo: '091', regiao: 'DEMO', tipo, ativa: true, ocupada: tipo === 'LIVRE',
      ocupante: '', responsavel: tipo === 'FIXA' ? pessoa : null,
      ocupanteNaData: tipo === 'LIVRE' ? pessoa : null,
      referenciaVisual: { planta: 'DEMO', x: 800, y: 600 },
    }]);
    http.expectOne('/api/mesas/disponiveis?data=2026-11-10').flush([]);
    fixture.detectChanges();
    expect(viewport.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'instant' }));
    expect(fixture.nativeElement.querySelector('.mesa__diaria').textContent).toBe('Sua reserva');
    expect(fixture.componentInstance.selecionada()).toBeNull();
  });

  beforeAll(() => {
    Object.defineProperties(HTMLElement.prototype, {
      showPopover: { configurable: true, writable: true, value: vi.fn() },
      hidePopover: { configurable: true, writable: true, value: vi.fn() },
    });
  });
  afterAll(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'showPopover');
    Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover');
  });

  beforeEach(() => {
    // Mock scrollTo for JSDOM test environment
    Element.prototype.scrollTo = vi.fn();
    HTMLElement.prototype.scrollTo = vi.fn();
    
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it("não sobrepõe as 115 mesas quando a API ainda usa a grade anterior ao SVG", () => {
    const fixture = TestBed.createComponent(PlantaMesas);
    fixture.detectChanges();
    http.expectOne("/api/mesas").flush(
      Array.from({ length: 115 }, (_, i) => ({
        id: 900 + i,
        codigo: String(i + 1).padStart(3, "0"),
        regiao: "TAMBORÉ",
        tipo: "FIXA",
        ativa: true,
        ocupante: "Teste",
        referenciaVisual: {
          planta: "TAMBORÉ",
          x: 100 + (i % 10) * 80,
          y: 80 + Math.floor(i / 10) * 60,
        },
        ocupada: false,
      })),
    );
    fixture.detectChanges();
    expect(fixture.componentInstance.plantas()[0].legado).toBe(true);
    expect(fixture.nativeElement.querySelector(".entrada")).toBeNull();
    const botoes = [
      ...fixture.nativeElement.querySelectorAll("button.mesa"),
    ] as HTMLButtonElement[];
    expect(botoes.length).toBe(115);
    const retangulos = botoes.map(({ style }) => ({
      x: parseFloat(style.left),
      y: parseFloat(style.top),
      largura: parseFloat(style.width),
      altura: parseFloat(style.height),
    }));
    for (let i = 0; i < retangulos.length; i++) {
      const a = retangulos[i];
      for (const b of retangulos.slice(i + 1)) {
        expect(
          a.x < b.x + b.largura &&
            a.x + a.largura > b.x &&
            a.y < b.y + b.altura &&
            a.y + a.altura > b.y,
        ).toBe(false);
      }
    }
  });

  it("usa os IDs e posições da API e permite consultar mesas não reserváveis", () => {
    const fixture = TestBed.createComponent(PlantaMesas);
    fixture.detectChanges();
    const request = http.expectOne("/api/mesas");
    const mesas: Mesa[] = [
      {
        id: 731,
        codigo: "A",
        regiao: "DEMO",
        tipo: "LIVRE",
        ativa: true,
        ocupante: "Teste",
        referenciaVisual: { planta: "P", x: 123, y: 87 },
        ocupada: false,
      },
      {
        id: 981,
        codigo: "B",
        regiao: "DEMO",
        tipo: "LIVRE",
        ativa: false,
        ocupante: "Teste",
        referenciaVisual: { planta: "P", x: 230, y: 87 },
        ocupada: false,
      },
      {
        id: 117,
        codigo: "C",
        regiao: "DEMO",
        tipo: "FIXA",
        ativa: true,
        ocupante: "Teste",
        referenciaVisual: { planta: "Outra", x: 10, y: 20 },
        ocupada: false,
      },
    ];
    request.flush(mesas);
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll(
      "button.mesa",
    ) as NodeListOf<HTMLButtonElement>;
    expect(buttons.length).toBe(3);
    expect(buttons[0].style.left).toBe("123px");
    expect(buttons[0].style.top).toBe("87px");
    expect(buttons[1].disabled).toBe(false);
    expect(buttons[2].disabled).toBe(false);
    expect(buttons[1].getAttribute('aria-disabled')).toBe('true');
    expect(buttons[2].getAttribute('aria-disabled')).toBe('true');
    const emit = vi.fn();
    fixture.componentInstance.mesaSelecionada.subscribe(emit);
    buttons[0].click();
    buttons[1].click();
    buttons[2].click();
    expect(emit.mock.calls).toEqual([
      [{ mesa: mesas[0], disponivel: true }],
      [{ mesa: mesas[1], disponivel: false }],
      [{ mesa: mesas[2], disponivel: false }],
    ]);
    expect(fixture.componentInstance.selecionada()).toBe(mesas[2].id);
  });

  it("mantém a geometria de Tamboré com entrada e parede sem duplicar mesas", () => {
    const fixture = TestBed.createComponent(PlantaMesas);
    fixture.detectChanges();
    http.expectOne("/api/mesas").flush([
      {
        id: 503,
        codigo: "DEMO",
        regiao: "TAMBORÉ",
        tipo: "LIVRE",
        ativa: true,
        ocupante: "Teste",
        referenciaVisual: { planta: "TAMBORÉ", x: 24, y: 24 },
        ocupada: false,
      },
    ]);
    fixture.detectChanges();
    expect(fixture.componentInstance.plantas()[0].largura).toBe(PLANTA_TAMBORE_EXIBICAO.largura);
    expect(fixture.componentInstance.plantas()[0].altura).toBe(PLANTA_TAMBORE_EXIBICAO.altura);
    expect(fixture.nativeElement.querySelector('.planta__janelas--inferiores')).not.toBeNull();
    const janelas = fixture.nativeElement.querySelectorAll('.planta__janelas') as NodeListOf<HTMLElement>;
    expect(janelas.length).toBe(2);
    for (const janela of janelas) {
      expect(janela.textContent).toBe('');
      expect(janela.getAttribute('aria-hidden')).toBe('true');
    }
    expect(
      fixture.nativeElement.querySelector(".entrada").textContent,
    ).toContain("Entrada");
    expect(fixture.nativeElement.querySelector(".parede")).toBeNull();
    expect(fixture.nativeElement.querySelectorAll(".estrutura").length).toBe(2);
    expect(fixture.nativeElement.querySelector(".planta__jardineiras")).toBeNull();
    expect(fixture.nativeElement.querySelector(".planta__vidros")).not.toBeNull();
    const viewport = fixture.nativeElement.querySelector(".mapa__viewport") as HTMLElement;
    const controles = fixture.nativeElement.querySelector(".mapa__rodape") as HTMLElement;
    expect(viewport.contains(controles)).toBe(false);
    expect(viewport.parentElement?.nextElementSibling).toBe(controles);
    expect(fixture.nativeElement.querySelectorAll("button.mesa").length).toBe(
      1,
    );
    expect(
      fixture.nativeElement.querySelector(".mesa__codigo").textContent,
    ).toContain("DEMO");
  });

  it("informa sessão inválida quando o catálogo responde 401", () => {
    const fixture = TestBed.createComponent(PlantaMesas);
    fixture.detectChanges();
    http
      .expectOne("/api/mesas")
      .flush({}, { status: 401, statusText: "Unauthorized" });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      "Sessão inválida ou expirada",
    );
  });

  it("une 1 com 8, 2 com 7, 3 com 6 e 4 com 5, sem cadeiras internas", () => {
    const fixture = TestBed.createComponent(PlantaMesas);
    fixture.detectChanges();
    const mesas: Mesa[] = Array.from({ length: 16 }, (_, indice) => {
      const fileira = Math.floor(indice / 4);
      const coluna = fileira % 2 === 0 ? indice % 4 : 3 - indice % 4;
      return {
        id: indice + 1, codigo: String(indice + 1).padStart(3, '0'),
        regiao: 'TAMBORÉ', tipo: 'LIVRE', ativa: true, ocupada: false, ocupante: '',
        referenciaVisual: { planta: 'TAMBORÉ', x: 24 + coluna * 189,
          y: [24, 124, 240, 340][fileira] },
      };
    });

    http.expectOne('/api/mesas').flush(mesas);
    fixture.detectChanges();
    const botao = (id: number): HTMLButtonElement =>
      fixture.nativeElement.querySelector(`[data-mesa-id="${id}"]`);
    for (const [superior, inferior] of [[1, 8], [2, 7], [3, 6], [4, 5], [9, 16], [10, 15]]) {
      expect(botao(superior).style.left).toBe(botao(inferior).style.left);
      expect(parseFloat(botao(inferior).style.top)).toBe(
        parseFloat(botao(superior).style.top) + parseFloat(botao(superior).style.height));
      expect(botao(superior).querySelector('.mesa__cadeira--inferior')).toBeNull();
      expect(botao(inferior).querySelector('.mesa__cadeira--superior')).toBeNull();
      expect(botao(superior).querySelector('.mesa__cadeira--superior')).not.toBeNull();
      expect(botao(inferior).querySelector('.mesa__cadeira--inferior')).not.toBeNull();
    }
    for (const [esquerda, direita] of [[1, 2], [2, 3], [3, 4], [8, 7], [7, 6], [6, 5]]) {
      expect(parseFloat(botao(direita).style.left)).toBe(
        parseFloat(botao(esquerda).style.left) + parseFloat(botao(esquerda).style.width));
    }
    const espaco = parseFloat(botao(9).style.top)
      - parseFloat(botao(8).style.top) - parseFloat(botao(8).style.height);
    expect(espaco).toBeGreaterThanOrEqual(110);
    const contornos = fixture.nativeElement.querySelectorAll('.bancada__relevo') as NodeListOf<HTMLElement>;
    expect(contornos.length).toBe(2);
    for (const contorno of contornos) {
      expect(parseFloat(contorno.style.width)).toBe(4 * TAMANHO_MESA.largura);
      expect(parseFloat(contorno.style.height)).toBe(2 * TAMANHO_MESA.altura);
      expect(contorno.getAttribute('aria-hidden')).toBe('true');
    }
    expect(mesas[7].referenciaVisual.y).toBe(124);
    const emitir = vi.fn();
    fixture.componentInstance.mesaSelecionada.subscribe(emitir);
    botao(8).click();
    expect(emitir).toHaveBeenCalledExactlyOnceWith({ mesa: mesas[7], disponivel: true });
  });

  it("separa os blocos e não une mesas através da entrada ou de posições ausentes", () => {
    const mesas: Mesa[] = [
      [1, 24, 24], [8, 24, 124],
      [112, 836, 24], [111, 836, 124],
      [98, 1213, 445], [97, 1213, 545],
      [93, 834, 1048], [94, 1211, 1048],
      [92, 834, 1148], [91, 1023, 1148],
    ].map(([id, x, y]) => ({
      id, codigo: String(id), tipo: 'LIVRE', ativa: true, ocupada: false, ocupante: '',
      regiao: 'TAMBORÉ', referenciaVisual: { planta: 'TAMBORÉ', x, y },
    }));
    const posicoes = agruparFileiras(mesas, TAMANHO_MESA, true);
    expect(posicoes.get(111)).toEqual({ x: 956, y: 116, superior: false, inferior: true });
    expect(posicoes.get(97)).toMatchObject({ superior: false, inferior: true });
    expect(posicoes.get(93)).toMatchObject({ superior: true, inferior: false });
    expect(posicoes.get(92)!.y).toBe(posicoes.get(93)!.y + TAMANHO_MESA.altura);
    expect(posicoes.get(94)).toMatchObject({ superior: true, inferior: true });
    expect(posicoes.get(91)).toMatchObject({ superior: false, inferior: true });
    expect(posicoes.get(91)!.y).toBe(posicoes.get(92)!.y);
    expect(posicoes.get(91)!.y).toBe(posicoes.get(94)!.y + TAMANHO_MESA.altura);
    const coluna = PLANTA_TAMBORE_EXIBICAO.estruturas[1];
    expect(coluna.x).toBe(posicoes.get(91)!.x);
    expect(coluna.y).toBe(posicoes.get(94)!.y);
    expect(coluna.largura).toBe(TAMANHO_MESA.largura);
    expect(coluna.y + coluna.altura).toBe(posicoes.get(91)!.y);
    const estruturaProximaMesa97 = PLANTA_TAMBORE_EXIBICAO.estruturas[0];
    const estruturaProximaMesa93 = PLANTA_TAMBORE_EXIBICAO.estruturas[1];
    expect(estruturaProximaMesa97.largura).toBe(estruturaProximaMesa93.largura);
    expect(estruturaProximaMesa97.altura).toBe(estruturaProximaMesa93.altura);
    expect(estruturaProximaMesa97.x + estruturaProximaMesa97.largura)
      .toBe(posicoes.get(97)!.x);
    expect(estruturaProximaMesa97.y).toBe(posicoes.get(97)!.y);
    const corredor = posicoes.get(112)!.x - posicoes.get(1)!.x - 4 * TAMANHO_MESA.largura;
    expect(corredor).toBeGreaterThanOrEqual(200);
  });

  it("reposiciona a fileira 77 junto ao bloco direito sem separar as bancadas", () => {
    const mesas: Mesa[] = [
      [65, '065', 29, 1757], [69, '069', 595, 1857],
      [77, '077', 833, 1548], [73, '073', 1400, 1650],
    ].map(([id, codigo, x, y]) => ({
      id: Number(id), codigo: String(codigo), tipo: 'FIXA', ativa: true, ocupada: false, ocupante: '',
      regiao: 'TAMBORÉ', referenciaVisual: { planta: 'TAMBORÉ', x: Number(x), y: Number(y) },
    }));
    const posicoes = agruparFileiras(mesas, TAMANHO_MESA, true);
    expect(posicoes.get(65)!.y - posicoes.get(77)!.y).toBeCloseTo(66.2);
    expect(posicoes.get(69)!.y).toBe(posicoes.get(65)!.y + TAMANHO_MESA.altura);
    expect(posicoes.get(73)!.y).toBe(posicoes.get(77)!.y + TAMANHO_MESA.altura);
  });

  it("posiciona o topo da fileira 93 abaixo da bancada 41 conforme a linha de referência", () => {
    const mesas: Mesa[] = [
      [41, 24, 1108], [48, 24, 1208],
      [93, 834, 1048], [94, 1211, 1048], [95, 1400, 1048],
      [92, 834, 1148], [91, 1023, 1148], [90, 1211, 1148], [89, 1400, 1148],
      [85, 834, 1294], [84, 834, 1394],
    ].map(([id, x, y]) => ({
      id, codigo: String(id), tipo: 'LIVRE', ativa: true, ocupada: false, ocupante: '',
      regiao: 'TAMBORÉ', referenciaVisual: { planta: 'TAMBORÉ', x, y },
    }));
    const posicoes = agruparFileiras(mesas, TAMANHO_MESA, true);
    for (const codigo of [93, 94, 95]) {
      expect(posicoes.get(codigo)!.y)
        .toBeCloseTo(posicoes.get(48)!.y + TAMANHO_MESA.altura + 48);
    }
    for (const codigo of [89, 90, 91, 92]) {
      expect(posicoes.get(codigo)!.y).toBeCloseTo(posicoes.get(48)!.y + 232);
    }
    expect(posicoes.get(93)!.x).toBeGreaterThan(posicoes.get(41)!.x + 4 * TAMANHO_MESA.largura);
    const estrutura = PLANTA_TAMBORE_EXIBICAO.estruturas[1];
    expect(estrutura.y).toBeCloseTo(posicoes.get(93)!.y);
    expect(estrutura.y + estrutura.altura).toBeCloseTo(posicoes.get(91)!.y);
    expect(posicoes.get(85)!.y - posicoes.get(92)!.y - TAMANHO_MESA.altura)
      .toBeGreaterThan(70);
    expect(mesas.find(mesa => mesa.id === 93)!.referenciaVisual.y).toBe(1048);
  });

  it("centraliza a entrada no vão direito com margens iguais para as cadeiras", () => {
    const mesas: Mesa[] = [
      [98, 1213, 445], [97, 1213, 545],
      [93, 834, 1048], [92, 834, 1148],
    ].map(([id, x, y]) => ({
      id, codigo: String(id), tipo: 'LIVRE', ativa: true, ocupada: false, ocupante: '',
      regiao: 'TAMBORÉ', referenciaVisual: { planta: 'TAMBORÉ', x, y },
    }));
    const posicoes = agruparFileiras(mesas, TAMANHO_MESA, true);
    const entrada = PLANTA_TAMBORE_EXIBICAO.entrada;
    const fimBancadaSuperior = posicoes.get(97)!.y + TAMANHO_MESA.altura;
    const inicioBancadaInferior = posicoes.get(93)!.y;
    expect(entrada.x).toBe(posicoes.get(93)!.x);
    expect(entrada.largura).toBe(4 * TAMANHO_MESA.largura);
    expect(entrada.y - fimBancadaSuperior).toBeCloseTo(60);
    expect(inicioBancadaInferior - entrada.y - entrada.altura).toBeCloseTo(60);
    expect(entrada.y + entrada.altura / 2)
      .toBeCloseTo((fimBancadaSuperior + inicioBancadaInferior) / 2);
    expect(entrada.altura).toBeGreaterThan(0);
  });

  it("repete os intervalos das bancadas esquerdas no bloco direito, exceto na entrada", () => {
    const mesas: Mesa[] = [
      [1, 24, 24], [8, 24, 124], [9, 24, 240], [16, 24, 340],
      [17, 24, 457], [24, 24, 557],
      [112, 836, 24], [111, 836, 124], [104, 836, 240], [103, 836, 340],
      [98, 1213, 445], [97, 1213, 545],
      [49, 24, 1321], [56, 24, 1421], [57, 29, 1541], [64, 29, 1641],
      [65, 29, 1757], [72, 29, 1857],
      [93, 834, 1048], [92, 834, 1148], [85, 834, 1294], [84, 834, 1394],
      [77, 833, 1548], [76, 834, 1650],
    ].map(([id, x, y]) => ({
      id, codigo: String(id), tipo: 'LIVRE', ativa: true, ocupada: false, ocupante: '',
      regiao: 'TAMBORÉ', referenciaVisual: { planta: 'TAMBORÉ', x, y },
    }));
    const posicoes = agruparFileiras(mesas, TAMANHO_MESA, true);
    const intervalo = (superior: number, inferior: number) =>
      posicoes.get(inferior)!.y - posicoes.get(superior)!.y - TAMANHO_MESA.altura;
    for (const [esquerdaFim, esquerdaInicio, direitaFim, direitaInicio] of [
      [8, 9, 111, 104], [16, 17, 103, 98],
      [56, 57, 92, 85], [64, 65, 84, 77],
    ]) {
      expect(intervalo(direitaFim, direitaInicio))
        .toBeCloseTo(intervalo(esquerdaFim, esquerdaInicio));
    }
  });

  it("limita o zoom e restaura a visualização sem alterar posições da API", () => {
    const fixture = TestBed.createComponent(PlantaMesas);
    fixture.detectChanges();
    http.expectOne("/api/mesas").flush([]);
    fixture.detectChanges();
    const componente = fixture.componentInstance;
    expect(componente.zoom()).toBe(1);
    expect(componente.escala()).toBeCloseTo(0.72);
    const viewport = fixture.nativeElement.querySelector(".mapa__viewport");
    viewport.scrollTo = vi.fn();
    const botoes = fixture.nativeElement.querySelectorAll(".mapa__controles button") as NodeListOf<HTMLButtonElement>;
    for (let i = 0; i < 20; i++) botoes[0].click();
    fixture.detectChanges();
    expect(componente.zoom()).toBe(1.5);
    expect(botoes[0].disabled).toBe(true);
    for (let i = 0; i < 20; i++) botoes[1].click();
    fixture.detectChanges();
    expect(componente.zoom()).toBe(0.5);
    expect(botoes[1].disabled).toBe(true);
    botoes[2].click();
    expect(componente.zoom()).toBe(1);
    expect(componente.escala()).toBeCloseTo(0.72);
    expect(viewport.scrollTo).toHaveBeenCalledWith({ left: 0, top: 0 });
  });

  it("abre o mapa ampliado como modal e permite fechá-lo pelo botão, Escape ou fundo", () => {
    const fixture = TestBed.createComponent(PlantaMesas);
    fixture.detectChanges();
    http.expectOne("/api/mesas").flush([]);
    fixture.detectChanges();

    const modal = fixture.nativeElement.querySelector(".mapa__modal") as HTMLElement;
    const botaoAmpliar = fixture.nativeElement.querySelector(
      '[aria-label="Ampliar mapa"]',
    ) as HTMLButtonElement;
    botaoAmpliar.click();
    fixture.detectChanges();

    expect(modal.getAttribute("role")).toBe("dialog");
    expect(modal.getAttribute("aria-modal")).toBe("true");
    expect(fixture.componentInstance.mapaAmpliado()).toBe(true);
    expect(fixture.componentInstance.zoomMapaAmpliado()).toBe(1);
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('[aria-label="Fechar mapa ampliado"]'),
    );
    expect(getComputedStyle(modal.querySelector(".mapa__cabecalho")!).display).toBe("none");
    expect(getComputedStyle(modal.querySelector(".mapa__rodape")!).display).toBe("none");
    const dataMapa = fixture.nativeElement.querySelector(
      ".mapa__ferramentas-modal > div",
    ) as HTMLElement;
    const botaoData = fixture.nativeElement.querySelector(
      '[aria-label="Mostrar dia da reserva"]',
    ) as HTMLButtonElement;
    expect(botaoData.classList.contains("mapa__alternar-data-modal")).toBe(true);
    expect(botaoData.getAttribute("aria-pressed")).toBe("false");
    expect(dataMapa.style.display).toBe("none");
    botaoData.click();
    fixture.detectChanges();
    expect(dataMapa.style.display).toBe("");
    expect(fixture.nativeElement.querySelector(
      '.mapa__alternar-data-modal[aria-label="Ocultar dia da reserva"]',
    )).not.toBeNull();
    (fixture.nativeElement.querySelector(
      '.mapa__alternar-data-modal[aria-label="Ocultar dia da reserva"]',
    ) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(dataMapa.style.display).toBe("none");

    const zoomIn = fixture.nativeElement.querySelector(
      '[aria-label="Aumentar zoom do mapa"]',
    ) as HTMLButtonElement;
    zoomIn.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.zoomMapaAmpliado()).toBe(1.1);
    expect(fixture.nativeElement.textContent).toContain("110%");

    const zoomOut = fixture.nativeElement.querySelector(
      '[aria-label="Diminuir zoom do mapa"]',
    ) as HTMLButtonElement;
    zoomOut.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.zoomMapaAmpliado()).toBe(1);
    expect(fixture.nativeElement.textContent).toContain("100%");

    const viewport = fixture.nativeElement.querySelector(".mapa__viewport") as HTMLElement;
    viewport.scrollTo = vi.fn();
    zoomIn.click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector(
      '[aria-label="Restaurar zoom do mapa"]',
    ) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.zoomMapaAmpliado()).toBe(1);
    expect(viewport.scrollTo).toHaveBeenCalledWith({ left: 0, top: 0 });

    fixture.nativeElement.querySelector('[aria-label="Fechar mapa ampliado"]').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.mapaAmpliado()).toBe(false);
    expect(document.activeElement).toBe(botaoAmpliar);

    botaoAmpliar.click();
    fixture.detectChanges();
    modal.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    }));
    fixture.detectChanges();
    expect(fixture.componentInstance.mapaAmpliado()).toBe(false);

    botaoAmpliar.click();
    fixture.detectChanges();
    modal.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.mapaAmpliado()).toBe(false);
  });

  it("ajusta a escala do modal para enquadrar a planta na largura e altura disponíveis", () => {
    class ResizeObserverFalso implements ResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}

      observe() {
        this.callback(
          [{ contentRect: new DOMRectReadOnly(0, 0, 1200, 500) } as ResizeObserverEntry],
          this,
        );
      }

      unobserve() {}
      disconnect() {}
    }

    const resizeObserverOriginal = globalThis.ResizeObserver;
    vi.stubGlobal("ResizeObserver", ResizeObserverFalso);
    try {
      const fixture = TestBed.createComponent(PlantaMesas);
      fixture.detectChanges();
      http.expectOne("/api/mesas").flush([{
        id: 44,
        codigo: "044",
        regiao: "TAMBORÉ",
        tipo: "LIVRE",
        ativa: true,
        ocupante: "",
        referenciaVisual: { planta: "TAMBORÉ", x: 24, y: 24 },
        ocupada: false,
      }]);
      fixture.detectChanges();

      const componente = fixture.componentInstance;
      fixture.nativeElement.querySelector('[aria-label="Ampliar mapa"]').click();
      fixture.detectChanges();

      const escalaEsperada = Math.min(
        1200 / (componente.larguraDesenho() + 132),
        500 / (componente.alturaDesenho() + 132),
      ) * 2.6;
      expect(componente.escala()).toBeCloseTo(escalaEsperada);
      const viewport = fixture.nativeElement.querySelector(".mapa__viewport") as HTMLElement;
      expect(getComputedStyle(viewport).overflow).toBe("auto");
      expect(getComputedStyle(viewport).scrollbarWidth).toBe("none");
    } finally {
      vi.stubGlobal("ResizeObserver", resizeObserverOriginal);
    }
  });

  it("mantém a disponibilidade diária e a seleção real após ajustar o zoom", () => {
    const fixture = TestBed.createComponent(PlantaMesas);
    fixture.componentRef.setInput('data', '2026-10-30');
    fixture.detectChanges();
    const mesas: Mesa[] = [1, 2].map(id => ({
      id,
      codigo: String(id),
      regiao: 'DEMO',
      tipo: 'LIVRE',
      ativa: true,
      ocupada: false,
      ocupante: '',
      referenciaVisual: { planta: 'P', x: id * 200, y: 80 },
    }));
    http.expectOne('/api/mesas/com-ocupacao?data=2026-10-30').flush(mesas);
    http.expectOne(request => request.url === '/api/mesas/disponiveis'
      && request.params.get('data') === '2026-10-30').flush([mesas[0]]);
    fixture.detectChanges();
    fixture.componentInstance.ajustarZoom(0.1);
    fixture.detectChanges();
    const botoes = fixture.nativeElement.querySelectorAll('button.mesa') as NodeListOf<HTMLButtonElement>;
    expect(botoes[0].disabled).toBe(false);
    expect(botoes[1].disabled).toBe(false);
    expect(botoes[1].getAttribute('aria-disabled')).toBe('true');
    expect(botoes[1].classList.contains('ocupada')).toBe(true);
    expect(botoes[0].querySelectorAll('.mesa__cadeira').length).toBe(2);
    const cadeira = botoes[0].querySelector('.mesa__cadeira') as HTMLElement;
    expect(getComputedStyle(cadeira).left).toBe('0px');
    expect(getComputedStyle(cadeira).right).toBe('0px');
    expect(getComputedStyle(cadeira).marginLeft).toBe('auto');
    expect(getComputedStyle(cadeira).marginRight).toBe('auto');
    expect(botoes[0].style.left).toBe('200px');
    const emitir = vi.fn();
    fixture.componentInstance.mesaSelecionada.subscribe(emitir);
    botoes[0].click();
    expect(emitir).toHaveBeenCalledExactlyOnceWith({ mesa: mesas[0], disponivel: true });
  });

  it("exibe somente o rótulo Livre e mantém nomes opcionais dos ocupantes", () => {
    const fixture = TestBed.createComponent(PlantaMesas);
    fixture.componentRef.setInput('data', '2026-11-03');
    fixture.detectChanges();
    http.expectOne('/api/mesas/com-ocupacao?data=2026-11-03').flush([
      {
        id: 65,
        codigo: '065',
        regiao: 'DEMO',
        tipo: 'FIXA',
        ativa: true,
        ocupante: 'Pessoa Exemplo',
        responsavel: { id: 5, nome: 'Pessoa Exemplo', email: 'fixa@example.com' },
        referenciaVisual: { planta: 'DEMO', x: 200, y: 80 },
      },
      {
        id: 66,
        codigo: '066',
        regiao: 'DEMO',
        tipo: 'LIVRE',
        ativa: true,
        ocupante: '',
        referenciaVisual: { planta: 'DEMO', x: 400, y: 80 },
      },
      {
        id: 67,
        codigo: '067',
        regiao: 'DEMO',
        tipo: 'LIVRE',
        ativa: true,
        ocupante: '',
        ocupanteNaData: { id: 8, nome: 'Pessoa Reservada', email: 'reservada@example.com' },
        referenciaVisual: { planta: 'DEMO', x: 600, y: 80 },
      },
    ]);
    http.expectOne('/api/mesas/disponiveis?data=2026-11-03')
      .flush([{ id: 66 }]);
    fixture.detectChanges();

    const mesas = fixture.nativeElement.querySelectorAll('button.mesa') as NodeListOf<HTMLButtonElement>;
    expect(mesas[0].querySelector('.mesa__estado')).toBeNull();
    expect(mesas[1].querySelector('.mesa__estado')?.textContent).toBe('Livre');
    expect(mesas[2].querySelector('.mesa__estado')?.textContent).toBe('Diária');
    expect(getComputedStyle(mesas[2].querySelector('.mesa__estado')!).fontSize)
      .toBe(getComputedStyle(mesas[1].querySelector('.mesa__estado')!).fontSize);
    expect(mesas[0].querySelector('.mesa__diaria')).toBeNull();
    expect(mesas[1].querySelector('.mesa__diaria')).toBeNull();
    expect(mesas[2].classList.contains('ocupada')).toBe(true);
    expect(mesas[2].querySelector('.mesa__diaria')?.textContent).toBe('Diária');
    TestBed.inject(AuthService).sessao.set({
      token: 'teste', tipo: 'Bearer',
      usuario: { id: 8, nome: 'Pessoa Reservada', email: 'reservada@example.com', perfil: 'USUARIO' },
    });
    fixture.detectChanges();
    expect(mesas[2].querySelector('.mesa__diaria')?.textContent).toBe('Sua reserva');
    expect(mesas[2].getAttribute('aria-label')).toContain('Sua reserva');

    expect(mesas[0].querySelector('.mesa-tooltip')?.textContent).toBe('Pessoa Exemplo');
    expect(mesas[1].querySelector('.mesa-tooltip')).toBeNull();
    expect(mesas[2].querySelector('.mesa-tooltip')?.textContent).toBe('Pessoa Reservada');
    expect(mesas[2].hasAttribute('title')).toBe(false);
    expect(mesas[2].querySelector('.mesa-tooltip')?.getAttribute('aria-hidden')).toBe('true');
    const tooltip = mesas[2].querySelector('.mesa-tooltip') as HTMLElement;
    tooltip.showPopover = vi.fn();
    tooltip.hidePopover = vi.fn();
    const codigo = mesas[2].querySelector('.mesa__codigo') as HTMLElement;
    vi.spyOn(mesas[2], 'getBoundingClientRect').mockReturnValue({
      left: 380, top: 280, width: 140, height: 120,
      right: 520, bottom: 400, x: 380, y: 280, toJSON: () => ({}),
    });
    vi.spyOn(codigo, 'getBoundingClientRect').mockReturnValue({
      left: 400, top: 300, width: 100, height: 80,
      right: 500, bottom: 380, x: 400, y: 300, toJSON: () => ({}),
    });
    Object.defineProperty(tooltip, 'offsetWidth', { value: 220 });
    Object.defineProperty(tooltip, 'offsetHeight', { value: 50 });
    mesas[2].dispatchEvent(new MouseEvent('mouseenter'));
    expect(tooltip.getAttribute('popover')).toBe('manual');
    expect(tooltip.showPopover).toHaveBeenCalledOnce();
    expect(tooltip.style.left).toBe('380px');
    expect(tooltip.style.top).toBe('315px');
    expect(tooltip.style.zoom).toBe(String(1 / fixture.componentInstance.escala()));
    expect(tooltip.style.width).toBe('140px');
    expect(tooltip.style.maxHeight).toBe('120px');
    expect(mesas[2].classList.contains('mesa--tooltip')).toBe(true);
    expect(codigo.textContent).toBe('67');
    mesas[2].dispatchEvent(new Event('pointerleave'));
    expect(tooltip.hidePopover).toHaveBeenCalledOnce();
    expect(mesas[2].classList.contains('mesa--tooltip')).toBe(false);
    expect(codigo.textContent).toBe('67');
    for (const evento of ['wheel', 'scroll']) {
      mesas[2].dispatchEvent(new MouseEvent('mouseenter'));
      const chamadasAntes = vi.mocked(tooltip.hidePopover).mock.calls.length;
      fixture.nativeElement.querySelector('.mapa__viewport').dispatchEvent(new Event(evento));
      expect(tooltip.hidePopover).toHaveBeenCalledTimes(chamadasAntes + 1);
      expect(mesas[2].classList.contains('mesa--tooltip')).toBe(false);
    }
    expect(mesas[2].querySelector('.mesa__ocupante')).toBeNull();

    const rodape = fixture.nativeElement.querySelector('.mapa__rodape') as HTMLElement;
    expect(rodape.querySelector('.amostra--fixa')?.parentElement?.textContent?.trim()).toBe('Fixa');
    expect(rodape.querySelector('.amostra--ocupada')?.parentElement?.textContent?.trim()).toBe('Diária');
    expect(rodape.textContent).not.toContain('Reservada');
    const mesaFixa = mesas[0];
    (fixture.nativeElement.querySelector(
      '.legenda__visibilidade .botao-icone',
    ) as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(mesaFixa.querySelector('.mesa__ocupante')?.textContent).toContain('Pessoa Exemplo');
    expect(mesas[2].querySelector('.mesa__ocupante')?.textContent).toContain('Pessoa Reservada');
    expect(getComputedStyle(mesaFixa.querySelector('.mesa__ocupante') as HTMLElement).fontSize).toBe('15px');
    expect(mesaFixa.querySelector('.mesa__estado')).toBeNull();
    expect(mesas[2].getAttribute('aria-label')).toContain('Pessoa Reservada');
    expect(mesas[2].querySelector('.mesa-tooltip')?.textContent).toBe('Pessoa Reservada');
  });

  it("arrasta somente o fundo e libera a captura ao finalizar", () => {
    const fixture = TestBed.createComponent(PlantaMesas);
    fixture.detectChanges();
    http.expectOne("/api/mesas").flush([]);
    fixture.detectChanges();
    const viewport = fixture.nativeElement.querySelector(".mapa__viewport") as HTMLElement;
    viewport.setPointerCapture = vi.fn();
    viewport.hasPointerCapture = vi.fn(() => true);
    viewport.releasePointerCapture = vi.fn();
    viewport.scrollLeft = 100;
    viewport.scrollTop = 200;
    const componente = fixture.componentInstance;
    viewport.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', button: 0, pointerId: 1, clientX: 50, clientY: 60 }));
    viewport.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 30, clientY: 20 }));
    expect(viewport.scrollLeft).toBe(120);
    expect(viewport.scrollTop).toBe(240);
    viewport.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
    expect(componente.arrastando()).toBe(false);
    expect(viewport.releasePointerCapture).toHaveBeenCalledWith(1);
    const botao = document.createElement('button');
    viewport.appendChild(botao);
    botao.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', button: 0, pointerId: 2 }));
    expect(componente.arrastando()).toBe(false);
    const mesaFixa = document.createElement('button');
    mesaFixa.className = 'mesa fixa';
    viewport.appendChild(mesaFixa);
    viewport.scrollLeft = 100;
    viewport.scrollTop = 200;
    mesaFixa.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', button: 0, pointerId: 3, clientX: 50, clientY: 60 }));
    expect(componente.arrastando()).toBe(false);
    viewport.dispatchEvent(new PointerEvent('pointermove', { pointerId: 3, clientX: 30, clientY: 20 }));
    expect(viewport.scrollLeft).toBe(100);
    expect(viewport.scrollTop).toBe(200);
    viewport.dispatchEvent(new PointerEvent('pointerup', { pointerId: 3 }));
    expect(componente.arrastando()).toBe(false);
  });

  it("mantém o relevo ativo sem exibir controles para alternar o modo do mapa", () => {
    const fixture = TestBed.createComponent(PlantaMesas);
    fixture.detectChanges();
    http.expectOne('/api/mesas').flush([]);
    fixture.detectChanges();
    const mapa = fixture.nativeElement.querySelector('.mapa') as HTMLElement;
    expect(mapa.classList.contains('mapa--relevo')).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.mapa__modo').length).toBe(0);
  });
});
