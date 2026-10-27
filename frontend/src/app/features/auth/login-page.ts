import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
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
  private readonly route = inject(ActivatedRoute);

  email = '';
  senha = '';
  readonly entrando = signal(false);
  readonly erro = signal(this.route.snapshot.queryParamMap.get('sessao') === 'expirada'
    ? 'Sua sessão expirou. Entre novamente.' : '');

  async entrar() {
    if (this.entrando() || !this.email.trim() || !this.senha) return;
    this.entrando.set(true);
    this.erro.set('');

    try {
      await firstValueFrom(this.auth.login(this.email.trim(), this.senha));
      void this.router.navigate(['/agendamento']);
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
