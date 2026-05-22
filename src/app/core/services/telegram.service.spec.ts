import { TelegramService } from './telegram.service';
import { TestBed } from '@angular/core/testing';

describe('TelegramService', () => {
  const storedInitParamsKey = '__telegram__initParams';
  const originalTelegram = window.Telegram;

  afterEach(() => {
    window.sessionStorage.removeItem(storedInitParamsKey);
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
});
