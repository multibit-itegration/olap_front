import { TestBed } from '@angular/core/testing';
import { TelegramAuthDebugService } from './telegram-auth-debug.service';

describe('TelegramAuthDebugService', () => {
  const storageKey = 'telegram_auth_debug_logs';

  beforeEach(() => {
    window.sessionStorage.removeItem(storageKey);
  });

  afterEach(() => {
    window.sessionStorage.removeItem(storageKey);
    TestBed.resetTestingModule();
  });

  it('stores safe entries in session storage for page refresh debugging', () => {
    const service = TestBed.inject(TelegramAuthDebugService);

    service.log('Login', 'POST /auth/telegram failed', 'error', {
      status: 401,
      hasInitData: true
    });

    const latestEntry = service.entries()[0];
    const storedEntries = window.sessionStorage.getItem(storageKey);

    expect(latestEntry.message).toBe('POST /auth/telegram failed');
    expect(latestEntry.details).toBe('{"status":401,"hasInitData":true}');
    expect(storedEntries).toContain('POST /auth/telegram failed');
  });

  it('keeps a visible entry after logs are cleared', () => {
    const service = TestBed.inject(TelegramAuthDebugService);

    service.clear();

    expect(service.entries()).toHaveSize(1);
    expect(service.entries()[0].message).toBe('Логи очищены');
  });
});
