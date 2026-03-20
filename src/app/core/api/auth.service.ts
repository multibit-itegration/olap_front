import { inject, Injectable, signal, computed } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap, catchError, shareReplay } from 'rxjs/operators';
import { ApiClientService } from './api-client.service';
import { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, TelegramAuthResponse } from './models/auth.models';
import { UserService } from './user.service';
import { User } from './models/user.models';
import { TelegramService } from '../services/telegram.service';

interface StoredToken {
  token: string;
  expiresAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiClient = inject(ApiClientService);
  private readonly userService = inject(UserService);
  private readonly telegramService = inject(TelegramService);
  private readonly SESSION_TOKEN_KEY = 'session_token';
  private readonly USER_ID_KEY = 'user_id';
  private readonly TOKEN_EXPIRATION_HOURS = 24;

  // Cached request to prevent multiple concurrent /users/me calls
  private currentUserRequest$: Observable<User> | null = null;

  // Reactive token state — synced with localStorage
  private readonly _hasToken = signal<boolean>(this.getSessionToken() !== null);

  // User state management with signals
  currentUser = signal<User | null>(null);
  userRole = computed(() => this.currentUser()?.role ?? null);
  isAdmin = computed(() => this.userRole() === 'admin');
  isAuthenticated = computed(() => this._hasToken());
  isFullyAuthenticated = computed(() => this.isAuthenticated() && this.currentUser() !== null);
  isTelegramAuth = computed(() => this.telegramService.isTelegramWebApp());

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.apiClient.post<LoginResponse>('/auth/login', credentials)
      .pipe(
        tap(response => this.setSessionToken(response.session_token))
      );
  }

  register(userData: RegisterRequest): Observable<RegisterResponse> {
    return this.apiClient.post<RegisterResponse>('/auth/register', userData);
  }

  // TODO: Replace endpoint with actual backend endpoint when ready
  // Backend endpoint: POST /auth/telegram with { init_data: string }
  telegramAuth(initData: string): Observable<TelegramAuthResponse> {
    return this.apiClient.post<TelegramAuthResponse>('/auth/telegram', { init_data: initData })
      .pipe(
        tap(response => this.setSessionToken(response.session_token))
      );
  }

  logout(): void {
    this.clearSessionToken();
    localStorage.removeItem(this.USER_ID_KEY);
    this.currentUser.set(null);
    this.currentUserRequest$ = null;
  }

  loadCurrentUser(): Observable<User> {
    // If already loaded, return cached user
    const existing = this.currentUser();
    if (existing !== null) {
      return of(existing);
    }

    // If request is in flight, return the same observable (dedup)
    if (this.currentUserRequest$) {
      return this.currentUserRequest$;
    }

    this.currentUserRequest$ = this.userService.getMe().pipe(
      tap(user => {
        this.currentUser.set(user);
        this.setUserId(user.id);
        this.currentUserRequest$ = null;
      }),
      catchError(error => {
        this.currentUserRequest$ = null;
        throw error;
      }),
      shareReplay(1)
    );

    return this.currentUserRequest$;
  }

  getUserId(): number | null {
    const stored = localStorage.getItem(this.USER_ID_KEY);
    if (!stored) return null;
    const id = Number(stored);
    return Number.isNaN(id) ? null : id;
  }

  getSessionToken(): string | null {
    const storedData = localStorage.getItem(this.SESSION_TOKEN_KEY);

    if (!storedData) {
      return null;
    }

    try {
      const parsed: StoredToken = JSON.parse(storedData);

      if (Date.now() > parsed.expiresAt) {
        this.clearSessionToken();
        return null;
      }

      return parsed.token;
    } catch {
      this.clearSessionToken();
      return null;
    }
  }

  private setSessionToken(token: string): void {
    if (!token) {
      this.clearSessionToken();
      return;
    }

    const expiresAt = Date.now() + (this.TOKEN_EXPIRATION_HOURS * 60 * 60 * 1000);
    const tokenData: StoredToken = {
      token,
      expiresAt
    };
    localStorage.setItem(this.SESSION_TOKEN_KEY, JSON.stringify(tokenData));
    this._hasToken.set(true);
  }

  private setUserId(id: number): void {
    localStorage.setItem(this.USER_ID_KEY, String(id));
  }

  private clearSessionToken(): void {
    localStorage.removeItem(this.SESSION_TOKEN_KEY);
    this._hasToken.set(false);
  }
}
