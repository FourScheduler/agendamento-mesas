import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from "@angular/router";
import { toSignal } from "@angular/core/rxjs-interop";
import { filter, map } from "rxjs";

@Component({
  selector: "app-topbar",
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: "./topbar.html",
  styleUrl: "./topbar.css",
  host: {
    "(document:click)": "fecharAoClicarFora($event)",
    "(document:keydown.escape)": "menuAberto.set(false)",
  },
})
export class Topbar {
  readonly usuario = input("");
  readonly perfil = input<string>("");
  readonly sair = output<void>();
  readonly menuAberto = signal(false);

  private readonly router = inject(Router);
  private readonly elemento = inject(ElementRef<HTMLElement>);

  readonly iniciais = computed(() =>
    this.usuario()
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte.charAt(0))
      .join("")
      .toUpperCase(),
  );

  readonly ehAdmin = computed(() => this.perfil() === 'ADMIN');

  readonly exibirLocalizacao = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(
        (event) =>
          /^\/(?:agendamento|minhas-reservas|mapa|admin\/mesas)(?:\/|[?#]|$)/.test(
            event.urlAfterRedirects,
          ),
      ),
    ),
    {
      initialValue: /^\/(?:agendamento|minhas-reservas|mapa|admin\/mesas)(?:\/|[?#]|$)/.test(
        this.router.url,
      ),
    },
  );

  readonly exibirAcoesPortal = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(
        (event) =>
          !/^\/(?:agendamento|minhas-reservas|mapa|admin)(?:\/|[?#]|$)/.test(
            event.urlAfterRedirects,
          ),
      ),
    ),
    {
      initialValue: !/^\/(?:agendamento|minhas-reservas|mapa|admin)(?:\/|[?#]|$)/.test(
        this.router.url,
      ),
    },
  );

  constructor() {
    effect(() => {
      this.usuario();
      this.menuAberto.set(false);
    });
  }

  fecharAoClicarFora(evento: MouseEvent) {
    const perfil = this.elemento.nativeElement.querySelector(".topbar__perfil");
    if (!perfil || !evento.composedPath().includes(perfil))
      this.menuAberto.set(false);
  }

  encerrarSessao() {
    this.menuAberto.set(false);
    this.sair.emit();
  }

  alternarMenu() {
    this.menuAberto.update((aberto) => !aberto);
  }
}