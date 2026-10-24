import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/mesas/catalogo-page').then(m => m.CatalogoPage), title: 'Mesas | Portal' },
  { path: '**', redirectTo: '' },
];
