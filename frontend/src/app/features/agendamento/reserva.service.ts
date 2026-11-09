import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Reserva } from './reserva';
import { Mesa } from '../mesas/mesa';
import { UsuarioAdminResumo } from '../../core/auth/auth.service';
import { AuthService } from '../../core/auth/auth.service';
import { map } from 'rxjs/operators';

export interface PaginaReservas {
  conteudo: Reserva[];
  pagina: number;
  tamanho: number;
  totalRegistros: number;
  totalPaginas: number;
}

@Injectable({ providedIn: 'root' })
export class ReservaService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  listarMinhas(params?: { status?: string; data?: string; dataInicio?: string; dataFim?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.data) searchParams.set('data', params.data);
    if (params?.dataInicio) searchParams.set('dataInicio', params.dataInicio);
    if (params?.dataFim) searchParams.set('dataFim', params.dataFim);
    const query = searchParams.toString();
    return this.http.get<readonly Reserva[]>(`${environment.apiUrl}/reservas/minhas${query ? `?${query}` : ''}`);
  }

  listarTodas(params?: { status?: string; data?: string; dataInicio?: string; dataFim?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.data) searchParams.set('data', params.data);
    if (params?.dataInicio) searchParams.set('dataInicio', params.dataInicio);
    if (params?.dataFim) searchParams.set('dataFim', params.dataFim);
    const query = searchParams.toString();
    return this.http.get<readonly Reserva[]>(`${environment.apiUrl}/admin/reservas${query ? `?${query}` : ''}`);
  }

  listarDisponiveis(data: string) {
    return this.http.get<readonly Mesa[]>(`${environment.apiUrl}/mesas/disponiveis`, {
      params: { data },
    });
  }

  listarPagina(admin: boolean, params: { canceladas: boolean; pagina: number; tamanho: number;
    status?: string; dataInicio?: string; dataFim?: string }) {
    const rota = admin ? 'admin/reservas/pagina' : 'reservas/minhas/pagina';
    return this.http.get<PaginaReservas>(`${environment.apiUrl}/${rota}`, { params });
  }

  /** Lista usuários ativos (rota administrativa). */
  buscarUsuariosAtivos(termo: string) {
    return this.http.get<readonly UsuarioAdminResumo[]>(`${environment.apiUrl}/admin/usuarios/busca`, {
      params: { termo },
    });
  }

  criar(mesaId: number, data: string, solicitanteId?: number, chave?: string) {
    const body: { mesaId: number; data: string; solicitanteId?: number } = { mesaId, data };
    if (solicitanteId != null) body.solicitanteId = solicitanteId;
    return this.http.post<Reserva>(`${environment.apiUrl}/reservas`, body, {
      headers: chave ? { 'Idempotency-Key': chave } : {},
    });
  }

  consultarConfirmacao(chave: string) {
    return this.http.get<Reserva>(`${environment.apiUrl}/reservas/confirmacoes/${encodeURIComponent(chave)}`, {
      headers: { 'X-Correlation-ID': chave },
    });
  }

  cancelar(id: number) {
    return this.http.patch<void>(`${environment.apiUrl}/reservas/${id}/cancelamento`, {});
  }

  /** Busca a reserva do usuário atual (ou de qualquer usuário se admin) para uma mesa e data específicas. */
  buscarReservaPorMesaEData(mesaId: number, data: string) {
    const isAdmin = this.auth.usuario()?.perfil === 'ADMIN';
    const lista$ = isAdmin ? this.listarTodas({ data }) : this.listarMinhas({ data });
    return lista$.pipe(
      map(reservas => reservas.find(r => r.mesa.id === mesaId && r.status !== 'CANCELADA') ?? null)
    );
  }
}
