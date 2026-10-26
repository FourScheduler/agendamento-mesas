import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { PlantaMesas } from "./planta-mesas";
import { Mesa } from "./mesa";

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
    fixture.componentRef.setInput("token", "token-teste");
    fixture.detectChanges();
    http.expectOne("/api/mesas").flush(
      Array.from({ length: 115 }, (_, i) => ({
        id: 900 + i,
        codigo: String(i + 1).padStart(3, "0"),
        regiao: "TAMBORÉ",
        tipo: "FIXA",
        ativa: true,
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
    fixture.componentRef.setInput("token", "token-teste");
    fixture.detectChanges();
    const request = http.expectOne("/api/mesas");
    expect(request.request.headers.get("Authorization")).toBe(
      "Bearer token-teste",
    );
    const mesas: Mesa[] = [
      {
        id: 731,
        codigo: "A",
        regiao: "DEMO",
        tipo: "LIVRE",
        ativa: true,
        referenciaVisual: { planta: "P", x: 123, y: 87 },
      },
      {
        id: 981,
        codigo: "B",
        regiao: "DEMO",
        tipo: "LIVRE",
        ativa: false,
        referenciaVisual: { planta: "P", x: 230, y: 87 },
      },
      {
        id: 117,
        codigo: "C",
        regiao: "DEMO",
        tipo: "FIXA",
        ativa: true,
        referenciaVisual: { planta: "Outra", x: 10, y: 20 },
      },
    ];
    request.flush(mesas);
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll(
      "button",
    ) as NodeListOf<HTMLButtonElement>;
    expect(buttons.length).toBe(3);
    const planta = fixture.componentInstance.plantas()[0];
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
    fixture.componentRef.setInput("token", "token-teste");
    fixture.detectChanges();
    http.expectOne("/api/mesas").flush([
      {
        id: 503,
        codigo: "DEMO",
        regiao: "TAMBORÉ",
        tipo: "LIVRE",
        ativa: true,
        referenciaVisual: { planta: "TAMBORÉ", x: 24, y: 24 },
      },
    ]);
    fixture.detectChanges();
    expect(fixture.componentInstance.plantas()[0].largura).toBe(1670);
    expect(fixture.componentInstance.plantas()[0].altura).toBe(1972);
    expect(
      fixture.nativeElement.querySelector(".entrada").textContent,
    ).toContain("Entrada");
    expect(
      fixture.nativeElement.querySelector(".parede").textContent,
    ).toContain("Parede");
    expect(fixture.nativeElement.querySelectorAll(".estrutura").length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll("button.mesa").length).toBe(
      1,
    );
    expect(
      fixture.nativeElement.querySelector(".mesa__codigo").textContent,
    ).toContain("DEMO");
  });

  it("informa sessão expirada e limpa o catálogo ao trocar o token", () => {
    const fixture = TestBed.createComponent(PlantaMesas);
    fixture.componentRef.setInput("token", "expirado");
    fixture.detectChanges();
    http
      .expectOne("/api/mesas")
      .flush({}, { status: 401, statusText: "Unauthorized" });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      "Sessão inválida ou expirada",
    );
    fixture.componentRef.setInput("token", "");
    fixture.detectChanges();
    expect(fixture.componentInstance.mesas()).toEqual([]);
    http.expectNone("/api/mesas");
  });
});
