import { Routes } from '@angular/router';
import { AuthGuard } from './core/auth/auth.guard';
import { LoginGuard } from './core/auth/login.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login-page').then(m => m.LoginPage), title: 'Login | Agendamento de Mesas', canActivate: [LoginGuard] },
  { path: 'agendamento', loadComponent: () => import('./features/agendamento/agendamento-page').then(m => m.AgendamentoPage), title: 'Agendamento | Agendamento de Mesas', canActivate: [AuthGuard] },
  { path: 'minhas-reservas', loadComponent: () => import('./features/minhas-reservas/minhas-reservas-page').then(m => m.MinhasReservasPage), title: 'Minhas Reservas | Agendamento de Mesas', canActivate: [AuthGuard] },
  { path: 'mapa', loadComponent: () => import('./features/mapa/mapa-page').then(m => m.MapaPage), title: 'Mapa de Mesas | Agendamento de Mesas', canActivate: [AuthGuard] },
  { path: '', redirectTo: '/agendamento', pathMatch: 'full' },
  { path: '**', redirectTo: '/agendamento' },
];