import { Component, inject, signal, computed, effect, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, combineLatest, of, timer } from 'rxjs';
import { catchError, startWith, switchMap, tap } from 'rxjs/operators';
import { AuthService } from '../../core/auth/auth.service';
import { AdminMesaService, UsuarioAtivo } from './admin-mesa.service';
import { Mesa } from './mesa';
import { Carregando } from '../../shared/estados/carregando';
import { Erro } from '../../shared/estados/erro';
import { Vazio } from '../../shared/estados/vazio';
import { ToastService } from '../../shared/toast/toast';
import { CalendarioSaoPaulo } from '../reservas/calendario-sao-paulo';
import { Paginacao } from '../../shared/paginacao/paginacao';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-admin-mesa-page',
  standalone: true,
  imports: [CommonModule, FormsModule, Carregando, Erro, Vazio, Paginacao],
  templateUrl: './admin-mesa-page.html',
  styleUrl: './admin-mesa-page.css',
})
export class AdminMesaPage {
  private readonly auth = inject(AuthService);
  private readonly adminMesa = inject(AdminMesaService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly calendario = inject(CalendarioSaoPaulo);
  private readonly recarregarMesas$ = new Subject<void>();

  readonly usuario = this.auth.usuario;
  readonly perfil = computed(() => this.auth.usuario()?.perfil ?? '');

  readonly mesas = signal<readonly Mesa[]>([]);
  readonly busca = signal('');
  readonly ordenacao = signal<'codigo' | 'regiao' | 'tipo' | 'status' | 'responsavel'>('codigo');
  readonly descendente = signal(false);
  readonly pagina = signal(0);
  readonly tamanhoPagina = signal(10);
  readonly filtroTipo = signal<'fixa' | 'livre' | 'inativa' | 'reservada' | null>(null);
  readonly mesasFiltradas = computed(() => {
    const termo = this.busca().trim().toLocaleLowerCase('pt-BR');
    const termoCodigo = termo.replace(/^mesa\s*/i, '');
    const filtro = this.filtroTipo();
    return this.mesas().filter(mesa => {
      const correspondeABusca = !termo
        || /^\d+$/.test(termoCodigo) && mesa.codigo.includes(termoCodigo)
        || mesa.regiao.toLocaleLowerCase('pt-BR').includes(termo)
        || mesa.responsavel?.nome.toLocaleLowerCase('pt-BR').includes(termo)
        || mesa.responsavel?.email.toLocaleLowerCase('pt-BR').includes(termo);
      if (!correspondeABusca) return false;
      switch (filtro) {
        case 'fixa': return mesa.tipo === 'FIXA';
        case 'livre': return mesa.ativa && mesa.tipo === 'LIVRE' && !mesa.ocupada;
        case 'inativa': return !mesa.ativa;
        case 'reservada': return mesa.ativa && mesa.tipo === 'LIVRE' && mesa.ocupada;
        default: return true;
      }
    }).sort((a, b) => {
      const campo = this.ordenacao();
      const valor = (m: Mesa) => {
        switch (campo) {
          case 'codigo': return m.codigo;
          case 'regiao': return m.regiao;
          case 'tipo': return m.tipo;
          case 'status': return m.ativa ? 'Ativa' : 'Inativa';
          case 'responsavel': return m.responsavel?.nome ?? '';
        }
      };
      const ordem = valor(a).localeCompare(valor(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
      return (this.descendente() ? -ordem : ordem) || a.id - b.id;
    });
  });
  readonly paginaAtual = computed(() => Math.min(this.pagina(),
    Math.max(0, Math.ceil(this.mesasFiltradas().length / this.tamanhoPagina()) - 1)));
  readonly mesasPaginadas = computed(() => this.mesasFiltradas().slice(
    this.paginaAtual() * this.tamanhoPagina(), (this.paginaAtual() + 1) * this.tamanhoPagina()));
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
    effect(() => {
      this.busca(); this.filtroTipo(); this.ordenacao(); this.descendente();
      this.pagina.set(0);
    });
    combineLatest([this.recarregarMesas$.pipe(startWith(undefined)), toObservable(this.calendario.hoje)]).pipe(
      tap(() => {
        this.carregando.set(true);
        this.erroConsulta.set('');
      }),
      switchMap(([, hoje]) => this.adminMesa.listarComOcupacao(undefined, hoje).pipe(
          catchError(e => {
            this.erroConsulta.set(this.extrairMensagemErro(e, 'Não foi possível carregar as mesas.'));
            return of([] as readonly Mesa[]);
          }),
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(mesas => {
      this.mesas.set(mesas);
      this.carregando.set(false);
    });

    this.carregarMesas();
  }

  carregarMesas() {
    this.calendario.atualizar();
    this.carregando.set(true);
    this.erroConsulta.set('');
    this.recarregarMesas$.next();
  }

  onBuscaChange(event: Event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const valor = target.value;
    this.busca.set(valor);
  }

  limparFiltros() {
    this.busca.set('');
    this.filtroTipo.set(null);
    this.carregarMesas();
  }

  ordenarPor(campo: 'codigo' | 'regiao' | 'tipo' | 'status' | 'responsavel') {
    if (this.ordenacao() === campo) {
      this.descendente.update(descendente => !descendente);
    } else {
      this.ordenacao.set(campo);
      this.descendente.set(false);
    }
  }

  ariaOrdenacao(campo: 'codigo' | 'regiao' | 'tipo' | 'status' | 'responsavel'): 'ascending' | 'descending' | 'none' {
    if (this.ordenacao() !== campo) return 'none';
    return this.descendente() ? 'descending' : 'ascending';
  }

  indicadorOrdenacao(campo: 'codigo' | 'regiao' | 'tipo' | 'status' | 'responsavel'): string {
    if (this.ordenacao() !== campo) return '↕';
    return this.descendente() ? '↓' : '↑';
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

  private extrairMensagemErro(e: unknown, padrao: string): string {
    if (!(e instanceof HttpErrorResponse)) return padrao;
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
    if (this.confirmando()) return;
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
    if (!mesa || !acao || this.confirmando()) return;

    this.confirmando.set(true);
    this.erroAcao.set('');

    let operacao: Observable<Mesa>;

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
          mesas.map(m => m.id === mesaAtualizada.id ? { ...m, ...mesaAtualizada, ocupada: m.ocupada } : m)
        );
        this.toast.sucesso('Sucesso', this.mensagemSucesso(acao));
        this.confirmando.set(false);
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
      case 'alterar-responsavel': return this.mesaSelecionadaParaAcao()?.responsavel
        ? 'Responsável alterado com sucesso.' : 'Responsável atribuído com sucesso.';
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
      case 'alterar-responsavel': return `${mesa.responsavel ? 'Alterar' : 'Atribuir'} responsável da mesa ${mesa.codigo}`;
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
    return mesa.ativa && mesa.tipo === 'LIVRE' && !mesa.responsavel;
  }

  podeDesfixar(mesa: Mesa): boolean {
    return mesa.tipo === 'FIXA';
  }

  podeAlterarResponsavel(mesa: Mesa): boolean {
    return mesa.ativa && mesa.tipo === 'FIXA';
  }

  getTipoLabel(tipo: string): string {
    return tipo === 'LIVRE' ? 'Livre' : 'Fixa';
  }

  getAtivacaoLabel(ativa: boolean): string {
    return ativa ? 'Ativa' : 'Inativa';
  }
}
