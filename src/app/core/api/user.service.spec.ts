import { TestBed } from '@angular/core/testing';
import { UserService } from './user.service';
import { ApiClientService } from './api-client.service';
import { User } from './models/user.models';
import { of, throwError } from 'rxjs';

describe('UserService', () => {
  let service: UserService;
  let apiClientSpy: jasmine.SpyObj<ApiClientService>;

  const mockUser: User = {
    id: 1,
    name: 'Test User',
    phone: '+1234567890',
    email: 'test@example.com',
    telegram_id: 123456789,
    role: 'user'
  };

  const mockAdminUser: User = {
    id: 2,
    name: 'Admin User',
    phone: '+9876543210',
    email: 'admin@example.com',
    telegram_id: null,
    role: 'admin'
  };

  beforeEach(() => {
    const apiClientSpyObj = jasmine.createSpyObj('ApiClientService', ['get', 'post', 'put', 'delete']);

    TestBed.configureTestingModule({
      providers: [
        UserService,
        { provide: ApiClientService, useValue: apiClientSpyObj }
      ]
    });

    service = TestBed.inject(UserService);
    apiClientSpy = TestBed.inject(ApiClientService) as jasmine.SpyObj<ApiClientService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getMe', () => {
    it('should call API client with correct endpoint', (done) => {
      apiClientSpy.get.and.returnValue(of(mockUser));

      service.getMe().subscribe({
        next: () => {
          expect(apiClientSpy.get).toHaveBeenCalledWith('/users/me');
          done();
        }
      });
    });

    it('should return user data for regular user', (done) => {
      apiClientSpy.get.and.returnValue(of(mockUser));

      service.getMe().subscribe({
        next: (user) => {
          expect(user).toEqual(mockUser);
          expect(user.id).toBe(1);
          expect(user.name).toBe('Test User');
          expect(user.role).toBe('user');
          done();
        }
      });
    });

    it('should return user data for admin user', (done) => {
      apiClientSpy.get.and.returnValue(of(mockAdminUser));

      service.getMe().subscribe({
        next: (user) => {
          expect(user).toEqual(mockAdminUser);
          expect(user.id).toBe(2);
          expect(user.name).toBe('Admin User');
          expect(user.role).toBe('admin');
          done();
        }
      });
    });

    it('should handle user with null email', (done) => {
      const userWithoutEmail: User = {
        ...mockUser,
        email: null
      };
      apiClientSpy.get.and.returnValue(of(userWithoutEmail));

      service.getMe().subscribe({
        next: (user) => {
          expect(user.email).toBeNull();
          done();
        }
      });
    });

    it('should handle user with null telegram_id', (done) => {
      const userWithoutTelegram: User = {
        ...mockUser,
        telegram_id: null
      };
      apiClientSpy.get.and.returnValue(of(userWithoutTelegram));

      service.getMe().subscribe({
        next: (user) => {
          expect(user.telegram_id).toBeNull();
          done();
        }
      });
    });

    it('should propagate API errors', (done) => {
      const mockError = new Error('Failed to fetch user');
      apiClientSpy.get.and.returnValue(throwError(() => mockError));

      service.getMe().subscribe({
        next: () => fail('Should have thrown error'),
        error: (error) => {
          expect(error).toBe(mockError);
          done();
        }
      });
    });

    it('should handle 401 unauthorized error', (done) => {
      const unauthorizedError = { status: 401, message: 'Unauthorized' };
      apiClientSpy.get.and.returnValue(throwError(() => unauthorizedError));

      service.getMe().subscribe({
        next: () => fail('Should have thrown error'),
        error: (error) => {
          expect(error.status).toBe(401);
          done();
        }
      });
    });

    it('should handle 404 not found error', (done) => {
      const notFoundError = { status: 404, message: 'User not found' };
      apiClientSpy.get.and.returnValue(throwError(() => notFoundError));

      service.getMe().subscribe({
        next: () => fail('Should have thrown error'),
        error: (error) => {
          expect(error.status).toBe(404);
          done();
        }
      });
    });

    it('should handle network errors', (done) => {
      const networkError = new Error('Network connection failed');
      apiClientSpy.get.and.returnValue(throwError(() => networkError));

      service.getMe().subscribe({
        next: () => fail('Should have thrown error'),
        error: (error) => {
          expect(error.message).toBe('Network connection failed');
          done();
        }
      });
    });

    it('should call API only once per subscription', (done) => {
      apiClientSpy.get.and.returnValue(of(mockUser));

      service.getMe().subscribe({
        next: () => {
          expect(apiClientSpy.get).toHaveBeenCalledTimes(1);
          done();
        }
      });
    });

    it('should handle multiple subscriptions independently', (done) => {
      apiClientSpy.get.and.returnValue(of(mockUser));

      let completed = 0;
      const checkDone = () => {
        completed++;
        if (completed === 2) done();
      };

      service.getMe().subscribe({
        next: (user) => {
          expect(user).toEqual(mockUser);
          checkDone();
        }
      });

      service.getMe().subscribe({
        next: (user) => {
          expect(user).toEqual(mockUser);
          checkDone();
        }
      });

      expect(apiClientSpy.get).toHaveBeenCalledTimes(2);
    });

    it('should return Observable that completes after emission', (done) => {
      apiClientSpy.get.and.returnValue(of(mockUser));

      service.getMe().subscribe({
        next: (user) => {
          expect(user).toEqual(mockUser);
        },
        complete: () => {
          done();
        }
      });
    });
  });

  describe('edge cases', () => {
    it('should handle user with all fields populated', (done) => {
      const fullUser: User = {
        id: 999,
        name: 'Full User',
        phone: '+1111111111',
        email: 'full@example.com',
        telegram_id: 987654321,
        role: 'admin'
      };
      apiClientSpy.get.and.returnValue(of(fullUser));

      service.getMe().subscribe({
        next: (user) => {
          expect(user.id).toBe(999);
          expect(user.name).toBe('Full User');
          expect(user.phone).toBe('+1111111111');
          expect(user.email).toBe('full@example.com');
          expect(user.telegram_id).toBe(987654321);
          expect(user.role).toBe('admin');
          done();
        }
      });
    });

    it('should handle user with minimal fields', (done) => {
      const minimalUser: User = {
        id: 1,
        name: 'Min User',
        phone: '+1234567890',
        email: null,
        telegram_id: null,
        role: 'user'
      };
      apiClientSpy.get.and.returnValue(of(minimalUser));

      service.getMe().subscribe({
        next: (user) => {
          expect(user).toEqual(minimalUser);
          done();
        }
      });
    });

    it('should handle very long user name', (done) => {
      const userWithLongName: User = {
        ...mockUser,
        name: 'A'.repeat(500)
      };
      apiClientSpy.get.and.returnValue(of(userWithLongName));

      service.getMe().subscribe({
        next: (user) => {
          expect(user.name.length).toBe(500);
          done();
        }
      });
    });

    it('should handle special characters in user name', (done) => {
      const userWithSpecialChars: User = {
        ...mockUser,
        name: 'User!@#$%^&*()_+-=[]{}|;:,.<>?'
      };
      apiClientSpy.get.and.returnValue(of(userWithSpecialChars));

      service.getMe().subscribe({
        next: (user) => {
          expect(user.name).toContain('!@#$%^&*()');
          done();
        }
      });
    });

    it('should handle international phone numbers', (done) => {
      const userWithIntlPhone: User = {
        ...mockUser,
        phone: '+44 20 7946 0958'
      };
      apiClientSpy.get.and.returnValue(of(userWithIntlPhone));

      service.getMe().subscribe({
        next: (user) => {
          expect(user.phone).toBe('+44 20 7946 0958');
          done();
        }
      });
    });

    it('should handle very large telegram_id', (done) => {
      const userWithLargeTelegramId: User = {
        ...mockUser,
        telegram_id: 999999999999
      };
      apiClientSpy.get.and.returnValue(of(userWithLargeTelegramId));

      service.getMe().subscribe({
        next: (user) => {
          expect(user.telegram_id).toBe(999999999999);
          done();
        }
      });
    });
  });

  describe('type safety', () => {
    it('should return properly typed User object', (done) => {
      apiClientSpy.get.and.returnValue(of(mockUser));

      service.getMe().subscribe({
        next: (user) => {
          // TypeScript type checking
          const id: number = user.id;
          const name: string = user.name;
          const phone: string = user.phone;
          const email: string | null = user.email;
          const telegram_id: number | null = user.telegram_id;
          const role: 'user' | 'admin' = user.role;

          expect(id).toBeDefined();
          expect(name).toBeDefined();
          expect(phone).toBeDefined();
          expect(role).toBeDefined();
          done();
        }
      });
    });

    it('should enforce UserRole type', (done) => {
      apiClientSpy.get.and.returnValue(of(mockUser));

      service.getMe().subscribe({
        next: (user) => {
          expect(['user', 'admin']).toContain(user.role);
          done();
        }
      });
    });
  });
});
