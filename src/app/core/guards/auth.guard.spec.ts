import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../api/auth.service';
import { User } from '../api/models/user.models';
import { of, throwError } from 'rxjs';

describe('authGuard', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;
  let mockUrlTree: UrlTree;
  let mockRoute: ActivatedRouteSnapshot;
  let mockState: RouterStateSnapshot;

  const mockUser: User = {
    id: 1,
    name: 'Test User',
    phone: '+1234567890',
    email: 'test@example.com',
    telegram_id: null,
    role: 'user'
  };

  beforeEach(() => {
    const authServiceSpy = jasmine.createSpyObj('AuthService', [
      'isAuthenticated',
      'loadCurrentUser',
      'logout'
    ], {
      currentUser: jasmine.createSpy('currentUser')
    });

    const routerSpy = jasmine.createSpyObj('Router', ['createUrlTree']);
    mockUrlTree = {} as UrlTree;
    routerSpy.createUrlTree.and.returnValue(mockUrlTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    });

    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;

    mockRoute = {} as ActivatedRouteSnapshot;
    mockState = { url: '/test-route' } as RouterStateSnapshot;
  });

  describe('when user is not authenticated', () => {
    it('should redirect to login when no token exists', (done) => {
      authService.isAuthenticated.and.returnValue(false);

      TestBed.runInInjectionContext(() => {
        const result = authGuard(mockRoute, mockState);

        expect(result).toBe(mockUrlTree);
        expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
        expect(authService.loadCurrentUser).not.toHaveBeenCalled();
        done();
      });
    });

    it('should not attempt to load user when not authenticated', (done) => {
      authService.isAuthenticated.and.returnValue(false);

      TestBed.runInInjectionContext(() => {
        authGuard(mockRoute, mockState);

        expect(authService.loadCurrentUser).not.toHaveBeenCalled();
        done();
      });
    });

    it('should create URL tree with correct login path', (done) => {
      authService.isAuthenticated.and.returnValue(false);

      TestBed.runInInjectionContext(() => {
        authGuard(mockRoute, mockState);

        const callArgs = router.createUrlTree.calls.mostRecent().args;
        expect(callArgs[0]).toEqual(['/login']);
        done();
      });
    });
  });

  describe('when user is authenticated and currentUser is loaded', () => {
    it('should allow access when token exists and user is loaded', (done) => {
      authService.isAuthenticated.and.returnValue(true);
      authService.currentUser.and.returnValue(mockUser);

      TestBed.runInInjectionContext(() => {
        const result = authGuard(mockRoute, mockState);

        expect(result).toBe(true);
        expect(authService.loadCurrentUser).not.toHaveBeenCalled();
        done();
      });
    });

    it('should not call loadCurrentUser when currentUser is already set', (done) => {
      authService.isAuthenticated.and.returnValue(true);
      authService.currentUser.and.returnValue(mockUser);

      TestBed.runInInjectionContext(() => {
        authGuard(mockRoute, mockState);

        expect(authService.loadCurrentUser).not.toHaveBeenCalled();
        done();
      });
    });
  });

  describe('when user is authenticated but currentUser is null (page refresh)', () => {
    it('should load user info when token exists but currentUser is null', (done) => {
      authService.isAuthenticated.and.returnValue(true);
      authService.currentUser.and.returnValue(null);
      authService.loadCurrentUser.and.returnValue(of(mockUser));

      TestBed.runInInjectionContext(() => {
        const result = authGuard(mockRoute, mockState);

        if (typeof result === 'object' && 'subscribe' in result) {
          result.subscribe({
            next: (allowed) => {
              expect(allowed).toBe(true);
              expect(authService.loadCurrentUser).toHaveBeenCalled();
              done();
            }
          });
        } else {
          fail('Expected Observable but got: ' + typeof result);
        }
      });
    });

    it('should return Observable that resolves to true on successful user load', (done) => {
      authService.isAuthenticated.and.returnValue(true);
      authService.currentUser.and.returnValue(null);
      authService.loadCurrentUser.and.returnValue(of(mockUser));

      TestBed.runInInjectionContext(() => {
        const result = authGuard(mockRoute, mockState);

        if (typeof result === 'object' && 'subscribe' in result) {
          result.subscribe({
            next: (allowed) => {
              expect(allowed).toBe(true);
              done();
            },
            error: () => fail('Should not error')
          });
        } else {
          fail('Expected Observable');
        }
      });
    });

    it('should handle page refresh scenario correctly', (done) => {
      authService.isAuthenticated.and.returnValue(true);
      authService.currentUser.and.returnValue(null);
      authService.loadCurrentUser.and.returnValue(of(mockUser));

      TestBed.runInInjectionContext(() => {
        const result = authGuard(mockRoute, mockState);

        if (typeof result === 'object' && 'subscribe' in result) {
          result.subscribe({
            next: (allowed) => {
              expect(authService.loadCurrentUser).toHaveBeenCalledTimes(1);
              expect(allowed).toBe(true);
              done();
            }
          });
        } else {
          fail('Expected Observable');
        }
      });
    });
  });

  describe('when loading user fails', () => {
    it('should logout and redirect to login when loadCurrentUser fails', (done) => {
      authService.isAuthenticated.and.returnValue(true);
      authService.currentUser.and.returnValue(null);
      authService.loadCurrentUser.and.returnValue(throwError(() => new Error('Failed to load user')));

      TestBed.runInInjectionContext(() => {
        const result = authGuard(mockRoute, mockState);

        if (typeof result === 'object' && 'subscribe' in result) {
          result.subscribe({
            next: (redirectResult) => {
              expect(authService.logout).toHaveBeenCalled();
              expect(redirectResult).toBe(mockUrlTree);
              expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
              done();
            },
            error: () => fail('Should not error, should handle gracefully')
          });
        } else {
          fail('Expected Observable');
        }
      });
    });

    it('should clear authentication state on user load failure', (done) => {
      authService.isAuthenticated.and.returnValue(true);
      authService.currentUser.and.returnValue(null);
      authService.loadCurrentUser.and.returnValue(throwError(() => new Error('Network error')));

      TestBed.runInInjectionContext(() => {
        const result = authGuard(mockRoute, mockState);

        if (typeof result === 'object' && 'subscribe' in result) {
          result.subscribe({
            next: () => {
              expect(authService.logout).toHaveBeenCalledTimes(1);
              done();
            }
          });
        } else {
          fail('Expected Observable');
        }
      });
    });

    it('should handle 401 unauthorized error', (done) => {
      authService.isAuthenticated.and.returnValue(true);
      authService.currentUser.and.returnValue(null);
      authService.loadCurrentUser.and.returnValue(throwError(() => ({ status: 401 })));

      TestBed.runInInjectionContext(() => {
        const result = authGuard(mockRoute, mockState);

        if (typeof result === 'object' && 'subscribe' in result) {
          result.subscribe({
            next: (redirectResult) => {
              expect(authService.logout).toHaveBeenCalled();
              expect(redirectResult).toBe(mockUrlTree);
              done();
            }
          });
        } else {
          fail('Expected Observable');
        }
      });
    });

    it('should handle network errors gracefully', (done) => {
      authService.isAuthenticated.and.returnValue(true);
      authService.currentUser.and.returnValue(null);
      authService.loadCurrentUser.and.returnValue(throwError(() => new Error('Network failure')));

      TestBed.runInInjectionContext(() => {
        const result = authGuard(mockRoute, mockState);

        if (typeof result === 'object' && 'subscribe' in result) {
          result.subscribe({
            next: (redirectResult) => {
              expect(redirectResult).toBe(mockUrlTree);
              expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
              done();
            }
          });
        } else {
          fail('Expected Observable');
        }
      });
    });
  });

  describe('edge cases', () => {
    it('should handle multiple rapid guard checks', (done) => {
      authService.isAuthenticated.and.returnValue(true);
      authService.currentUser.and.returnValue(mockUser);

      TestBed.runInInjectionContext(() => {
        const result1 = authGuard(mockRoute, mockState);
        const result2 = authGuard(mockRoute, mockState);
        const result3 = authGuard(mockRoute, mockState);

        expect(result1).toBe(true);
        expect(result2).toBe(true);
        expect(result3).toBe(true);
        expect(authService.loadCurrentUser).not.toHaveBeenCalled();
        done();
      });
    });

    it('should handle empty route state', (done) => {
      authService.isAuthenticated.and.returnValue(true);
      authService.currentUser.and.returnValue(mockUser);

      const emptyState = { url: '' } as RouterStateSnapshot;

      TestBed.runInInjectionContext(() => {
        const result = authGuard(mockRoute, emptyState);

        expect(result).toBe(true);
        done();
      });
    });

    it('should handle undefined route parameters', (done) => {
      authService.isAuthenticated.and.returnValue(false);

      TestBed.runInInjectionContext(() => {
        const result = authGuard(mockRoute, mockState);

        expect(result).toBe(mockUrlTree);
        done();
      });
    });
  });

  describe('return type validation', () => {
    it('should return boolean true when access is immediately granted', (done) => {
      authService.isAuthenticated.and.returnValue(true);
      authService.currentUser.and.returnValue(mockUser);

      TestBed.runInInjectionContext(() => {
        const result = authGuard(mockRoute, mockState);

        expect(typeof result).toBe('boolean');
        expect(result).toBe(true);
        done();
      });
    });

    it('should return UrlTree when not authenticated', (done) => {
      authService.isAuthenticated.and.returnValue(false);

      TestBed.runInInjectionContext(() => {
        const result = authGuard(mockRoute, mockState);

        expect(result).toBe(mockUrlTree);
        expect(typeof result).toBe('object');
        done();
      });
    });

    it('should return Observable when loading user', (done) => {
      authService.isAuthenticated.and.returnValue(true);
      authService.currentUser.and.returnValue(null);
      authService.loadCurrentUser.and.returnValue(of(mockUser));

      TestBed.runInInjectionContext(() => {
        const result = authGuard(mockRoute, mockState);

        expect(typeof result).toBe('object');
        expect(typeof result === 'object' && result !== null && 'subscribe' in result).toBe(true);
        done();
      });
    });
  });

  describe('sequential navigation scenarios', () => {
    it('should allow navigation after successful user load', (done) => {
      authService.isAuthenticated.and.returnValue(true);
      authService.currentUser.and.returnValue(null);
      authService.loadCurrentUser.and.returnValue(of(mockUser));

      TestBed.runInInjectionContext(() => {
        const result = authGuard(mockRoute, mockState);

        if (typeof result === 'object' && 'subscribe' in result) {
          result.subscribe({
            next: (allowed) => {
              expect(allowed).toBe(true);

              // Simulate subsequent navigation
              authService.currentUser.and.returnValue(mockUser);
              const result2 = authGuard(mockRoute, mockState);
              expect(result2).toBe(true);
              done();
            }
          });
        } else {
          fail('Expected Observable');
        }
      });
    });

    it('should block navigation after user load failure', (done) => {
      authService.isAuthenticated.and.returnValue(true);
      authService.currentUser.and.returnValue(null);
      authService.loadCurrentUser.and.returnValue(throwError(() => new Error('Load failed')));

      TestBed.runInInjectionContext(() => {
        const result = authGuard(mockRoute, mockState);

        if (typeof result === 'object' && 'subscribe' in result) {
          result.subscribe({
            next: (redirectResult) => {
              expect(redirectResult).toBe(mockUrlTree);

              // Simulate subsequent navigation after failure
              authService.isAuthenticated.and.returnValue(false);
              const result2 = authGuard(mockRoute, mockState);
              expect(result2).toBe(mockUrlTree);
              done();
            }
          });
        } else {
          fail('Expected Observable');
        }
      });
    });
  });
});
