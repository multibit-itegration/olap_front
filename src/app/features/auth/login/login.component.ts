import { Component, ChangeDetectionStrategy, DestroyRef, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { switchMap, finalize } from 'rxjs/operators';
import { AuthService } from '../../../core/api/auth.service';
import { TelegramService } from '../../../core/services/telegram.service';
import { TelegramAuthDebugDetails, TelegramAuthDebugService } from '../../../core/services/telegram-auth-debug.service';
import { LoginRequest } from '../../../core/api/models/auth.models';
import { formatPhoneForLogin } from '../../../shared/utils/phone-formatter';
import { TelegramAuthDebugPanelComponent } from '../telegram-auth-debug-panel/telegram-auth-debug-panel.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, TelegramAuthDebugPanelComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly telegramService = inject(TelegramService);
  private readonly telegramDebug = inject(TelegramAuthDebugService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  loginForm: FormGroup;
  showPassword = signal(false);
  errorMessage = signal('');
  hasError = signal(false);
  isSubmitting = signal(false);
  isTelegramAuthInProgress = signal(false);
  showLoginForm = signal(true);
  readonly showTelegramDebugPanel = this.isTelegramAuthRoute();
  telegramAuthPhrase = signal('Сверяем цифровой пропуск...');
  loginAuthPhrase = signal('Вход...');

  private readonly loginAuthPhrases = [
    'Вход...',
    'Проверяем пароль...',
    'Ищем ваш профиль...',
    'Собираем рабочее место...',
    'Почти впускаем...'
  ];
  private readonly telegramAuthPhrases = [
    'Сверяем цифровой пропуск...',
    'Ищем ваш Telegram в списке своих...',
    'Проверяем, что ключ подходит к замку...',
    'Открываем дверь в личный кабинет...',
    'Почти внутри, осталось пару байтов...'
  ];
  private loginPhraseTimer?: number;
  private telegramPhraseTimer?: number;

  constructor() {
    this.loginForm = this.fb.group({
      phone: ['', [Validators.required, Validators.pattern(/^\+7\d{10}$/)]],
      password: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.logTelegram('Компонент логина инициализирован', 'info', {
      authenticated: this.authService.isAuthenticated(),
      hasCurrentUser: this.authService.currentUser() !== null,
      telegramLaunch: this.telegramService.isTelegramLaunch()
    });

    if (this.authService.isAuthenticated()) {
      if (this.authService.currentUser()) {
        this.logTelegram('Пользователь уже загружен, перенаправляем по роли', 'success');
        this.redirectByRole();
        return;
      }

      this.logTelegram('Найден сохраненный токен, пробуем загрузить пользователя');
      this.resumeAuthenticatedSession();
      return;
    }

    if (this.isTelegramAuthContext()) {
      this.logTelegram('Нет сохраненного токена, начинаем Telegram init');
      this.prepareTelegramAuth();
    }
  }

  ngOnDestroy(): void {
    this.stopLoginPhraseRotation();
    this.stopTelegramPhraseRotation();
  }

  private attemptTelegramAuth(): void {
    const initData = this.telegramService.initData();
    if (!initData) {
      this.logTelegram('Остановили Telegram auth: initData отсутствует', 'warning');
      return;
    }

    this.logTelegram('Отправляем POST /auth/telegram', 'info', {
      hasInitData: true
    });
    this.isTelegramAuthInProgress.set(true);
    this.showLoginForm.set(false);
    this.hasError.set(false);
    this.errorMessage.set('');
    this.startTelegramPhraseRotation();

    this.authService.telegramAuth(initData).pipe(
      switchMap(() => {
        this.logTelegram('POST /auth/telegram успешен, загружаем GET /users/me', 'success');
        return this.authService.loadCurrentUser();
      }),
      finalize(() => {
        this.logTelegram('Попытка Telegram auth завершилась');
        this.isTelegramAuthInProgress.set(false);
        this.stopTelegramPhraseRotation();
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (user) => {
        this.logTelegram('GET /users/me успешен, перенаправляем в кабинет', 'success', {
          role: user.role
        });

        if (user.role === 'admin') {
          this.router.navigate(['/admin/dashboard']);
        } else {
          this.router.navigate(['/user/databases']);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.logTelegram('Telegram auth завершился ошибкой', 'error', this.httpErrorDetails(error));
        this.showLoginForm.set(true);
        this.hasError.set(true);

        if (error.status === 404) {
          this.errorMessage.set('Аккаунт Telegram не найден. Войдите по номеру телефона.');
        } else {
          this.errorMessage.set('Не удалось войти через Telegram. Войдите по номеру телефона.');
        }
      }
    });
  }

  private prepareTelegramAuth(): void {
    this.logTelegram('Запускаем TelegramService.initialize', 'info', {
      forceTelegramRoute: this.isTelegramAuthRoute()
    });
    this.isTelegramAuthInProgress.set(true);
    this.showLoginForm.set(false);
    this.hasError.set(false);
    this.errorMessage.set('');
    this.startTelegramPhraseRotation();

    void this.telegramService.initialize(8000, this.isTelegramAuthRoute()).then((isReady) => {
      this.logTelegram('TelegramService.initialize вернул результат', isReady ? 'success' : 'warning', {
        ready: isReady,
        hasInitData: this.telegramService.initData() !== null
      });

      if (!isReady) {
        this.showTelegramFallback('Не удалось получить данные Telegram. Откройте приложение из Telegram или войдите по номеру телефона.');
        return;
      }

      this.attemptTelegramAuth();
    }).catch((error: unknown) => {
      this.logTelegram('TelegramService.initialize выбросил ошибку', 'error', {
        reason: error instanceof Error ? error.message : 'unknown'
      });
      this.showTelegramFallback('Не удалось загрузить Telegram. Попробуйте обновить страницу или войдите по номеру телефона.');
    });
  }

  private resumeAuthenticatedSession(): void {
    const isTelegramAuthContext = this.isTelegramAuthContext();
    this.logTelegram('Пробуем восстановить пользователя по сохраненной сессии', 'info', {
      telegramContext: isTelegramAuthContext
    });

    if (isTelegramAuthContext) {
      this.isTelegramAuthInProgress.set(true);
      this.showLoginForm.set(false);
      this.hasError.set(false);
      this.errorMessage.set('');
      this.startTelegramPhraseRotation();
    }

    this.authService.loadCurrentUser().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.logTelegram('Сохраненная сессия восстановлена', 'success');
        this.redirectByRole();
      },
      error: (error: HttpErrorResponse) => {
        this.logTelegram('Не удалось восстановить сохраненную сессию', 'warning', this.httpErrorDetails(error));
        this.authService.logout();

        if (isTelegramAuthContext) {
          this.logTelegram('После сбоя сессии повторяем Telegram init');
          this.prepareTelegramAuth();
          return;
        }

        this.isTelegramAuthInProgress.set(false);
        this.stopTelegramPhraseRotation();
        this.showLoginForm.set(true);
      }
    });
  }

  private isTelegramAuthContext(): boolean {
    return this.telegramService.isTelegramLaunch() || this.isTelegramAuthRoute();
  }

  private isTelegramAuthRoute(): boolean {
    return this.route.snapshot.data['telegramAuth'] === true;
  }

  private showTelegramFallback(message: string): void {
    this.logTelegram('Показан fallback ручного входа', 'warning', {
      message
    });
    this.isTelegramAuthInProgress.set(false);
    this.showLoginForm.set(true);
    this.hasError.set(true);
    this.errorMessage.set(message);
    this.stopTelegramPhraseRotation();
  }

  private startTelegramPhraseRotation(): void {
    this.stopTelegramPhraseRotation();
    this.telegramAuthPhrase.set(this.telegramAuthPhrases[0]);

    let phraseIndex = 0;
    this.telegramPhraseTimer = window.setInterval(() => {
      phraseIndex = (phraseIndex + 1) % this.telegramAuthPhrases.length;
      this.telegramAuthPhrase.set(this.telegramAuthPhrases[phraseIndex]);
    }, 1800);
  }

  private stopTelegramPhraseRotation(): void {
    if (this.telegramPhraseTimer !== undefined) {
      clearInterval(this.telegramPhraseTimer);
      this.telegramPhraseTimer = undefined;
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  formatPhone(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatPhoneForLogin(input.value);
    this.loginForm.patchValue({ phone: formatted.rawValue });
  }

  onSubmit(): void {
    if (this.loginForm.invalid || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.hasError.set(false);
    this.errorMessage.set('');
    this.startLoginPhraseRotation();

    const loginData: LoginRequest = this.loginForm.value;

    this.authService.login(loginData).pipe(
      switchMap(() => this.authService.loadCurrentUser()),
      finalize(() => {
        this.isSubmitting.set(false);
        this.stopLoginPhraseRotation();
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (user) => {
        if (user.role === 'admin') {
          this.router.navigate(['/admin/dashboard']);
        } else {
          this.router.navigate(['/user/databases']);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.hasError.set(true);

        switch (error.status) {
          case 502:
            this.errorMessage.set('УПС, ЧТО-ТО ПОЛОМАЛОСЬ, ПОПРОБУЙТЕ ПОЗЖЕ');
            break;
          case 404:
            this.errorMessage.set('Пользователь не найден');
            break;
          case 403:
            this.errorMessage.set('Неверный пароль');
            break;
          default:
            this.errorMessage.set('Произошла ошибка при входе');
        }
      }
    });
  }

  private startLoginPhraseRotation(): void {
    this.stopLoginPhraseRotation();
    this.loginAuthPhrase.set(this.loginAuthPhrases[0]);

    let phraseIndex = 0;
    this.loginPhraseTimer = window.setInterval(() => {
      phraseIndex = (phraseIndex + 1) % this.loginAuthPhrases.length;
      this.loginAuthPhrase.set(this.loginAuthPhrases[phraseIndex]);
    }, 1500);
  }

  private stopLoginPhraseRotation(): void {
    if (this.loginPhraseTimer !== undefined) {
      clearInterval(this.loginPhraseTimer);
      this.loginPhraseTimer = undefined;
    }
  }

  private redirectByRole(): void {
    const role = this.authService.userRole();
    this.router.navigate([role === 'admin' ? '/admin/dashboard' : '/user/databases']);
  }

  private logTelegram(
    message: string,
    level: 'info' | 'success' | 'warning' | 'error' = 'info',
    details?: TelegramAuthDebugDetails
  ): void {
    if (this.showTelegramDebugPanel) {
      this.telegramDebug.log('Login', message, level, details);
    }
  }

  private httpErrorDetails(error: HttpErrorResponse): TelegramAuthDebugDetails {
    return {
      status: error.status,
      statusText: error.statusText || null,
      url: error.url,
      detail: this.extractBackendDetail(error.error)
    };
  }

  private extractBackendDetail(errorBody: unknown): string | undefined {
    if (!errorBody || typeof errorBody !== 'object') {
      return undefined;
    }

    const detail = (errorBody as Record<string, unknown>)['detail'];
    return typeof detail === 'string' ? detail : undefined;
  }
}
