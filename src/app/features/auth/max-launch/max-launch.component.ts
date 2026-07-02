import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  signal
} from '@angular/core';
import { RouterModule } from '@angular/router';

interface MaxWebApp {
  initData?: string | null;
  initDataUnsafe?: unknown;
  platform?: string | null;
  version?: string | null;
  deviceName?: string | null;
  colorScheme?: string | null;
  ready?: () => void;
}

interface MaxLaunchParam {
  key: string;
  value: string;
}

interface MaxHashExtraction {
  webAppData: string;
  reconstructedWebAppData: string;
  params: MaxLaunchParam[];
}

interface MaxLaunchExtraction {
  currentHash: string;
  navigationHash: string;
  currentHashData: MaxHashExtraction;
  navigationHashData: MaxHashExtraction;
  sessionWebAppData: string;
}

interface MaxInitDataCandidate {
  source: string;
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
  private readonly initDataParamKeys = new Set([
    'auth_date',
    'chat',
    'hash',
    'ip',
    'query_id',
    'start_param',
    'user'
  ]);
  private readonly importantInitDataKeys = ['auth_date', 'hash', 'query_id', 'user', 'chat'];

  protected readonly bridgeStatus = signal<'loading' | 'ready' | 'missing' | 'failed'>('loading');
  protected readonly statusMessage = signal('Загружаем MAX Bridge...');
  protected readonly initData = signal('');
  protected readonly initDataSource = signal('нет данных');
  protected readonly bridgeInitData = signal('');
  protected readonly initDataUnsafeJson = signal('null');
  protected readonly webAppInfoJson = signal('{}');
  protected readonly launchDiagnosticsJson = signal('{}');
  protected readonly missingImportantFields = signal<string[]>([]);
  protected readonly copyMessage = signal('');

  protected readonly backendPayload = computed(() => {
    return JSON.stringify({ init_data: this.initData() }, null, 2);
  });

  protected readonly missingImportantFieldsLabel = computed(() => {
    return this.missingImportantFields().join(', ');
  });

