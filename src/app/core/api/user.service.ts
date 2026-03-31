import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { User, UserProfileUpdateRequest, UserProfileUpdateResponse } from './models/user.models';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly apiClient = inject(ApiClientService);

  getMe(): Observable<User> {
    return this.apiClient.get<User>('/users/me');
  }

  updateProfile(data: UserProfileUpdateRequest): Observable<UserProfileUpdateResponse> {
    return this.apiClient.patch<UserProfileUpdateResponse>('/users/me', data);
  }
}
