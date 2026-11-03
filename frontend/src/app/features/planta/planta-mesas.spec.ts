import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { PlantaMesas } from "./planta-mesas";
import { Mesa } from "../mesas/mesa";
import { agruparFileiras, TAMANHO_MESA, PLANTA_TAMBORE_EXIBICAO } from "./planta-layout";

describe("PlantaMesas", () => {
  let http: HttpTestingController;

  beforeEach(() => {
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

  it("usa os IDs e posições da API e impede seleção de inativas e fixas", () => {
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
      },
      {
        id: 981,
        codigo: "B",
        regiao: "DEMO",
        tipo: "LIVRE",
        ativa: false,
        ocupante: "Teste",
        referenciaVisual: { planta: "P", x: 230, y: 87 },
      },
      {
        id: 117,
        codigo: "C",
        regiao: "DEMO",
        tipo: "FIXA",
        ativa: true,
        ocupante: "Teste",
        referenciaVisual: { planta: "Outra", x: 10, y: 20 },
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
    expect(buttons[1].disabled).toBe(true);
    expect(buttons[2].disabled).toBe(true);
    const emit = vi.fn();
    fixture.componentInstance.mesaSelecionada.subscribe(emit);
    buttons[0].click();
    fixture.componentInstance.selecionar(mesas[1]);
    fixture.componentInstance.selecionar(mesas[2]);
    expect(emit).toHaveBeenCalledExactlyOnceWith(mesas[0]);
    expect(fixture.componentInstance.selecionada()).toBe(731);
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
        regiao: 'TAMBORÉ', tipo: 'LIVRE', ativa: true, ocupante: '',
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
    expect(emitir).toHaveBeenCalledExactlyOnceWith(mesas[7]);
  });

  it("separa os blocos e não une mesas através da entrada ou de posições ausentes", () => {
    const mesas: Mesa[] = [
      [1, 24, 24], [8, 24, 124],
      [112, 836, 24], [111, 836, 124],
      [98, 1213, 445], [97, 1213, 545],
      [93, 834, 1048], [94, 1211, 1048],
      [92, 834, 1148], [91, 1023, 1148],
    ].map(([id, x, y]) => ({
      id, codigo: String(id), tipo: 'LIVRE', ativa: true, ocupante: '',
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

  it("aproxima horizontalmente as fileiras iniciadas nas mesas 65 e 77 sem separar as bancadas", () => {
    const mesas: Mesa[] = [
      [65, '065', 29, 1757], [69, '069', 595, 1857],
      [77, '077', 833, 1548], [73, '073', 1400, 1650],
    ].map(([id, codigo, x, y]) => ({
      id: Number(id), codigo: String(codigo), tipo: 'FIXA', ativa: true, ocupante: '',
      regiao: 'TAMBORÉ', referenciaVisual: { planta: 'TAMBORÉ', x: Number(x), y: Number(y) },
    }));
    const posicoes = agruparFileiras(mesas, TAMANHO_MESA, true);
    const distanciaOriginal = (1757 - 1548) * 1.4;
    expect(posicoes.get(65)!.y - posicoes.get(77)!.y).toBeCloseTo(distanciaOriginal - 64);
    expect(posicoes.get(69)!.y).toBe(posicoes.get(65)!.y + TAMANHO_MESA.altura);
    expect(posicoes.get(73)!.y).toBe(posicoes.get(77)!.y + TAMANHO_MESA.altura);
  });

  it("limita o zoom e restaura a visualização sem alterar posições da API", () => {
    const fixture = TestBed.createComponent(PlantaMesas);
    fixture.detectChanges();
    http.expectOne("/api/mesas").flush([]);
    fixture.detectChanges();
    const componente = fixture.componentInstance;
    expect(componente.zoom()).toBe(1);
    expect(componente.escala()).toBeCloseTo(0.8);
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
    expect(componente.escala()).toBeCloseTo(0.8);
    expect(viewport.scrollTo).toHaveBeenCalledWith({ left: 0, top: 0 });
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
      ocupante: '',
      referenciaVisual: { planta: 'P', x: id * 200, y: 80 },
    }));
    http.expectOne('/api/mesas').flush(mesas);
    http.expectOne(request => request.url === '/api/mesas/disponiveis'
      && request.params.get('data') === '2026-10-30').flush([mesas[0]]);
    fixture.detectChanges();
    fixture.componentInstance.ajustarZoom(0.1);
    fixture.detectChanges();
    const botoes = fixture.nativeElement.querySelectorAll('button.mesa') as NodeListOf<HTMLButtonElement>;
    expect(botoes[0].disabled).toBe(false);
    expect(botoes[1].disabled).toBe(true);
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
    expect(emitir).toHaveBeenCalledExactlyOnceWith(mesas[0]);
  });

  it("oculta o rótulo de mesa fixa ao exibir os nomes dos ocupantes", () => {
    const fixture = TestBed.createComponent(PlantaMesas);
    fixture.detectChanges();
    http.expectOne('/api/mesas').flush([{
      id: 65,
      codigo: '065',
      regiao: 'DEMO',
      tipo: 'FIXA',
      ativa: true,
      ocupante: 'Pessoa Exemplo',
      referenciaVisual: { planta: 'DEMO', x: 200, y: 80 },
    }]);
    fixture.detectChanges();

    const mesa = fixture.nativeElement.querySelector('button.mesa') as HTMLButtonElement;
    expect(mesa.querySelector('.mesa__estado')?.textContent).toContain('Mesa fixa');
    (fixture.nativeElement.querySelector('.botao-icone') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(mesa.querySelector('.mesa__ocupante')?.textContent).toContain('Pessoa Exemplo');
    expect(getComputedStyle(mesa.querySelector('.mesa__ocupante') as HTMLElement).fontSize).toBe('15px');
    expect(mesa.querySelector('.mesa__estado')).toBeNull();
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
    mesaFixa.disabled = true;
    viewport.appendChild(mesaFixa);
    viewport.scrollLeft = 100;
    viewport.scrollTop = 200;
    mesaFixa.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', button: 0, pointerId: 3, clientX: 50, clientY: 60 }));
    expect(componente.arrastando()).toBe(true);
    viewport.dispatchEvent(new PointerEvent('pointermove', { pointerId: 3, clientX: 30, clientY: 20 }));
    expect(viewport.scrollLeft).toBe(120);
    expect(viewport.scrollTop).toBe(240);
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
