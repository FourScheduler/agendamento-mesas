import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface ReservaConfirmada {
  readonly id: number;
  readonly data: string;
  readonly status: 'CONFIRMADA';
  readonly criadaEm: string;
  readonly confirmadaEm: string;
  readonly mesa: { readonly id: number; readonly codigo: string; readonly regiao: string };
  readonly solicitante: { readonly id: number; readonly nome: string; readonly email: string };
}

@Injectable({ providedIn: 'root' })
export class ReservaService {
  private readonly http = inject(HttpClient);

  confirmar(mesaId: number, data: string, token: string) {
    return this.http.post<ReservaConfirmada>(`${environment.apiUrl}/reservas`, { mesaId, data }, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}
