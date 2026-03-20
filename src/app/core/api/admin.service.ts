import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { User } from './models/user.models';
import { License, IikoConnection, UserUpdateRequest, UserUpdateResponse, LicenseUpdateRequest, IikoConnectionCreateRequest, IikoConnectionUpdateRequest } from './models/admin.models';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly apiClient = inject(ApiClientService);

  getAllUsers(): Observable<User[]> {
    return this.apiClient.get<User[]>('/users/');
  }

  getAllLicenses(): Observable<License[]> {
    return this.apiClient.get<License[]>('/licenses/');
  }

  getIikoConnectionsByUserId(userId: number): Observable<IikoConnection[]> {
    // 404 is expected when user has no iiko connections - don't log it as error
    return this.apiClient.get<IikoConnection[]>(`/iiko_connections/${userId}`, { silentErrors: [404] });
  }

  getUserById(userId: number): Observable<User> {
    return this.apiClient.get<User>(`/users/${userId}`);
  }

  updateUser(userId: number, data: UserUpdateRequest): Observable<UserUpdateResponse> {
    return this.apiClient.patch<UserUpdateResponse>(`/users/edit/${userId}`, data);
  }

  deleteUser(userId: number): Observable<void> {
    return this.apiClient.delete<void>(`/users/${userId}`);
  }

  getLicenseByUserId(userId: number): Observable<License> {
    return this.apiClient.get<License>(`/licenses/${userId}`);
  }

  updateLicense(licenseId: number, data: LicenseUpdateRequest): Observable<License> {
    return this.apiClient.patch<License>(`/licenses/${licenseId}`, data);
  }

  deleteLicense(licenseId: number): Observable<void> {
    return this.apiClient.delete<void>(`/licenses/${licenseId}`);
  }

  createIikoConnection(userId: number, data: IikoConnectionCreateRequest): Observable<IikoConnection> {
    return this.apiClient.post<IikoConnection>(`/iiko_connections/${userId}`, data);
  }

  updateIikoConnection(connectionId: number, data: IikoConnectionUpdateRequest): Observable<IikoConnection> {
    return this.apiClient.patch<IikoConnection>(`/iiko_connections/edit/${connectionId}`, data);
  }

  deleteIikoConnection(connectionId: number): Observable<void> {
    return this.apiClient.delete<void>(`/iiko_connections/${connectionId}`);
  }
}
