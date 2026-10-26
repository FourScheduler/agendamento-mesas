import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { PlantaMesas } from './planta-mesas';
import { Mesa } from './mesa';
import { Topbar } from '../../shared/topbar/topbar';

interface Sessao {
  token: string;
  tipo: string;
  usuario: { id: number; nome: string; email: string; perfil: string };
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
}
