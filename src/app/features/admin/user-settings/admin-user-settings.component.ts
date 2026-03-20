import { Component, ChangeDetectionStrategy, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AdminService } from '../../../core/api/admin.service';
import { User } from '../../../core/api/models/user.models';
import { UserUpdateRequest } from '../../../core/api/models/admin.models';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-admin-user-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-user-settings.component.html',
  styleUrls: ['./admin-user-settings.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminUserSettingsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly adminService = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly user = signal<User | null>(null);
  protected readonly loading = signal<boolean>(true);
  protected readonly saving = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  // Form fields
  protected readonly formName = signal<string>('');
  protected readonly formPhone = signal<string>('');
  protected readonly formEmail = signal<string>('');
  protected readonly formPassword = signal<string>('');

  ngOnInit(): void {
    const userId = this.route.snapshot.paramMap.get('id');
    if (!userId || isNaN(Number(userId))) {
      this.error.set('Неверный ID пользователя');
      this.loading.set(false);
      return;
    }

    this.loadUser(Number(userId));
  }

  private loadUser(userId: number): void {
    this.loading.set(true);
    this.error.set(null);

    this.adminService.getUserById(userId).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err) => {
        // Differentiate between client errors (4xx) and server errors (5xx)
        if (err.status === 404) {
          this.error.set('Пользователь не найден');
        } else if (err.status === 403) {
          this.error.set('У вас нет прав для просмотра этого пользователя');
        } else if (err.status >= 500) {
          this.error.set('Ошибка сервера. Попробуйте позже');
        } else {
          this.error.set('Не удалось загрузить данные пользователя');
        }
        this.loading.set(false);
        return of(null);
      })
    ).subscribe(user => {
      if (user) {
        this.user.set(user);
        this.formName.set(user.name);
        this.formPhone.set(user.phone);
        this.formEmail.set(user.email || '');
        this.formPassword.set('');
      }
      this.loading.set(false);
    });
  }

  protected onInputChange(event: Event, field: 'name' | 'phone' | 'email' | 'password'): void {
    const value = (event.target as HTMLInputElement).value;
    switch (field) {
      case 'name': this.formName.set(value); break;
      case 'phone': this.formPhone.set(value); break;
      case 'email': this.formEmail.set(value); break;
      case 'password': this.formPassword.set(value); break;
    }
  }

  protected retry(): void {
    const userId = this.route.snapshot.paramMap.get('id');
    if (userId) this.loadUser(Number(userId));
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

    if (!this.formPhone().trim()) {
      this.error.set('Телефон обязателен для заполнения');
      return;
    }

    if (this.formPassword().trim() && this.formPassword().length < 6) {
      this.error.set('Пароль должен содержать минимум 6 символов');
      return;
    }

    // Build update request with only changed fields
    const updateData: UserUpdateRequest = {};

    if (this.formName() !== user.name) {
      updateData.name = this.formName();
    }

    if (this.formPhone() !== user.phone) {
      updateData.phone = this.formPhone();
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

    this.adminService.updateUser(user.id, updateData).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err) => {
        // Provide specific error messages based on status code
        if (err.status === 409) {
          this.error.set('Пользователь с таким номером телефона или email уже существует');
        } else if (err.status === 422) {
          this.error.set('Неверный формат данных. Проверьте введённые значения');
        } else if (err.status >= 500) {
          this.error.set('Ошибка сервера. Попробуйте позже');
        } else {
          this.error.set('Не удалось обновить данные пользователя');
        }
        this.saving.set(false);
        return of(null);
      })
    ).subscribe(response => {
      if (response) {
        // Update local user data
        this.user.set({
          ...user,
          name: response.name,
          phone: response.phone,
          email: response.email
        });
        this.formName.set(response.name);
        this.formPhone.set(response.phone);
        this.formEmail.set(response.email || '');
        this.formPassword.set('');
        this.successMessage.set('Изменения успешно сохранены');
      }
      this.saving.set(false);
    });
  }

  protected onDelete(): void {
    const user = this.user();
    if (!user || this.saving()) return;

    const confirmed = confirm(
      `Вы уверены, что хотите удалить пользователя "${user.name}"?\n\nЭто действие нельзя отменить.`
    );

    if (!confirmed) return;

    this.saving.set(true);
    this.error.set(null);

    this.adminService.deleteUser(user.id).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err) => {
        if (err.status === 403) {
          this.error.set('У вас нет прав для удаления этого пользователя');
        } else if (err.status === 409) {
          this.error.set('Невозможно удалить пользователя с активными лицензиями');
        } else if (err.status >= 500) {
          this.error.set('Ошибка сервера. Попробуйте позже');
        } else {
          this.error.set('Не удалось удалить пользователя');
        }
        this.saving.set(false);
        return of(null);
      })
    ).subscribe(() => {
      this.saving.set(false);
      this.router.navigate(['/admin/users']);
    });
  }

  protected onBack(): void {
    this.router.navigate(['/admin/users']);
  }

  protected getRoleDisplayName(): string {
    const user = this.user();
    if (!user) return '';
    return user.role === 'admin' ? 'Администратор' : 'Пользователь';
  }

  protected onViewLinkedChats(): void {
    const user = this.user();
    if (!user) return;
    this.router.navigate(['/admin/users', user.id, 'linked-chats']);
  }
}
