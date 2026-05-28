import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal
} from '@angular/core';
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
  styleUrls: ['../login/login.component.css', './vk-launch.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VkLaunchComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly rawLaunchParams = this.readLaunchParams();
  protected readonly vkParams = this.readVkParams();
  protected readonly hasVkLaunchParams = this.rawLaunchParams.length > 0 && this.vkParams.length > 0;
  protected readonly bridgeStatus = signal<'initializing' | 'ready' | 'failed' | 'standalone'>(
    'initializing'
  );
  protected readonly authStatus = signal<'waiting' | 'missing' | 'loading' | 'success' | 'failed'>(
    'waiting'
  );
  protected readonly authMessage = signal('');
  protected readonly vkAuthPhrase = signal('Подбираем VK-ключи...');

  private readonly vkAuthPhrases = [
    'Подбираем VK-ключи...',
    'Проверяем подпись запуска...',
    'Сверяем профиль ВКонтакте...',
    'Ищем ваш кабинет...',
    'Почти внутри, открываем рабочее место...'
  ];
  private vkPhraseTimer?: number;

  private readonly requiredParamKeys = ['vk_app_id', 'vk_user_id', 'sign'];

  protected readonly missingParamKeys = this.requiredParamKeys.filter((key) => {
    return !this.vkParams.some((param) => param.key === key && param.value.trim() !== '');
  });

  ngOnInit(): void {
    this.startVkPhraseRotation();
    void this.initializeBridge();
    this.attemptVkAuth();
  }

  ngOnDestroy(): void {
    this.stopVkPhraseRotation();
  }

  private readLaunchParams(): string {
    const sources = [
      window.location.search,
      this.getHashParamsSource(window.location.hash)
    ];

    return sources
      .map((source) => this.normalizeLaunchParams(source))
      .find((params) => params.length > 0) ?? '';
  }

  private getHashParamsSource(hash: string): string {
    const source = hash.startsWith('#') ? hash.slice(1) : hash;
    const queryIndex = source.indexOf('?');

    return queryIndex >= 0 ? source.slice(queryIndex + 1) : source;
  }

  private normalizeLaunchParams(source: string): string {
    const query = source.trim().replace(/^[?#]/, '');

    if (!query) {
      return '';
    }

    const params = new URLSearchParams(query);
    const hasVkParams = Array.from(params.keys()).some((key) => key.startsWith('vk_'))
      || params.has('sign');

    return hasVkParams ? query : '';
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
      this.authStatus.set('failed');
      this.authMessage.set('Не удалось получить данные VK. Откройте приложение из VK или войдите по номеру телефона.');
      this.stopVkPhraseRotation();
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
        this.stopVkPhraseRotation();
        this.router.navigate([user.role === 'admin' ? '/admin/dashboard' : '/user/databases']);
      },
      error: (error: HttpErrorResponse) => {
        this.authStatus.set('failed');
        this.stopVkPhraseRotation();

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

  private startVkPhraseRotation(): void {
    this.stopVkPhraseRotation();
    this.vkAuthPhrase.set(this.vkAuthPhrases[0]);

    let phraseIndex = 0;
    this.vkPhraseTimer = window.setInterval(() => {
      phraseIndex = (phraseIndex + 1) % this.vkAuthPhrases.length;
      this.vkAuthPhrase.set(this.vkAuthPhrases[phraseIndex]);
    }, 1800);
  }

  private stopVkPhraseRotation(): void {
    if (this.vkPhraseTimer !== undefined) {
      clearInterval(this.vkPhraseTimer);
      this.vkPhraseTimer = undefined;
    }
  }
}
