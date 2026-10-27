import { Component, inject, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { MesaService } from '../mesas/mesa.service';
import { ReservaDiaria } from '../reservas/reserva-diaria';
import { Mesa } from '../mesas/mesa';

@Component({
  selector: 'app-agendamento-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [ReservaDiaria],
  templateUrl: './agendamento-page.html',
  styleUrl: './agendamento-page.css',
})
export class AgendamentoPage {
  private readonly auth = inject(AuthService);
  private readonly mesas = inject(MesaService);
  private readonly router = inject(Router);
  readonly reserva = inject(ReservaDiaria);
  readonly usuario = this.auth.usuario;
  readonly token = this.auth.token;
  readonly dataSelecionada = this.reserva.data;
  readonly mesasLivres = signal<readonly Mesa[]>([]);
  readonly mesaSelecionada = this.reserva.selecionada;
  readonly carregandoMesas = signal(false);
  readonly erroConsulta = signal('');
  readonly erro = computed(() => this.reserva.erro() || this.erroConsulta());
  readonly confirmando = this.reserva.confirmando;
  readonly todayISO = () => this.reserva.dataMinima;
  readonly maxDateISO = () => this.reserva.dataMaxima;

  constructor() {
    effect(onCleanup => {
      const token = this.token();
      const data = this.dataSelecionada();
      this.reserva.atualizacao();
      this.mesasLivres.set([]);
      this.mesaSelecionada.set(null);
      this.erroConsulta.set('');
      this.carregandoMesas.set(false);
      if (!token || !data || !this.usuario()) return;

      this.carregandoMesas.set(true);
      const consulta = this.mesas.listarDisponiveis(data, token).subscribe({
        next: mesas => {
          this.mesasLivres.set(mesas);
          this.carregandoMesas.set(false);
        },
        error: erro => {
          this.carregandoMesas.set(false);
          this.erroConsulta.set(erro.status === 400
            ? (erro.error?.detail ?? 'Escolha uma data válida.')
            : 'Não foi possível carregar mesas livres. Atualize a disponibilidade.');
          if (erro.status === 401) this.auth.logout(true);
        },
      });
      onCleanup(() => consulta.unsubscribe());
    });
  }

  onDataChange(data: string) {
    this.reserva.alterarData(data);
  }

  selecionarMesa(mesa: Mesa) {
    if (!this.confirmando() && !this.carregandoMesas() && this.mesasLivres().some(m => m.id === mesa.id)) {
      this.mesaSelecionada.set(mesa);
    }
  }

  confirmarReserva() {
    this.reserva.confirmar();
  }

  irParaMapa() {
    void this.router.navigate(['/mapa'], { queryParams: { data: this.dataSelecionada() } });
  }

  formatarDataBR(dataISO: string): string {
    if (!dataISO) return '';
    return new Date(dataISO + 'T12:00:00Z').toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long',
    });
  }

  getSolicitanteLabel(): string {
    return this.usuario()?.nome ?? '';
  }
}
