import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../api/auth.service';
import { TelegramService } from '../services/telegram.service';
import { TelegramAuthDebugService } from '../services/telegram-auth-debug.service';
import { map, catchError, of, switchMap, from } from 'rxjs';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const telegramService = inject(TelegramService);
  const telegramDebug = inject(TelegramAuthDebugService);
  const router = inject(Router);

  telegramDebug.log('Auth guard', 'Проверяем закрытый route', 'info', {
    target: state.url,
    authenticated: authService.isAuthenticated(),
    hasCurrentUser: authService.currentUser() !== null,
    telegramLaunch: telegramService.isTelegramLaunch()
  });

  const authenticateFromTelegram = () => from(telegramService.initialize()).pipe(
    switchMap((isReady) => {
      const initData = telegramService.initData();

      if (!isReady || !initData) {
        telegramDebug.log('Auth guard', 'Telegram re-auth невозможен, уходим на /login', 'warning', {
          ready: isReady,
          hasInitData: initData !== null
        });
        return of(router.createUrlTree(['/login']));
      }

      telegramDebug.log('Auth guard', 'Пробуем Telegram re-auth из guard');
      return authService.telegramAuth(initData).pipe(
        switchMap(() => authService.loadCurrentUser()),
        map(() => {
          telegramDebug.log('Auth guard', 'Telegram re-auth из guard успешен', 'success');
          return true;
        })
      );
    }),
    catchError(() => {
      telegramDebug.log('Auth guard', 'Telegram re-auth из guard завершился ошибкой', 'error');
      return of(router.createUrlTree(['/login']));
    })
  );

  // Not authenticated: check if we can auto-auth via Telegram
  if (!authService.isAuthenticated()) {
    if (telegramService.isTelegramLaunch()) {
      return authenticateFromTelegram();
    }

    // No token and not in Telegram, redirect to login
    telegramDebug.log('Auth guard', 'Нет сессии и Telegram launch, уходим на /login', 'warning');
    return router.createUrlTree(['/login']);
  }

  // Page refresh: token exists but user not loaded yet
  if (authService.currentUser() === null) {
    return authService.loadCurrentUser().pipe(
      map(() => true),
      catchError(() => {
        telegramDebug.log('Auth guard', 'Сохраненная сессия в guard не восстановилась', 'warning');
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
