import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'reg',
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'user',
    canActivate: [authGuard],
    loadComponent: () => import('./features/user/user-layout/user-layout.component').then(m => m.UserLayoutComponent),
    canActivateChild: [roleGuard(['user'])],
    children: [
      {
        path: '',
        redirectTo: 'databases',
        pathMatch: 'full'
      },
      {
        path: 'databases',
        loadComponent: () => import('./features/user/user-databases/user-databases.component').then(m => m.UserDatabasesComponent)
      },
      {
        path: 'databases/:dbId/reports',
        loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent)
      },
      {
        path: 'databases/:dbId/reports/:reportId/settings',
        loadComponent: () => import('./features/reports/report-settings/report-settings.component').then(m => m.ReportSettingsComponent)
      },
      {
        path: 'linked-chats',
        loadComponent: () => import('./features/user/linked-chats/linked-chats.component').then(m => m.LinkedChatsComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/user/profile/user-profile.component').then(m => m.UserProfileComponent)
      },
      {
        path: 'dashboard',
        redirectTo: 'databases',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () => import('./features/admin/admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    canActivateChild: [roleGuard(['admin'])],
    children: [
      {
        path: '',
        redirectTo: 'users',
        pathMatch: 'full'
      },
      {
        path: 'users',
        loadComponent: () => import('./features/admin/users/admin-users.component').then(m => m.AdminUsersComponent)
      },
      {
        path: 'users/:id/databases',
        loadComponent: () => import('./features/admin/user-databases/admin-user-databases.component').then(m => m.AdminUserDatabasesComponent)
      },
      {
        path: 'users/:id/databases/:dbId/reports',
        loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent)
      },
      {
        path: 'users/:id/databases/:dbId/reports/:reportId/settings',
        loadComponent: () => import('./features/reports/report-settings/report-settings.component').then(m => m.ReportSettingsComponent)
      },
      {
        path: 'users/:id/linked-chats',
        loadComponent: () => import('./features/user/linked-chats/linked-chats.component').then(m => m.LinkedChatsComponent)
      },
      {
        path: 'users/:id',
        loadComponent: () => import('./features/admin/user-settings/admin-user-settings.component').then(m => m.AdminUserSettingsComponent)
      },
      {
        path: 'linked-chats',
        loadComponent: () => import('./features/user/linked-chats/linked-chats.component').then(m => m.LinkedChatsComponent)
      },
      {
        path: 'licenses',
        loadComponent: () => import('./features/admin/licenses/admin-licenses.component').then(m => m.AdminLicensesComponent)
      },
      {
        path: 'licenses/:id',
        loadComponent: () => import('./features/admin/license-settings/admin-license-settings.component').then(m => m.AdminLicenseSettingsComponent)
      },
      {
        path: 'dashboard',
        redirectTo: 'users',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '**',
    redirectTo: '/login'
  }
];
