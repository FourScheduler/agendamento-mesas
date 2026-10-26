import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-minhas-reservas-page',
  standalone: true,
  templateUrl: './minhas-reservas-page.html',
  styleUrl: './minhas-reservas-page.css',
})
export class MinhasReservasPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly usuario = this.auth.usuario;

  irParaAgendamento() {
    this.router.navigate(['/agendamento']);
  }

  irParaMapa() {
    this.router.navigate(['/mapa']);
  }
}