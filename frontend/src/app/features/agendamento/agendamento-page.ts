import { Component, inject, signal, computed, effect, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth.service';
import { MesaService } from '../mesas/mesa.service';
import { ReservaDiaria } from '../reservas/reserva-diaria';
import { Mesa } from '../mesas/mesa';
import { Notificacao } from '../../shared/notificacao/notificacao';

@Component({
  selector: 'app-agendamento-page',
  standalone: true,
  imports: [CommonModule, FormsModule, Notificacao],
  providers: [ReservaDiaria],
  templateUrl: './agendamento-page.html',
  styleUrl: './agendamento-page.css',
})
export class AgendamentoPage {
  private readonly auth = inject(AuthService);
  private readonly mesas = inject(MesaService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // Estado da reserva (compartilhado via ReservaDiaria)
  readonly reserva = inject(ReservaDiaria);
  readonly usuario = this.auth.usuario;
  readonly token = this.auth.token;
  readonly perfil = computed(() => this.auth.usuario()?.perfil ?? '');

  // Filtros locais (lista de mesas)
  readonly busca = signal('');
  readonly mesasLivres = signal<readonly Mesa[]>([]);
  readonly carregandoMesas = signal(false);
  readonly erroConsulta = signal('');

  readonly mesasFiltradas = computed(() => {
    const termo = this.busca().trim().toLowerCase();
    if (!termo) return this.mesasLivres();
    return this.mesasLivres().filter(m =>
      m.codigo.toLowerCase().includes(termo) ||
      m.regiao.toLowerCase().includes(termo)
    );
  });

  // Helpers para o template
  readonly dataSelecionada = this.reserva.data;
  readonly mesaSelecionada = this.reserva.selecionada;
  readonly confirmando = this.reserva.confirmando;
  readonly erro = this.reserva.erro;
  readonly todayISO = this.reserva.dataMinima;
  readonly maxDateISO = this.reserva.dataMaxima;

  // UI extras
  readonly stepAtual = signal(1);

  constructor() {
    effect((onCleanup) => {
      // Reage a mudanças de data ou trigger de atualização
      this.reserva.atualizacao();
      const token = this.token();
      const data = this.dataSelecionada();
      const erroData = this.reserva.erroData();

      this.mesasLivres.set([]);
      this.reserva.iniciarConsulta();
      this.erroConsulta.set('');
      this.carregandoMesas.set(false);

      if (!token || erroData || !this.usuario()) return;

      this.carregandoMesas.set(true);
      const sub = this.mesas.listarDisponiveis(data, token)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (mesas) => {
            this.mesasLivres.set(mesas);
            this.reserva.registrarDisponibilidade(data);
            this.carregandoMesas.set(false);
          },
          error: (e) => {
            this.carregandoMesas.set(false);
            this.erroConsulta.set(
              e.status === 400
                ? (e.error?.detail ?? 'Escolha uma data válida.')
                : 'Não foi possível carregar mesas livres. Atualize a disponibilidade.'
            );
            if (e.status === 401) this.auth.logout(true);
          },
        });
      onCleanup(() => sub.unsubscribe());
    });
  }

  onDataChange(data: string) {
    this.reserva.alterarData(data);
  }

  selecionarMesa(mesa: Mesa) {
    if (!this.confirmando() && !this.carregandoMesas() && this.mesasLivres().some(m => m.id === mesa.id)) {
      this.reserva.selecionar(mesa);
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
    const data = new Date(dataISO + 'T12:00:00Z').toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    });
    // Capitaliza a primeira letra do dia da semana
    return data.charAt(0).toUpperCase() + data.slice(1);
  }

  getSolicitanteLabel(): string {
    return this.usuario()?.nome ?? '';
  }

}
