import { Component, ChangeDetectionStrategy, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/api/auth.service';
import { UserService } from '../../../core/api/user.service';
import { User } from '../../../core/api/models/user.models';
import { UserProfileUpdateRequest } from '../../../core/api/models/user.models';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserProfileComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly user = signal<User | null>(null);
  protected readonly loading = signal<boolean>(true);
  protected readonly saving = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  // Form fields
  protected readonly formName = signal<string>('');
  protected readonly formEmail = signal<string>('');
  protected readonly formPassword = signal<string>('');

  ngOnInit(): void {
    this.loadUser();
  }

  private loadUser(): void {
    this.loading.set(true);
    this.error.set(null);

    // Use currentUser from authService if available, otherwise load from API
    const currentUser = this.authService.currentUser();

    if (currentUser) {
      this.initializeForm(currentUser);
      this.loading.set(false);
    } else {
      this.authService.loadCurrentUser().pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          if (err.status === 404) {
            this.error.set('Пользователь не найден');
          } else if (err.status === 403) {
            this.error.set('У вас нет прав для просмотра профиля');
          } else if (err.status >= 500) {
            this.error.set('Ошибка сервера. Попробуйте позже');
          } else {
            this.error.set('Не удалось загрузить данные профиля');
          }
          this.loading.set(false);
          return of(null);
        })
      ).subscribe(user => {
        if (user) {
          this.initializeForm(user);
        }
        this.loading.set(false);
      });
    }
  }

  private initializeForm(user: User): void {
    this.user.set(user);
    this.formName.set(user.name);
    this.formEmail.set(user.email || '');
    this.formPassword.set('');
  }

  protected onInputChange(event: Event, field: 'name' | 'email' | 'password'): void {
    const value = (event.target as HTMLInputElement).value;
    switch (field) {
      case 'name': this.formName.set(value); break;
      case 'email': this.formEmail.set(value); break;
      case 'password': this.formPassword.set(value); break;
    }
  }

  protected retry(): void {
    this.loadUser();
  }

  protected onSave(): void {
    const user = this.user();
    if (!user || this.saving()) return;

    this.successMessage.set(null);
    this.error.set(null);

    if (!this.formName().trim()) {
      this.error.set('Имя обязательно для заполнения');
      return;
    }

    if (this.formPassword().trim() && this.formPassword().length < 6) {
      this.error.set('Пароль должен содержать минимум 6 символов');
      return;
    }

    // Build update request with only changed fields
    const updateData: UserProfileUpdateRequest = {};

    if (this.formName() !== user.name) {
      updateData.name = this.formName();
    }

    if (this.formEmail() !== (user.email || '')) {
      updateData.email = this.formEmail() || null;
    }

    if (this.formPassword().trim()) {
      updateData.password = this.formPassword();
    }

    // If no changes, show message
    if (Object.keys(updateData).length === 0) {
      this.successMessage.set('Нет изменений для сохранения');
      return;
    }

    this.saving.set(true);

    const userId = this.authService.currentUser()?.id;
    if (!userId) {
      this.error.set('Не удалось определить пользователя');
      this.saving.set(false);
      return;
    }

    this.userService.updateProfile(userId, updateData).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err) => {
        if (err.status === 409) {
          this.error.set('Пользователь с таким email уже существует');
        } else if (err.status === 422) {
          this.error.set('Неверный формат данных. Проверьте введённые значения');
        } else if (err.status >= 500) {
          this.error.set('Ошибка сервера. Попробуйте позже');
        } else {
          this.error.set('Не удалось обновить данные профиля');
        }
        this.saving.set(false);
        return of(null);
      })
    ).subscribe(response => {
      if (response) {
        // Update local user data and authService
        const updatedUser: User = {
          ...user,
          name: response.name,
          phone: response.phone,
          email: response.email
        };
        this.user.set(updatedUser);
        this.authService.currentUser.set(updatedUser);
        this.formName.set(response.name);
        this.formEmail.set(response.email || '');
        this.formPassword.set('');
        this.successMessage.set('Изменения успешно сохранены');
      }
      this.saving.set(false);
    });
  }

  protected onViewLinkedChats(): void {
    this.router.navigate(['/user/linked-chats']);
  }
}
