import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import bridge from '@vkontakte/vk-bridge';

interface VkLaunchParam {
  key: string;
  value: string;
}

@Component({
  selector: 'app-vk-launch',
  standalone: true,
  templateUrl: './vk-launch.component.html',
  styleUrls: ['./vk-launch.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VkLaunchComponent implements OnInit {
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

  private readonly requiredParamKeys = ['vk_app_id', 'vk_user_id', 'sign'];

  protected readonly missingParamKeys = this.requiredParamKeys.filter((key) => {
    return !this.vkParams.some((param) => param.key === key && param.value.trim() !== '');
  });

  ngOnInit(): void {
    void this.initializeBridge();
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
}
