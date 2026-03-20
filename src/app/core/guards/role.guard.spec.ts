import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { roleGuard } from './role.guard';
import { AuthService } from '../api/auth.service';
import { UserRole, User } from '../api/models/user.models';
import { of } from 'rxjs';

describe('roleGuard', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;
  let mockUrlTree: UrlTree;

  const mockUser: User = {
    id: 1,
    name: 'Test User',
    phone: '+1234567890',
    email: 'test@example.com',
    telegram_id: null,
    role: 'user'
  };

  const mockAdminUser: User = {
    ...mockUser,
    id: 2,
    name: 'Admin User',
    role: 'admin'
  };

  beforeEach(() => {
    // Create spies
    const authServiceSpy = jasmine.createSpyObj('AuthService', ['isAuthenticated', 'loadCurrentUser'], {
      userRole: jasmine.createSpy('userRole'),
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
  });

  describe('when user has required role', () => {
    it('should allow access when user has user role and user role is required', () => {
      authService.userRole.and.returnValue('user');

      const guard = roleGuard(['user']);
      const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));

      expect(result).toBe(true);
    });

    it('should allow access when user has admin role and admin role is required', () => {
      authService.userRole.and.returnValue('admin');

      const guard = roleGuard(['admin']);
      const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));

      expect(result).toBe(true);
    });

    it('should allow access when user role matches one of multiple allowed roles', () => {
      authService.userRole.and.returnValue('user');

      const guard = roleGuard(['user', 'admin']);
      const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));

      expect(result).toBe(true);
    });

    it('should allow access when admin role matches one of multiple allowed roles', () => {
      authService.userRole.and.returnValue('admin');

      const guard = roleGuard(['user', 'admin']);
      const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));

      expect(result).toBe(true);
    });
  });

  describe('when user has wrong role', () => {
    it('should redirect user to user databases when trying to access admin route', () => {
      authService.userRole.and.returnValue('user');
      authService.isAuthenticated.and.returnValue(true);

      const guard = roleGuard(['admin']);
      const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));

      expect(result).toBe(mockUrlTree);
      expect(router.createUrlTree).toHaveBeenCalledWith(['/user/databases']);
    });

    it('should redirect admin to admin dashboard when trying to access user-only route', () => {
      authService.userRole.and.returnValue('admin');
      authService.isAuthenticated.and.returnValue(true);

      const guard = roleGuard(['user']);
      const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));

      expect(result).toBe(mockUrlTree);
      expect(router.createUrlTree).toHaveBeenCalledWith(['/admin/dashboard']);
    });

    it('should redirect to appropriate dashboard when authenticated but role does not match', () => {
      authService.userRole.and.returnValue('user');
      authService.isAuthenticated.and.returnValue(true);

      const guard = roleGuard(['admin']);
      const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));

      expect(router.createUrlTree).toHaveBeenCalledWith(['/user/databases']);
      expect(result).toBeInstanceOf(Object); // UrlTree
    });
  });

  describe('when user is not authenticated', () => {
    it('should redirect to login when user is not authenticated', () => {
      authService.userRole.and.returnValue(null);
      authService.isAuthenticated.and.returnValue(false);

      const guard = roleGuard(['user']);
      const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));

      expect(result).toBe(mockUrlTree);
      expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
    });

    it('should redirect to login when userRole is null and not authenticated', () => {
      authService.userRole.and.returnValue(null);
      authService.isAuthenticated.and.returnValue(false);

      const guard = roleGuard(['admin']);
      const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));

      expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
    });

    it('should prioritize authentication check over role check', () => {
      authService.userRole.and.returnValue(null);
      authService.isAuthenticated.and.returnValue(false);

      const guard = roleGuard(['user', 'admin']);
      const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));

      expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
      expect(router.createUrlTree).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty allowed roles array by denying access', () => {
      authService.userRole.and.returnValue('user');
      authService.isAuthenticated.and.returnValue(true);

      const guard = roleGuard([]);
      const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));

      expect(result).toBe(mockUrlTree);
      expect(router.createUrlTree).toHaveBeenCalledWith(['/user/databases']);
    });

    it('should handle null role when authenticated', (done) => {
      authService.userRole.and.returnValue(null);
      authService.isAuthenticated.and.returnValue(true);
      authService.loadCurrentUser.and.returnValue(of(mockUser));

      const guard = roleGuard(['user']);
      const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));

      // When authenticated but role is null, guard loads user and checks role
      if (result instanceof Object && 'subscribe' in result) {
        (result as any).subscribe((res: boolean | UrlTree) => {
          expect(res).toBe(true);
          done();
        });
      } else {
        fail('Expected Observable result');
        done();
      }
    });

    it('should create correct URL tree for user databases redirect', () => {
      authService.userRole.and.returnValue('user');
      authService.isAuthenticated.and.returnValue(true);

      const guard = roleGuard(['admin']);
      TestBed.runInInjectionContext(() => guard({} as any, {} as any));

      const callArgs = router.createUrlTree.calls.mostRecent().args;
      expect(callArgs[0]).toEqual(['/user/databases']);
    });

    it('should create correct URL tree for admin dashboard redirect', () => {
      authService.userRole.and.returnValue('admin');
      authService.isAuthenticated.and.returnValue(true);

      const guard = roleGuard(['user']);
      TestBed.runInInjectionContext(() => guard({} as any, {} as any));

      const callArgs = router.createUrlTree.calls.mostRecent().args;
      expect(callArgs[0]).toEqual(['/admin/dashboard']);
    });

    it('should create correct URL tree for login redirect', () => {
      authService.userRole.and.returnValue(null);
      authService.isAuthenticated.and.returnValue(false);

      const guard = roleGuard(['user']);
      TestBed.runInInjectionContext(() => guard({} as any, {} as any));

      const callArgs = router.createUrlTree.calls.mostRecent().args;
      expect(callArgs[0]).toEqual(['/login']);
    });
  });

  describe('multiple guard instances', () => {
    it('should create independent guard functions for different role requirements', () => {
      const userGuard = roleGuard(['user']);
      const adminGuard = roleGuard(['admin']);

      authService.userRole.and.returnValue('user');
      authService.isAuthenticated.and.returnValue(true);

      const userResult = TestBed.runInInjectionContext(() => userGuard({} as any, {} as any));
      const adminResult = TestBed.runInInjectionContext(() => adminGuard({} as any, {} as any));

      expect(userResult).toBe(true);
      expect(adminResult).toBe(mockUrlTree);
    });

    it('should handle sequential guard calls correctly', () => {
      const guard = roleGuard(['admin']);

      // First call - user role
      authService.userRole.and.returnValue('user');
      authService.isAuthenticated.and.returnValue(true);
      const result1 = TestBed.runInInjectionContext(() => guard({} as any, {} as any));
      expect(result1).toBe(mockUrlTree);

      // Second call - admin role
      authService.userRole.and.returnValue('admin');
      authService.isAuthenticated.and.returnValue(true);
      const result2 = TestBed.runInInjectionContext(() => guard({} as any, {} as any));
      expect(result2).toBe(true);
    });
  });

  describe('type safety', () => {
    it('should accept only valid UserRole values', () => {
      const validRoles: UserRole[] = ['user', 'admin'];
      const guard = roleGuard(validRoles);

      expect(guard).toBeDefined();
      expect(typeof guard).toBe('function');
    });

    it('should work with single role in array', () => {
      authService.userRole.and.returnValue('user');

      const guard = roleGuard(['user']);
      const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));

      expect(result).toBe(true);
    });
  });

  describe('return type validation', () => {
    it('should return boolean true when access is granted', () => {
      authService.userRole.and.returnValue('user');

      const guard = roleGuard(['user']);
      const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));

      expect(typeof result).toBe('boolean');
      expect(result).toBe(true);
    });

    it('should return UrlTree when access is denied', () => {
      authService.userRole.and.returnValue('user');
      authService.isAuthenticated.and.returnValue(true);

      const guard = roleGuard(['admin']);
      const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));

      expect(result).toBe(mockUrlTree);
      expect(result).not.toBe(true);
      expect(result).not.toBe(false);
    });
  });
});
