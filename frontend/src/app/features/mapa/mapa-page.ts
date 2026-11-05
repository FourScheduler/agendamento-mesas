import { Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
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
import { AdminMesaService } from '../mesas/admin-mesa.service';
import { CalendarioReserva } from '../reservas/calendario-reserva';
import { ToastService } from '../../shared/toast/toast';

@Component({
  selector: 'app-mapa-page',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, PlantaMesas, Notificacao, CalendarioReserva],
  providers: [ReservaDiaria],
  templateUrl: './mapa-page.html',
  styleUrl: './mapa-page.css',
  host: {
    '(document:keydown.escape)': 'fecharDetalhes()',
  },
})
export class MapaPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reservas = inject(ReservaService);
  private readonly adminMesas = inject(AdminMesaService);
  private readonly toast = inject(ToastService);
  private readonly dialogoFixacao = viewChild.required<ElementRef<HTMLDialogElement>>('dialogoFixacao');
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly reserva = inject(ReservaDiaria);
  readonly usuario = this.auth.usuario;
  readonly isAdmin = computed(() => this.usuario()?.perfil === 'ADMIN');
  readonly mesaInicialId = signal(Number(this.route.snapshot.queryParamMap.get('mesaId')) || null);
  readonly mesaSelecionada = this.reserva.selecionada;
  readonly mesaNoPainel = signal<Mesa | null>(null);
  readonly detalhesAbertos = signal(false);
  readonly fixacaoPretendida = signal<boolean | null>(null);
  readonly enviandoFixacao = signal(false);
  readonly erroFixacao = signal('');
  readonly sucessoFixacao = signal('');
  readonly formatarData = formatarData;
  readonly buscaSolicitante = signal('');
  readonly solicitanteFocado = signal(false);
  readonly editandoSolicitante = signal(true);
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

  onMesaSelecionada(selecao: { readonly mesa: Mesa; readonly disponivel: boolean }) {
    if (this.enviandoFixacao() || this.reserva.confirmando()) return;
    if (this.detalhesAbertos() && this.mesaNoPainel()?.id === selecao.mesa.id) {
      this.fecharDetalhes();
      return;
    }
    this.limparFixacao();
    const { mesa, disponivel } = selecao;
    this.mesaNoPainel.set(mesa);
    if (disponivel) this.reserva.selecionar(mesa);
    else this.reserva.limparSelecao();
    if (this.mesaSelecionada()?.id !== mesa.id) this.reserva.limparSelecao();
    this.detalhesAbertos.set(true);
  }

  onMesaInicialSelecionada(mesa: Mesa) {
    this.mesaNoPainel.set(mesa);
    this.reserva.selecionar(mesa);
    this.detalhesAbertos.set(false);
  }

  onDataChange(data: string) {
    if (this.enviandoFixacao()) return;
    this.limparFixacao();
    this.detalhesAbertos.set(false);
    this.mesaNoPainel.set(null);
    this.mesaInicialId.set(null);
    this.reserva.alterarData(data);
  }

  onMesaInicialInvalidada() {
    this.detalhesAbertos.set(false);
    this.mesaNoPainel.set(null);
    this.mesaInicialId.set(null);
    this.reserva.limparSelecao();
  }

  voltarParaAgendamento() {
    void this.router.navigate(['/agendamento'], { queryParams: { data: this.reserva.data(), mesaId: this.mesaSelecionada()?.id ?? null } });
  }

  fecharDetalhes() {
    if (!this.detalhesAbertos() || this.reserva.confirmando() || this.enviandoFixacao() || this.dialogoFixacao().nativeElement.open) return;

    const mesaId = this.mesaNoPainel()?.id;
    if (mesaId !== undefined) {
      this.elemento.nativeElement
        .querySelector<HTMLButtonElement>(`button.mesa[data-mesa-id="${mesaId}"]`)
        ?.focus();
    }
    this.detalhesAbertos.set(false);
    this.mesaNoPainel.set(null);
    this.mesaInicialId.set(null);
    this.reserva.limparSelecao();
    this.limparFixacao();
  }

  alterarFixacao() {
    const mesa = this.mesaNoPainel();
    if (!this.isAdmin() || !mesa || !mesa.ativa || this.enviandoFixacao() || this.reserva.confirmando()) return;
    const fixar = !(this.fixacaoPretendida() ?? mesa.tipo === 'FIXA');
    this.fixacaoPretendida.set(fixar === (mesa.tipo === 'FIXA') ? null : fixar);
    this.erroFixacao.set('');
    this.sucessoFixacao.set('');
    if (!fixar && this.fixacaoPretendida() !== null) this.abrirConfirmacaoFixacao();
  }

  abrirConfirmacaoFixacao() {
    if (this.fixacaoPretendida() === null || this.enviandoFixacao()
      || (this.fixacaoPretendida() && !this.solicitanteSelecionado())) return;
    this.dialogoFixacao().nativeElement.showModal();
  }

  cancelarFixacao(event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.enviandoFixacao()) return;
    this.dialogoFixacao().nativeElement.close();
    this.fixacaoPretendida.set(null);
    this.erroFixacao.set('');
  }

  confirmarFixacao() {
    const mesa = this.mesaNoPainel();
    const fixar = this.fixacaoPretendida();
    if (!this.isAdmin() || !mesa || fixar === null || !this.dialogoFixacao().nativeElement.open
      || this.enviandoFixacao() || this.reserva.confirmando()) return;
    const usuarioId = this.solicitanteSelecionado()?.id;
    if (fixar && !usuarioId) {
      this.erroFixacao.set('Selecione um usuário ativo para fixar a mesa.');
      return;
    }
    this.enviandoFixacao.set(true);
    this.erroFixacao.set('');
    const operacao = fixar && usuarioId !== undefined
      ? this.adminMesas.fixarMesa(mesa.id, { usuarioId })
      : this.adminMesas.desfixarMesa(mesa.id);
    operacao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: atualizada => {
        this.mesaNoPainel.set({ ...mesa, ...atualizada });
        this.enviandoFixacao.set(false);
        this.fixacaoPretendida.set(null);
        this.sucessoFixacao.set(fixar ? 'Mesa fixada com sucesso.' : 'Mesa desfixada com sucesso.');
        this.dialogoFixacao().nativeElement.close();
        this.toast.sucesso(this.sucessoFixacao());
        this.mesaInicialId.set(null);
        this.reserva.atualizarDisponibilidade();
      },
      error: (erro: HttpErrorResponse) => {
        this.enviandoFixacao.set(false);
        this.erroFixacao.set(typeof erro.error?.detail === 'string'
          ? erro.error.detail : 'Não foi possível alterar a fixação da mesa. Tente novamente.');
      },
    });
  }

  private limparFixacao() {
    this.fixacaoPretendida.set(null);
    this.erroFixacao.set('');
    this.sucessoFixacao.set('');
  }

  podeReservar(mesa: Mesa): boolean {
    return this.reserva.disponibilidadeAtual() && this.mesaSelecionada()?.id === mesa.id;
  }

  statusMesa(mesa: Mesa): string {
    if (!mesa.ativa) return 'Inativa';
    if (mesa.tipo === 'FIXA') return 'Mesa fixa';
    if (this.podeReservar(mesa)) return 'Disponível';
    return this.reserva.disponibilidadeAtual() ? 'Indisponível nesta data' : 'Disponibilidade pendente';
  }

  buscarSolicitantes(termo: string) {
    const busca = termo.trim();
    this.buscaSolicitante.set(termo);
    this.solicitanteSelecionado.set(null);
    this.editandoSolicitante.set(true);
    this.usuariosEncontrados.set([]);
    this.erroBuscaSolicitante.set('');
    this.termosBuscaSolicitante.next(busca);
  }

  selecionarSolicitante(usuario: UsuarioAdminResumo) {
    this.solicitanteSelecionado.set(usuario);
    this.editandoSolicitante.set(false);
    this.buscaSolicitante.set('');
    this.usuariosEncontrados.set([]);
    this.solicitanteFocado.set(false);
    this.termosBuscaSolicitante.next('');
  }

  trocarSolicitante() {
    if (this.reserva.confirmando() || this.enviandoFixacao()) return;

    this.solicitanteSelecionado.set(null);
    this.editandoSolicitante.set(true);
    this.buscaSolicitante.set('');
    this.usuariosEncontrados.set([]);
    this.erroBuscaSolicitante.set('');
    this.solicitanteFocado.set(false);
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
