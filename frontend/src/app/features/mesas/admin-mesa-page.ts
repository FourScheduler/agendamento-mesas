import { Component, inject, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, switchMap } from 'rxjs/operators';
import { AuthService } from '../../core/auth/auth.service';
import { AdminMesaService, UsuarioAtivo } from './admin-mesa.service';
import { Mesa } from './mesa';
import { Carregando } from '../../shared/estados/carregando';
import { Erro } from '../../shared/estados/erro';
import { Vazio } from '../../shared/estados/vazio';
import { ToastService } from '../../shared/toast/toast';

@Component({
  selector: 'app-admin-mesa-page',
  standalone: true,
  imports: [CommonModule, FormsModule, Carregando, Erro, Vazio],
  templateUrl: './admin-mesa-page.html',
  styleUrl: './admin-mesa-page.css',
})
export class AdminMesaPage {
  private readonly auth = inject(AuthService);
  private readonly adminMesa = inject(AdminMesaService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly buscaMesas$ = new Subject<string>();

  readonly usuario = this.auth.usuario;
  readonly perfil = computed(() => this.auth.usuario()?.perfil ?? '');

  readonly mesas = signal<readonly Mesa[]>([]);
  readonly busca = signal('');
  readonly filtroTipo = signal<'fixa' | 'livre' | 'inativa' | 'reservada' | null>(null);
  readonly mesasFiltradas = computed(() => {
    const filtro = this.filtroTipo();
    return this.mesas().filter(mesa => {
      switch (filtro) {
        case 'fixa': return mesa.tipo === 'FIXA';
        case 'livre': return mesa.ativa && mesa.tipo === 'LIVRE' && !mesa.ocupada;
        case 'inativa': return !mesa.ativa;
        case 'reservada': return mesa.ativa && mesa.tipo === 'LIVRE' && mesa.ocupada;
        default: return true;
      }
    });
  });
  readonly carregando = signal(false);
  readonly erroConsulta = signal('');

  readonly usuariosAtivos = signal<readonly UsuarioAtivo[]>([]);
  readonly carregandoUsuarios = signal(false);
  readonly erroUsuarios = signal('');
  readonly buscaUsuario = signal('');
  readonly usuarioFocado = signal(false);

  readonly usuariosFiltrados = computed(() => {
    const termo = this.buscaUsuario().trim().toLowerCase();
    if (!termo) return this.usuariosAtivos();
    return this.usuariosAtivos().filter(u =>
      u.nome.toLowerCase().includes(termo) ||
      u.email.toLowerCase().includes(termo)
    );
  });

  readonly mostrarSugestoesUsuario = computed(() => 
    this.usuarioFocado() && !this.carregandoUsuarios()
  );

  readonly mesaSelecionadaParaAcao = signal<Mesa | null>(null);
  readonly acaoEmAndamento = signal<'fixar' | 'desfixar' | 'alterar-responsavel' | 'ativar' | 'inativar' | null>(null);
  readonly usuarioSelecionado = signal<number | null>(null);
  readonly editandoUsuario = signal(true);
  readonly confirmando = signal(false);
  readonly erroAcao = signal('');

  voltarParaAgendamento() {
    void this.router.navigate(['/agendamento']);
  }

  irParaMapa() {
    void this.router.navigate(['/mapa']);
  }

  constructor() {
    this.buscaMesas$.pipe(
      debounceTime(250),
      switchMap(termo => {
        const hoje = new Date().toISOString().split('T')[0];
        return this.adminMesa.listarComOcupacao(termo, hoje).pipe(
          catchError(e => {
            this.erroConsulta.set(this.extrairMensagemErro(e, 'Não foi possível carregar as mesas.'));
            return of([] as readonly Mesa[]);
          }),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(mesas => {
      this.mesas.set(mesas);
      this.carregando.set(false);
    });

    this.carregarMesas();
  }

  carregarMesas() {
    this.carregando.set(true);
    this.erroConsulta.set('');
    this.buscaMesas$.next(this.busca());
  }

  onBuscaChange(event: Event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const valor = target.value;
    this.busca.set(valor);
    this.buscaMesas$.next(valor);
  }

  carregarUsuariosAtivos() {
    this.carregandoUsuarios.set(true);
    this.erroUsuarios.set('');
    this.adminMesa.listarUsuariosAtivos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (usuarios) => {
          this.usuariosAtivos.set([...usuarios].sort((a, b) => a.nome.localeCompare(b.nome)));
          this.carregandoUsuarios.set(false);
        },
        error: (e) => {
          this.carregandoUsuarios.set(false);
          this.erroUsuarios.set(this.extrairMensagemErro(e, 'Não foi possível carregar usuários ativos.'));
        },
      });
  }

  private extrairMensagemErro(e: any, padrao: string): string {
    if (e.status === 401) return 'Sua sessão expirou. Faça login novamente.';
    if (e.status === 403) return 'Acesso restrito a administradores.';
    return e.error?.detail ?? padrao;
  }

  abrirModalFixar(mesa: Mesa) {
    this.mesaSelecionadaParaAcao.set(mesa);
    this.acaoEmAndamento.set('fixar');
    this.usuarioSelecionado.set(null);
    this.editandoUsuario.set(true);
    this.buscaUsuario.set('');
    this.erroAcao.set('');
    this.confirmando.set(false);
    this.carregarUsuariosAtivos();
  }

  abrirModalDesfixar(mesa: Mesa) {
    this.mesaSelecionadaParaAcao.set(mesa);
    this.acaoEmAndamento.set('desfixar');
    this.erroAcao.set('');
    this.confirmando.set(false);
  }

  abrirModalAlterarResponsavel(mesa: Mesa) {
    this.mesaSelecionadaParaAcao.set(mesa);
    this.acaoEmAndamento.set('alterar-responsavel');
    this.usuarioSelecionado.set(null);
    this.editandoUsuario.set(true);
    this.buscaUsuario.set('');
    this.erroAcao.set('');
    this.confirmando.set(false);
    this.carregarUsuariosAtivos();
  }

  abrirModalAtivar(mesa: Mesa) {
    this.mesaSelecionadaParaAcao.set(mesa);
    this.acaoEmAndamento.set('ativar');
    this.erroAcao.set('');
    this.confirmando.set(false);
  }

  abrirModalInativar(mesa: Mesa) {
    this.mesaSelecionadaParaAcao.set(mesa);
    this.acaoEmAndamento.set('inativar');
    this.erroAcao.set('');
    this.confirmando.set(false);
  }

  fecharModal() {
    this.mesaSelecionadaParaAcao.set(null);
    this.acaoEmAndamento.set(null);
    this.usuarioSelecionado.set(null);
    this.editandoUsuario.set(true);
    this.erroAcao.set('');
    this.confirmando.set(false);
  }

  selecionarUsuario(usuarioId: number) {
    this.usuarioSelecionado.set(usuarioId);
    this.editandoUsuario.set(false);
    this.usuarioFocado.set(false);
    this.buscaUsuario.set('');
  }

  trocarUsuario() {
    this.usuarioSelecionado.set(null);
    this.editandoUsuario.set(true);
    this.buscaUsuario.set('');
    this.usuarioFocado.set(false);
  }

  getUsuarioSelecionado(): UsuarioAtivo | undefined {
    return this.usuariosAtivos().find(usuario => usuario.id === this.usuarioSelecionado());
  }

  iniciaisUsuario(nome: string): string {
    return nome.trim().split(/\s+/).slice(0, 2).map(parte => parte[0]).join('').toLocaleUpperCase('pt-BR');
  }

  confirmarAcao() {
    const mesa = this.mesaSelecionadaParaAcao();
    const acao = this.acaoEmAndamento();
    if (!mesa || !acao) return;

    this.confirmando.set(true);
    this.erroAcao.set('');

    let operacao: any;

    switch (acao) {
      case 'fixar': {
        const usuarioId = this.usuarioSelecionado();
        if (!usuarioId) {
          this.erroAcao.set('Selecione um usuário para fixar a mesa.');
          this.confirmando.set(false);
          return;
        }
        operacao = this.adminMesa.fixarMesa(mesa.id, { usuarioId });
        break;
      }
      case 'desfixar': {
        operacao = this.adminMesa.desfixarMesa(mesa.id);
        break;
      }
      case 'alterar-responsavel': {
        const usuarioId = this.usuarioSelecionado();
        if (!usuarioId) {
          this.erroAcao.set('Selecione um usuário para ser o novo responsável.');
          this.confirmando.set(false);
          return;
        }
        operacao = this.adminMesa.alterarResponsavel(mesa.id, { usuarioId });
        break;
      }
      case 'ativar': {
        operacao = this.adminMesa.alterarAtivacao(mesa.id, { ativa: true });
        break;
      }
      case 'inativar': {
        operacao = this.adminMesa.alterarAtivacao(mesa.id, { ativa: false });
        break;
      }
    }

    operacao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (mesaAtualizada: Mesa) => {
        this.mesas.update(mesas =>
          mesas.map(m => m.id === mesaAtualizada.id ? mesaAtualizada : m)
        );
        this.toast.sucesso('Sucesso', this.mensagemSucesso(acao));
        this.fecharModal();
      },
      error: (e: unknown) => {
        this.confirmando.set(false);
        this.erroAcao.set(this.extrairMensagemErro(e, 'Não foi possível realizar a operação.'));
      },
    });
  }

  private mensagemSucesso(acao: string): string {
    switch (acao) {
      case 'fixar': return 'Mesa fixada com sucesso.';
      case 'desfixar': return 'Mesa desfixada com sucesso.';
      case 'alterar-responsavel': return 'Responsável alterado com sucesso.';
      case 'ativar': return 'Mesa ativada com sucesso.';
      case 'inativar': return 'Mesa inativada com sucesso.';
      default: return 'Operação realizada com sucesso.';
    }
  }

  getTituloModal(): string {
    const mesa = this.mesaSelecionadaParaAcao();
    const acao = this.acaoEmAndamento();
    if (!mesa || !acao) return '';

    switch (acao) {
      case 'fixar': return `Fixar mesa ${mesa.codigo}`;
      case 'desfixar': return `Desfixar mesa ${mesa.codigo}`;
      case 'alterar-responsavel': return `Alterar responsável da mesa ${mesa.codigo}`;
      case 'ativar': return `Ativar mesa ${mesa.codigo}`;
      case 'inativar': return `Inativar mesa ${mesa.codigo}`;
      default: return '';
    }
  }

  getMensagemConfirmacao(): string {
    const mesa = this.mesaSelecionadaParaAcao();
    const acao = this.acaoEmAndamento();
    if (!mesa || !acao) return '';

    switch (acao) {
      case 'fixar': {
        const usuario = this.getUsuarioSelecionado();
        return usuario
          ? `Atribuir esta mesa para ${usuario.nome}?`
          : 'Selecione quem ficará responsável por esta mesa.';
      }
      case 'desfixar': {
        return 'A mesa ficará livre e o responsável atual será removido.';
      }
      case 'alterar-responsavel': {
        const usuario = this.getUsuarioSelecionado();
        return usuario
          ? `O novo responsável será ${usuario.nome}.`
          : 'Selecione o novo responsável para esta mesa.';
      }
      case 'ativar': {
        return 'A mesa voltará a aparecer como ativa.';
      }
      case 'inativar': {
        return 'A mesa ficará indisponível para novas reservas.';
      }
      default: return '';
    }
  }

  getResponsavelAtual(): string {
    const mesa = this.mesaSelecionadaParaAcao();
    if (!mesa?.responsavel) return 'Não atribuída';
    return `${mesa.responsavel.nome} (${mesa.responsavel.email})`;
  }

  podeFixar(mesa: Mesa): boolean {
    return mesa.tipo === 'LIVRE' && !mesa.responsavel;
  }

  podeDesfixar(mesa: Mesa): boolean {
    return mesa.tipo === 'FIXA';
  }

  podeAlterarResponsavel(mesa: Mesa): boolean {
    return mesa.tipo === 'FIXA' && !!mesa.responsavel;
  }

  getTipoLabel(tipo: string): string {
    return tipo === 'LIVRE' ? 'Livre' : 'Fixa';
  }

  getAtivacaoLabel(ativa: boolean): string {
    return ativa ? 'Ativa' : 'Inativa';
  }
}