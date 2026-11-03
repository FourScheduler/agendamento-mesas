import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, of, timer } from 'rxjs';
import { catchError, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { PlantaMesas } from '../planta/planta-mesas';
import { Mesa } from '../mesas/mesa';
import { AuthService, UsuarioAdminResumo } from '../../core/auth/auth.service';
import { ReservaDiaria } from '../reservas/reserva-diaria';
import { formatarData } from '../reservas/data-reserva';
import { Notificacao } from '../../shared/notificacao/notificacao';
import { ReservaService } from '../agendamento/reserva.service';

@Component({
  selector: 'app-mapa-page',
  standalone: true,
  imports: [FormsModule, PlantaMesas, Notificacao],
  providers: [ReservaDiaria],
  templateUrl: './mapa-page.html',
  styleUrl: './mapa-page.css',
})
export class MapaPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reservas = inject(ReservaService);
  readonly reserva = inject(ReservaDiaria);
  readonly usuario = this.auth.usuario;
  readonly isAdmin = computed(() => this.usuario()?.perfil === 'ADMIN');
  readonly mesaInicialId = signal(Number(this.route.snapshot.queryParamMap.get('mesaId')) || null);
  readonly mesaSelecionada = this.reserva.selecionada;
  readonly formatarData = formatarData;
  readonly buscaSolicitante = signal('');
  readonly solicitanteFocado = signal(false);
  readonly solicitanteSelecionado = signal<UsuarioAdminResumo | null>(null);
  readonly usuariosEncontrados = signal<readonly UsuarioAdminResumo[]>([]);
  readonly carregandoUsuarios = signal(false);
  readonly erroBuscaSolicitante = signal('');
  readonly mostrarSugestoesSolicitante = computed(() =>
    this.solicitanteFocado() && (
      this.buscaSolicitante().trim().length > 0 ||
      this.carregandoUsuarios() ||
      !!this.erroBuscaSolicitante()
    ),
  );
  private readonly termosBuscaSolicitante = new Subject<string>();

  constructor() {
    const usuarioAtual = this.usuario();
    if (this.isAdmin() && usuarioAtual) {
      this.solicitanteSelecionado.set({ ...usuarioAtual, ativo: true });
    }

    this.termosBuscaSolicitante.pipe(
      distinctUntilChanged(),
      tap(termo => {
        this.erroBuscaSolicitante.set('');
        this.usuariosEncontrados.set([]);
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
      this.usuariosEncontrados.set(usuarios);
      this.carregandoUsuarios.set(false);
    });
  }

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

  buscarSolicitantes(termo: string) {
    const busca = termo.trim();
    this.buscaSolicitante.set(termo);
    this.solicitanteSelecionado.set(null);
    this.usuariosEncontrados.set([]);
    this.erroBuscaSolicitante.set('');
    this.termosBuscaSolicitante.next(busca);
  }

  selecionarSolicitante(usuario: UsuarioAdminResumo) {
    this.solicitanteSelecionado.set(usuario);
    this.buscaSolicitante.set('');
    this.usuariosEncontrados.set([]);
    this.solicitanteFocado.set(false);
    this.termosBuscaSolicitante.next('');
  }

  confirmarReserva() {
    const solicitanteId = this.isAdmin() ? this.solicitanteSelecionado()?.id ?? null : null;
    if (this.isAdmin() && solicitanteId === null) return;
    this.reserva.confirmarComSolicitante(solicitanteId);
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
}
