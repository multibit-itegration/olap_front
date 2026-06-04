import { Observable, of, throwError } from 'rxjs';
import { catchError, shareReplay, tap } from 'rxjs/operators';

export interface RequestCacheEntry<T> {
  readonly expiresAt: number;
  readonly value?: T;
  readonly request$?: Observable<T>;
}

export function getCachedRequest<T>(
  cache: Map<string, RequestCacheEntry<T>>,
  key: string,
  ttlMs: number,
  requestFactory: () => Observable<T>
): Observable<T> {
  const cached = cache.get(key);

  if (cached?.value !== undefined && cached.expiresAt > Date.now()) {
    return of(cached.value);
  }

  if (cached?.request$) {
    return cached.request$;
  }

  const request$ = requestFactory().pipe(
    tap(value => setCachedValue(cache, key, value, ttlMs)),
    catchError(error => {
      cache.delete(key);
      return throwError(() => error);
    }),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  cache.set(key, { expiresAt: 0, request$ });
  return request$;
}

export function setCachedValue<T>(
  cache: Map<string, RequestCacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number
): void {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
  });
}
