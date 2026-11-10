import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export type NivelLog = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export interface ContextoLog {
  correlationId?: string;
  metodo?: string;
  rota?: string;
  status?: number;
  duracaoMs?: number;
  reservaId?: number;
  mesaId?: number;
}

/** Contexto permitido por lista: nunca recebe body, credenciais, token ou texto da API. */
@Injectable({ providedIn: 'root' })
export class LoggingService {
  registrar(nivel: NivelLog, evento: string, contexto: ContextoLog = {}) {
    if (environment.production && (nivel === 'DEBUG' || nivel === 'INFO')) return;
    const seguro: Record<string, string | number> = {};
    for (const campo of ['correlationId', 'metodo', 'rota', 'status', 'duracaoMs', 'reservaId', 'mesaId'] as const) {
      const valor = contexto[campo];
      if (typeof valor === 'string' || typeof valor === 'number') seguro[campo] = valor;
    }
    const metodo = nivel === 'ERROR' ? 'error' : nivel === 'WARN' ? 'warn' : nivel === 'DEBUG' ? 'debug' : 'info';
    console[metodo](`[${nivel}] ${evento}`, seguro);
  }
}
