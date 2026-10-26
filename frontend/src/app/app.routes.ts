import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/catalogo/catalogo-page').then(m => m.CatalogoPage), title: 'Mesas | Portal' },
  { path: '**', redirectTo: '' },
];
