import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { License } from './models/license.models';
import { getCachedRequest, RequestCacheEntry } from './request-cache';

@Injectable({
  providedIn: 'root'
})
export class LicenseService {
  private readonly apiClient = inject(ApiClientService);
  private readonly licenseCache = new Map<string, RequestCacheEntry<License>>();
  private readonly cacheTtlMs = 5 * 60 * 1000;

  getLicenseByUserId(userId: number): Observable<License> {
    return getCachedRequest(
      this.licenseCache,
      String(userId),
      this.cacheTtlMs,
      () => this.apiClient.get<License>(`/licenses/${userId}`, { silentErrors: [403, 404] })
    );
  }

  hasProAccess(license: License | null): boolean {
    return license?.plan.trim().toLowerCase() === 'pro';
  }
}
