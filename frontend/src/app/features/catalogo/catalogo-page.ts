import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { PlantaMesas } from '../planta/planta-mesas';
import { Mesa } from '../mesas/mesa';
import { Topbar } from '../../shared/topbar/topbar';

interface Sessao {
  token: string;
  tipo: string;
  usuario: { id: number; nome: string; email: string; perfil: string };
}

const TOKEN_KEY = 'agendamento_mesas_token';

function salvarToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
function lerToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
function limparToken() {
  localStorage.removeItem(TOKEN_KEY);
}

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
  readonly erro = signal('');
  readonly selecionada = signal<Mesa | null>(null);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Restaura sessão do localStorage ao iniciar
    const token = lerToken();
    if (token) {
      // Faz uma chamada leve para validar o token (ex.: /api/mesas ou /auth/me)
      // Aqui apenas reaplicamos o token; a planta fará a chamada real e tratará 401.
      this.sessao.set({ token, tipo: '', usuario: { id: 0, nome: '', email: '', perfil: '' } });
    }
  }

  private readonly persistirToken = effect(() => {
    const s = this.sessao();
    if (s?.token) salvarToken(s.token);
    else if (s === null) limparToken(); // logout explícito
  });

  entrar() {
    if (this.entrando() || !this.email.trim() || !this.senha) return;
    this.entrando.set(true);
    this.erro.set('');
    this.http.post<Sessao>(`${environment.apiUrl}/auth/login`, {
      email: this.email.trim(), senha: this.senha,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sessao => {
        this.senha = '';
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

  sair(expirada = false) {
    this.sessao.set(null);
    this.selecionada.set(null);
    this.senha = '';
    this.erro.set(expirada ? 'Sua sessão expirou. Entre novamente.' : '');
  }

  // Token atual para passar à planta (signal ou localStorage)
  get tokenAtual(): string {
    return this.sessao()?.token ?? lerToken() ?? '';
  }
}
