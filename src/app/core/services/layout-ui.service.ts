import { Injectable, computed, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LayoutUiService {
  private readonly mobileNavHiddenReasons = signal<readonly string[]>([]);

  readonly mobileNavHidden = computed(() => this.mobileNavHiddenReasons().length > 0);

  setMobileNavHidden(reason: string, hidden: boolean): void {
    const reasons = this.mobileNavHiddenReasons();

    if (hidden) {
      if (!reasons.includes(reason)) {
        this.mobileNavHiddenReasons.set([...reasons, reason]);
      }
      return;
    }

    if (reasons.includes(reason)) {
      this.mobileNavHiddenReasons.set(reasons.filter(item => item !== reason));
    }
  }
}
