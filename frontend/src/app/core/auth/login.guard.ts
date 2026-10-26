import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const LoginGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('agendamento_mesas_token');

  if (token) {
    router.navigate(['/agendamento']);
    return false;
  }

  return true;
};