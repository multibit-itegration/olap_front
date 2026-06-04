import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of, timer } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AppPreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (route.data?.['preload'] !== true) {
      return of(null);
    }

    const delay = route.data?.['preloadDelay'];
    if (typeof delay === 'number' && delay > 0) {
      return timer(delay).pipe(mergeMap(() => load()));
    }

    return load();
  }
}
