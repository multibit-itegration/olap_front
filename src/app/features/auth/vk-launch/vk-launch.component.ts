import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

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
export class VkLaunchComponent {
  protected readonly rawLaunchParams = this.readLaunchParams();
  protected readonly backendPayload = JSON.stringify(
    { launch_params: this.rawLaunchParams },
    null,
    2
  );
  protected readonly vkParams = this.readVkParams();
  protected readonly hasVkLaunchParams = this.rawLaunchParams.length > 0 && this.vkParams.length > 0;
  protected readonly copyMessage = signal('');

  private readonly requiredParamKeys = ['vk_app_id', 'vk_user_id', 'sign'];

  protected readonly missingParamKeys = this.requiredParamKeys.filter((key) => {
    return !this.vkParams.some((param) => param.key === key && param.value.trim() !== '');
  });

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
}
