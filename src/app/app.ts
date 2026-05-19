import { Component, OnInit, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './core/api/auth.service';
import { OnboardingService } from './core/services/onboarding.service';
import { OnboardingOverlayComponent } from './shared/components/onboarding-overlay/onboarding-overlay.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, OnboardingOverlayComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('olap-frontend');
  private readonly authService = inject(AuthService);
  private readonly onboarding = inject(OnboardingService);
  private readonly router = inject(Router);
  private hasStartedOnboarding = false;
  private readonly onboardingStartUrl = '/user/databases';

  ngOnInit(): void {
    this.startOnboardingForUserArea(this.router.url);

    this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(event => {
      this.startOnboardingForUserArea(event.urlAfterRedirects);
      this.advanceOnboardingAfterNavigation(event.urlAfterRedirects);
    });
  }

  private startOnboardingForUserArea(url: string): void {
    if (!url.startsWith('/user') || this.hasStartedOnboarding) {
      return;
    }

    const user = this.authService.currentUser();
    if (!user) {
      return;
    }

    this.hasStartedOnboarding = true;

    if (user.onboarding_complete === true) {
      return;
    }

    const currentPath = url.split(/[?#]/)[0];

    if (currentPath !== this.onboardingStartUrl) {
      this.router.navigateByUrl(this.onboardingStartUrl).then(navigated => {
        if (navigated || this.router.url.split(/[?#]/)[0] === this.onboardingStartUrl) {
          this.onboarding.start();
        }
      });
      return;
    }

    this.onboarding.start();
  }

  private advanceOnboardingAfterNavigation(url: string): void {
    const isUserReportsRoute = /^\/user\/databases\/\d+\/reports(?:[?#].*)?$/.test(url);

    if (
      isUserReportsRoute &&
      this.onboarding.active() &&
      this.onboarding.step().id === 'go_to_reports'
    ) {
      window.setTimeout(() => this.onboarding.goToStep('add_report'));
    }
  }
}
