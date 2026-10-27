import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PlantaMesas } from '../planta/planta-mesas';
import { Mesa } from '../mesas/mesa';
import { AuthService } from '../../core/auth/auth.service';
import { ReservaDiaria } from '../reservas/reserva-diaria';
import { formatarData } from '../reservas/data-reserva';

@Component({
  selector: 'app-mapa-page',
  standalone: true,
  imports: [FormsModule, PlantaMesas],
  providers: [ReservaDiaria],
  templateUrl: './mapa-page.html',
  styleUrl: './mapa-page.css',
})
export class MapaPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly reserva = inject(ReservaDiaria);
  readonly token = this.auth.token;
  readonly usuario = this.auth.usuario;
  readonly mesaSelecionada = this.reserva.selecionada;
  readonly formatarData = formatarData;

  onMesaSelecionada(mesa: Mesa) {
    if (!this.reserva.confirmando()) this.mesaSelecionada.set(mesa);
  }

  onSessaoExpirada() {
    this.auth.logout(true);
  }

  voltarParaAgendamento() {
    void this.router.navigate(['/agendamento'], { queryParams: { data: this.reserva.data() } });
  }

  fecharDetalhes() {
    if (!this.reserva.confirmando()) this.mesaSelecionada.set(null);
  }
}
