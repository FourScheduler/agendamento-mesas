import { Component, inject, signal, computed, effect, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, of, timer } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { AuthService, UsuarioAdminResumo } from '../../core/auth/auth.service';
import { MesaService } from '../mesas/mesa.service';
import { ReservaDiaria } from '../reservas/reserva-diaria';
import { Mesa } from '../mesas/mesa';
import { Notificacao } from '../../shared/notificacao/notificacao';
import { ReservaService } from './reserva.service';

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
  private readonly reservas = inject(ReservaService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // Estado da reserva (compartilhado via ReservaDiaria)
  readonly reserva = inject(ReservaDiaria);
  readonly usuario = this.auth.usuario;
  readonly token = this.auth.token;
  readonly perfil = computed(() => this.auth.usuario()?.perfil ?? '');
  readonly isAdmin = computed(() => this.perfil() === 'ADMIN');

  // Catálogo completo de mesas (para busca)
  readonly todasMesas = signal<readonly Mesa[]>([]);
  // Mesas livres na data selecionada
  readonly mesasLivres = signal<readonly Mesa[]>([]);
  // Filtros locais
  readonly busca = signal('');
  readonly carregandoMesas = signal(false);
  readonly erroConsulta = signal('');

  // Usuários ativos (para admin escolher solicitante)
  readonly usuariosAtivos = signal<readonly UsuarioAdminResumo[]>([]);
  readonly carregandoUsuarios = signal(false);
  readonly erroBuscaSolicitante = signal('');
  readonly solicitanteSelecionado = signal<number | null>(null);
  readonly solicitanteEscolhido = signal<UsuarioAdminResumo | null>(null);
  readonly buscaSolicitante = signal('');
  readonly solicitanteFocado = signal(false);
  private readonly termosBuscaSolicitante = new Subject<string>();

  readonly mostrarSugestoesSolicitante = computed(() => 
    this.solicitanteFocado() && (
      this.buscaSolicitante().trim().length > 0 ||
      this.carregandoUsuarios() ||
      !!this.erroBuscaSolicitante()
    )
  );

  readonly mesasFiltradas = computed(() => {
    const termo = this.busca().trim().toLowerCase();

    // Busca vazia: mostra apenas mesas livres
    if (!termo) return this.mesasLivres();

    // Busca com termo: busca no catálogo completo
    const termoNormalizado = termo.replace(/^mesa\s*/i, '');

    const resultados = this.todasMesasParaBusca().filter(m =>
      m.codigo.toLowerCase().includes(termoNormalizado) ||
      m.codigo.toLowerCase().includes(termo) ||
      `mesa ${m.codigo}`.toLowerCase().includes(termo) ||
      m.regiao.toLowerCase().includes(termo)
    );

    // Prioriza mesas livres no topo
    return resultados.sort((a, b) => {
      const aLivre = this.estaDisponivel(a);
      const bLivre = this.estaDisponivel(b);
      if (aLivre && !bLivre) return -1;
      if (!aLivre && bLivre) return 1;
      return a.codigo.localeCompare(b.codigo);
    });
  });

  /** Todas as mesas do catálogo para busca (livres + ocupadas), ordenadas por código. */
  private todasMesasParaBusca(): readonly Mesa[] {
    return [...this.todasMesas()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  }

  /** Verifica se uma mesa está livre na data selecionada. */
  estaDisponivel(mesa: Mesa): boolean {
    return this.mesasLivres().some(m => m.id === mesa.id);
  }

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
    this.termosBuscaSolicitante.pipe(
      distinctUntilChanged(),
      tap(termo => {
        this.erroBuscaSolicitante.set('');
        this.usuariosAtivos.set([]);
        this.carregandoUsuarios.set(termo.length >= 2);
      }),
      switchMap(termo => termo.length >= 2
        ? timer(250).pipe(
            switchMap(() => this.reservas.buscarUsuariosAtivos(termo).pipe(
              catchError(() => {
                this.erroBuscaSolicitante.set('Não foi possível buscar usuários. Tente novamente.');
                return of([]);
              }),
            )),
          )
        : of([]),
      ),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(usuarios => {
      this.usuariosAtivos.set(usuarios);
      this.carregandoUsuarios.set(false);
    });

    // Carrega catálogo completo uma vez
    this.mesas.listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (mesas) => this.todasMesas.set(mesas),
        error: () => this.todasMesas.set([]),
      });

    if (this.isAdmin()) {
      const eu = this.usuario();
      if (eu) {
        this.solicitanteSelecionado.set(eu.id);
        this.solicitanteEscolhido.set({ ...eu, ativo: true });
      }
    }

    effect((onCleanup) => {
      // Reage a mudanças de data ou trigger de atualização
      this.reserva.atualizacao();
      const data = this.dataSelecionada();
      const erroData = this.reserva.erroData();

      this.mesasLivres.set([]);
      this.reserva.iniciarConsulta();
      this.erroConsulta.set('');
      this.carregandoMesas.set(false);

      if (!this.token() || erroData || !this.usuario()) return;

      this.carregandoMesas.set(true);
      const sub = this.mesas.listarDisponiveis(data)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (mesas) => {
            this.mesasLivres.set(mesas);
            this.reserva.registrarDisponibilidade(data);
            this.reserva.restaurarSelecao(mesas);
            this.carregandoMesas.set(false);
          },
          error: (e) => {
            this.carregandoMesas.set(false);
            this.erroConsulta.set(
              e.status === 400
                ? (e.error?.detail ?? 'Escolha uma data válida.')
                : 'Não foi possível carregar mesas livres. Atualize a disponibilidade.'
            );
          },
        });
      onCleanup(() => sub.unsubscribe());
    });
  }

  onDataChange(data: string) {
    this.reserva.alterarData(data);
  }

  selecionarMesa(mesa: Mesa) {
    if (!this.confirmando() && !this.carregandoMesas() && this.estaDisponivel(mesa)) {
      this.reserva.selecionar(mesa);
    }
  }

  confirmarReserva() {
    const solicitanteId = this.isAdmin() ? this.solicitanteSelecionado() : null;
    if (this.isAdmin() && solicitanteId === null) return;
    this.reserva.confirmarComSolicitante(solicitanteId);
  }

  buscarSolicitantes(termo: string) {
    const busca = termo.trim();
    this.buscaSolicitante.set(termo);
    this.solicitanteSelecionado.set(null);
    this.solicitanteEscolhido.set(null);
    this.usuariosAtivos.set([]);
    this.erroBuscaSolicitante.set('');
    this.termosBuscaSolicitante.next(busca);
  }

  selecionarSolicitante(usuario: UsuarioAdminResumo) {
    this.solicitanteSelecionado.set(usuario.id);
    this.solicitanteEscolhido.set(usuario);
    this.buscaSolicitante.set('');
    this.usuariosAtivos.set([]);
    this.solicitanteFocado.set(false);
    this.termosBuscaSolicitante.next('');
  }

  iniciaisSolicitante(nome: string): string {
    return nome.trim().split(/\s+/).slice(0, 2).map(parte => parte[0]).join('').toLocaleUpperCase('pt-BR');
  }

  fecharSugestoesSeFora(event: FocusEvent) {
    const container = event.currentTarget;
    const proximoFoco = event.relatedTarget;
    if (!(container instanceof HTMLElement) || !(proximoFoco instanceof Node) || !container.contains(proximoFoco)) {
      this.solicitanteFocado.set(false);
    }
  }

  irParaMapa() {
    void this.router.navigate(['/mapa'], { queryParams: { data: this.dataSelecionada(), mesaId: this.mesaSelecionada()?.id ?? null } });
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
    if (!this.isAdmin()) {
      return this.usuario()?.nome ?? '';
    }
    if (!this.solicitanteSelecionado()) {
      return this.usuario()?.nome ?? '';
    }
    if (this.solicitanteEscolhido()?.id === this.solicitanteSelecionado()) {
      return this.solicitanteEscolhido()?.nome ?? '';
    }
    const solicitante = this.usuariosAtivos().find(u => u.id === this.solicitanteSelecionado());
    return solicitante?.nome ?? this.usuario()?.nome ?? '';
  }

  /** Remove zeros à esquerda do código da mesa (ex: "053" → "53", "005" → "5"). */
  formatarCodigoMesa(codigo: string): string {
    return String(parseInt(codigo, 10));
  }
}