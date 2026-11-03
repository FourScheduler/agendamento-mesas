import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const AdminGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const valida = await auth.restaurarSessaoSeValida();
  if (!valida) {
    const attempted = router.parseUrl(state.url || '/');
    const path = attempted.root.children['primary']?.segments.map(segment => segment.path).join('/');
    const queryParams: Record<string, string> = { retorno: path === 'mapa' ? 'mapa' : 'agendamento' };
    const data = attempted.queryParams['data'];
    const mesaId = attempted.queryParams['mesaId'];
    if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data)) queryParams['data'] = data;
    if (typeof mesaId === 'string' && /^\d+$/.test(mesaId)) queryParams['mesaId'] = mesaId;
    return router.createUrlTree(['/login'], { queryParams });
  }
  const usuario = auth.usuario();
  if (usuario?.perfil === 'ADMIN') return true;
  return router.createUrlTree(['/agendamento']);
};