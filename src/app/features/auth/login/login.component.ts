import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
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
export class LoginComponent implements OnInit {
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
  // TODO: убрать после настройки бэкенд авторизации
  debugInitData = signal('');
  debugCopied = signal(false);

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

    // TODO: убрать после настройки бэкенд авторизации
    const initData = this.telegramService.initData();
    if (initData) {
      this.debugInitData.set(initData);
    }

    // Attempt Telegram auto-auth if available
    if (this.telegramService.isTelegramWebApp() && this.telegramService.initData()) {
      this.attemptTelegramAuth();
    }
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

    this.authService.telegramAuth(initData).pipe(
      switchMap(() => this.authService.loadCurrentUser()),
      finalize(() => this.isTelegramAuthInProgress.set(false))
    ).subscribe({
      next: (user) => {
        if (user.role === 'admin') {
          this.router.navigate(['/admin/dashboard']);
        } else {
          this.router.navigate(['/user/databases']);
        }
      },
      error: (error: HttpErrorResponse) => {
        // Telegram auth failed, show manual login form
        this.showLoginForm.set(true);
        this.hasError.set(true);

        if (error.status === 404) {
          this.errorMessage.set('Telegram account not found. Please login manually.');
        } else {
          this.errorMessage.set('Telegram authentication failed. Please login manually.');
        }
      }
    });
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

    const loginData: LoginRequest = this.loginForm.value;

    this.authService.login(loginData).pipe(
      switchMap(() => this.authService.loadCurrentUser()),
      finalize(() => this.isSubmitting.set(false))
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

  // TODO: убрать после настройки бэкенд авторизации
  copyInitData(): void {
    navigator.clipboard.writeText(this.debugInitData()).then(() => {
      this.debugCopied.set(true);
      setTimeout(() => this.debugCopied.set(false), 2000);
    });
  }

  private redirectByRole(): void {
    const role = this.authService.userRole();
    this.router.navigate([role === 'admin' ? '/admin/dashboard' : '/user/databases']);
  }
}
