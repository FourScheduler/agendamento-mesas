import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Sessao {
  token: string;
  tipo: string;
  usuario: { id: number; nome: string; email: string; perfil: string };
}

const TOKEN_KEY = 'agendamento_mesas_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tokenArmazenado = signal(localStorage.getItem(TOKEN_KEY) ?? '');
  private restauracao: Promise<boolean> | null = null;

  readonly sessao = signal<Sessao | null>(null);
  readonly autenticado = computed(() => !!this.sessao()?.token);
  readonly usuario = computed(() => this.sessao()?.usuario ?? null);
  readonly token = computed(() => this.sessao()?.token ?? this.tokenArmazenado());

  login(email: string, senha: string) {
    return this.http.post<Sessao>(`${environment.apiUrl}/auth/login`, { email: email.trim(), senha }).pipe(
      tap(sessao => {
        localStorage.setItem(TOKEN_KEY, sessao.token);
        this.tokenArmazenado.set(sessao.token);
        this.sessao.set(sessao);
      }),
    );
  }

  logout(expirada = false) {
    this.limparSessao();
    void this.router.navigate(['/login'], { queryParams: expirada ? { sessao: 'expirada' } : {} });
  }

  restaurarSessaoSeValida(): Promise<boolean> {
    const token = this.token();
    if (!token) return Promise.resolve(false);
    if (this.sessao()?.token === token) return Promise.resolve(true);
    if (this.restauracao) return this.restauracao;

    this.restauracao = firstValueFrom(this.http.get<Sessao['usuario']>(`${environment.apiUrl}/auth/perfil`, {
      headers: { Authorization: `Bearer ${token}` },
    })).then(perfil => {
      // Uma resposta antiga não pode restaurar uma sessão encerrada durante a consulta.
      if (this.tokenArmazenado() !== token) return false;
      this.sessao.set({ token, tipo: 'Bearer', usuario: perfil });
      return true;
    }).catch(() => {
      if (this.tokenArmazenado() === token) this.limparSessao();
      return false;
    }).finally(() => { this.restauracao = null; });
    return this.restauracao;
  }

  private limparSessao() {
    localStorage.removeItem(TOKEN_KEY);
    this.tokenArmazenado.set('');
    this.sessao.set(null);
  }
}
