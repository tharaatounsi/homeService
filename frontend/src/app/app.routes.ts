import { Routes } from '@angular/router';

import { authGuard, roleGuard } from './core/guards';
import { LoginComponent } from './features/auth/login.component';
import { RegisterComponent } from './features/auth/register.component';

const roleHome = () =>
  import('./features/home/role-home.component').then((m) => m.RoleHomeComponent);

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  {
    path: 'client',
    canActivate: [authGuard, roleGuard(['client'])],
    data: { title: 'Espace client' },
    loadComponent: roleHome,
  },
  {
    path: 'technician',
    canActivate: [authGuard, roleGuard(['technician'])],
    data: { title: 'Espace technicien' },
    loadComponent: roleHome,
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(['admin'])],
    data: { title: 'Espace administrateur' },
    loadComponent: roleHome,
  },
  { path: '**', redirectTo: 'login' },
];
