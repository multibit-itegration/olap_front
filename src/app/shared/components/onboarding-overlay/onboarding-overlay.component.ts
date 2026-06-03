import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  effect,
  inject,
  signal
} from '@angular/core';
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
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly viewportWidth = signal(window.innerWidth);
  protected readonly viewportHeight = signal(window.innerHeight);
  private readonly scrollBlockListenerOptions: AddEventListenerOptions = {
    capture: true,
    passive: false
  };
  private readonly scrollLockedBodyStyles = new Map<string, string>();
  private readonly scrollLockedHtmlStyles = new Map<string, string>();
  private scrollLockTop = 0;
  private scrollLocked = false;

  constructor() {
    this.document.addEventListener(
      'touchmove',
      this.preventBackgroundScroll,
      this.scrollBlockListenerOptions
    );
    this.document.addEventListener(
      'wheel',
      this.preventBackgroundScroll,
      this.scrollBlockListenerOptions
    );

    effect(() => {
      if (this.shouldLockPageScroll()) {
        this.lockPageScroll();
        return;
      }

      this.unlockPageScroll();
    });

    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener(
        'touchmove',
        this.preventBackgroundScroll,
        this.scrollBlockListenerOptions
      );
      this.document.removeEventListener(
        'wheel',
        this.preventBackgroundScroll,
        this.scrollBlockListenerOptions
      );
      this.unlockPageScroll();
    });
  }

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

  private readonly preventBackgroundScroll = (event: Event): void => {
    if (!this.shouldLockPageScroll()) {
      return;
    }

    if (this.isScrollableOnboardingContent(event.target)) {
      return;
    }

    event.preventDefault();
  };

  private shouldLockPageScroll(): boolean {
    if (this.onboarding.completionActive()) {
      return true;
    }

    if (this.onboarding.active() && this.onboarding.step().id === 'set_password') {
      return this.onboarding.targetRect() !== null;
    }

    return this.onboarding.active() && this.onboarding.step().id !== 'database_form';
  }

  private lockPageScroll(): void {
    if (this.scrollLocked) {
      return;
    }

    const body = this.document.body;
    const html = this.document.documentElement;
    this.scrollLockTop = window.scrollY || html.scrollTop || body.scrollTop || 0;

    this.captureInlineStyles(body, this.scrollLockedBodyStyles, [
      'left',
      'overflow',
      'position',
      'right',
      'top',
      'width'
    ]);
    this.captureInlineStyles(html, this.scrollLockedHtmlStyles, ['overflow', 'overscroll-behavior']);

    html.classList.add('onboarding-scroll-locked');
    body.classList.add('onboarding-scroll-locked');
    html.style.setProperty('overflow', 'hidden');
    html.style.setProperty('overscroll-behavior', 'none');
    body.style.setProperty('position', 'fixed');
    body.style.setProperty('top', `-${this.scrollLockTop}px`);
    body.style.setProperty('left', '0');
    body.style.setProperty('right', '0');
    body.style.setProperty('width', '100%');
    body.style.setProperty('overflow', 'hidden');

    this.scrollLocked = true;
  }

  private unlockPageScroll(): void {
    if (!this.scrollLocked) {
      return;
    }

    const body = this.document.body;
    const html = this.document.documentElement;

    html.classList.remove('onboarding-scroll-locked');
    body.classList.remove('onboarding-scroll-locked');
    this.restoreInlineStyles(body, this.scrollLockedBodyStyles);
    this.restoreInlineStyles(html, this.scrollLockedHtmlStyles);
    this.scrollLocked = false;
    window.scrollTo(0, this.scrollLockTop);
  }

  private captureInlineStyles(
    element: HTMLElement,
    target: Map<string, string>,
    properties: readonly string[]
  ): void {
    target.clear();
    properties.forEach(property => target.set(property, element.style.getPropertyValue(property)));
  }

  private restoreInlineStyles(element: HTMLElement, styles: Map<string, string>): void {
    styles.forEach((value, property) => {
      if (value) {
        element.style.setProperty(property, value);
        return;
      }

      element.style.removeProperty(property);
    });
    styles.clear();
  }

  private isScrollableOnboardingContent(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
      return false;
    }

    const scrollContainer = target.closest('.onboarding-card, .onboarding-guide-card');
    if (!(scrollContainer instanceof HTMLElement)) {
      return false;
    }

    return scrollContainer.scrollHeight > scrollContainer.clientHeight;
  }
}
