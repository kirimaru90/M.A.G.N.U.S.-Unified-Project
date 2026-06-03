import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then((m) => m.LoginPage),
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell').then((m) => m.ShellComponent),
    canMatch: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'campaigns' },
      {
        path: 'campaigns',
        loadComponent: () => import('./features/campaigns/campaigns').then((m) => m.CampaignsPage),
      },
      {
        path: 'campaigns/:id',
        loadComponent: () =>
          import('./features/campaigns/campaign-detail-page').then((m) => m.CampaignDetailPage),
      },
      {
        path: 'users',
        loadComponent: () => import('./features/users/users').then((m) => m.UsersPage),
      },
      {
        path: 'users/:id',
        loadComponent: () =>
          import('./features/users/user-detail-page').then((m) => m.UserDetailPage),
      },
      {
        path: 'campaigns/:campaignId/terminals',
        loadComponent: () =>
          import('./features/terminals/terminals-list').then((m) => m.TerminalsListPage),
      },
      {
        path: 'terminals/:id',
        loadComponent: () =>
          import('./features/terminals/terminal-detail').then((m) => m.TerminalDetailPage),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
