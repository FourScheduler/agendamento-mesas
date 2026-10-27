import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const LoginGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return await auth.restaurarSessaoSeValida() ? router.createUrlTree(['/agendamento']) : true;
};
