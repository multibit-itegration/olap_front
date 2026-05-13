import { Component, ChangeDetectionStrategy, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { switchMap, finalize } from 'rxjs/operators';
import { AuthService } from '../../../core/api/auth.service';
import { TelegramService } from '../../../core/services/telegram.service';
import { LoginRequest } from '../../../core/api/models/auth.models';
import { formatPhoneForLogin } from '../../../shared/utils/phone-formatter';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly telegramService = inject(TelegramService);
  private readonly router = inject(Router);

  loginForm: FormGroup;
  showPassword = signal(false);
  errorMessage = signal('');
  hasError = signal(false);
  isSubmitting = signal(false);
  isTelegramAuthInProgress = signal(false);
  showLoginForm = signal(true);
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
    // Redirect if already authenticated
    if (this.authService.isAuthenticated() && this.authService.currentUser()) {
      this.redirectByRole();
      return;
    }

    if (this.telegramService.isTelegramLaunch()) {
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
      return;
    }

    this.isTelegramAuthInProgress.set(true);
    this.showLoginForm.set(false);
    this.hasError.set(false);
    this.errorMessage.set('');
    this.startTelegramPhraseRotation();

    this.authService.telegramAuth(initData).pipe(
      switchMap(() => this.authService.loadCurrentUser()),
      finalize(() => {
        this.isTelegramAuthInProgress.set(false);
        this.stopTelegramPhraseRotation();
      })
    ).subscribe({
      next: (user) => {
        if (user.role === 'admin') {
          this.router.navigate(['/admin/dashboard']);
        } else {
          this.router.navigate(['/user/databases']);
        }
      },
      error: (error: HttpErrorResponse) => {
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
    this.isTelegramAuthInProgress.set(true);
    this.showLoginForm.set(false);
    this.hasError.set(false);
    this.errorMessage.set('');
    this.startTelegramPhraseRotation();

    void this.telegramService.initialize().then((isReady) => {
      if (!isReady) {
        this.showTelegramFallback('Не удалось получить данные Telegram. Откройте приложение из Telegram или войдите по номеру телефона.');
        return;
      }

      this.attemptTelegramAuth();
    }).catch(() => {
      this.showTelegramFallback('Не удалось загрузить Telegram. Попробуйте обновить страницу или войдите по номеру телефона.');
    });
  }

  private showTelegramFallback(message: string): void {
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
      })
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
}
