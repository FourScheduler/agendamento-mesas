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
import { RouterLink, RouterLinkActive } from "@angular/router";

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
  readonly sair = output<void>();
  readonly menuAberto = signal(false);
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
  private readonly elemento = inject(ElementRef<HTMLElement>);

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