import { Injectable, signal } from '@angular/core';

export type TelegramAuthDebugLevel = 'info' | 'success' | 'warning' | 'error';

export interface TelegramAuthDebugEntry {
  id: string;
  timestamp: string;
  level: TelegramAuthDebugLevel;
  source: string;
  message: string;
  details?: string;
}

export type TelegramAuthDebugDetails = Record<string, string | number | boolean | null | undefined>;

@Injectable({
  providedIn: 'root'
})
export class TelegramAuthDebugService {
  private readonly storageKey = 'telegram_auth_debug_logs';
  private readonly maxEntries = 80;
  private nextId = 0;
  private readonly _entries = signal<TelegramAuthDebugEntry[]>(this.readEntries());

  readonly entries = this._entries.asReadonly();

  constructor() {
    this.log('Page', 'Новая загрузка приложения', 'info', {
      route: window.location.pathname
    });
  }

  log(
    source: string,
    message: string,
    level: TelegramAuthDebugLevel = 'info',
    details?: TelegramAuthDebugDetails
  ): void {
    const nextEntries = [
      {
        id: `${Date.now()}-${this.nextId++}`,
        timestamp: new Date().toISOString(),
        level,
        source,
        message,
        details: this.formatDetails(details)
      },
      ...this._entries()
    ].slice(0, this.maxEntries);

    this._entries.set(nextEntries);
    this.storeEntries(nextEntries);
  }

  clear(): void {
    this._entries.set([]);
    this.storeEntries([]);
    this.log('Logs', 'Логи очищены');
  }

  private readEntries(): TelegramAuthDebugEntry[] {
    try {
      const storedEntries = window.sessionStorage.getItem(this.storageKey);
      if (!storedEntries) {
        return [];
      }

      const entries = JSON.parse(storedEntries) as TelegramAuthDebugEntry[];
      return Array.isArray(entries) ? entries.slice(0, this.maxEntries) : [];
    } catch {
      return [];
    }
  }

  private storeEntries(entries: TelegramAuthDebugEntry[]): void {
    try {
      window.sessionStorage.setItem(this.storageKey, JSON.stringify(entries));
    } catch {
      return;
    }
  }

  private formatDetails(details?: TelegramAuthDebugDetails): string | undefined {
    if (!details) {
      return undefined;
    }

    const safeDetails = Object.fromEntries(
      Object.entries(details).filter(([, value]) => value !== undefined)
    );

    return Object.keys(safeDetails).length > 0
      ? JSON.stringify(safeDetails)
      : undefined;
  }
}
