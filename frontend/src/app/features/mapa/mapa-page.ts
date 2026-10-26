import { Component, inject, signal, effect, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PlantaMesas } from '../planta/planta-mesas';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-mapa-page',
  standalone: true,
  imports: [CommonModule, PlantaMesas],
  templateUrl: './mapa-page.html',
  styleUrl: './mapa-page.css',
})
export class MapaPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly token = this.auth.token;
  readonly mesaSelecionada = signal<any>(null);
  readonly erro = signal('');

  constructor() {
    effect((onCleanup) => {
      const token = this.token();
      this.mesaSelecionada.set(null);
      this.erro.set('');
      if (!token) return;
      // A PlantaMesas carrega os dados automaticamente via token
      onCleanup(() => {});
    });
  }

  onMesaSelecionada(mesa: any) {
    this.mesaSelecionada.set(mesa);
  }

  onSessaoExpirada() {
    this.auth.logout();
  }

  voltarParaAgendamento() {
    this.router.navigate(['/agendamento']);
  }

  fecharDetalhes() {
    this.mesaSelecionada.set(null);
  }
}