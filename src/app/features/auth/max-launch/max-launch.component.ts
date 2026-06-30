import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  signal
} from '@angular/core';
import { RouterModule } from '@angular/router';

interface MaxWebApp {
  initData?: string;
  initDataUnsafe?: unknown;
  platform?: string;
  version?: string;
  colorScheme?: string;
  ready?: () => void;
}

interface MaxLaunchParam {
  key: string;
  value: string;
}

declare global {
  interface Window {
    WebApp?: MaxWebApp;
  }
}

@Component({
  selector: 'app-max-launch',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './max-launch.component.html',
  styleUrls: ['./max-launch.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MaxLaunchComponent implements OnInit {
  private readonly maxScriptUrl = 'https://st.max.ru/js/max-web-app.js';
  private readonly bridgeTimeoutMs = 8000;

  protected readonly bridgeStatus = signal<'loading' | 'ready' | 'missing' | 'failed'>('loading');
  protected readonly statusMessage = signal('Загружаем MAX Bridge...');
  protected readonly initData = signal('');
  protected readonly initDataUnsafeJson = signal('null');
  protected readonly webAppInfoJson = signal('{}');
  protected readonly copyMessage = signal('');

  protected readonly backendPayload = computed(() => {
    return JSON.stringify({ init_data: this.initData() }, null, 2);
  });

  protected readonly parsedInitData = computed<MaxLaunchParam[]>(() => {
    const rawInitData = this.initData();

    if (!rawInitData) {
      return [];
    }

    return Array.from(new URLSearchParams(rawInitData).entries())
      .map(([key, value]) => ({ key, value }));
  });

  ngOnInit(): void {
    void this.initializeMaxBridge();
  }

  protected async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copyMessage.set('Скопировано.');
    } catch {
      this.copyMessage.set('Не удалось скопировать автоматически. Текст можно взять из поля ниже.');
    }
  }

  protected refresh(): void {
    this.readMaxLaunchData();
  }

  private async initializeMaxBridge(): Promise<void> {
    try {
      await this.loadMaxScript();
      this.readMaxLaunchData();
    } catch {
      this.bridgeStatus.set('failed');
      this.statusMessage.set('Не удалось загрузить MAX Bridge. Откройте страницу внутри MAX или обновите её.');
      this.readMaxLaunchData();
    }
  }

  private loadMaxScript(): Promise<void> {
    if (window.WebApp) {
      return Promise.resolve();
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${this.maxScriptUrl}"]`
    );

    if (existingScript?.dataset['maxBridgeLoaded'] === 'true') {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const script = existingScript ?? document.createElement('script');
      let settled = false;

      const cleanup = (): void => {
        window.clearTimeout(timeoutId);
        script.removeEventListener('load', handleLoad);
        script.removeEventListener('error', handleError);
      };

      const settle = (): void => {
        if (settled) {
          return;
        }

        settled = true;
        script.dataset['maxBridgeLoaded'] = 'true';
        cleanup();
        resolve();
      };

      const fail = (): void => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        reject(new Error('MAX Bridge failed to load'));
      };

      const handleLoad = (): void => settle();
      const handleError = (): void => fail();
      const timeoutId = window.setTimeout(() => fail(), this.bridgeTimeoutMs);

      script.addEventListener('load', handleLoad);
      script.addEventListener('error', handleError);

      if (!existingScript) {
        script.src = this.maxScriptUrl;
        script.async = true;
        document.head.appendChild(script);
      }
    });
  }

  private readMaxLaunchData(): void {
    const webApp = window.WebApp;

    if (!webApp) {
      this.bridgeStatus.set('failed');
      this.statusMessage.set('window.WebApp не найден. Страница, похоже, открыта вне MAX Web App.');
      this.setEmptyMaxData();
      return;
    }

    webApp.ready?.();

    const rawInitData = typeof webApp.initData === 'string'
      ? webApp.initData
      : '';

    this.initData.set(rawInitData);
    this.initDataUnsafeJson.set(this.stringifyUnknown(webApp.initDataUnsafe ?? null));
    this.webAppInfoJson.set(this.stringifyUnknown({
      hasWebApp: true,
      hasInitData: rawInitData.length > 0,
      initDataLength: rawInitData.length,
      platform: webApp.platform ?? null,
      version: webApp.version ?? null,
      colorScheme: webApp.colorScheme ?? null,
      location: {
        href: window.location.href,
        search: window.location.search,
        hash: window.location.hash
      }
    }));

    if (!rawInitData) {
      this.bridgeStatus.set('missing');
      this.statusMessage.set('MAX Bridge загружен, но initData пустой. Откройте страницу из MAX.');
      return;
    }

    this.bridgeStatus.set('ready');
    this.statusMessage.set('MAX initData получен. Можно передавать JSON backend-разработчику.');
  }

  private setEmptyMaxData(): void {
    this.initData.set('');
    this.initDataUnsafeJson.set('null');
    this.webAppInfoJson.set(this.stringifyUnknown({
      hasWebApp: false,
      location: {
        href: window.location.href,
        search: window.location.search,
        hash: window.location.hash
      }
    }));
  }

  private stringifyUnknown(value: unknown): string {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return JSON.stringify({ error: 'Не удалось сериализовать значение' }, null, 2);
    }
  }
}
