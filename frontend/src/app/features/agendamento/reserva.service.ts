import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Reserva } from './reserva';
import { Mesa } from '../mesas/mesa';

@Injectable({ providedIn: 'root' })
export class ReservaService {
  private readonly http = inject(HttpClient);

  listarMinhas(token: string, params?: { status?: string; data?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.data) searchParams.set('data', params.data);
    const query = searchParams.toString();
    return this.http.get<readonly Reserva[]>(`${environment.apiUrl}/reservas/minhas${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  listarDisponiveis(token: string, data: string) {
    return this.http.get<readonly Mesa[]>(`${environment.apiUrl}/mesas/disponiveis`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { data },
    });
  }

  criar(token: string, mesaId: number, data: string) {
    return this.http.post<Reserva>(`${environment.apiUrl}/reservas`, { mesaId, data }, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  confirmar(token: string, id: number) {
    return this.http.post<Reserva>(`${environment.apiUrl}/reservas/${id}/confirmacao`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  cancelar(token: string, id: number) {
    return this.http.patch<Reserva>(`${environment.apiUrl}/reservas/${id}/cancelamento`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}