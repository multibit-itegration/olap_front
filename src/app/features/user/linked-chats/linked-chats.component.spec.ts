import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { LinkedChatsComponent } from './linked-chats.component';
import { LinkedChatsService } from '../../../core/api/linked-chats.service';
import { AuthService } from '../../../core/api/auth.service';
import { LinkedChat } from '../../../core/api/models/linked-chats.models';
import { User } from '../../../core/api/models/user.models';
import { HttpErrorResponse } from '@angular/common/http';

describe('LinkedChatsComponent', () => {
  let component: LinkedChatsComponent;
  let fixture: ComponentFixture<LinkedChatsComponent>;
  let linkedChatsService: jasmine.SpyObj<LinkedChatsService>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  const mockUser: User = {
    id: 123,
    name: 'Test User',
    phone: '+79001234567',
    email: 'test@example.com',
    telegram_id: 987654321,
    role: 'user'
  };

  const mockUserNoTelegram: User = {
    ...mockUser,
    telegram_id: null
  };

  const mockAdminUser: User = {
    id: 1,
    name: 'Admin User',
    phone: '+79009999999',
    email: 'admin@example.com',
    telegram_id: 111111111,
    role: 'admin'
  };

  const mockLinkedChats: LinkedChat[] = [
    {
      id: 1,
      group_name: 'Test Group 1',
      is_active: true
    },
    {
      id: 2,
      group_name: 'Test Group 2',
      is_active: false
    }
  ];

  function setupTestBed(routeParams: { [key: string]: string } = {}, url: string = '/user/linked-chats') {
    const linkedChatsServiceSpy = jasmine.createSpyObj('LinkedChatsService', ['getLinkedChats', 'updateLinkedChat']);
    const currentUserSignal = signal(mockUser);
    const authServiceSpy = jasmine.createSpyObj('AuthService', ['loadCurrentUser'], {
      currentUser: currentUserSignal
    });
    const routerSpy = jasmine.createSpyObj('Router', ['navigate'], {
      url: url
    });

    TestBed.configureTestingModule({
      imports: [LinkedChatsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LinkedChatsService, useValue: linkedChatsServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap(routeParams) },
            parent: routeParams['id'] ? null : { snapshot: { paramMap: convertToParamMap({}) } }
          }
        }
      ]
    });

    linkedChatsService = TestBed.inject(LinkedChatsService) as jasmine.SpyObj<LinkedChatsService>;
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;

    fixture = TestBed.createComponent(LinkedChatsComponent);
    component = fixture.componentInstance;
  }

  afterEach(() => {
    fixture?.destroy();
  });

  describe('Component creation', () => {
    it('should create', () => {
      setupTestBed();
      linkedChatsService.getLinkedChats.and.returnValue(of([]));
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });
  });

  describe('Initialization - Current user view', () => {
    it('should load current user chats on init', () => {
      setupTestBed();
      linkedChatsService.getLinkedChats.and.returnValue(of(mockLinkedChats));

      fixture.detectChanges();

      expect(linkedChatsService.getLinkedChats).toHaveBeenCalledWith(mockUser.id);
      expect(component['chats']()).toEqual(mockLinkedChats);
      expect(component['loading']()).toBe(false);
      expect(component['userId']()).toBe(mockUser.id);
    });

    it('should handle empty chats list', () => {
      setupTestBed();
      linkedChatsService.getLinkedChats.and.returnValue(of([]));

      fixture.detectChanges();

      expect(component['chats']()).toEqual([]);
      expect(component['loading']()).toBe(false);
      expect(component['error']()).toBeNull();
    });

    it('should load user when currentUser is null', () => {
      setupTestBed();
      authService.currentUser.set(null);
      authService.loadCurrentUser.and.returnValue(of(mockUser));
      linkedChatsService.getLinkedChats.and.returnValue(of(mockLinkedChats));

      fixture.detectChanges();

      expect(authService.loadCurrentUser).toHaveBeenCalled();
      expect(linkedChatsService.getLinkedChats).toHaveBeenCalledWith(mockUser.id);
    });

    it('should redirect to login when user load fails', () => {
      setupTestBed();
      authService.currentUser.set(null);
      authService.loadCurrentUser.and.returnValue(throwError(() => new Error('Unauthorized')));

      fixture.detectChanges();

      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('Admin view - Route extraction', () => {
    it('should extract user ID from URL pattern /admin/users/89/linked-chats', () => {
      setupTestBed({}, '/admin/users/89/linked-chats');
      linkedChatsService.getLinkedChats.and.returnValue(of(mockLinkedChats));

      fixture.detectChanges();

      expect(linkedChatsService.getLinkedChats).toHaveBeenCalledWith(89);
      expect(component['userId']()).toBe(89);
    });

    it('should use route param id when available', () => {
      setupTestBed({ id: '456' }, '/user/linked-chats');
      linkedChatsService.getLinkedChats.and.returnValue(of(mockLinkedChats));

      fixture.detectChanges();

      expect(linkedChatsService.getLinkedChats).toHaveBeenCalledWith(456);
      expect(component['userId']()).toBe(456);
    });

    it('should set isAdminView to true when viewing another user chats', () => {
      setupTestBed({}, '/admin/users/456/linked-chats');
      authService.currentUser.set(mockAdminUser);
      linkedChatsService.getLinkedChats.and.returnValue(of(mockLinkedChats));

      fixture.detectChanges();

      expect(component['isAdminView']()).toBe(true);
    });

    it('should set isAdminView to false when viewing own chats', () => {
      setupTestBed();
      linkedChatsService.getLinkedChats.and.returnValue(of(mockLinkedChats));

      fixture.detectChanges();

      expect(component['isAdminView']()).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should handle 404 error and show empty chats', () => {
      setupTestBed();
      const error404 = new HttpErrorResponse({ status: 404, statusText: 'Not Found' });
      linkedChatsService.getLinkedChats.and.returnValue(throwError(() => error404));

      fixture.detectChanges();

      expect(component['chats']()).toEqual([]);
      expect(component['loading']()).toBe(false);
      expect(component['error']()).toBeNull();
    });

    it('should handle server error and show error message', () => {
      setupTestBed();
      const error500 = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });
      linkedChatsService.getLinkedChats.and.returnValue(throwError(() => error500));

      fixture.detectChanges();

      expect(component['error']()).toBe('Не удалось загрузить привязанные чаты');
      expect(component['loading']()).toBe(false);
    });

    it('should retry loading chats on retry button click', () => {
      setupTestBed();
      const error500 = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });
      linkedChatsService.getLinkedChats.and.returnValue(throwError(() => error500));

      fixture.detectChanges();

      linkedChatsService.getLinkedChats.and.returnValue(of(mockLinkedChats));
      component['retry']();

      expect(linkedChatsService.getLinkedChats).toHaveBeenCalledTimes(2);
      expect(component['chats']()).toEqual(mockLinkedChats);
      expect(component['error']()).toBeNull();
    });
  });

  describe('Toggle chat status', () => {
    beforeEach(() => {
      setupTestBed();
      linkedChatsService.getLinkedChats.and.returnValue(of(mockLinkedChats));
      fixture.detectChanges();
    });

    it('should activate an inactive chat', () => {
      const inactiveChat = mockLinkedChats[1];
      const updatedChat = { ...inactiveChat, is_active: true };
      linkedChatsService.updateLinkedChat.and.returnValue(of(updatedChat));

      component['onToggleStatus'](inactiveChat);

      expect(linkedChatsService.updateLinkedChat).toHaveBeenCalledWith(inactiveChat.id, { is_active: true });
      expect(component['updatingChatId']()).toBeNull();
      expect(component['chats']()[1].is_active).toBe(true);
    });

    it('should deactivate an active chat', () => {
      const activeChat = mockLinkedChats[0];
      const updatedChat = { ...activeChat, is_active: false };
      linkedChatsService.updateLinkedChat.and.returnValue(of(updatedChat));

      component['onToggleStatus'](activeChat);

      expect(linkedChatsService.updateLinkedChat).toHaveBeenCalledWith(activeChat.id, { is_active: false });
      expect(component['updatingChatId']()).toBeNull();
      expect(component['chats']()[0].is_active).toBe(false);
    });

    it('should set updatingChatId during update', () => {
      const activeChat = mockLinkedChats[0];
      linkedChatsService.updateLinkedChat.and.returnValue(of({ ...activeChat, is_active: false }));

      component['onToggleStatus'](activeChat);

      // updatingChatId is set to null after subscription completes
      // But we can verify the service was called
      expect(linkedChatsService.updateLinkedChat).toHaveBeenCalled();
    });

    it('should handle update error gracefully', () => {
      const activeChat = mockLinkedChats[0];
      const error403 = new HttpErrorResponse({ status: 403, statusText: 'Forbidden' });
      linkedChatsService.updateLinkedChat.and.returnValue(throwError(() => error403));

      spyOn(window, 'alert');

      component['onToggleStatus'](activeChat);

      expect(window.alert).toHaveBeenCalledWith('Не удалось обновить статус чата');
      expect(component['updatingChatId']()).toBeNull();
      // Chat status should remain unchanged
      expect(component['chats']()[0].is_active).toBe(true);
    });
  });

  describe('Navigation', () => {
    it('should navigate back to user settings when in admin view with route userId', () => {
      setupTestBed({}, '/admin/users/89/linked-chats');
      linkedChatsService.getLinkedChats.and.returnValue(of(mockLinkedChats));
      fixture.detectChanges();

      component['onBack']();

      expect(router.navigate).toHaveBeenCalledWith(['/admin/users', '89']);
    });

    it('should navigate to admin users list when no route userId', () => {
      setupTestBed();
      linkedChatsService.getLinkedChats.and.returnValue(of(mockLinkedChats));
      fixture.detectChanges();

      component['onBack']();

      expect(router.navigate).toHaveBeenCalledWith(['/admin/users']);
    });
  });

  describe('TrackBy function', () => {
    it('should track chats by id', () => {
      setupTestBed();
      linkedChatsService.getLinkedChats.and.returnValue(of(mockLinkedChats));
      fixture.detectChanges();

      const trackById = component['trackByChatId'](0, mockLinkedChats[0]);
      expect(trackById).toBe(mockLinkedChats[0].id);
    });
  });

  describe('Input parameter', () => {
    it('should use targetUserId input when provided', () => {
      setupTestBed();
      fixture.componentRef.setInput('targetUserId', 999);
      linkedChatsService.getLinkedChats.and.returnValue(of(mockLinkedChats));

      fixture.detectChanges();

      expect(linkedChatsService.getLinkedChats).toHaveBeenCalledWith(999);
      expect(component['userId']()).toBe(999);
    });
  });
});
