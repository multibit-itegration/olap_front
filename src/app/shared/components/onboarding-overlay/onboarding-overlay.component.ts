import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OnboardingService, OnboardingTargetRect } from '../../../core/services/onboarding.service';

@Component({
  selector: 'app-onboarding-overlay',
  standalone: true,
  templateUrl: './onboarding-overlay.component.html',
  styleUrl: './onboarding-overlay.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OnboardingOverlayComponent {
  protected readonly onboarding = inject(OnboardingService);
  private readonly router = inject(Router);
  protected readonly viewportWidth = signal(window.innerWidth);
  protected readonly viewportHeight = signal(window.innerHeight);

  protected onTargetClick(): void {
    const navigationUrl = this.onboarding.targetNavigationUrl();

    if (this.onboarding.step().id === 'go_to_reports' && navigationUrl) {
      this.onboarding.close();

      this.router.navigateByUrl(navigationUrl).then(navigated => {
        if (navigated || this.router.url === navigationUrl) {
          window.setTimeout(() => this.onboarding.openAtStep('add_report'));
        }
      });
      return;
    }

    this.onboarding.activateTarget();
  }

  @HostListener('document:keydown.escape')
  protected closeOnEscape(): void {
    if (this.onboarding.completionActive()) {
      this.onboarding.closeCompletion();
      return;
    }

    if (this.onboarding.active()) {
      this.onboarding.close();
    }
  }

  @HostListener('window:resize')
  protected updateViewportSize(): void {
    this.viewportWidth.set(window.innerWidth);
    this.viewportHeight.set(window.innerHeight);
  }

  protected backdropTopHeight(rect: OnboardingTargetRect): number {
    return Math.max(rect.top, 0);
  }

  protected backdropMiddleTop(rect: OnboardingTargetRect): number {
    return Math.max(rect.top, 0);
  }

  protected backdropMiddleHeight(rect: OnboardingTargetRect): number {
    return Math.max(rect.height, 0);
  }

  protected backdropLeftWidth(rect: OnboardingTargetRect): number {
    return Math.max(rect.left, 0);
  }

  protected backdropRightLeft(rect: OnboardingTargetRect): number {
    return Math.min(rect.left + rect.width, this.viewportWidth());
  }

  protected backdropRightWidth(rect: OnboardingTargetRect): number {
    return Math.max(this.viewportWidth() - this.backdropRightLeft(rect), 0);
  }

  protected backdropBottomTop(rect: OnboardingTargetRect): number {
    return Math.min(rect.top + rect.height, this.viewportHeight());
  }

  protected backdropBottomHeight(rect: OnboardingTargetRect): number {
    return Math.max(this.viewportHeight() - this.backdropBottomTop(rect), 0);
  }
}
