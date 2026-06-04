import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiClientService } from './api-client.service';
import { User } from './models/user.models';
import { License, IikoConnection, MainMetrics, WaiterMetrics, UserUpdateRequest, UserUpdateResponse, LicenseUpdateRequest, IikoConnectionCreateRequest, IikoConnectionUpdateRequest } from './models/admin.models';
import { getCachedRequest, RequestCacheEntry } from './request-cache';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly apiClient = inject(ApiClientService);
  private readonly shortCacheTtlMs = 2 * 60 * 1000;
  private readonly overviewCacheTtlMs = 2 * 60 * 1000;
  private readonly usersCache = new Map<string, RequestCacheEntry<User[]>>();
  private readonly licensesCache = new Map<string, RequestCacheEntry<License[]>>();
  private readonly userLicenseCache = new Map<string, RequestCacheEntry<License>>();
  private readonly iikoConnectionsCache = new Map<string, RequestCacheEntry<IikoConnection[]>>();
  private readonly mainMetricsCache = new Map<string, RequestCacheEntry<MainMetrics>>();
  private readonly topWaitersCache = new Map<string, RequestCacheEntry<WaiterMetrics[]>>();

  getAllUsers(): Observable<User[]> {
    return getCachedRequest(
      this.usersCache,
      'all',
      this.shortCacheTtlMs,
      () => this.apiClient.get<User[]>('/users/')
    );
  }

  getAllLicenses(): Observable<License[]> {
    return getCachedRequest(
      this.licensesCache,
      'all',
      this.shortCacheTtlMs,
      () => this.apiClient.get<License[]>('/licenses/')
    );
  }

  getIikoConnectionsByUserId(userId: number): Observable<IikoConnection[]> {
    // 404 is expected when user has no iiko connections - don't log it as error
    return getCachedRequest(
      this.iikoConnectionsCache,
      String(userId),
      this.shortCacheTtlMs,
      () => this.apiClient.get<IikoConnection[]>(`/iiko_connections/${userId}`, { silentErrors: [404] })
    );
  }

  getMainMetrics(connectionId: number): Observable<MainMetrics> {
    return getCachedRequest(
      this.mainMetricsCache,
      String(connectionId),
      this.overviewCacheTtlMs,
      () => this.apiClient.get<MainMetrics>(`/iiko_connections/main_metrics/${connectionId}`)
    );
  }

  getTopWaiters(connectionId: number): Observable<WaiterMetrics[]> {
    return getCachedRequest(
      this.topWaitersCache,
      String(connectionId),
      this.overviewCacheTtlMs,
      () => this.apiClient.get<WaiterMetrics[]>(`/iiko_connections/top_waiters/${connectionId}`)
    );
  }

  getUserById(userId: number): Observable<User> {
    return this.apiClient.get<User>(`/users/${userId}`);
  }

  updateUser(userId: number, data: UserUpdateRequest): Observable<UserUpdateResponse> {
    return this.apiClient.patch<UserUpdateResponse>(`/users/edit/${userId}`, data).pipe(
      tap(() => this.usersCache.clear())
    );
  }

  deleteUser(userId: number): Observable<void> {
    return this.apiClient.delete<void>(`/users/${userId}`).pipe(
      tap(() => {
        this.usersCache.clear();
        this.licensesCache.clear();
        this.userLicenseCache.delete(String(userId));
        this.iikoConnectionsCache.delete(String(userId));
      })
    );
  }

  getLicenseByUserId(userId: number): Observable<License> {
    return getCachedRequest(
      this.userLicenseCache,
      String(userId),
      this.shortCacheTtlMs,
      () => this.apiClient.get<License>(`/licenses/${userId}`)
    );
  }

  updateLicense(licenseId: number, data: LicenseUpdateRequest): Observable<License> {
    return this.apiClient.patch<License>(`/licenses/${licenseId}`, data).pipe(
      tap(license => {
        this.licensesCache.clear();
        this.userLicenseCache.delete(String(license.user_id));
      })
    );
  }

  deleteLicense(licenseId: number): Observable<void> {
    return this.apiClient.delete<void>(`/licenses/${licenseId}`).pipe(
      tap(() => {
        this.licensesCache.clear();
        this.userLicenseCache.clear();
      })
    );
  }

  createIikoConnection(userId: number, data: IikoConnectionCreateRequest): Observable<IikoConnection> {
    return this.apiClient.post<IikoConnection>(`/iiko_connections/${userId}`, data).pipe(
      tap(() => this.iikoConnectionsCache.delete(String(userId)))
    );
  }

  updateIikoConnection(connectionId: number, data: IikoConnectionUpdateRequest): Observable<IikoConnection> {
    return this.apiClient.patch<IikoConnection>(`/iiko_connections/edit/${connectionId}`, data).pipe(
      tap(() => {
        this.iikoConnectionsCache.clear();
        this.mainMetricsCache.delete(String(connectionId));
        this.topWaitersCache.delete(String(connectionId));
      })
    );
  }

  deleteIikoConnection(connectionId: number): Observable<void> {
    return this.apiClient.delete<void>(`/iiko_connections/${connectionId}`).pipe(
      tap(() => {
        this.iikoConnectionsCache.clear();
        this.mainMetricsCache.delete(String(connectionId));
        this.topWaitersCache.delete(String(connectionId));
      })
    );
  }
}
