import { ErrorHandler, Injectable, inject } from '@angular/core';
import { LoggingService } from './logging.service';

/** Captura também rejeições assíncronas via provideBrowserGlobalErrorListeners. */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly logger = inject(LoggingService);

  handleError(_erro: unknown): void {
    // Mensagens/stacks arbitrários podem conter respostas HTTP ou dados pessoais.
    this.logger.registrar('ERROR', 'Falha não tratada na interface', { correlationId: crypto.randomUUID() });
  }
}
