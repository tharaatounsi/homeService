import { Routes } from '@angular/router';

import { authGuard, roleGuard } from './core/guards';
import { LoginComponent } from './features/auth/login.component';
import { RegisterComponent } from './features/auth/register.component';

const roleHome = () =>
  import('./features/home/role-home.component').then((m) => m.RoleHomeComponent);

const clientProfile = () =>
  import('./features/client/client-profile.component').then((m) => m.ClientProfileComponent);

const technicianDashboard = () =>
  import('./features/technician/technician-dashboard.component').then(
    (m) => m.TechnicianDashboardComponent
  );

const adminDashboard = () =>
  import('./features/admin/admin-dashboard.component').then((m) => m.AdminDashboardComponent);


export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  {
    path: 'client',
    canActivate: [authGuard, roleGuard(['client'])],
    data: { title: 'Espace Client' },
    loadComponent: clientProfile,
  },
  {
    path: 'client/profile',
    canActivate: [authGuard, roleGuard(['client'])],
    data: { title: 'Mon profil client' },
    loadComponent: clientProfile,
  },
  {
    path: 'technician',
    canActivate: [authGuard, roleGuard(['technician'])],
    data: { title: 'Espace Technicien' },
    loadComponent: technicianDashboard,
  },
  {
    path: 'technician/profile',
    canActivate: [authGuard, roleGuard(['technician'])],
    data: { title: 'Profil & Planning Technicien' },
    loadComponent: technicianDashboard,
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(['admin'])],
    data: { title: 'Espace administrateur' },
    loadComponent: adminDashboard,
  },

  { path: '**', redirectTo: 'login' },
];
