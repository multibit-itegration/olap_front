import { Component, ChangeDetectionStrategy, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../core/api/admin.service';
import { IikoConnection, IikoConnectionCreateRequest, IikoConnectionUpdateRequest } from '../../../core/api/models/admin.models';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, EMPTY, of } from 'rxjs';

@Component({
  selector: 'app-admin-user-databases',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-user-databases.component.html',
  styleUrls: ['./admin-user-databases.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminUserDatabasesComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly databases = signal<IikoConnection[]>([]);
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);
  protected readonly userId = signal<number>(0);

  // Form state
  protected readonly showForm = signal<boolean>(false);
  protected readonly editingConnection = signal<IikoConnection | null>(null);
  protected readonly formLoading = signal<boolean>(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly formErrorType = signal<'connection' | 'password' | null>(null);

  // Form fields
  protected readonly formName = signal<string>('');
  protected readonly formHost = signal<string>('');
  protected readonly formPath = signal<string>('');
  protected readonly formPort = signal<number>(443);
  protected readonly formUsername = signal<string>('');
  protected readonly formPassword = signal<string>('');

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/admin/users']);
      return;
    }

    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      this.router.navigate(['/admin/users']);
      return;
    }

    this.userId.set(parsedId);
    this.loadDatabases();
  }

  private loadDatabases(): void {
    this.loading.set(true);
    this.error.set(null);

    this.adminService.getIikoConnectionsByUserId(this.userId()).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 404) {
          return of([]);
        }
        this.error.set('Не удалось загрузить базы данных');
        this.loading.set(false);
        return of([]);
      })
    ).subscribe(databases => {
      this.databases.set(databases);
      this.loading.set(false);
    });
  }

  protected retry(): void {
    this.loadDatabases();
  }

  protected onAddDatabase(): void {
    this.resetForm();
    this.editingConnection.set(null);
    this.showForm.set(true);
  }

  protected onReports(database: IikoConnection): void {
    this.router.navigate(['/admin/users', this.userId(), 'databases', database.id, 'reports']);
  }

  protected onSettings(database: IikoConnection): void {
    this.editingConnection.set(database);
    this.formName.set(database.name);
    this.formHost.set(database.host);
    this.formPath.set(database.path);
    this.formPort.set(database.port);
    this.formUsername.set(database.username_iiko);
    this.formPassword.set(''); // Don't pre-fill password for security
    this.formError.set(null);
    this.showForm.set(true);
  }

  protected onCancelForm(): void {
    this.showForm.set(false);
    this.resetForm();
  }

  protected onNameChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.formName.set(input.value);
  }

  protected onHostChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.formHost.set(input.value);
  }

  protected onPathChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.formPath.set(input.value);
  }

  protected onPortChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value)) {
      this.formPort.set(value);
    }
  }

  protected onUsernameChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.formUsername.set(input.value);
  }

  protected onPasswordChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.formPassword.set(input.value);
  }

  protected onSaveForm(): void {
    this.formErrorType.set(null);
    // Validate required fields
    if (!this.formName().trim()) {
      this.formError.set('Название базы обязательно');
      return;
    }
    if (!this.formHost().trim()) {
      this.formError.set('Адрес базы обязателен');
      return;
    }
    if (!this.formUsername().trim()) {
      this.formError.set('Имя пользователя обязательно');
      return;
    }
    const editing = this.editingConnection();
    if (!editing && !this.formPassword().trim()) {
      this.formError.set('Пароль обязателен');
      return;
    }

    if (editing) {
      this.updateConnection(editing.id);
    } else {
      this.createConnection();
    }
  }

  protected onDeleteConnection(): void {
    const connection = this.editingConnection();
    if (!connection) return;

    if (!confirm(`Вы уверены, что хотите удалить базу "${connection.name}"?`)) {
      return;
    }

    this.formLoading.set(true);
    this.formError.set(null);

    this.adminService.deleteIikoConnection(connection.id).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        this.formError.set('Не удалось удалить базу данных');
        this.formLoading.set(false);
        return EMPTY;
      })
    ).subscribe(() => {
      this.formLoading.set(false);
      this.showForm.set(false);
      this.resetForm();
      this.loadDatabases();
    });
  }

  private createConnection(): void {
    const data: IikoConnectionCreateRequest = {
      name: this.formName().trim(),
      host: this.formHost().trim(),
      path: this.formPath().trim(),
      port: this.formPort(),
      username_iiko: this.formUsername().trim(),
      password_iiko: this.formPassword().trim()
    };

    this.formLoading.set(true);
    this.formError.set(null);

    this.adminService.createIikoConnection(this.userId(), data).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        this.handleIikoError(err);
        return of(null);
      })
    ).subscribe(connection => {
      if (connection) {
        this.formLoading.set(false);
        this.showForm.set(false);
        this.resetForm();
        this.loadDatabases();
      }
    });
  }

  private updateConnection(connectionId: number): void {
    const data: IikoConnectionUpdateRequest = {
      name: this.formName().trim(),
      host: this.formHost().trim(),
      path: this.formPath().trim(),
      port: this.formPort(),
      username_iiko: this.formUsername().trim()
    };
    const password = this.formPassword().trim();
    if (password) {
      data.password_iiko = password;
    }

    this.formLoading.set(true);
    this.formError.set(null);

    this.adminService.updateIikoConnection(connectionId, data).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        this.handleIikoError(err);
        return of(null);
      })
    ).subscribe(connection => {
      if (connection) {
        this.formLoading.set(false);
        this.showForm.set(false);
        this.resetForm();
        this.loadDatabases();
      }
    });
  }

  private handleIikoError(err: HttpErrorResponse): void {
    if (err.status === 502) {
      const detail: string = err.error?.detail ?? '';
      if (detail.includes('Неверный пароль')) {
        this.formError.set('Введён неверный пароль от базы');
        this.formErrorType.set('password');
      } else {
        this.formError.set('Проверьте данные базы, не удалось подключиться');
        this.formErrorType.set('connection');
      }
    } else {
      this.formError.set('Не удалось сохранить базу данных');
      this.formErrorType.set(null);
    }
    this.formLoading.set(false);
  }

  private resetForm(): void {
    this.formName.set('');
    this.formHost.set('');
    this.formPath.set('');
    this.formPort.set(443);
    this.formUsername.set('');
    this.formPassword.set('');
    this.formError.set(null);
    this.formErrorType.set(null);
    this.editingConnection.set(null);
  }

  protected trackByDatabaseId(index: number, database: IikoConnection): number {
    return database.id;
  }

  protected goBack(): void {
    this.router.navigate(['/admin/users']);
  }
}
