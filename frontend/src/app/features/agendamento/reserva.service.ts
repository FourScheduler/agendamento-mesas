import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Reserva, ReservaConfirmada } from './reserva';
import { Mesa } from '../mesas/mesa';

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

  criar(mesaId: number, data: string) {
    return this.http.post<ReservaConfirmada>(`${environment.apiUrl}/reservas`, { mesaId, data });
  }

  cancelar(id: number) {
    return this.http.patch<Reserva>(`${environment.apiUrl}/reservas/${id}/cancelamento`, {});
  }
}
