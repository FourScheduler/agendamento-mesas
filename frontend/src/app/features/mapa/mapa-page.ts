import { Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, of, timer } from 'rxjs';
import { catchError, distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators';
import { PlantaMesas } from '../planta/planta-mesas';
import { Mesa } from '../mesas/mesa';
import { AdminMesaService } from '../mesas/admin-mesa.service';
import { AuthService, UsuarioAdminResumo } from '../../core/auth/auth.service';
import { ReservaDiaria } from '../reservas/reserva-diaria';
import { CalendarioReserva } from '../reservas/calendario-reserva';
import { formatarData } from '../reservas/data-reserva';
import { ToastService } from '../../shared/toast/toast';
import { ReservaService } from '../agendamento/reserva.service';
import { Reserva } from '../agendamento/reserva';
import { ConfirmacaoPendente } from '../reservas/confirmacao-pendente';

@Component({
  selector: 'app-mapa-page',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, PlantaMesas, CalendarioReserva, ConfirmacaoPendente],
  providers: [ReservaDiaria],
  templateUrl: './mapa-page.html',
  styleUrl: './mapa-page.css',
  host: {
    '(document:keydown.escape)': 'fecharDetalhes($event)',
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
  private readonly campoDataDetalhes = viewChild<ElementRef<HTMLInputElement>>('campoDataDetalhes');
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly reserva = inject(ReservaDiaria);
  readonly usuario = this.auth.usuario;
  readonly isAdmin = computed(() => this.usuario()?.perfil === 'ADMIN');
  readonly mesaInicialId = signal(Number(this.route.snapshot.queryParamMap.get('mesaId')) || null);
  readonly mesaSelecionada = this.reserva.selecionada;
  readonly mesaNoPainel = signal<Mesa | null>(null);
  readonly mesasCatalogo = signal<readonly Mesa[]>([]);
  readonly idsMesasDisponiveis = signal<ReadonlySet<number> | null>(null);
  readonly reservaDoPainel = signal<Reserva | null>(null);
  readonly carregandoReservaDoPainel = signal(false);
  readonly confirmacaoCancelamento = signal(false);
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
  private reservaPainelRequest = 0;
  readonly mesaReservadaId = computed(() => {
    const usuarioId = this.usuario()?.id;
    if (usuarioId == null) return null;
    return this.mesasCatalogo().find(m => m.ocupanteNaData?.id === usuarioId)?.id
      ?? this.mesasCatalogo().find(m => m.responsavel?.id === usuarioId)?.id ?? null;
  });

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
    if (this.enviandoFixacao() || this.reserva.confirmando() || this.reserva.cancelando()) return;
    if (this.detalhesAbertos() && this.mesaNoPainel()?.id === selecao.mesa.id) {
      this.fecharDetalhes();
      return;
    }
    this.limparFixacao();
    const { mesa, disponivel } = selecao;
    this.mesaNoPainel.set(mesa);
    this.carregarReservaDoPainel(mesa);
    if (disponivel) this.reserva.selecionar(mesa);
    else this.reserva.limparSelecao();
    if (this.mesaSelecionada()?.id !== mesa.id) this.reserva.limparSelecao();
    this.detalhesAbertos.set(true);
  }

  onMesaInicialSelecionada(mesa: Mesa) {
    this.mesaNoPainel.set(mesa);
    this.invalidarBuscaReservaDoPainel();
    this.reserva.selecionar(mesa);
    this.detalhesAbertos.set(false);
  }

  onDataChange(data: string) {
    if (this.enviandoFixacao() || this.reserva.confirmando() || this.reserva.cancelando()) return;
    this.mesaInicialId.set(null);
    this.invalidarBuscaReservaDoPainel();
    this.reserva.alterarData(data);
  }

  onMesasCarregadas(mesas: readonly Mesa[]) {
    this.mesasCatalogo.set(mesas);
    const mesaAtual = this.mesaNoPainel();
    if (!this.detalhesAbertos() || !mesaAtual) return;
    const mesaAtualizada = mesas.find(mesa => mesa.id === mesaAtual.id);
    if (!mesaAtualizada) return;
    this.mesaNoPainel.set(mesaAtualizada);
    this.carregarReservaDoPainel(mesaAtualizada);
  }

  onMesasDisponiveisCarregadas(ids: ReadonlySet<number> | null) {
    this.idsMesasDisponiveis.set(ids);
  }

  onDisponibilidadeConsultada(data: string) {
    this.reserva.registrarDisponibilidade(data);
    const mesa = this.mesaNoPainel();
    if (data === this.reserva.data() && mesa && this.idsMesasDisponiveis()?.has(mesa.id)) {
      this.reserva.selecionar(mesa);
    }
  }

  onMesaInicialInvalidada() {
    this.detalhesAbertos.set(false);
    this.mesaNoPainel.set(null);
    this.invalidarBuscaReservaDoPainel();
    this.mesaInicialId.set(null);
    this.reserva.limparSelecao();
  }

  /** Altera a data diretamente pelo input no painel de detalhes. */
  onDataChangeNoPainel(data: string) {
    this.onDataChange(data);
  }

  abrirCalendarioDetalhes(event: Event) {
    event.preventDefault();
    const campo = this.campoDataDetalhes()?.nativeElement;
    if (campo && !campo.disabled) campo.click();
  }

  voltarParaAgendamento() {
    void this.router.navigate(['/agendamento'], { queryParams: { data: this.reserva.data(), mesaId: this.mesaSelecionada()?.id ?? null } });
  }

  fecharDetalhes(event?: Event) {
    if (event?.defaultPrevented) return;
    if (!this.detalhesAbertos() || this.enviandoFixacao() || this.reserva.confirmando() || this.reserva.cancelando()) return;

    const mesaId = this.mesaNoPainel()?.id;
    if (mesaId !== undefined) {
      this.elemento.nativeElement
        .querySelector<HTMLButtonElement>(`button.mesa[data-mesa-id="${mesaId}"]`)
        ?.focus();
    }
    this.detalhesAbertos.set(false);
    this.mesaNoPainel.set(null);
    this.invalidarBuscaReservaDoPainel();
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
    return this.reserva.disponibilidadeAtual()
      && this.mesaNoPainel()?.id === mesa.id
      && mesa.ativa
      && mesa.tipo === 'LIVRE'
      && !this.mesaReservada(mesa)
      && this.idsMesasDisponiveis()?.has(mesa.id) === true;
  }

  mesaReservada(mesa: Mesa): boolean {
    return mesa.ocupada || mesa.ocupanteNaData != null;
  }

  /** Verifica a permissão a partir do registro da reserva carregado pela API. */
  podeGerenciarReserva(mesa: Mesa): boolean {
    const reservaMesa = this.reservaDoPainel();
    if (
      !reservaMesa ||
      reservaMesa.status === 'CANCELADA' ||
      reservaMesa.data !== this.reserva.data() ||
      reservaMesa.mesa.id !== mesa.id
    ) return false;
    const usuarioAtual = this.usuario();
    if (!usuarioAtual) return false;
    if (this.isAdmin()) return true;
    return reservaMesa.usuarioId === usuarioAtual.id;
  }

  /** Cancela a reserva atualmente exibida no painel. */
  cancelarReserva() {
    const mesa = this.mesaNoPainel();
    const reservaMesa = this.reservaDoPainel();
    if (!mesa || !reservaMesa || !this.confirmacaoCancelamento() || !this.podeGerenciarReserva(mesa)
      || this.reserva.cancelando() || this.enviandoFixacao()) return;
    this.reserva.cancelarReserva(reservaMesa.id, mesa.id, () => {
      this.detalhesAbertos.set(false);
      this.mesaNoPainel.set(null);
      this.mesaInicialId.set(null);
      this.invalidarBuscaReservaDoPainel();
      this.reserva.limparSelecao();
    });
  }

  statusMesa(mesa: Mesa): string {
    if (!mesa.ativa) return 'Inativa';
    if (mesa.tipo === 'FIXA') return 'Mesa fixa';
    if (this.mesaReservada(mesa)) return 'Reservada';
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
    const mesa = this.mesaNoPainel();
    if (mesa && this.mesaSelecionada()?.id !== mesa.id && this.podeReservar(mesa)) {
      this.reserva.selecionar(mesa);
    }
    const solicitanteId = this.isAdmin() ? this.solicitanteSelecionado()?.id ?? null : null;
    if (this.isAdmin() && solicitanteId === null) return;
    this.reserva.confirmarComSolicitante(solicitanteId, () => {
      this.detalhesAbertos.set(false);
      this.mesaNoPainel.set(null);
      this.invalidarBuscaReservaDoPainel();
      this.mesaInicialId.set(null);
    });
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

  private carregarReservaDoPainel(mesa: Mesa) {
    this.invalidarBuscaReservaDoPainel();
    if (!this.mesaReservada(mesa)) return;

    const request = this.reservaPainelRequest;
    const data = this.reserva.data();
    this.carregandoReservaDoPainel.set(true);
    this.reservas.buscarReservaPorMesaEData(mesa.id, data)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: reservaMesa => {
          if (request !== this.reservaPainelRequest
            || this.mesaNoPainel()?.id !== mesa.id
            || this.reserva.data() !== data) return;
          this.reservaDoPainel.set(reservaMesa);
          this.carregandoReservaDoPainel.set(false);
        },
        error: () => {
          if (request !== this.reservaPainelRequest) return;
          this.carregandoReservaDoPainel.set(false);
          this.reserva.erro.set('Não foi possível carregar os detalhes da reserva.');
        },
      });
  }

  private invalidarBuscaReservaDoPainel() {
    this.confirmacaoCancelamento.set(false);
    this.reservaPainelRequest++;
    this.reservaDoPainel.set(null);
    this.carregandoReservaDoPainel.set(false);
  }
}
