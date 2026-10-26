import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
  private readonly persistirToken = effect(() => {
    const s = this.sessao();
    if (s?.token) localStorage.setItem(TOKEN_KEY, s.token);
    else if (s === null) localStorage.removeItem(TOKEN_KEY);
  });

  readonly sessao = signal<Sessao | null>(null);
  readonly autenticado = computed(() => !!this.sessao()?.token);
  readonly usuario = computed(() => this.sessao()?.usuario ?? null);
  readonly token = computed(() => this.sessao()?.token ?? localStorage.getItem(TOKEN_KEY) ?? '');

  constructor() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      this.sessao.set({ token, tipo: '', usuario: { id: 0, nome: '', email: '', perfil: '' } });
    }
  }

  login(email: string, senha: string) {
    return this.http.post<Sessao>(`${environment.apiUrl}/auth/login`, { email: email.trim(), senha });
  }

  logout() {
    this.sessao.set(null);
  }

  restaurarSessaoSeValida(): Promise<boolean> {
    const token = this.token();
    if (!token) return Promise.resolve(false);

    return new Promise((resolve) => {
      this.http.get(`${environment.apiUrl}/auth/perfil`, { headers: { Authorization: `Bearer ${token}` } }).subscribe({
        next: (perfil: any) => {
          this.sessao.set({ token, tipo: 'Bearer', usuario: perfil });
          resolve(true);
        },
        error: () => {
          this.sessao.set(null);
          resolve(false);
        },
      });
    });
  }
}