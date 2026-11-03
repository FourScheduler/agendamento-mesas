import { Component, inject, signal, computed, effect, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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

  readonly usuario = this.auth.usuario;
  readonly perfil = computed(() => this.auth.usuario()?.perfil ?? '');

  readonly mesas = signal<readonly Mesa[]>([]);
  readonly busca = signal('');
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
  readonly confirmando = signal(false);
  readonly erroAcao = signal('');

  readonly mesasFiltradas = computed(() => {
    const termo = this.busca().trim().toLowerCase();
    if (!termo) return this.mesas();
    return this.mesas().filter(m =>
      m.codigo.toLowerCase().includes(termo) ||
      m.regiao.toLowerCase().includes(termo)
    );
  });

  constructor() {
    effect((onCleanup) => {
      this.carregarMesas();
      onCleanup(() => {});
    });
  }

  carregarMesas() {
    this.carregando.set(true);
    this.erroConsulta.set('');
    this.adminMesa.listarTodas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (mesas) => {
          this.mesas.set(mesas);
          this.carregando.set(false);
        },
        error: (e) => {
          this.carregando.set(false);
          this.erroConsulta.set(this.extrairMensagemErro(e, 'Não foi possível carregar as mesas.'));
        },
      });
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
    this.erroAcao.set('');
    this.confirmando.set(false);
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
        const usuario = this.usuariosAtivos().find(u => u.id === this.usuarioSelecionado());
        return `Confirmar fixação da mesa ${mesa.codigo} (${mesa.regiao}) para ${usuario?.nome ?? 'usuário selecionado'}?`;
      }
      case 'desfixar': {
        return `Confirmar desfixação da mesa ${mesa.codigo}? O responsável será removido e o tipo passará para LIVRE.`;
      }
      case 'alterar-responsavel': {
        const usuario = this.usuariosAtivos().find(u => u.id === this.usuarioSelecionado());
        const atual = mesa.responsavel ? `${mesa.responsavel.nome} (${mesa.responsavel.email})` : 'não atribuída';
        return `Alterar responsável da mesa ${mesa.codigo} de "${atual}" para ${usuario?.nome ?? 'usuário selecionado'}?`;
      }
      case 'ativar': {
        return `Confirmar ativação da mesa ${mesa.codigo}?`;
      }
      case 'inativar': {
        return `Confirmar inativação da mesa ${mesa.codigo}? A mesa não ficará disponível para reservas.`;
      }
      default: return '';
    }
  }

  getResponsavelAtual(): string {
    const mesa = this.mesaSelecionadaParaAcao();
    if (!mesa?.responsavel) return 'Não atribuída';
    return `${mesa.responsavel.nome} (${mesa.responsavel.email})`;
  }

  getResponsavelLabel(mesa: Mesa): string {
    if (!mesa.responsavel) return 'Não atribuída';
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

  trackByMesa(index: number, mesa: Mesa): number {
    return mesa.id;
  }

  trackByUsuario(index: number, usuario: UsuarioAtivo): number {
    return usuario.id;
  }
}