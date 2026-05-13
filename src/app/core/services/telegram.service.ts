import { Injectable, signal, computed } from '@angular/core';

// TypeScript interfaces for Telegram WebApp API
export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramWebAppInitDataUnsafe {
  query_id?: string;
  user?: TelegramWebAppUser;
  receiver?: TelegramWebAppUser;
  chat?: {
    id: number;
    type: string;
    title: string;
    username?: string;
    photo_url?: string;
  };
  chat_type?: string;
  chat_instance?: string;
  start_param?: string;
  can_send_after?: number;
  auth_date: number;
  hash: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: TelegramWebAppInitDataUnsafe;
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;
  BackButton: {
    isVisible: boolean;
    onClick(callback: () => void): void;
    offClick(callback: () => void): void;
    show(): void;
    hide(): void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText(text: string): void;
    onClick(callback: () => void): void;
    offClick(callback: () => void): void;
    show(): void;
    hide(): void;
    enable(): void;
    disable(): void;
    showProgress(leaveActive?: boolean): void;
    hideProgress(): void;
    setParams(params: {
      text?: string;
      color?: string;
      text_color?: string;
      is_active?: boolean;
      is_visible?: boolean;
    }): void;
  };
  ready(): void;
  expand(): void;
  close(): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
  onEvent(eventType: string, eventHandler: () => void): void;
  offEvent(eventType: string, eventHandler: () => void): void;
  sendData(data: string): void;
  switchInlineQuery(query: string, choose_chat_types?: string[]): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  openInvoice(url: string, callback?: (status: string) => void): void;
  showPopup(params: {
    title?: string;
    message: string;
    buttons?: Array<{ id?: string; type?: string; text?: string }>;
  }, callback?: (buttonId: string) => void): void;
  showAlert(message: string, callback?: () => void): void;
  showConfirm(message: string, callback?: (confirmed: boolean) => void): void;
  showScanQrPopup(params: { text?: string }, callback?: (data: string) => boolean): void;
  closeScanQrPopup(): void;
  readTextFromClipboard(callback?: (data: string) => void): void;
  requestWriteAccess(callback?: (granted: boolean) => void): void;
  requestContact(callback?: (granted: boolean) => void): void;
  invokeCustomMethod(method: string, params: Record<string, unknown>, callback?: (error: string, result: unknown) => void): void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

@Injectable({
  providedIn: 'root'
})
export class TelegramService {
  private readonly telegramScriptUrl = 'https://telegram.org/js/telegram-web-app.js';
  private readonly _isTelegramWebApp = signal<boolean>(false);
  private readonly _initData = signal<string | null>(null);
  private readonly _telegramUser = signal<TelegramWebAppUser | null>(null);
  private readonly _isTelegramLaunch = signal<boolean>(false);
  private sdkLoadPromise?: Promise<boolean>;

  readonly isTelegramWebApp = this._isTelegramWebApp.asReadonly();
  readonly initData = this._initData.asReadonly();
  readonly telegramUser = this._telegramUser.asReadonly();
  readonly isTelegramLaunch = this._isTelegramLaunch.asReadonly();

  readonly isReady = computed(() => this._isTelegramWebApp() && this._initData() !== null);

  constructor() {
    this._isTelegramLaunch.set(this.detectTelegramLaunch());
    this.detectTelegramWebApp();
  }

  initialize(timeoutMs = 8000, forceTelegramLaunch = false): Promise<boolean> {
    if (this.isReady()) {
      return Promise.resolve(true);
    }

    if (forceTelegramLaunch) {
      this._isTelegramLaunch.set(true);
    }

    if (!this._isTelegramLaunch()) {
      return Promise.resolve(false);
    }

    return this.loadSdk(timeoutMs).then(() => {
      this.detectTelegramWebApp();
      return this.isReady();
    });
  }

  private detectTelegramLaunch(): boolean {
    if (window.Telegram?.WebApp) {
      return true;
    }

    const launchParams = new URLSearchParams(this.getTelegramParamsSource());
    return launchParams.has('tgWebAppData') || launchParams.has('tgWebAppVersion');
  }

  private getTelegramParamsSource(): string {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;

    return hash || window.location.search;
  }

  private loadSdk(timeoutMs: number): Promise<boolean> {
    if (window.Telegram?.WebApp) {
      return Promise.resolve(true);
    }

    if (this.sdkLoadPromise) {
      return this.sdkLoadPromise;
    }

    this.sdkLoadPromise = new Promise<boolean>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${this.telegramScriptUrl}"]`);
      const script = existingScript ?? document.createElement('script');
      let settled = false;

      const cleanup = (): void => {
        window.clearTimeout(timeoutId);
        script.removeEventListener('load', handleLoad);
        script.removeEventListener('error', handleError);
      };

      const settle = (value: boolean): void => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        resolve(value);
      };

      const fail = (): void => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        reject(new Error('Telegram WebApp SDK failed to load'));
      };

      const handleLoad = (): void => settle(true);
      const handleError = (): void => fail();
      const timeoutId = window.setTimeout(() => fail(), timeoutMs);

      script.addEventListener('load', handleLoad);
      script.addEventListener('error', handleError);

      if (!existingScript) {
        script.src = this.telegramScriptUrl;
        script.async = true;
        document.head.appendChild(script);
      }
    });

    this.sdkLoadPromise.catch(() => {
      this.sdkLoadPromise = undefined;
    });

    return this.sdkLoadPromise;
  }

  private detectTelegramWebApp(): void {
    const telegram = window.Telegram?.WebApp;

    if (!telegram) {
      return;
    }

    const initData = telegram.initData;

    if (!initData || initData.trim() === '') {
      return;
    }

    // We are inside Telegram WebApp with valid initData
    this._isTelegramWebApp.set(true);
    this._initData.set(initData);

    // Extract user info from initDataUnsafe if available
    const user = telegram.initDataUnsafe?.user;
    if (user) {
      this._telegramUser.set(user);
    }

    // Notify Telegram that the app is ready
    telegram.ready();

    // Expand the mini app to full height
    telegram.expand();
  }

  getTelegramWebApp(): TelegramWebApp | undefined {
    return window.Telegram?.WebApp;
  }
}
