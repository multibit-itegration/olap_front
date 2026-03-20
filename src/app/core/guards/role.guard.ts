import { inject } from '@angular/core';
import { Router, type CanActivateFn, UrlTree } from '@angular/router';
import { Observable, map, catchError, of } from 'rxjs';
import { AuthService } from '../api/auth.service';
import { UserRole } from '../api/models/user.models';

export function roleGuard(allowedRoles: UserRole[]): CanActivateFn {
  return (): boolean | UrlTree | Observable<boolean | UrlTree> => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const role = authService.userRole();

    // User already loaded — check synchronously
    if (role) {
      return allowedRoles.includes(role)
        ? true
        : redirectToDashboard(router, role);
    }

    // Authenticated but user not yet loaded (page refresh) — wait for load
    if (authService.isAuthenticated()) {
      return authService.loadCurrentUser().pipe(
        map(user =>
          allowedRoles.includes(user.role)
            ? true
            : redirectToDashboard(router, user.role)
        ),
        catchError(() => of(router.createUrlTree(['/login'])))
      );
    }

    return router.createUrlTree(['/login']);
  };
}

function redirectToDashboard(router: Router, role: UserRole): UrlTree {
  return role === 'admin'
    ? router.createUrlTree(['/admin/dashboard'])
    : router.createUrlTree(['/user/databases']);
}
