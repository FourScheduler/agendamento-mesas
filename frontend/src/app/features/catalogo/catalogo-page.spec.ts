import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { routes } from "../../app.routes";
import { CatalogoPage } from "./catalogo-page";

describe("Página do catálogo", () => {
  let http: HttpTestingController;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { localStorage.clear(); http.verify(); });

  it("abre o login na rota inicial", async () => {
    const router = await RouterTestingHarness.create("/");
    expect(router.routeNativeElement?.textContent).toContain(
      "Entre para visualizar a planta",
    );
    expect(
      router.routeNativeElement?.querySelector('input[type="password"]'),
    ).not.toBeNull();
    http.expectNone("/api/mesas");
  });

  it("autentica, carrega a planta com o token e encerra a sessão ao sair", () => {
    const fixture = TestBed.createComponent(CatalogoPage);
    fixture.detectChanges();
    fixture.componentInstance.email = "usuario@exemplo.com";
    fixture.componentInstance.senha = "senha-teste";
    fixture.componentInstance.entrar();
    const login = http.expectOne("/api/auth/login");
    expect(login.request.method).toBe("POST");
    expect(login.request.body).toEqual({
      email: "usuario@exemplo.com",
      senha: "senha-teste",
    });
    login.flush({
      token: "token-teste",
      tipo: "Bearer",
      usuario: { id: 42, nome: "Usuário Demo" },
    });
    fixture.detectChanges();
    const catalogo = http.expectOne("/api/mesas");
    expect(catalogo.request.headers.get("Authorization")).toBe(
      "Bearer token-teste",
    );
    catalogo.flush([
      {
        id: 703,
        codigo: "M703",
        regiao: "DEMO",
        tipo: "LIVRE",
        ativa: true,
        referenciaVisual: { planta: "DEMO", x: 20, y: 30 },
      },
    ]);
    http.expectOne(r => r.url === '/api/mesas/disponiveis').flush([{ id: 703 }]);
    fixture.detectChanges();
    fixture.nativeElement.querySelector(".topbar__avatar").click();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector("#menu-perfil").textContent,
    ).toContain("Usuário Demo");
    expect(fixture.nativeElement.textContent).toContain("M703");
    expect(fixture.componentInstance.senha).toBe("");
    fixture.nativeElement.querySelector(".mesa").click();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector(".detalhes").textContent,
    ).toContain("Mesa M703");
    fixture.nativeElement.querySelector(".topbar__avatar").click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector(".sair").click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("app-planta-mesas")).toBeNull();
    expect(fixture.componentInstance.sessao()).toBeNull();
    expect(fixture.componentInstance.selecionada()).toBeNull();
  });

  it("mantém o login visível quando a API rejeita as credenciais", () => {
    const fixture = TestBed.createComponent(CatalogoPage);
    fixture.componentInstance.email = "usuario@exemplo.com";
    fixture.componentInstance.senha = "incorreta";
    fixture.componentInstance.entrar();
    http
      .expectOne("/api/auth/login")
      .flush({}, { status: 401, statusText: "Unauthorized" });
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent,
    ).toContain("E-mail ou senha inválidos");
    expect(fixture.componentInstance.senha).toBe("");
    http.expectNone("/api/mesas");
  });

  it("volta ao login quando a consulta do catálogo recebe 401", () => {
    const fixture = TestBed.createComponent(CatalogoPage);
    fixture.componentInstance.sessao.set({
      token: "expirado",
      tipo: "Bearer",
      usuario: { id: 1, nome: "Demo", email: "", perfil: "USUARIO" },
    });
    fixture.detectChanges();
    http
      .expectOne("/api/mesas")
      .flush({}, { status: 401, statusText: "Unauthorized" });
    const disponibilidade = http.match(r => r.url === '/api/mesas/disponiveis');
    for (const request of disponibilidade) {
      if (!request.cancelled) request.flush({}, { status: 401, statusText: 'Unauthorized' });
    }
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("form")).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain("Sua sessão expirou");
  });
});
