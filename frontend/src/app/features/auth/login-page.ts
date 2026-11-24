import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';

const RETORNO_MICROSOFT = 'agendamento_mesas_retorno_microsoft';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private retornoMicrosoft: URLSearchParams | null = null;

  email = '';
  senha = '';
  readonly urlMicrosoft = `${environment.apiUrl}/auth/sso/autorizar/microsoft`;
  readonly entrando = signal(false);
  readonly conectandoMicrosoft = signal(false);
  readonly erro = signal(this.route.snapshot.queryParamMap.get('sessao') === 'expirada'
    ? 'Sua sessão expirou. Entre novamente.' : '');

  ngOnInit(): void {
    const status = this.route.snapshot.queryParamMap.get('microsoft');
    if (!status) return;

    this.retornoMicrosoft = new URLSearchParams(sessionStorage.getItem(RETORNO_MICROSOFT) ?? '');
    sessionStorage.removeItem(RETORNO_MICROSOFT);
    switch (status) {
      case 'sucesso':
        void this.concluirMicrosoft();
        break;
      case 'cancelado':
        this.erro.set('O login com a Microsoft foi cancelado. Você pode tentar novamente.');
        break;
      case 'indisponivel':
        this.erro.set('O acesso com a Microsoft está indisponível neste ambiente.');
        break;
      default:
        this.erro.set('Não foi possível entrar com a Microsoft. Tente novamente.');
    }
  }

  prepararMicrosoft(evento: MouseEvent): void {
    if (this.entrando() || this.conectandoMicrosoft()) {
      evento.preventDefault();
      return;
    }

    const { rota, queryParams } = this.destino();
    sessionStorage.setItem(RETORNO_MICROSOFT, new URLSearchParams({ retorno: rota.slice(1), ...queryParams }).toString());
  }

  async entrar() {
    if (this.entrando() || this.conectandoMicrosoft() || !this.email.trim() || !this.senha) return;
    this.entrando.set(true);
    this.erro.set('');

    try {
      await firstValueFrom(this.auth.login(this.email.trim(), this.senha));
      const { rota, queryParams } = this.destino();
      void this.router.navigate([rota], { queryParams });
    } catch (erro) {
      this.erro.set(erro instanceof HttpErrorResponse && erro.status === 401
        ? 'E-mail ou senha inválidos, ou usuário inativo.'
        : 'Não foi possível entrar. Verifique se o backend está em execução e tente novamente.');
    } finally {
      this.senha = '';
      this.entrando.set(false);
    }
  }

  private async concluirMicrosoft(): Promise<void> {
    this.conectandoMicrosoft.set(true);
    try {
      await firstValueFrom(this.auth.concluirLoginMicrosoft());
      const { rota, queryParams } = this.destino();
      await this.router.navigate([rota], { queryParams, replaceUrl: true });
    } catch (erro) {
      this.erro.set(erro instanceof HttpErrorResponse && erro.status === 403
        ? 'Sua conta Microsoft precisa estar vinculada a um cadastro ativo. Fale com a administração.'
        : 'Não foi possível concluir o login com a Microsoft. Tente novamente.');
    } finally {
      this.conectandoMicrosoft.set(false);
    }
  }

  private destino() {
    const params = this.retornoMicrosoft ?? this.route.snapshot.queryParamMap;
    const rota = params.get('retorno') === 'agendamento' ? '/agendamento' : '/mapa';
    const data = params.get('data');
    const mesaId = params.get('mesaId');
    const queryParams: Record<string, string> = {};
    if (data && /^\d{4}-\d{2}-\d{2}$/.test(data)) queryParams['data'] = data;
    if (mesaId && /^\d+$/.test(mesaId)) queryParams['mesaId'] = mesaId;
    return { rota, queryParams };
  }
}
