import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const isApiRequest = request.url.startsWith(environment.apiUrl);
  const isLogin = request.url.endsWith('/auth/login');
  const isProfile = request.url.endsWith('/auth/perfil');
  const token = auth.token();
  const authenticatedRequest = isApiRequest && token && !isLogin
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authenticatedRequest).pipe(catchError(error => {
    // Login 401s are credential errors. Profile 401s are handled by session restoration
    // and its route guards, avoiding duplicate navigation.
    if (isApiRequest && !isLogin && !isProfile && error instanceof HttpErrorResponse && error.status === 401) {
      auth.logout(true);
    }
    return throwError(() => error);
  }));
};
