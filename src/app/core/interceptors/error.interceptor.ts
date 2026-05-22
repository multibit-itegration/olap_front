import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../api/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const isAuthRequest = req.url.includes('/auth/login') || req.url.includes('/auth/telegram');

      if (error.status === 401 && !isAuthRequest) {
        authService.logout();

        if (router.url.split(/[?#]/)[0] !== '/logintg') {
          router.navigate(['/login']);
        }
      }
      return throwError(() => error);
    })
  );
};