  protected readonly parsedInitData = computed<MaxLaunchParam[]>(() => {
    return this.parseInitDataPairs(this.initData());
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
    const extraction = this.extractLaunchData();
    const bridgeInitData = typeof webApp?.initData === 'string'
      ? webApp.initData
      : '';
    const selectedInitData = this.selectInitData(bridgeInitData, extraction);
    const missingFields = this.getMissingImportantFields(selectedInitData.value);

    this.bridgeInitData.set(bridgeInitData);
    this.initData.set(selectedInitData.value);
    this.initDataSource.set(selectedInitData.source);
    this.missingImportantFields.set(missingFields);
    this.launchDiagnosticsJson.set(this.stringifyUnknown({
      currentHash: extraction.currentHash,
      navigationHash: extraction.navigationHash,
      currentHashParams: extraction.currentHashData.params,
      currentHashWebAppData: extraction.currentHashData.webAppData,
      currentHashReconstructedWebAppData: extraction.currentHashData.reconstructedWebAppData,
      navigationHashWebAppData: extraction.navigationHashData.webAppData,
      navigationHashReconstructedWebAppData: extraction.navigationHashData.reconstructedWebAppData,
      sessionWebAppData: extraction.sessionWebAppData
    }));

    if (!webApp) {
      this.initDataUnsafeJson.set('null');
      this.webAppInfoJson.set(this.stringifyUnknown({
        hasWebApp: false,
        backendInitDataSource: selectedInitData.source,
        backendInitDataLength: selectedInitData.value.length,
        missingImportantFields: missingFields,
        location: this.getLocationInfo()
      }));

      if (selectedInitData.value) {
        this.bridgeStatus.set(missingFields.length > 0 ? 'missing' : 'ready');
        this.statusMessage.set('window.WebApp не найден, но WebAppData найден в URL/hash. Проверьте payload ниже.');
        return;
      }

      this.bridgeStatus.set('failed');
      this.statusMessage.set('window.WebApp не найден и WebAppData в URL/hash тоже не найден.');
      return;
    }

    webApp.ready?.();
    this.initDataUnsafeJson.set(this.stringifyUnknown(webApp.initDataUnsafe ?? null));
    this.webAppInfoJson.set(this.stringifyUnknown({
      hasWebApp: true,
      backendInitDataSource: selectedInitData.source,
      hasBackendInitData: selectedInitData.value.length > 0,
      backendInitDataLength: selectedInitData.value.length,
      bridgeInitDataLength: bridgeInitData.length,
      missingImportantFields: missingFields,
      platform: webApp.platform ?? null,
      version: webApp.version ?? null,
      deviceName: webApp.deviceName ?? null,
      colorScheme: webApp.colorScheme ?? null,
      location: this.getLocationInfo()
    }));

    if (!selectedInitData.value) {
      this.bridgeStatus.set('missing');
      this.statusMessage.set('MAX Bridge загружен, но WebAppData/initData пустой. Откройте страницу из MAX.');
      return;
    }

    if (missingFields.length > 0) {
      this.bridgeStatus.set('missing');
      this.statusMessage.set(`WebAppData получен, но не хватает ключевых полей: ${missingFields.join(', ')}.`);
      return;
    }

    this.bridgeStatus.set('ready');
    this.statusMessage.set('MAX WebAppData получен. JSON ниже можно передавать backend-разработчику.');
  }

  private selectInitData(bridgeInitData: string, extraction: MaxLaunchExtraction): MaxInitDataCandidate {
    const candidates: MaxInitDataCandidate[] = [
      {
        source: 'window.WebApp.initData',
        value: bridgeInitData
      },
      {
        source: 'location.hash -> WebAppData',
        value: extraction.currentHashData.webAppData
      },
      {
        source: 'location.hash -> восстановленный WebAppData',
        value: extraction.currentHashData.reconstructedWebAppData
      },
      {
        source: 'navigation entry hash -> WebAppData',
        value: extraction.navigationHashData.webAppData
      },
      {
        source: 'navigation entry hash -> восстановленный WebAppData',
        value: extraction.navigationHashData.reconstructedWebAppData
      },
      {
        source: 'sessionStorage.WebAppData',
        value: extraction.sessionWebAppData
      }
    ].filter(candidate => candidate.value.trim().length > 0);

    const verifiableCandidate = candidates.find(candidate => this.isVerifiableInitData(candidate.value));

    if (verifiableCandidate) {
      return verifiableCandidate;
    }

    const bestPartialCandidate = candidates
      .map(candidate => ({
        ...candidate,
        score: this.getInitDataScore(candidate.value)
      }))
      .sort((first, second) => second.score - first.score)[0];

    return bestPartialCandidate
      ? { source: bestPartialCandidate.source, value: bestPartialCandidate.value }
      : { source: 'нет данных', value: '' };
  }

  private extractLaunchData(): MaxLaunchExtraction {
    const currentHash = window.location.hash;
    const navigationHash = this.getNavigationHash();

    return {
      currentHash,
      navigationHash,
      currentHashData: this.extractWebAppDataFromHash(currentHash),
      navigationHashData: this.extractWebAppDataFromHash(navigationHash),
      sessionWebAppData: this.getSessionWebAppData()
    };
  }

  private extractWebAppDataFromHash(hash: string): MaxHashExtraction {
    if (!hash) {
      return {
        webAppData: '',
        reconstructedWebAppData: '',
        params: []
      };
    }

    const hashBody = hash.replace(/^#/, '');
    const hashParams = new URLSearchParams(hashBody);
    const params = Array.from(hashParams.entries()).map(([key, value]) => ({ key, value }));
    const webAppData = hashParams.get('WebAppData') ?? '';
    const siblingInitDataParams = params.filter(param => this.initDataParamKeys.has(param.key));

    if (this.isVerifiableInitData(webAppData)) {
      return {
        webAppData,
        reconstructedWebAppData: '',
        params
      };
    }

    const webAppDataPairs = this.parseInitDataPairs(webAppData);
    const reconstructedPairs = webAppDataPairs.length > 0
      ? [...webAppDataPairs, ...siblingInitDataParams]
      : siblingInitDataParams;

    return {
      webAppData,
      reconstructedWebAppData: this.buildInitDataString(reconstructedPairs),
      params
    };
  }

  private parseInitDataPairs(rawInitData: string): MaxLaunchParam[] {
    if (!rawInitData) {
      return [];
    }

    try {
      return Array.from(new URLSearchParams(rawInitData).entries())
        .map(([key, value]) => ({ key, value }));
    } catch {
      return [];
    }
  }

  private buildInitDataString(pairs: MaxLaunchParam[]): string {
    const params = new URLSearchParams();

    for (const pair of pairs) {
      if (!params.has(pair.key)) {
        params.set(pair.key, pair.value);
      }
    }

    return params.toString();
  }

  private isVerifiableInitData(rawInitData: string): boolean {
    if (!rawInitData) {
      return false;
    }

    const params = new URLSearchParams(rawInitData);

    return params.has('auth_date') && params.has('hash');
  }

  private getInitDataScore(rawInitData: string): number {
    const params = new URLSearchParams(rawInitData);
    const importantScore = this.importantInitDataKeys
      .filter(key => params.has(key))
      .length * 10;

    return importantScore + Array.from(params.keys()).length;
  }

  private getMissingImportantFields(rawInitData: string): string[] {
    if (!rawInitData) {
      return this.importantInitDataKeys;
    }

    const params = new URLSearchParams(rawInitData);

    return this.importantInitDataKeys.filter(key => !params.has(key));
  }

  private getSessionWebAppData(): string {
    try {
      return window.sessionStorage.getItem('WebAppData') ?? '';
    } catch {
      return '';
    }
  }

  private getNavigationHash(): string {
    const navigationEntry = performance.getEntriesByType('navigation')[0];

    if (!navigationEntry?.name) {
      return '';
    }

    try {
      return new URL(navigationEntry.name).hash;
    } catch {
      return '';
    }
  }

  private getLocationInfo(): Record<string, string> {
    return {
      href: window.location.href,
      search: window.location.search,
      hash: window.location.hash
    };
  }

  private stringifyUnknown(value: unknown): string {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return JSON.stringify({ error: 'Не удалось сериализовать значение' }, null, 2);
    }
  }
}
