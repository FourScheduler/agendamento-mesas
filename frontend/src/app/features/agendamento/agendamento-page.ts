import { Component, inject, signal, computed, effect, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth.service';
import { ReservaService } from './reserva.service';
import { Reserva } from './reserva';
import { Mesa } from '../mesas/mesa';

@Component({
  selector: 'app-agendamento-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agendamento-page.html',
  styleUrl: './agendamento-page.css',
})
export class AgendamentoPage {
  private readonly auth = inject(AuthService);
  private readonly reservaService = inject(ReservaService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly usuario = this.auth.usuario;
  readonly token = this.auth.token;
  readonly perfil = computed(() => this.auth.usuario()?.perfil ?? '');

  // Filtro de data
  readonly dataSelecionada = signal('');
  readonly mesasLivres = signal<readonly Mesa[]>([]);
  readonly mesaSelecionada = signal<Mesa | null>(null);
  readonly carregandoMesas = signal(false);
  readonly erro = signal('');

  // Resumo da reserva (lado direito)
  readonly confirmando = signal(false);

  // Datas para input date (apenas dias úteis, até +15 dias)
  readonly todayISO = computed(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  readonly maxDateISO = computed(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });

  constructor() {
    effect((onCleanup) => {
      const token = this.token();
      this.mesasLivres.set([]);
      this.mesaSelecionada.set(null);
      this.erro.set('');
      if (!token) return;
      // data padrão = hoje (próximo dia útil)
      const hoje = new Date();
      const dataISO = hoje.toISOString().split('T')[0];
      this.dataSelecionada.set(dataISO);
      this.carregarMesasLivres(token, dataISO);
      onCleanup(() => {});
    });
  }

  onDataChange() {
    const token = this.token();
    const data = this.dataSelecionada();
    if (!token || !data) return;
    this.mesaSelecionada.set(null);
    this.carregarMesasLivres(token, data);
  }

  private carregarMesasLivres(token: string, data: string) {
    this.carregandoMesas.set(true);
    this.reservaService.listarDisponiveis(token, data).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (mesas) => {
        this.mesasLivres.set(mesas);
        this.carregandoMesas.set(false);
      },
      error: (e) => {
        this.carregandoMesas.set(false);
        this.erro.set(e.status === 401 ? 'Sessão expirada. Entre novamente.' : 'Não foi possível carregar mesas livres.');
        if (e.status === 401) this.auth.logout();
      },
    });
  }

  selecionarMesa(mesa: Mesa) {
    this.mesaSelecionada.set(mesa);
  }

  async confirmarReserva() {
    const mesa = this.mesaSelecionada();
    const data = this.dataSelecionada();
    const token = this.token();
    if (!mesa || !data || !token) return;

    this.confirmando.set(true);
    this.erro.set('');
    try {
      await this.reservaService.criar(token, mesa.id, data).toPromise();
      // Sucesso: limpar seleção e recarregar mesas (a mesa não estará mais livre)
      this.mesaSelecionada.set(null);
      this.carregarMesasLivres(token, data);
    } catch (e: any) {
      this.erro.set(e.status === 409 ? (e.error?.detail ?? 'Conflito ao reservar.') : 'Erro ao criar reserva.');
    } finally {
      this.confirmando.set(false);
    }
  }

  irParaMapa() {
    this.router.navigate(['/mapa']);
  }

  formatarDataBR(dataISO: string): string {
    const d = new Date(dataISO + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  }

  getSolicitanteLabel(): string {
    const user = this.usuario();
    if (!user) return '';
    return this.perfil() === 'ADMIN' ? 'Administrador (pode reservar para outros)' : user.nome;
  }
}