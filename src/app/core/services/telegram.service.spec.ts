import { TelegramService } from './telegram.service';

describe('TelegramService', () => {
  const storedInitParamsKey = '__telegram__initParams';
  const originalTelegram = window.Telegram;

  afterEach(() => {
    window.sessionStorage.removeItem(storedInitParamsKey);
    window.Telegram = originalTelegram;
  });

  it('recognizes a Telegram reload from stored launch data', () => {
    window.Telegram = undefined;
    window.sessionStorage.setItem(storedInitParamsKey, JSON.stringify({
      tgWebAppData: 'query_id=stored&hash=signed'
    }));

    const service = new TelegramService();

    expect(service.isTelegramLaunch()).toBeTrue();
  });

  it('ignores broken stored launch data', () => {
    window.Telegram = undefined;
    window.sessionStorage.setItem(storedInitParamsKey, '{');

    const service = new TelegramService();

    expect(service.isTelegramLaunch()).toBeFalse();
  });
});
