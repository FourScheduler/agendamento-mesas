import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  senha = '';
  readonly entrando = signal(false);
  readonly erro = signal('');

  async entrar() {
    if (this.entrando() || !this.email.trim() || !this.senha) return;
    this.entrando.set(true);
    this.erro.set('');

    try {
      const sessao = await this.auth.login(this.email.trim(), this.senha).toPromise();
      if (sessao) {
        this.auth.sessao.set(sessao);
        this.router.navigate(['/agendamento']);
      }
    } catch (e: any) {
      this.erro.set(e?.status === 401
        ? 'E-mail ou senha inválidos, ou usuário inativo.'
        : 'Não foi possível entrar. Verifique se o backend está em execução e tente novamente.');
    } finally {
      this.senha = '';
      this.entrando.set(false);
    }
  }
}