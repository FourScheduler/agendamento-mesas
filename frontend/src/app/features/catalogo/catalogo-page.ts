import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { PlantaMesas } from '../planta/planta-mesas';
import { Mesa } from '../mesas/mesa';
import { Topbar } from '../../shared/topbar/topbar';
import { ReservaService } from '../reservas/reserva.service';
import { adicionarDias, formatarData, hojeSaoPaulo, proximoDiaUtil } from '../reservas/data-reserva';

interface Sessao {
  token: string;
  tipo: string;
  usuario: { id: number; nome: string; email: string; perfil: string };
}

const TOKEN_KEY = 'agendamento_mesas_token';

@Component({
  selector: 'app-catalogo-page',
  standalone: true,
  imports: [FormsModule, PlantaMesas, Topbar],
  templateUrl: './catalogo-page.html',
  styleUrl: './catalogo-page.css',
})
export class CatalogoPage {
  email = '';
  senha = '';
  readonly sessao = signal<Sessao | null>(null);
  readonly entrando = signal(false);
  readonly restaurando = signal(false);
  readonly erro = signal('');
  readonly selecionada = signal<Mesa | null>(null);
  readonly dataMinima = hojeSaoPaulo();
  readonly dataMaxima = adicionarDias(this.dataMinima, 15);
  readonly data = signal(proximoDiaUtil(this.dataMinima));
  readonly confirmando = signal(false);
  readonly erroReserva = signal('');
  readonly sucesso = signal('');
  readonly atualizacaoDisponibilidade = signal(0);
  readonly formatarData = formatarData;
  private readonly http = inject(HttpClient);
  private readonly reservas = inject(ReservaService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      this.restaurando.set(true);
      this.http.get<Sessao['usuario']>(`${environment.apiUrl}/auth/perfil`, {
        headers: { Authorization: `Bearer ${token}` },
      }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: usuario => {
          this.sessao.set({ token, tipo: 'Bearer', usuario });
          this.restaurando.set(false);
        },
        error: (erro: HttpErrorResponse) => {
          this.restaurando.set(false);
          this.sair(erro.status === 401);
          if (erro.status !== 401) this.erro.set('Não foi possível recuperar sua sessão. Entre novamente.');
        },
      });
    }
  }

  entrar() {
    if (this.entrando() || this.restaurando() || !this.email.trim() || !this.senha) return;
    this.entrando.set(true);
    this.erro.set('');
    this.http.post<Sessao>(`${environment.apiUrl}/auth/login`, {
      email: this.email.trim(), senha: this.senha,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sessao => {
        this.senha = '';
        localStorage.setItem(TOKEN_KEY, sessao.token);
        this.sessao.set(sessao);
        this.entrando.set(false);
      },
      error: (erro: HttpErrorResponse) => {
        this.senha = '';
        this.entrando.set(false);
        this.erro.set(erro.status === 401
          ? 'E-mail ou senha inválidos, ou usuário inativo.'
          : 'Não foi possível entrar. Verifique se o backend está em execução e tente novamente.');
      },
    });
  }

  alterarData(data: string) {
    if (this.confirmando()) return;
    this.data.set(data);
    this.selecionada.set(null);
    this.erroReserva.set('');
    this.sucesso.set('');
  }

  atualizarDisponibilidade() {
    if (this.confirmando()) return;
    this.selecionada.set(null);
    this.atualizacaoDisponibilidade.update(valor => valor + 1);
  }

  confirmarReserva() {
    const mesa = this.selecionada();
    const sessao = this.sessao();
    if (this.confirmando() || !mesa || !sessao || !this.data()) return;
    this.confirmando.set(true);
    this.erroReserva.set('');
    this.sucesso.set('');
    this.reservas.confirmar(mesa.id, this.data(), sessao.token)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: reserva => {
          this.confirmando.set(false);
          if (this.sessao()?.token !== sessao.token) return;
          this.sucesso.set(`Reserva #${reserva.id} confirmada: mesa ${reserva.mesa.codigo}, dia ${formatarData(reserva.data)}, para ${reserva.solicitante.nome}.`);
          this.atualizarDisponibilidade();
        },
        error: (erro: HttpErrorResponse) => {
          this.confirmando.set(false);
          if (this.sessao()?.token !== sessao.token) return;
          if (erro.status === 401) {
            this.sair(true);
            return;
          }
          const detalhe = typeof erro.error?.detail === 'string' ? erro.error.detail : '';
          this.erroReserva.set(erro.status === 409
            ? `${detalhe || 'A mesa ou o seu dia já possui uma reserva.'} A disponibilidade foi atualizada; revise a seleção.`
            : erro.status === 400 ? (detalhe || 'Verifique a data e a mesa selecionadas.')
            : 'Não foi possível confirmar a reserva. Atualize a disponibilidade antes de tentar novamente.');
          this.atualizarDisponibilidade();
        },
      });
  }

  sair(expirada = false) {
    localStorage.removeItem(TOKEN_KEY);
    this.sessao.set(null);
    this.selecionada.set(null);
    this.erroReserva.set('');
    this.sucesso.set('');
    this.senha = '';
    this.erro.set(expirada ? 'Sua sessão expirou. Entre novamente.' : '');
  }

  get tokenAtual(): string {
    return this.sessao()?.token ?? '';
  }
}
