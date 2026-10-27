import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Mesa } from './mesa';

@Injectable({ providedIn: 'root' })
export class MesaService {
  private readonly http = inject(HttpClient);

  listarDisponiveis(data: string, token: string) {
    return this.http.get<readonly Mesa[]>(`${environment.apiUrl}/mesas/disponiveis`, {
      params: { data }, headers: { Authorization: `Bearer ${token}` },
    });
  }

  listar(token: string) {
    return this.http.get<readonly Mesa[]>(`${environment.apiUrl}/mesas`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}
