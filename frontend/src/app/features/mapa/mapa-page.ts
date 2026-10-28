import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { PlantaMesas } from '../planta/planta-mesas';
import { Mesa } from '../mesas/mesa';
import { AuthService } from '../../core/auth/auth.service';
import { ReservaDiaria } from '../reservas/reserva-diaria';
import { formatarData } from '../reservas/data-reserva';
import { PainelArrastavel } from '../../shared/painel-arrastavel.directive';
import { Notificacao } from '../../shared/notificacao/notificacao';

@Component({
  selector: 'app-mapa-page',
  standalone: true,
  imports: [FormsModule, PlantaMesas, PainelArrastavel, Notificacao],
  providers: [ReservaDiaria],
  templateUrl: './mapa-page.html',
  styleUrl: './mapa-page.css',
})
export class MapaPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly reserva = inject(ReservaDiaria);
  readonly usuario = this.auth.usuario;
  readonly mesaInicialId = signal(Number(this.route.snapshot.queryParamMap.get('mesaId')) || null);
  readonly mesaSelecionada = this.reserva.selecionada;
  readonly formatarData = formatarData;

  onMesaSelecionada(mesa: Mesa) {
    this.reserva.selecionar(mesa);
  }

  onDataChange(data: string) {
    this.mesaInicialId.set(null);
    this.reserva.alterarData(data);
  }

  onMesaInicialInvalidada() {
    this.mesaInicialId.set(null);
    this.reserva.limparSelecao();
  }

  voltarParaAgendamento() {
    void this.router.navigate(['/agendamento'], { queryParams: { data: this.reserva.data(), mesaId: this.mesaSelecionada()?.id ?? null } });
  }

  fecharDetalhes() {
    if (!this.reserva.confirmando()) {
      this.mesaInicialId.set(null);
      this.reserva.limparSelecao();
    }
  }
}
