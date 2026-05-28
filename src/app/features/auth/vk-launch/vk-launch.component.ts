import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import bridge from '@vkontakte/vk-bridge';
import { switchMap } from 'rxjs';
import { AuthService } from '../../../core/api/auth.service';

interface VkLaunchParam {
  key: string;
  value: string;
}

@Component({
  selector: 'app-vk-launch',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './vk-launch.component.html',
  styleUrls: ['./vk-launch.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VkLaunchComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly rawLaunchParams = this.readLaunchParams();
  protected readonly backendPayload = JSON.stringify(
    { launch_params: this.rawLaunchParams },
    null,
    2
  );
  protected readonly vkParams = this.readVkParams();
  protected readonly hasVkLaunchParams = this.rawLaunchParams.length > 0 && this.vkParams.length > 0;
  protected readonly copyMessage = signal('');
  protected readonly bridgeStatus = signal<'initializing' | 'ready' | 'failed' | 'standalone'>(
    'initializing'
  );
  protected readonly authStatus = signal<'waiting' | 'missing' | 'loading' | 'success' | 'failed'>(
    'waiting'
  );
  protected readonly authMessage = signal('');

  private readonly requiredParamKeys = ['vk_app_id', 'vk_user_id', 'sign'];

  protected readonly missingParamKeys = this.requiredParamKeys.filter((key) => {
    return !this.vkParams.some((param) => param.key === key && param.value.trim() !== '');
  });

  ngOnInit(): void {
    void this.initializeBridge();
    this.attemptVkAuth();
  }

  protected async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copyMessage.set('Скопировано.');
    } catch {
      this.copyMessage.set('Не удалось скопировать автоматически. Текст можно взять из поля ниже.');
    }
  }

  private readLaunchParams(): string {
    return window.location.search.startsWith('?')
      ? window.location.search.slice(1)
      : window.location.search;
  }

  private readVkParams(): VkLaunchParam[] {
    const params = new URLSearchParams(this.rawLaunchParams);

    return Array.from(params.entries())
      .filter(([key]) => key.startsWith('vk_') || key === 'sign')
      .map(([key, value]) => ({ key, value }));
  }

  private async initializeBridge(): Promise<void> {
    if (!bridge.isEmbedded()) {
      this.bridgeStatus.set('standalone');
      return;
    }

    try {
      await Promise.race([
        bridge.send('VKWebAppInit'),
        this.createBridgeTimeout(5000)
      ]);
      this.bridgeStatus.set('ready');
    } catch {
      this.bridgeStatus.set('failed');
    }
  }

  private createBridgeTimeout(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error('VK Bridge init timed out')), timeoutMs);
    });
  }

  private attemptVkAuth(): void {
    if (!this.hasVkLaunchParams || this.missingParamKeys.length > 0) {
      this.authStatus.set('missing');
      return;
    }

    this.authStatus.set('loading');
    this.authMessage.set('Входим через VK...');

    this.authService.vkAuth(this.rawLaunchParams).pipe(
      switchMap(() => this.authService.loadCurrentUser())
    ).subscribe({
      next: (user) => {
        this.authStatus.set('success');
        this.authMessage.set('VK вход выполнен. Открываем кабинет...');
        this.router.navigate([user.role === 'admin' ? '/admin/dashboard' : '/user/databases']);
      },
      error: (error: HttpErrorResponse) => {
        this.authStatus.set('failed');

        switch (error.status) {
          case 401:
            this.authMessage.set('VK не подтвердил параметры запуска. Откройте приложение из VK.');
            break;
          case 404:
            this.authMessage.set('Аккаунт VK не найден. Войдите по номеру телефона.');
            break;
          default:
            this.authMessage.set('Не удалось войти через VK. Попробуйте позже или войдите по номеру телефона.');
        }
      }
    });
  }
}
