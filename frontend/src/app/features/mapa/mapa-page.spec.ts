import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from "@angular/router";
import { AuthService } from "../../core/auth/auth.service";
import { MapaPage } from "./mapa-page";
import { Mesa } from "../mesas/mesa";

const mesa: Mesa = {
  id: 44,
  codigo: "044",
  regiao: "TAMBORÉ",
  tipo: "LIVRE",
  ativa: true,
  ocupante: "",
  referenciaVisual: { planta: "TAMBORÉ", x: 24, y: 24 },
  ocupada: false,
};

describe("Barra de reserva do mapa", () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
    TestBed.inject(AuthService).sessao.set({
      token: "teste",
      tipo: "Bearer",
      usuario: {
        id: 7,
        nome: "Pessoa Teste",
        email: "pessoa@example.com",
        perfil: "USUARIO",
      },
    });
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    vi.useRealTimers();
  });

  function abrir() {
    const fixture = TestBed.createComponent(MapaPage);
    fixture.detectChanges();
    http.expectOne("/api/mesas").flush([mesa]);
    http
      .expectOne((request) => request.url === "/api/mesas/disponiveis")
      .flush([mesa]);
    fixture.detectChanges();
    fixture.nativeElement.querySelector("button.mesa").click();
    fixture.detectChanges();
    return fixture;
  }

  it("rola até a mesa recebida do agendamento e mantém o destaque sem abrir o modal", () => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
    const rolar = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: rolar,
    });
    try {
      vi.spyOn(TestBed.inject(ActivatedRoute).snapshot.queryParamMap, "get")
        .mockImplementation(nome => convertToParamMap({ mesaId: "44" }).get(nome));
      const fixture = TestBed.createComponent(MapaPage);
      fixture.detectChanges();
      http.expectOne("/api/mesas").flush([mesa]);
      http.expectOne(request => request.url === "/api/mesas/disponiveis").flush([mesa]);
      fixture.detectChanges();
      const botao = fixture.nativeElement.querySelector("button.mesa") as HTMLButtonElement;
      expect(botao.classList.contains("selecionada")).toBe(true);
      expect(botao.getAttribute("aria-pressed")).toBe("true");
      expect(fixture.componentInstance.mesaSelecionada()?.id).toBe(44);
      expect(fixture.nativeElement.querySelector(".detalhes-overlay")).toBeNull();
      expect(rolar).toHaveBeenCalledExactlyOnceWith({
        block: "center", inline: "center", behavior: "instant",
      });
      expect(rolar.mock.contexts[0]).toBe(botao);
      http.expectNone("/api/reservas");

      botao.click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector(".detalhes")).not.toBeNull();
      fixture.nativeElement.querySelector(".detalhes__fechar").click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector(".mesa.selecionada")).toBeNull();
      expect(fixture.nativeElement.querySelector(".detalhes-overlay")).toBeNull();
    } finally {
      if (descriptor) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", descriptor);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
      }
    }
  });

  it("mostra o resumo e mantém a confirmação integrada à API", () => {
    const fixture = abrir();
    const resumo = fixture.nativeElement.querySelector(
      ".detalhes",
    ) as HTMLElement;
    expect(resumo.getAttribute("role")).toBe("dialog");
    expect(resumo.getAttribute("aria-modal")).toBe("true");
    expect(resumo.textContent).toContain("Mesa 044");
    expect(resumo.textContent).toContain("Disponível em");
    expect(resumo.querySelector(".detalhes__informacoes")).not.toBeNull();
    expect(resumo.querySelector("details")).toBeNull();
    expect(resumo.querySelector("dl")?.textContent).toContain(
      "Pessoa Teste",
    );
    const confirmar = resumo.querySelector(".confirmar") as HTMLButtonElement;
    expect(confirmar.disabled).toBe(false);
    confirmar.click();
    fixture.detectChanges();
    expect(confirmar.disabled).toBe(true);
    const request = http.expectOne("/api/reservas");
    expect(request.request.body).toEqual({
      mesaId: 44,
      data: fixture.componentInstance.reserva.data(),
    });
    request.flush(
      { detail: "Reserva indisponível." },
      { status: 400, statusText: "Bad Request" },
    );
    fixture.detectChanges();
    http.expectOne("/api/mesas").flush([mesa]);
    http
      .expectOne((request) => request.url === "/api/mesas/disponiveis")
      .flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".detalhes")).toBeNull();
    expect(fixture.componentInstance.reserva.erro()).toBe(
      "Reserva indisponível.",
    );
  });

  it("permite limpar a seleção sem enviar reserva", () => {
    const fixture = abrir();
    fixture.nativeElement.querySelector(".detalhes__fechar").click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".detalhes")).toBeNull();
    expect(fixture.componentInstance.mesaSelecionada()).toBeNull();
    expect(fixture.nativeElement.querySelector(".mesa.selecionada")).toBeNull();
    http.expectNone("/api/reservas");
  });

  it("permite ao administrador escolher outro solicitante na busca e envia o ID", async () => {
    vi.useFakeTimers();
    TestBed.inject(AuthService).sessao.set({
      token: "teste",
      tipo: "Bearer",
      usuario: {
        id: 1,
        nome: "Admin",
        email: "admin@example.com",
        perfil: "ADMIN",
      },
    });
    const fixture = abrir();
    const busca = fixture.nativeElement.querySelector("#solicitante-busca") as HTMLInputElement;
    busca.value = "outra";
    busca.dispatchEvent(new Event("input", { bubbles: true }));
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(250);
    const pesquisa = http.expectOne(request =>
      request.url === "/api/admin/usuarios/busca" && request.params.get("termo") === "outra",
    );
    pesquisa.flush([{
      id: 42,
      nome: "Pessoa Solicitante",
      email: "pessoa@example.com",
      perfil: "USUARIO",
      ativo: true,
    }]);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector(".solicitante-busca__opcao") as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".solicitante-selecionado")?.textContent)
      .toContain("Pessoa Solicitante");

    (fixture.nativeElement.querySelector(".confirmar") as HTMLButtonElement).click();
    const request = http.expectOne("/api/reservas");
    expect(request.request.body).toEqual({
      mesaId: 44,
      data: fixture.componentInstance.reserva.data(),
      solicitanteId: 42,
    });
    request.flush(
      { id: 9, status: "CONFIRMADA", data: request.request.body.data, mesa, solicitante: { id: 42, nome: "Pessoa Solicitante", email: "pessoa@example.com" } },
    );
    fixture.detectChanges();
    http.expectOne("/api/mesas").flush([mesa]);
    http.expectOne(request => request.url === "/api/mesas/disponiveis").flush([mesa]);
    fixture.detectChanges();
  });
});
