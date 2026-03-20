import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiClientService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  get<T>(endpoint: string, options?: { silentErrors?: number[] }): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${endpoint}`)
      .pipe(catchError((error) => this.handleError(error, options?.silentErrors)));
  }

  post<T>(endpoint: string, body: unknown, options?: { silentErrors?: number[] }): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${endpoint}`, body)
      .pipe(catchError((error) => this.handleError(error, options?.silentErrors)));
  }

  put<T>(endpoint: string, body: unknown, options?: { silentErrors?: number[] }): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${endpoint}`, body)
      .pipe(catchError((error) => this.handleError(error, options?.silentErrors)));
  }

  patch<T>(endpoint: string, body: unknown, options?: { silentErrors?: number[] }): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${endpoint}`, body)
      .pipe(catchError((error) => this.handleError(error, options?.silentErrors)));
  }

  delete<T>(endpoint: string, options?: { silentErrors?: number[] }): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${endpoint}`)
      .pipe(catchError((error) => this.handleError(error, options?.silentErrors)));
  }

  private handleError(error: HttpErrorResponse, silentErrors?: number[]): Observable<never> {
    // Check if this error status should be silent
    const isSilentError = silentErrors?.includes(error.status);

    if (!isSilentError) {
      // Log error to console for debugging (can be replaced with logging service)
      if (error.error instanceof ErrorEvent) {
        // Client-side or network error
        console.error('Client error:', error.error.message);
      } else {
        // Backend returned an unsuccessful response code
        // Only log status code, not error body which may contain sensitive data
        console.error(`Backend returned code ${error.status}`);
      }
    }

    // Always throw the error for proper handling in components
    // Silent errors are just not logged, but still propagate for catchError handling
    return throwError(() => error);
  }
}
