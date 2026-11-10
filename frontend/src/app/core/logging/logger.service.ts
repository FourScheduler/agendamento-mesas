import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

type NivelLog = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
interface ContextoLog {
  correlationId?: string;
  status?: number;
  duracaoMs?: number;
  reservaId?: number;
  mesaId?: number;
}

@Injectable({ providedIn: 'root' })
export class LoggerService {
  debug(evento: string, contexto: ContextoLog = {}) { this.registrar('DEBUG', evento, contexto); }
  info(evento: string, contexto: ContextoLog = {}) { this.registrar('INFO', evento, contexto); }
  warn(evento: string, contexto: ContextoLog = {}) { this.registrar('WARN', evento, contexto); }
  error(evento: string, contexto: ContextoLog = {}) { this.registrar('ERROR', evento, contexto); }

  private registrar(nivel: NivelLog, evento: string, contexto: ContextoLog) {
    if (environment.production && (nivel === 'DEBUG' || nivel === 'INFO')) return;
    const metodo = nivel === 'DEBUG' ? 'debug' : nivel === 'INFO' ? 'info' : nivel === 'WARN' ? 'warn' : 'error';
    // Whitelist: nunca serialize requests, respostas, headers ou exceções.
    console[metodo](`[${nivel}] ${evento}`, {
      correlationId: contexto.correlationId,
      status: contexto.status,
      duracaoMs: contexto.duracaoMs,
      reservaId: contexto.reservaId,
      mesaId: contexto.mesaId,
    });
  }
}
