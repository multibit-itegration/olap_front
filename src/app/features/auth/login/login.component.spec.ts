import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/api/auth.service';
import { User } from '../../../core/api/models/user.models';
import { TelegramService } from '../../../core/services/telegram.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let telegramServiceSpy: jasmine.SpyObj<TelegramService>;
  let routerSpy: jasmine.SpyObj<Router>;

  const user: User = {
    id: 5,
    name: 'Test User',
    phone: '+79990000000',
    email: null,
    telegram_id: 123,
    role: 'user'
  };

  function createComponent(routeData: Record<string, unknown> = {}): LoginComponent {
    const authService = jasmine.createSpyObj('AuthService', [
      'isAuthenticated',
      'loadCurrentUser',
      'logout',
      'telegramAuth',
      'currentUser',
      'userRole'
    ]);
    const telegramService = jasmine.createSpyObj('TelegramService', [
      'isTelegramLaunch',
      'initialize',
      'initData'
    ]);
    const router = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: TelegramService, useValue: telegramService },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { data: routeData } } }
      ]
    });

    authServiceSpy = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    telegramServiceSpy = TestBed.inject(TelegramService) as jasmine.SpyObj<TelegramService>;
    routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    telegramServiceSpy.isTelegramLaunch.and.returnValue(false);
    telegramServiceSpy.initData.and.returnValue(null);
    authServiceSpy.currentUser.and.returnValue(null);
    authServiceSpy.userRole.and.returnValue('user');

    return TestBed.createComponent(LoginComponent).componentInstance;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('resumes a stored session on the Telegram login route before starting Telegram auth again', () => {
    const component = createComponent({ telegramAuth: true });
    authServiceSpy.isAuthenticated.and.returnValue(true);
    authServiceSpy.loadCurrentUser.and.returnValue(of(user));

    component.ngOnInit();

    expect(authServiceSpy.loadCurrentUser).toHaveBeenCalledTimes(1);
    expect(authServiceSpy.telegramAuth).not.toHaveBeenCalled();
    expect(telegramServiceSpy.initialize).not.toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/user/databases']);
  });

  it('restarts Telegram auth preparation on the Telegram login route when session resume fails', () => {
    const component = createComponent({ telegramAuth: true });
    authServiceSpy.isAuthenticated.and.returnValue(true);
    authServiceSpy.loadCurrentUser.and.returnValue(throwError(() => new Error('Session failed')));
    telegramServiceSpy.initialize.and.returnValue(new Promise<boolean>(() => undefined));

    component.ngOnInit();

    expect(authServiceSpy.logout).toHaveBeenCalledTimes(1);
    expect(telegramServiceSpy.initialize).toHaveBeenCalledWith(8000, true);
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });
});
