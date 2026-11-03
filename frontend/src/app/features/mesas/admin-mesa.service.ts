import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Mesa } from './mesa';

export interface UsuarioAtivo {
  readonly id: number;
  readonly nome: string;
  readonly email: string;
}

export interface FixarMesaRequest {
  readonly usuarioId: number;
}

export interface AlterarResponsavelRequest {
  readonly usuarioId: number;
}

export interface AlterarTipoRequest {
  readonly tipo: 'LIVRE' | 'FIXA';
}

export interface AlterarAtivacaoRequest {
  readonly ativa: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminMesaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin/mesas`;

  listarTodas(termo?: string) {
    let params = new HttpParams();
    if (termo?.trim()) {
      params = params.set('termo', termo.trim());
    }
    return this.http.get<readonly Mesa[]>(`${environment.apiUrl}/mesas`, { params });
  }

  listarUsuariosAtivos() {
    return this.http.get<readonly UsuarioAtivo[]>(`${environment.apiUrl}/admin/usuarios/ativos`);
  }

  fixarMesa(id: number, request: FixarMesaRequest) {
    return this.http.patch<Mesa>(`${this.baseUrl}/${id}/fixar`, request);
  }

  desfixarMesa(id: number) {
    return this.http.patch<Mesa>(`${this.baseUrl}/${id}/desfixar`, {});
  }

  alterarResponsavel(id: number, request: AlterarResponsavelRequest) {
    return this.http.patch<Mesa>(`${this.baseUrl}/${id}/responsavel`, request);
  }

  alterarTipo(id: number, request: AlterarTipoRequest) {
    return this.http.patch<Mesa>(`${this.baseUrl}/${id}/tipo`, request);
  }

  alterarAtivacao(id: number, request: AlterarAtivacaoRequest) {
    return this.http.patch<Mesa>(`${this.baseUrl}/${id}/ativacao`, request);
  }
}