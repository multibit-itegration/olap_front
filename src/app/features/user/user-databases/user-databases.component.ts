import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
  effect,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminService } from '../../../core/api/admin.service';
import { AuthService } from '../../../core/api/auth.service';
import { IikoConnection, IikoConnectionCreateRequest, IikoConnectionUpdateRequest } from '../../../core/api/models/admin.models';
import { OnboardingService } from '../../../core/services/onboarding.service';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, EMPTY, of } from 'rxjs';

@Component({
  selector: 'app-user-databases',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-databases.component.html',
  styleUrls: ['./user-databases.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserDatabasesComponent implements OnInit, AfterViewInit {
  private readonly adminService = inject(AdminService);
  protected readonly authService = inject(AuthService);
  protected readonly onboarding = inject(OnboardingService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostElement = inject(ElementRef<HTMLElement>);

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
  protected readonly formPath = signal<string>('/resto');
  protected readonly formPort = signal<number>(443);
  protected readonly formUsername = signal<string>('');
  protected readonly formPassword = signal<string>('');

  @ViewChild('addDatabaseButton')
  private addDatabaseButton?: ElementRef<HTMLButtonElement>;

  @ViewChild('addDatabaseHeaderButton')
  private addDatabaseHeaderButton?: ElementRef<HTMLButtonElement>;

  @ViewChildren('reportsButton')
  private reportsButtons?: QueryList<ElementRef<HTMLButtonElement>>;

  private readonly onboardingDatabaseId = signal<number | null>(null);
  private lastHandledOnboardingActivation = 0;

  private readonly onboardingTargetEffect = effect(() => {
    const stepId = this.onboarding.step().id;

    if (!this.onboarding.active()) {
      this.onboarding.setTargetRect(null);
      this.onboarding.setSecondaryTargetRect(null);
      this.onboarding.setGuidePosition(null);
      return;
    }

    if (stepId === 'add_database') {
      window.setTimeout(() => this.updateAddDatabaseTargetRect());
      return;
    }

    if (stepId === 'go_to_reports') {
      window.setTimeout(() => this.updateReportsTargetRect());
      return;
    }

    this.onboarding.setTargetRect(null);
    this.onboarding.setSecondaryTargetRect(null);
    this.onboarding.setGuidePosition(null);
  });

  private readonly onboardingActivationEffect = effect(() => {
    const activationVersion = this.onboarding.targetActivation();
    const activationStep = this.onboarding.targetActivationStep();

    if (
      activationVersion === 0 ||
      activationVersion === this.lastHandledOnboardingActivation ||
      !this.onboarding.active() ||
      activationStep !== this.onboarding.step().id
    ) {
      return;
    }

    this.lastHandledOnboardingActivation = activationVersion;
    const stepId = this.onboarding.step().id;

    if (stepId === 'add_database') {
      this.onAddDatabase();
      return;
    }

    if (stepId === 'database_form' && !this.showForm()) {
      this.onboarding.next();
      return;
    }

    if (stepId === 'go_to_reports') {
      const database = this.getOnboardingDatabase();
      if (database) {
        this.openReportsForOnboarding(database);
        return;
      }

      const databaseId = this.onboardingDatabaseId();
      if (databaseId !== null) {
        this.openReportsByIdForOnboarding(databaseId);
      }
    }
  });

  ngOnInit(): void {
    // Get current user from AuthService
    const currentUser = this.authService.currentUser();

    if (!currentUser) {
      // If user not loaded yet, try to load
      this.authService.loadCurrentUser().pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: user => {
          this.userId.set(user.id);
          this.loadDatabases();
        },
        error: () => {
          this.router.navigate(['/login']);
        }
      });
    } else {
      this.userId.set(currentUser.id);
      this.loadDatabases();
    }
  }

  ngAfterViewInit(): void {
    this.reportsButtons?.changes.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.scheduleCurrentOnboardingTargetUpdate());

    this.updateCurrentOnboardingTarget();
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.updateCurrentOnboardingTarget();
  }

  private updateCurrentOnboardingTarget(): void {
    const stepId = this.onboarding.step().id;

    if (stepId === 'add_database') {
      this.updateAddDatabaseTargetRect();
      return;
    }

    if (stepId === 'go_to_reports') {
      this.updateReportsTargetRect();
    }
  }

  private scheduleCurrentOnboardingTargetUpdate(): void {
    window.setTimeout(() => this.updateCurrentOnboardingTarget());
    window.requestAnimationFrame(() => this.updateCurrentOnboardingTarget());
    window.setTimeout(() => this.updateCurrentOnboardingTarget(), 80);
  }

  private updateAddDatabaseTargetRect(): void {
    if (!this.onboarding.active() || this.onboarding.step().id !== 'add_database') {
      return;
    }

    const primaryButton = this.addDatabaseButton?.nativeElement;
    const headerButton = this.addDatabaseHeaderButton?.nativeElement;

    if (!primaryButton && !headerButton) {
      this.onboarding.setTargetRect(null);
      this.onboarding.setSecondaryTargetRect(null);
      this.onboarding.setGuidePosition(null);
      return;
    }

    const padding = 4;

    if (primaryButton) {
      const primaryRect = primaryButton.getBoundingClientRect();
      this.onboarding.setTargetRect({
        top: primaryRect.top - padding,
        left: primaryRect.left - padding,
        width: primaryRect.width + padding * 2,
        height: primaryRect.height + padding * 2
      });
    } else {
      this.onboarding.setTargetRect(null);
    }

    if (headerButton) {
      const headerRect = headerButton.getBoundingClientRect();
      this.onboarding.setSecondaryTargetRect({
        top: headerRect.top - padding,
        left: headerRect.left - padding,
        width: headerRect.width + padding * 2,
        height: headerRect.height + padding * 2
      });
    } else {
      this.onboarding.setSecondaryTargetRect(null);
    }

    const activeButton = primaryButton ?? headerButton;
    if (!activeButton) {
      this.onboarding.setGuidePosition(null);
      return;
    }

    const activeRect = activeButton.getBoundingClientRect();
    this.setGuidePositionForRect(activeRect);
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
      this.configureOnboardingForDatabases(databases);

      if (this.onboarding.active() && this.onboarding.step().id === 'go_to_reports') {
        this.scheduleCurrentOnboardingTargetUpdate();
      }
    });
  }

  private configureOnboardingForDatabases(databases: IikoConnection[]): void {
    const hasDatabases = databases.length > 0;

    this.onboarding.setPostWelcomeStep(hasDatabases ? 'database_form' : 'add_database');

    if (hasDatabases && this.onboarding.active() && this.onboarding.step().id === 'add_database') {
      this.onboarding.goToStep('database_form');
    }
  }

  protected retry(): void {
    this.loadDatabases();
  }

  protected onAddDatabase(): void {
    this.resetForm();
    this.editingConnection.set(null);
    this.showForm.set(true);

    if (this.onboarding.active() && this.onboarding.step().id === 'add_database') {
      this.onboarding.next();
    }
  }

  protected onReports(database: IikoConnection): void {
    this.router.navigate(['/user/databases', database.id, 'reports']);
  }

  private openReportsForOnboarding(database: IikoConnection): void {
    this.openReportsByIdForOnboarding(database.id);
  }

  private openReportsByIdForOnboarding(databaseId: number): void {
    this.onboarding.close();

    this.router.navigate(['/user/databases', databaseId, 'reports']).then(navigated => {
      if (navigated || this.router.url === `/user/databases/${databaseId}/reports`) {
        window.setTimeout(() => this.onboarding.openAtStep('add_report'));
      }
    });
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

    if (this.onboarding.active() && this.onboarding.step().id === 'database_form') {
      this.onboarding.close();
    }
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
        this.onboardingDatabaseId.set(connection.id);
        this.formLoading.set(false);
        this.showForm.set(false);
        this.resetForm();
        this.loadDatabases();

        if (this.onboarding.active() && this.onboarding.step().id === 'database_form') {
          this.onboarding.next();
        }
      }
    });
  }

  private updateReportsTargetRect(): void {
    if (!this.onboarding.active() || this.onboarding.step().id !== 'go_to_reports') {
      return;
    }

    const databases = this.databases();
    const databaseIndex = this.getOnboardingDatabaseIndex(databases);
    const database = this.getOnboardingDatabase() ?? databases[databaseIndex] ?? databases[0];
    const databaseId = database?.id ?? this.onboardingDatabaseId();
    const button = this.getReportsButton(databaseIndex);

    if (!button || databaseId === null) {
      this.onboarding.setTargetRect(null);
      this.onboarding.setSecondaryTargetRect(null);
      this.onboarding.setGuidePosition(null);
      this.onboarding.setTargetNavigationUrl(null);
      return;
    }

    this.onboarding.setTargetNavigationUrl(`/user/databases/${databaseId}/reports`);

    const padding = 4;
    const rect = button.getBoundingClientRect();
    this.onboarding.setTargetRect({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2
    });
    this.onboarding.setSecondaryTargetRect(null);
    this.setGuidePositionForRect(rect);
  }

  private getReportsButton(databaseIndex: number): HTMLButtonElement | null {
    const buttons = this.reportsButtons?.toArray().map(button => button.nativeElement) ?? [];

    return buttons[databaseIndex]
      ?? buttons[0]
      ?? this.hostElement.nativeElement.querySelector('[data-onboarding-target="reports"]') as HTMLButtonElement | null;
  }

  private setGuidePositionForRect(rect: DOMRect): void {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isMobile = viewportWidth <= 560;
    const cardHeight = isMobile ? 168 : 190;
    const spacing = isMobile ? 18 : 28;
    const safeTop = isMobile ? 12 : 24;
    const safeBottom = isMobile ? 96 : 24;
    const hasRoomBelow = rect.bottom + spacing + cardHeight <= viewportHeight - safeBottom;
    const preferredTop = hasRoomBelow
      ? rect.bottom + spacing
      : rect.top - spacing - cardHeight;

    this.onboarding.setGuidePosition({
      top: Math.max(safeTop, Math.min(preferredTop, viewportHeight - safeBottom - cardHeight)),
      width: Math.min(viewportWidth - (isMobile ? 28 : 40), 520)
    });
  }

  private getOnboardingDatabase(): IikoConnection | null {
    const databases = this.databases();
    const targetId = this.onboardingDatabaseId();

    if (targetId !== null) {
      const target = databases.find(database => database.id === targetId);
      if (target) return target;
    }

    return databases[0] ?? null;
  }

  private getOnboardingDatabaseIndex(databases: IikoConnection[]): number {
    const targetId = this.onboardingDatabaseId();
    const targetIndex = targetId === null
      ? -1
      : databases.findIndex(database => database.id === targetId);

    return targetIndex >= 0 ? targetIndex : 0;
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
    this.formPath.set('/resto');
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
}
