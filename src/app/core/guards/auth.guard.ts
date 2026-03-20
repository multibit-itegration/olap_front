import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../api/auth.service';
import { TelegramService } from '../services/telegram.service';
import { map, catchError, of, switchMap } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const telegramService = inject(TelegramService);
  const router = inject(Router);

  // Not authenticated: check if we can auto-auth via Telegram
  if (!authService.isAuthenticated()) {
    // Attempt Telegram auto-auth if initData is available
    if (telegramService.isTelegramWebApp() && telegramService.initData()) {
      return authService.telegramAuth(telegramService.initData()!).pipe(
        switchMap(() => authService.loadCurrentUser()),
        map(() => true),
        catchError(() => {
          // Telegram auth failed, redirect to login for manual auth
          return of(router.createUrlTree(['/login']));
        })
      );
    }

    // No token and not in Telegram, redirect to login
    return router.createUrlTree(['/login']);
  }

  // Page refresh: token exists but user not loaded yet
  if (authService.currentUser() === null) {
    return authService.loadCurrentUser().pipe(
      map(() => true),
      catchError(() => {
        authService.logout();
        return of(router.createUrlTree(['/login']));
      })
    );
  }

  return true;
};
