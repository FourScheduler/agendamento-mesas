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
import { ToastService } from "../../shared/toast/toast";

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

  function abrir(mesaExibida: Mesa = mesa) {
    const fixture = TestBed.createComponent(MapaPage);
    fixture.detectChanges();
    http.expectOne(request => request.url === "/api/mesas/com-ocupacao").flush([mesa]);
    http
      .expectOne((request) => request.url === "/api/mesas/disponiveis")
      .flush(mesaExibida.tipo === "LIVRE" ? [mesaExibida] : []);
    fixture.detectChanges();
    const dialogo = fixture.nativeElement.querySelector(".fixacao-dialogo") as HTMLDialogElement;
    dialogo.showModal = vi.fn(() => dialogo.setAttribute("open", ""));
    dialogo.close = vi.fn(() => dialogo.removeAttribute("open"));
    fixture.nativeElement.querySelector("button.mesa").click();
    fixture.detectChanges();
    return fixture;
  }

  function autenticarAdmin() {
    TestBed.inject(AuthService).sessao.set({
      token: "teste", tipo: "Bearer",
      usuario: { id: 1, nome: "Admin", email: "admin@example.com", perfil: "ADMIN" },
    });
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
      const viewport = fixture.nativeElement.querySelector(".mapa__viewport") as HTMLElement;
      const centralizar = vi.fn();
      viewport.scrollTo = centralizar;
      vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(
        new DOMRect(10, 20, 400, 300),
      );
      Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 400 });
      Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 300 });
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
        return new DOMRect(710, 920, 100, 60);
      });
      http.expectOne(request => request.url === "/api/mesas/com-ocupacao").flush([mesa]);
      http.expectOne(request => request.url === "/api/mesas/disponiveis").flush([mesa]);
      fixture.detectChanges();
      const botao = fixture.nativeElement.querySelector("button.mesa") as HTMLButtonElement;
      expect(botao.classList.contains("selecionada")).toBe(true);
      expect(botao.getAttribute("aria-pressed")).toBe("true");
      expect(fixture.componentInstance.mesaSelecionada()?.id).toBe(44);
      expect(fixture.nativeElement.querySelector(".detalhes-overlay")).toBeNull();
      expect(centralizar).toHaveBeenCalledExactlyOnceWith({
        left: 550, top: 780, behavior: "instant",
      });
      expect(rolar).not.toHaveBeenCalled();
      http.expectNone("/api/reservas");

      botao.click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector(".detalhes")).not.toBeNull();
      fixture.nativeElement.querySelector(".detalhes__fechar").click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector(".mesa.selecionada")).toBeNull();
      expect(fixture.nativeElement.querySelector(".detalhes-overlay")).toBeNull();

      botao.click();
      fixture.detectChanges();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector(".mesa.selecionada")).toBeNull();
      expect(fixture.componentInstance.mesaSelecionada()).toBeNull();
      expect(fixture.nativeElement.querySelector(".detalhes")).toBeNull();
    } finally {
      vi.restoreAllMocks();
      if (descriptor) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", descriptor);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
      }
    }
  });

  it("mostra o resumo e mantém a confirmação integrada à API", () => {
    const fixture = abrir();
    expect(fixture.nativeElement.querySelector(".page-header")).toBeNull();
    expect(fixture.nativeElement.querySelector(".mapa__cabecalho #data-reserva")).not.toBeNull();
    const atualizar = fixture.nativeElement.querySelector("#atualizar-disponibilidade") as HTMLButtonElement;
    expect(atualizar.textContent?.trim()).toBe("");
    expect(atualizar.getAttribute("aria-label")).toBe("Atualizar disponibilidade");
    expect(atualizar.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector(".mapa__rodape .legenda__itens")).not.toBeNull();
    const itensLegenda = fixture.nativeElement.querySelectorAll(".legenda__itens li:not(.legenda__visibilidade)") as NodeListOf<HTMLElement>;
    expect([...itensLegenda].map(item => item.textContent?.trim())).toEqual(["Livre", "Reservada", "Inativa"]);
    expect(fixture.nativeElement.querySelector(".legenda__itens .amostra--ocupada")).not.toBeNull();
    expect(fixture.nativeElement.querySelector(".legenda__itens .amostra--inativa")).not.toBeNull();
    const tooltip = fixture.nativeElement.querySelector("#mapa-informacoes") as HTMLElement;
    expect(tooltip.getAttribute("role")).toBe("tooltip");
    expect(getComputedStyle(tooltip).visibility).toBe("hidden");
    const informacao = fixture.nativeElement.querySelector(
      '[aria-describedby="mapa-informacoes"]',
    ) as HTMLElement;
    expect(informacao.tagName).toBe("SPAN");
    expect(informacao.getAttribute("tabindex")).toBe("0");
    informacao.click();
    fixture.detectChanges();
    expect(getComputedStyle(tooltip).visibility).toBe("hidden");
    expect(tooltip.textContent)
      .toContain("A disponibilidade considera somente a data escolhida.");
    const resumo = fixture.nativeElement.querySelector(
      ".detalhes",
    ) as HTMLElement;
    expect(resumo.tagName).toBe("ASIDE");
    expect(resumo.getAttribute("aria-modal")).toBeNull();
    expect(resumo.textContent).toContain("Mesa 044");
    expect(resumo.textContent).toContain("Disponível");
    expect(resumo.querySelector(".detalhes__status--disponivel")).not.toBeNull();
    expect(resumo.textContent).toContain("Data selecionada");
    expect(resumo.querySelector(".detalhes__informacoes")).not.toBeNull();
    expect(resumo.querySelector("details")).toBeNull();
    expect(resumo.querySelector("dl")?.textContent).toContain(
      "Pessoa Teste",
    );
    const confirmar = resumo.querySelector(".confirmar") as HTMLButtonElement;
    expect(confirmar.textContent.trim()).toBe("Confirmar");
    expect(confirmar.closest("footer")?.classList.contains("detalhes__rodape")).toBe(true);
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
    http.expectOne(request => request.url === "/api/mesas/com-ocupacao").flush([mesa]);
    http
      .expectOne((request) => request.url === "/api/mesas/disponiveis")
      .flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".detalhes__status")?.textContent)
      .toContain("Indisponível nesta data");
    expect(fixture.nativeElement.querySelector(".detalhes__status--reservada")).not.toBeNull();
    expect(fixture.nativeElement.querySelector(".confirmar")).toBeNull();
    expect(fixture.componentInstance.reserva.erro()).toBe(
      "Reserva indisponível.",
    );
  });

  it("mostra detalhes de uma mesa fixa sem oferecer reserva", () => {
    const mesaFixa: Mesa = {
      ...mesa,
      id: 45,
      codigo: "045",
      tipo: "FIXA",
      responsavel: { id: 8, nome: "Pessoa Responsável", email: "responsavel@example.com" },
    };
    const fixture = TestBed.createComponent(MapaPage);
    fixture.detectChanges();
    http.expectOne(request => request.url === "/api/mesas/com-ocupacao").flush([mesa, mesaFixa]);
    http.expectOne(request => request.url === "/api/mesas/disponiveis").flush([mesa]);
    fixture.detectChanges();

    const botaoMesaFixa = fixture.nativeElement.querySelector(
      'button.mesa[data-mesa-id="45"]',
    ) as HTMLButtonElement;
    expect(botaoMesaFixa.disabled).toBe(false);
    expect(botaoMesaFixa.getAttribute("aria-disabled")).toBe("true");

    (fixture.nativeElement.querySelector('button.mesa[data-mesa-id="44"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".detalhes__status")?.textContent)
      .toContain("Disponível");
    botaoMesaFixa.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector(".mapa__viewport")).not.toBeNull();
    expect(botaoMesaFixa.classList.contains("selecionada")).toBe(true);
    expect(fixture.nativeElement.querySelector(".detalhes")?.textContent).toContain("Mesa fixa");
    const detalhes = fixture.nativeElement.querySelector(".detalhes") as HTMLElement;
    expect(detalhes.textContent).toContain("Localização");
    expect(detalhes.textContent).toContain("Data selecionada");
    expect(detalhes.textContent).toContain("Reservado para");
    expect(detalhes.textContent).toContain("Pessoa Responsável");
    expect(detalhes.querySelector(".detalhes__status--reservada")).not.toBeNull();
    expect(detalhes.querySelector('[role="switch"]')).toBeNull();
    expect(fixture.nativeElement.querySelector(".confirmar")).toBeNull();
    expect(fixture.componentInstance.mesaSelecionada()).toBeNull();
    http.expectNone("/api/reservas");
  });

  it("envia a tentativa de reserva ao backend para usuário com mesa fixa", () => {
    const mesaFixa: Mesa = {
      ...mesa,
      id: 45,
      codigo: "045",
      tipo: "FIXA",
      responsavel: { id: 7, nome: "Pessoa Teste", email: "pessoa@example.com" },
    };
    const fixture = TestBed.createComponent(MapaPage);
    fixture.detectChanges();
    http.expectOne(request => request.url === "/api/mesas/com-ocupacao").flush([mesa, mesaFixa]);
    http.expectOne(request => request.url === "/api/mesas/disponiveis").flush([mesa]);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button.mesa[data-mesa-id="44"]').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".confirmar")).not.toBeNull();
    fixture.componentInstance.confirmarReserva();
    const request = http.expectOne("/api/reservas");
    expect(request.request.body).toEqual({
      mesaId: mesa.id,
      data: fixture.componentInstance.reserva.data(),
    });
    request.flush(
      { detail: "O solicitante possui uma mesa fixa e não pode realizar reservas." },
      { status: 409, statusText: "Conflict" },
    );
    fixture.detectChanges();
    http.expectOne(request => request.url === "/api/mesas/com-ocupacao").flush([mesa, mesaFixa]);
    http
      .expectOne(request => request.url === "/api/mesas/disponiveis")
      .flush([mesa]);
  });

  it("mostra apenas os dados da mesa reservada e permite ao dono cancelar", () => {
    const mesaReservada: Mesa = {
      ...mesa,
      ocupada: true,
      ocupanteNaData: { id: 7, nome: "Pessoa Teste", email: "pessoa@example.com" },
    };
    const fixture = TestBed.createComponent(MapaPage);
    fixture.detectChanges();

    http.expectOne(request => request.url === "/api/mesas/com-ocupacao").flush([mesaReservada]);
    http.expectOne(request => request.url === "/api/mesas/disponiveis").flush([]);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button.mesa[data-mesa-id="44"]').click();
    fixture.detectChanges();

    const detalhesReserva = http.expectOne(request =>
      request.url.startsWith("/api/reservas/minhas?"),
    );
    const dataReservada = fixture.componentInstance.reserva.data();
    detalhesReserva.flush([{
      id: 91,
      usuarioId: 7,
      status: "PENDENTE",
      data: dataReservada,
      criadaEm: `${dataReservada}T08:00:00`,
      mesa: { id: 44, codigo: "044", regiao: "TAMBORÉ" },
      solicitante: { id: 7, nome: "Pessoa Teste", email: "pessoa@example.com" },
    }]);
    fixture.detectChanges();

    const detalhes = fixture.nativeElement.querySelector(".detalhes") as HTMLElement;
    expect(detalhes.textContent).toContain("Localização");
    expect(detalhes.textContent).toContain("TAMBORÉ");
    expect(detalhes.textContent).toContain("Data reservada");
    expect(detalhes.textContent).toContain("Pessoa Teste");
    expect(detalhes.querySelector('input[type="date"]')).toBeNull();
    expect(detalhes.querySelector("#solicitante-busca")).toBeNull();
    expect(detalhes.querySelector(".confirmar")).toBeNull();

    (detalhes.querySelector(".botao--perigo") as HTMLButtonElement).click();
    const cancelamento = http.expectOne("/api/reservas/91/cancelamento");
    expect(cancelamento.request.method).toBe("PATCH");
    cancelamento.flush(null);
    fixture.detectChanges();

    http.expectOne(request => request.url === "/api/mesas/com-ocupacao").flush([mesa]);
    http.expectOne(request => request.url === "/api/mesas/disponiveis").flush([mesa]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".detalhes")).toBeNull();
    expect(fixture.nativeElement.querySelector("button.mesa.ocupada")).toBeNull();
    expect(fixture.nativeElement.querySelector("button.mesa.livre")).not.toBeNull();
  });

  it("não oferece cancelamento ao beneficiário quando um administrador criou a reserva", () => {
    const mesaReservada: Mesa = {
      ...mesa,
      ocupada: true,
      ocupanteNaData: { id: 7, nome: "Pessoa Teste", email: "pessoa@example.com" },
    };
    const fixture = TestBed.createComponent(MapaPage);
    fixture.detectChanges();
    http.expectOne(request => request.url === "/api/mesas/com-ocupacao").flush([mesaReservada]);
    http.expectOne(request => request.url === "/api/mesas/disponiveis").flush([]);
    fixture.detectChanges();
    fixture.nativeElement.querySelector("button.mesa").click();
    fixture.detectChanges();

    http.expectOne(request =>
      request.url.startsWith("/api/reservas/minhas?"),
    ).flush([{
      id: 92,
      usuarioId: 7,
      status: "CONFIRMADA",
      data: fixture.componentInstance.reserva.data(),
      criadaEm: "2026-11-05T08:00:00",
      criador: { id: 1, nome: "Admin", perfil: "ADMIN" },
      mesa: { id: 44, codigo: "044", regiao: "TAMBORÉ" },
    }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".botao--perigo")).toBeNull();
    expect(fixture.nativeElement.querySelector(".confirmar")).toBeNull();
  });

  it("permite ao administrador cancelar a reserva de outro usuário", () => {
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
    const mesaReservada: Mesa = {
      ...mesa,
      ocupada: true,
      ocupanteNaData: { id: 8, nome: "Outra Pessoa", email: "outra@example.com" },
    };
    const fixture = TestBed.createComponent(MapaPage);
    fixture.detectChanges();
    http.expectOne(request => request.url === "/api/mesas/com-ocupacao").flush([mesaReservada]);
    http.expectOne(request => request.url === "/api/mesas/disponiveis").flush([]);
    fixture.detectChanges();
    fixture.nativeElement.querySelector("button.mesa").click();
    fixture.detectChanges();

    http.expectOne(request => request.url.startsWith("/api/admin/reservas?")).flush([{
      id: 93,
      usuarioId: 8,
      status: "CONFIRMADA",
      data: fixture.componentInstance.reserva.data(),
      criadaEm: "2026-11-05T08:00:00",
      criador: { id: 1, nome: "Admin", perfil: "ADMIN" },
      mesa: { id: 44, codigo: "044", regiao: "TAMBORÉ" },
    }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".botao--perigo")).not.toBeNull();
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

  it("acomoda solicitante com nome e e-mail longos na largura completa do painel", () => {
    autenticarAdmin();
    const fixture = abrir();
    const nome = "Pessoa com nome completo muito extenso para o painel de detalhes";
    const email = "endereco.muito.longo.sem.espacos.para.verificar.responsividade@example.com";
    fixture.componentInstance.selecionarSolicitante({
      id: 8, nome, email, perfil: "USUARIO", ativo: true,
    });
    fixture.detectChanges();
    const solicitante = fixture.nativeElement.querySelector(".detalhes__solicitante") as HTMLElement;
    expect(getComputedStyle(solicitante).gridColumn).toBe("1 / -1");
    for (const [seletor, texto] of [
      [".solicitante-selecionado__nome", nome],
      [".solicitante-selecionado__email", email],
    ]) {
      const campo = solicitante.querySelector(seletor) as HTMLElement;
      expect(campo.textContent).toBe(texto);
      expect(getComputedStyle(campo).overflowWrap).toBe("anywhere");
    }
    expect(getComputedStyle(solicitante.querySelector(".solicitante-selecionado")!).gridTemplateColumns)
      .toBe("auto minmax(0, 1fr)");
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
    expect(fixture.nativeElement.querySelector("#solicitante-busca")).toBeNull();

    (fixture.nativeElement.querySelector(".solicitante-selecionado__trocar") as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("#solicitante-busca")).not.toBeNull();
    expect(fixture.nativeElement.querySelector(".solicitante-selecionado")).toBeNull();

    const buscaAtualizada = fixture.nativeElement.querySelector("#solicitante-busca") as HTMLInputElement;
    buscaAtualizada.value = "outra pessoa";
    buscaAtualizada.dispatchEvent(new Event("input", { bubbles: true }));
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(250);
    http.expectOne(request =>
      request.url === "/api/admin/usuarios/busca" && request.params.get("termo") === "outra pessoa",
    ).flush([{
      id: 43,
      nome: "Outra Pessoa",
      email: "outra@example.com",
      perfil: "USUARIO",
      ativo: true,
    }]);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector(".solicitante-busca__opcao") as HTMLButtonElement).click();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector(".confirmar") as HTMLButtonElement).click();
    const request = http.expectOne("/api/reservas");
    expect(request.request.body).toEqual({
      mesaId: 44,
      data: fixture.componentInstance.reserva.data(),
      solicitanteId: 43,
    });
    request.flush(
      { id: 9, status: "CONFIRMADA", data: request.request.body.data, mesa, solicitante: { id: 43, nome: "Outra Pessoa", email: "outra@example.com" } },
    );
    fixture.detectChanges();
    http.expectOne(request => request.url === "/api/mesas/com-ocupacao").flush([mesa]);
    http.expectOne(request => request.url === "/api/mesas/disponiveis").flush([mesa]);
    fixture.detectChanges();
  });
});
