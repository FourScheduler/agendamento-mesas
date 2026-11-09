import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';

export const loggingInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(`${environment.apiUrl}/`)) return next(request);
  const logger = inject(LoggerService);
  const recebida = request.headers.get('X-Correlation-ID') ?? request.headers.get('Idempotency-Key') ?? '';
  const correlationId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(recebida)
    ? recebida : crypto.randomUUID();
  const inicio = performance.now();
  logger.debug('api.inicio', { correlationId });
  return next(request.clone({ setHeaders: { 'X-Correlation-ID': correlationId } })).pipe(tap({
    next: resposta => {
      if (resposta instanceof HttpResponse) logger.info('api.resposta', {
        correlationId, status: resposta.status, duracaoMs: Math.round(performance.now() - inicio),
      });
    },
    error: (erro: unknown) => logger.error('api.falha', {
      correlationId, status: erro instanceof HttpErrorResponse ? erro.status : undefined,
      duracaoMs: Math.round(performance.now() - inicio),
    }),
  }));
};
