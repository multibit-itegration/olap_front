import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  effect,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/api/auth.service';
import { UserService } from '../../../core/api/user.service';
import { OnboardingService } from '../../../core/services/onboarding.service';
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
export class UserProfileComponent implements OnInit, AfterViewInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly onboarding = inject(OnboardingService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostElement = inject(ElementRef<HTMLElement>);

  protected readonly user = signal<User | null>(null);
  protected readonly loading = signal<boolean>(true);
  protected readonly saving = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  // Form fields
  protected readonly formName = signal<string>('');
  protected readonly formEmail = signal<string>('');
  protected readonly formPassword = signal<string>('');

  @ViewChild('onboardingStartButton')
  private onboardingStartButton?: ElementRef<HTMLButtonElement>;

  @ViewChild('passwordInput')
  private passwordField?: ElementRef<HTMLElement>;

  private lastHandledOnboardingActivation = 0;

  private readonly onboardingTargetEffect = effect(() => {
    if (!this.onboarding.active()) {
      return;
    }

    const stepId = this.onboarding.step().id;

    if (stepId === 'restart_onboarding') {
      this.scheduleOnboardingStartTargetUpdate();
    }

    if (stepId === 'set_password') {
      this.schedulePasswordTargetUpdate();
    }
  });

  private readonly onboardingActivationEffect = effect(() => {
    const activationVersion = this.onboarding.targetActivation();
    const activationStep = this.onboarding.targetActivationStep();
    const stepId = this.onboarding.step().id;

    if (
      activationVersion === 0 ||
      activationVersion === this.lastHandledOnboardingActivation ||
      !this.onboarding.active() ||
      activationStep !== stepId
    ) {
      return;
    }

    this.lastHandledOnboardingActivation = activationVersion;

    if (stepId === 'restart_onboarding') {
      this.onboarding.next();
      return;
    }

    if (stepId === 'set_password') {
      this.finishOnboarding();
    }
  });

  ngOnInit(): void {
    this.loadUser();
  }

  ngAfterViewInit(): void {
    this.scheduleCurrentOnboardingTargetUpdate();
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.scheduleCurrentOnboardingTargetUpdate();
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

  protected startOnboarding(): void {
    if (this.user()?.role !== 'user') {
      return;
    }

    this.router.navigateByUrl('/user/databases').then(navigated => {
      if (navigated || this.router.url.split(/[?#]/)[0] === '/user/databases') {
        window.setTimeout(() => this.onboarding.start());
      }
    });
  }

  private scheduleCurrentOnboardingTargetUpdate(): void {
    const stepId = this.onboarding.step().id;

    if (stepId === 'restart_onboarding') {
      this.scheduleOnboardingStartTargetUpdate();
    }

    if (stepId === 'set_password') {
      this.schedulePasswordTargetUpdate();
    }
  }

  private scheduleOnboardingStartTargetUpdate(): void {
    window.setTimeout(() => this.updateOnboardingStartTargetRect());
    window.requestAnimationFrame(() => this.updateOnboardingStartTargetRect());
    window.setTimeout(() => this.updateOnboardingStartTargetRect(), 100);
  }

  private schedulePasswordTargetUpdate(): void {
    window.setTimeout(() => this.updatePasswordTargetRect());
    window.requestAnimationFrame(() => this.updatePasswordTargetRect());
    window.setTimeout(() => this.updatePasswordTargetRect(), 180);
  }

  private updateOnboardingStartTargetRect(): void {
    if (!this.onboarding.active() || this.onboarding.step().id !== 'restart_onboarding') {
      return;
    }

    const button = this.getOnboardingStartButton();
    if (!button) {
      this.clearOnboardingTarget();
      return;
    }

    this.setTargetForElement(button, 5, 210);
  }

  private updatePasswordTargetRect(): void {
    if (!this.onboarding.active() || this.onboarding.step().id !== 'set_password') {
      return;
    }

    const field = this.getPasswordField();
    if (!field) {
      this.clearOnboardingTarget();
      return;
    }

    if (this.scrollTargetIntoViewIfNeeded(field)) {
      this.clearOnboardingTarget();
      window.setTimeout(() => this.updatePasswordTargetRect(), 260);
      return;
    }

    this.setTargetForElement(field, 8, window.innerWidth <= 900 ? 330 : 250);
  }

  private getOnboardingStartButton(): HTMLButtonElement | null {
    return this.onboardingStartButton?.nativeElement
      ?? this.hostElement.nativeElement.querySelector('[data-onboarding-target="restart-onboarding"]') as HTMLButtonElement | null;
  }

  private getPasswordField(): HTMLElement | null {
    return this.passwordField?.nativeElement
      ?? this.hostElement.nativeElement.querySelector('[data-onboarding-target="profile-password"]') as HTMLElement | null;
  }

  private setTargetForElement(element: HTMLElement, padding: number, cardHeight: number): void {
    const rect = element.getBoundingClientRect();
    this.onboarding.setTargetRect({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2
    });
    this.onboarding.setSecondaryTargetRect(null);
    this.setGuidePositionForRect(rect, cardHeight);
  }

  private scrollTargetIntoViewIfNeeded(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    const safeTop = 92;
    const safeBottom = 160;

    if (rect.top >= safeTop && rect.bottom <= window.innerHeight - safeBottom) {
      return false;
    }

    element.scrollIntoView({ block: 'center', behavior: 'auto' });
    return true;
  }

  private clearOnboardingTarget(): void {
    this.onboarding.setTargetRect(null);
    this.onboarding.setSecondaryTargetRect(null);
    this.onboarding.setGuidePosition(null);
  }

  private setGuidePositionForRect(rect: DOMRect, cardHeight: number): void {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isCompactViewport = viewportWidth <= 900;
    const spacing = isCompactViewport ? 16 : 26;
    const safeTop = isCompactViewport ? 12 : 24;
    const safeBottom = isCompactViewport ? 96 : 24;
    const adjustedCardHeight = isCompactViewport ? Math.min(cardHeight, 330) : cardHeight;
    const hasRoomBelow = rect.bottom + spacing + adjustedCardHeight <= viewportHeight - safeBottom;
    const preferredTop = hasRoomBelow
      ? rect.bottom + spacing
      : rect.top - spacing - adjustedCardHeight;

    this.onboarding.setGuidePosition({
      top: Math.max(safeTop, Math.min(preferredTop, viewportHeight - safeBottom - adjustedCardHeight)),
      width: Math.min(viewportWidth - (isCompactViewport ? 28 : 40), 520)
    });
  }

  private finishOnboarding(): void {
    this.onboarding.close();
    const user = this.user() ?? this.authService.currentUser();

    if (!user) {
      this.showCompletionOnDatabases();
      return;
    }

    const completedAt = this.formatBackendDateTime(new Date());
    const updateData: UserProfileUpdateRequest = {
      onboarding_complete: true,
      onboarding_completed_at: completedAt
    };

    this.userService.updateProfile(user.id, updateData).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(() => of(null))
    ).subscribe(response => {
      const onboardingCompletedAt = response?.onboarding_completed_at ?? completedAt;
      const currentUser = this.authService.currentUser();

      if (currentUser) {
        this.authService.currentUser.set({
          ...currentUser,
          onboarding_complete: true,
          onboarding_completed_at: onboardingCompletedAt
        });
      }

      const profileUser = this.user();
      if (profileUser) {
        this.user.set({
          ...profileUser,
          onboarding_complete: true,
          onboarding_completed_at: onboardingCompletedAt
        });
      }

      this.showCompletionOnDatabases();
    });
  }

  private formatBackendDateTime(date: Date): string {
    const pad = (value: number, size = 2): string => String(value).padStart(size, '0');

    return [
      date.getFullYear(),
      '-',
      pad(date.getMonth() + 1),
      '-',
      pad(date.getDate()),
      'T',
      pad(date.getHours()),
      ':',
      pad(date.getMinutes()),
      ':',
      pad(date.getSeconds()),
      '.',
      pad(date.getMilliseconds(), 3)
    ].join('');
  }

  private showCompletionOnDatabases(): void {
    this.router.navigateByUrl('/user/databases').then(navigated => {
      if (navigated || this.router.url.split(/[?#]/)[0] === '/user/databases') {
        window.setTimeout(() => this.onboarding.showCompletion(), 120);
      }
    });
  }
}
