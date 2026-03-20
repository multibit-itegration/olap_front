import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { User } from './models/user.models';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly apiClient = inject(ApiClientService);

  getMe(): Observable<User> {
    return this.apiClient.get<User>('/users/me');
  }
}
