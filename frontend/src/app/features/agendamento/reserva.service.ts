import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Reserva, ReservaConfirmada } from './reserva';
import { Mesa } from '../mesas/mesa';
import { UsuarioAdminResumo } from '../../core/auth/auth.service';

@Injectable({ providedIn: 'root' })
export class ReservaService {
  private readonly http = inject(HttpClient);

  listarMinhas(params?: { status?: string; data?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.data) searchParams.set('data', params.data);
    const query = searchParams.toString();
    return this.http.get<readonly Reserva[]>(`${environment.apiUrl}/reservas/minhas${query ? `?${query}` : ''}`);
  }

  listarDisponiveis(data: string) {
    return this.http.get<readonly Mesa[]>(`${environment.apiUrl}/mesas/disponiveis`, {
      params: { data },
    });
  }

  /** Lista usuários ativos (rota administrativa). */
  listarUsuariosAtivos() {
    return this.http.get<readonly UsuarioAdminResumo[]>(`${environment.apiUrl}/admin/usuarios`);
  }

  criar(mesaId: number, data: string, solicitanteId?: number) {
    const body: { mesaId: number; data: string; solicitanteId?: number } = { mesaId, data };
    if (solicitanteId != null) body.solicitanteId = solicitanteId;
    return this.http.post<ReservaConfirmada>(`${environment.apiUrl}/reservas`, body);
  }

  cancelar(id: number) {
    return this.http.patch<Reserva>(`${environment.apiUrl}/reservas/${id}/cancelamento`, {});
  }
}
