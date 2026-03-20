import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/api/auth.service';
import { TelegramService } from '../../../core/services/telegram.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminLayoutComponent {
  protected readonly authService = inject(AuthService);
  protected readonly telegramService = inject(TelegramService);
  private readonly router = inject(Router);

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
}
