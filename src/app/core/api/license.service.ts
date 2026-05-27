import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { License } from './models/license.models';

@Injectable({
  providedIn: 'root'
})
export class LicenseService {
  private readonly apiClient = inject(ApiClientService);

  getLicenseByUserId(userId: number): Observable<License> {
    return this.apiClient.get<License>(`/licenses/${userId}`, { silentErrors: [403, 404] });
  }

  hasProAccess(license: License | null): boolean {
    return license?.plan.trim().toLowerCase() === 'pro';
  }
}
