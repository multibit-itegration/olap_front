import { TelegramService, TelegramWebApp } from './telegram.service';
import { TestBed } from '@angular/core/testing';

describe('TelegramService', () => {
  const storedInitParamsKey = '__telegram__initParams';
  const signedInitDataKey = 'telegram_signed_init_data';
  const originalTelegram = window.Telegram;

  afterEach(() => {
    window.sessionStorage.removeItem(storedInitParamsKey);
    window.sessionStorage.removeItem(signedInitDataKey);
    window.Telegram = originalTelegram;
    TestBed.resetTestingModule();
  });

  it('recognizes a Telegram reload from stored launch data', () => {
    window.Telegram = undefined;
    window.sessionStorage.setItem(storedInitParamsKey, JSON.stringify({
      tgWebAppData: 'query_id=stored&hash=signed'
    }));

    const service = TestBed.inject(TelegramService);

    expect(service.isTelegramLaunch()).toBeTrue();
  });

  it('ignores broken stored launch data', () => {
    window.Telegram = undefined;
    window.sessionStorage.setItem(storedInitParamsKey, '{');

    const service = TestBed.inject(TelegramService);

    expect(service.isTelegramLaunch()).toBeFalse();
  });

  it('stores signed initData before Telegram auth begins', () => {
    const signedInitData = 'auth_date=1&hash=signed-hash&user=%7B%22id%22%3A1%7D';
    window.Telegram = createTelegram(signedInitData);

    const service = TestBed.inject(TelegramService);

    expect(service.initData()).toBe(signedInitData);
    expect(window.sessionStorage.getItem(signedInitDataKey)).toBe(signedInitData);
  });

  it('restores saved signed initData when Telegram reload data has no hash', () => {
    const signedInitData = 'auth_date=1&hash=signed-hash&user=%7B%22id%22%3A1%7D';
    const reloadInitData = 'auth_date=1&user=%7B%22id%22%3A1%7D';
    window.sessionStorage.setItem(signedInitDataKey, signedInitData);
    window.Telegram = createTelegram(reloadInitData);

    const service = TestBed.inject(TelegramService);

    expect(service.initData()).toBe(signedInitData);
    expect(service.isReady()).toBeTrue();
  });

  function createTelegram(initData: string): NonNullable<typeof window.Telegram> {
    const webApp = {
      initData,
      initDataUnsafe: {
        auth_date: 1,
        hash: '',
        user: {
          id: 1,
          first_name: 'Test'
        }
      },
      platform: 'macos',
      version: '9.6',
      ready: jasmine.createSpy('ready'),
      expand: jasmine.createSpy('expand')
    } as unknown as TelegramWebApp;

    return { WebApp: webApp };
  }
});
