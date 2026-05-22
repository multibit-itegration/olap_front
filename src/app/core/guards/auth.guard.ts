import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../api/auth.service';
import { TelegramService } from '../services/telegram.service';
import { map, catchError, of, switchMap, from } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const telegramService = inject(TelegramService);
  const router = inject(Router);

  const authenticateFromTelegram = () => from(telegramService.initialize()).pipe(
    switchMap((isReady) => {
      const initData = telegramService.initData();

      if (!isReady || !initData) {
        return of(router.createUrlTree(['/login']));
      }

      return authService.telegramAuth(initData).pipe(
        switchMap(() => authService.loadCurrentUser()),
        map(() => true)
      );
    }),
    catchError(() => of(router.createUrlTree(['/login'])))
  );

  // Not authenticated: check if we can auto-auth via Telegram
  if (!authService.isAuthenticated()) {
    if (telegramService.isTelegramLaunch()) {
      return authenticateFromTelegram();
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

        if (telegramService.isTelegramLaunch()) {
          return authenticateFromTelegram();
        }

        return of(router.createUrlTree(['/login']));
      })
    );
  }

  return true;
};
