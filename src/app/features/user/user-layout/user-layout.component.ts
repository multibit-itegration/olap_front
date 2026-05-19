import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  effect,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/api/auth.service';
import { TelegramService } from '../../../core/services/telegram.service';
import { OnboardingService } from '../../../core/services/onboarding.service';
import { LayoutUiService } from '../../../core/services/layout-ui.service';

@Component({
  selector: 'app-user-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './user-layout.component.html',
  styleUrls: ['./user-layout.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserLayoutComponent implements AfterViewInit {
  protected readonly authService = inject(AuthService);
  protected readonly telegramService = inject(TelegramService);
  protected readonly onboarding = inject(OnboardingService);
  protected readonly layoutUi = inject(LayoutUiService);
  private readonly router = inject(Router);
  private readonly hostElement = inject(ElementRef<HTMLElement>);

  @ViewChild('profileDesktopLink')
  private profileDesktopLink?: ElementRef<HTMLElement>;

  @ViewChild('profileMobileLink')
  private profileMobileLink?: ElementRef<HTMLElement>;

  private lastHandledOnboardingActivation = 0;

  private readonly onboardingTargetEffect = effect(() => {
    if (!this.onboarding.active() || this.onboarding.step().id !== 'go_to_profile') {
      return;
    }

    this.scheduleProfileTargetUpdate();
  });

  private readonly onboardingActivationEffect = effect(() => {
    const activationVersion = this.onboarding.targetActivation();
    const activationStep = this.onboarding.targetActivationStep();

    if (
      activationVersion === 0 ||
      activationVersion === this.lastHandledOnboardingActivation ||
      !this.onboarding.active() ||
      activationStep !== 'go_to_profile'
    ) {
      return;
    }

    this.lastHandledOnboardingActivation = activationVersion;
    this.onboarding.close();

    this.router.navigateByUrl('/user/profile').then(navigated => {
      if (navigated || this.router.url.split(/[?#]/)[0] === '/user/profile') {
        window.setTimeout(() => this.onboarding.openAtStep('restart_onboarding'), 120);
      }
    });
  });

  ngAfterViewInit(): void {
    this.scheduleProfileTargetUpdate();
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.scheduleProfileTargetUpdate();
  }

  isActiveRoute(route: string): boolean {
    return this.router.url.includes(route);
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  onSupportClick(): void {
    // TODO: Replace with actual support page route when available
    window.open('https://t.me/support', '_blank');
  }

  private scheduleProfileTargetUpdate(): void {
    if (!this.onboarding.active() || this.onboarding.step().id !== 'go_to_profile') {
      return;
    }

    window.setTimeout(() => this.updateProfileTargetRect());
    window.requestAnimationFrame(() => this.updateProfileTargetRect());
    window.setTimeout(() => this.updateProfileTargetRect(), 100);
  }

  private updateProfileTargetRect(): void {
    if (!this.onboarding.active() || this.onboarding.step().id !== 'go_to_profile') {
      return;
    }

    const target = this.getVisibleProfileTarget();
    if (!target) {
      this.onboarding.setTargetRect(null);
      this.onboarding.setSecondaryTargetRect(null);
      this.onboarding.setGuidePosition(null);
      return;
    }

    const padding = 5;
    const rect = target.getBoundingClientRect();
    this.onboarding.setTargetRect({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2
    });
    this.onboarding.setSecondaryTargetRect(null);
    this.setGuidePositionForRect(rect, 220);
  }

  private getVisibleProfileTarget(): HTMLElement | null {
    const candidates: Array<HTMLElement | undefined> = [
      this.profileDesktopLink?.nativeElement,
      this.profileMobileLink?.nativeElement,
      this.hostElement.nativeElement.querySelector('[data-onboarding-target="profile-nav"]') as HTMLElement | null ?? undefined
    ];

    return candidates.find(element => {
      if (!element) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && styles.visibility !== 'hidden' && styles.display !== 'none';
    }) ?? null;
  }

  private setGuidePositionForRect(rect: DOMRect, cardHeight: number): void {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isMobile = viewportWidth <= 560;
    const spacing = isMobile ? 18 : 28;
    const safeTop = isMobile ? 12 : 24;
    const safeBottom = isMobile ? 96 : 24;
    const adjustedCardHeight = isMobile ? Math.min(cardHeight, 190) : cardHeight;
    const hasRoomBelow = rect.bottom + spacing + adjustedCardHeight <= viewportHeight - safeBottom;
    const preferredTop = hasRoomBelow
      ? rect.bottom + spacing
      : rect.top - spacing - adjustedCardHeight;

    this.onboarding.setGuidePosition({
      top: Math.max(safeTop, Math.min(preferredTop, viewportHeight - safeBottom - adjustedCardHeight)),
      width: Math.min(viewportWidth - (isMobile ? 28 : 40), 520)
    });
  }
}
