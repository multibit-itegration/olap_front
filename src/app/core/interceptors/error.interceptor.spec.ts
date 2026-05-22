import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../api/auth.service';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let httpClient: HttpClient;
  let httpTesting: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;

  function configure(routeUrl: string): void {
    const authService = jasmine.createSpyObj('AuthService', ['logout']);
    const router = jasmine.createSpyObj('Router', ['navigate'], { url: routeUrl });

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router }
      ]
    });

    authServiceSpy = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    httpClient = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  }

  afterEach(() => {
    httpTesting.verify();
    TestBed.resetTestingModule();
  });

  it('keeps the Telegram login route on non-auth 401 responses', () => {
    configure('/logintg');

    httpClient.get('/users/me').subscribe({ error: () => undefined });
    httpTesting.expectOne('/users/me').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(authServiceSpy.logout).toHaveBeenCalledTimes(1);
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('redirects other routes to login on non-auth 401 responses', () => {
    configure('/user/databases');

    httpClient.get('/users/me').subscribe({ error: () => undefined });
    httpTesting.expectOne('/users/me').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(authServiceSpy.logout).toHaveBeenCalledTimes(1);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });
});
