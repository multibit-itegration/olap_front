import { Component, ChangeDetectionStrategy, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/api/auth.service';
import { RegisterRequest } from '../../../core/api/models/auth.models';
import { formatPhoneForRegister } from '../../../shared/utils/phone-formatter';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  registerForm: FormGroup;
  showPassword = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  fieldErrors = signal<{ [key: string]: boolean }>({});
  private redirectTimer?: number;

  constructor() {
    this.registerForm = this.fb.group({
      name: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^\+7\d{10}$/)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    if (this.authService.isAuthenticated() && this.authService.currentUser()) {
      const role = this.authService.userRole();
      this.router.navigate([role === 'admin' ? '/admin/dashboard' : '/user/dashboard']);
    }
  }

  ngOnDestroy(): void {
    if (this.redirectTimer !== undefined) {
      clearTimeout(this.redirectTimer);
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  formatPhone(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatPhoneForRegister(input.value);

    input.value = formatted.displayValue;
    this.registerForm.patchValue({ phone: formatted.rawValue }, { emitEvent: false });
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      return;
    }

    const registerData: RegisterRequest = this.registerForm.value;

    this.authService.register(registerData).subscribe({
      next: (response) => {
        this.fieldErrors.set({});
        this.errorMessage.set('');
        this.successMessage.set('Пользователь успешно создан');

        // Redirect to login after 2 seconds
        this.redirectTimer = window.setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      },
      error: (error: HttpErrorResponse) => {
        this.successMessage.set('');
        const errors: { [key: string]: boolean } = {};

        if (error.status === 502) {
          errors['phone'] = true;
          errors['email'] = true;
          errors['name'] = true;
          errors['password'] = true;
          this.errorMessage.set('УПС, ЧТО-ТО ПОЛОМАЛОСЬ, ПОПРОБУЙТЕ ПОЗЖЕ');
        } else if (error.status === 422 && error.error?.msg?.includes('email')) {
          errors['email'] = true;
          this.errorMessage.set('Неверный формат электронной почты');
        } else if (error.status === 409) {
          const detail = error.error?.detail || '';
          if (detail.includes('email')) {
            errors['email'] = true;
            this.errorMessage.set('Пользователь с таким email уже существует');
          } else if (detail.includes('номером телефона')) {
            errors['phone'] = true;
            this.errorMessage.set('Пользователь с таким номером телефона уже существует');
          }
        } else {
          this.errorMessage.set('Произошла ошибка при регистрации');
        }

        this.fieldErrors.set(errors);
      }
    });
  }

  hasFieldError(field: string): boolean {
    return this.fieldErrors()[field] || false;
  }
}
