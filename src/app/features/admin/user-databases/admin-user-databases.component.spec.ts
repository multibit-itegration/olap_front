import { TestBed } from '@angular/core/testing';
import { AdminUserDatabasesComponent } from './admin-user-databases.component';
import { AdminService } from '../../../core/api/admin.service';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { IikoConnection, IikoConnectionCreateRequest, IikoConnectionUpdateRequest } from '../../../core/api/models/admin.models';

describe('AdminUserDatabasesComponent', () => {
  let component: AdminUserDatabasesComponent;
  let adminServiceSpy: jasmine.SpyObj<AdminService>;
  let routerSpy: jasmine.SpyObj<Router>;

  const mockDatabases: IikoConnection[] = [
    {
      id: 1,
      name: 'Test Database 1',
      host: 'test1.iiko.com',
      path: '/api',
      port: 443,
      username_iiko: 'user1',
      password_iiko: 'pass1'
    },
    {
      id: 2,
      name: 'Test Database 2',
      host: 'test2.iiko.com',
      path: '/api/v2',
      port: 80,
      username_iiko: 'user2',
      password_iiko: 'pass2'
    }
  ];

  function configureTestingModule(routeParams: { [key: string]: string }) {
    const adminSpy = jasmine.createSpyObj('AdminService', [
      'getIikoConnectionsByUserId',
      'createIikoConnection',
      'updateIikoConnection',
      'deleteIikoConnection'
    ]);
    const routerSpyObj = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      imports: [AdminUserDatabasesComponent],
      providers: [
        provideRouter([]),
        { provide: AdminService, useValue: adminSpy },
        { provide: Router, useValue: routerSpyObj },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(routeParams) } } }
      ]
    });

    adminServiceSpy = TestBed.inject(AdminService) as jasmine.SpyObj<AdminService>;
    routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  }

  describe('Component creation and initialization', () => {
    it('should create', () => {
      configureTestingModule({ id: '1' });
      component = TestBed.createComponent(AdminUserDatabasesComponent).componentInstance;
      expect(component).toBeTruthy();
    });
  });

  describe('ngOnInit', () => {
    it('should load databases when valid user ID is provided in route params', (done) => {
      configureTestingModule({ id: '123' });
      adminServiceSpy.getIikoConnectionsByUserId.and.returnValue(of(mockDatabases));

      const fixture = TestBed.createComponent(AdminUserDatabasesComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        expect(component['userId']()).toBe(123);
        expect(adminServiceSpy.getIikoConnectionsByUserId).toHaveBeenCalledWith(123);
        expect(component['databases']()).toEqual(mockDatabases);
        expect(component['loading']()).toBe(false);
        done();
      }, 0);
    });

    it('should redirect to /admin/users when id param is missing', () => {
      configureTestingModule({});

      const fixture = TestBed.createComponent(AdminUserDatabasesComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/admin/users']);
    });

    it('should redirect to /admin/users when id param is not a valid number', () => {
      configureTestingModule({ id: 'invalid' });

      const fixture = TestBed.createComponent(AdminUserDatabasesComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/admin/users']);
    });

    it('should redirect to /admin/users when id param is NaN', () => {
      configureTestingModule({ id: 'NaN' });

      const fixture = TestBed.createComponent(AdminUserDatabasesComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/admin/users']);
    });

    it('should treat 404 error as empty array (user has no databases)', (done) => {
      configureTestingModule({ id: '999' });
      const error = new HttpErrorResponse({ status: 404, statusText: 'Not Found' });
      adminServiceSpy.getIikoConnectionsByUserId.and.returnValue(throwError(() => error));

      const fixture = TestBed.createComponent(AdminUserDatabasesComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        expect(component['databases']()).toEqual([]);
        expect(component['loading']()).toBe(false);
        expect(component['error']()).toBeNull();
        done();
      }, 0);
    });

    it('should set error message for non-404 HTTP errors', (done) => {
      configureTestingModule({ id: '1' });
      const error = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });
      adminServiceSpy.getIikoConnectionsByUserId.and.returnValue(throwError(() => error));

      const fixture = TestBed.createComponent(AdminUserDatabasesComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        expect(component['error']()).toBe('Не удалось загрузить базы данных');
        expect(component['loading']()).toBe(false);
        expect(component['databases']()).toEqual([]);
        done();
      }, 0);
    });
  });

  describe('Form interactions', () => {
    beforeEach(() => {
      configureTestingModule({ id: '1' });
      adminServiceSpy.getIikoConnectionsByUserId.and.returnValue(of(mockDatabases));
      const fixture = TestBed.createComponent(AdminUserDatabasesComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should open form with empty fields when onAddDatabase is called', () => {
      component['onAddDatabase']();

      expect(component['showForm']()).toBe(true);
      expect(component['editingConnection']()).toBeNull();
      expect(component['formName']()).toBe('');
      expect(component['formHost']()).toBe('');
      expect(component['formPath']()).toBe('');
      expect(component['formPort']()).toBe(443);
      expect(component['formUsername']()).toBe('');
      expect(component['formPassword']()).toBe('');
    });

    it('should open form with pre-filled data (except password) when onSettings is called', () => {
      const database = mockDatabases[0];
      component['onSettings'](database);

      expect(component['showForm']()).toBe(true);
      expect(component['editingConnection']()).toEqual(database);
      expect(component['formName']()).toBe(database.name);
      expect(component['formHost']()).toBe(database.host);
      expect(component['formPath']()).toBe(database.path);
      expect(component['formPort']()).toBe(database.port);
      expect(component['formUsername']()).toBe(database.username_iiko);
      expect(component['formPassword']()).toBe('');
      expect(component['formError']()).toBeNull();
    });

    it('should hide form and reset fields when onCancelForm is called', () => {
      component['onAddDatabase']();
      component['formName'].set('Test Name');
      component['formHost'].set('test.host');

      component['onCancelForm']();

      expect(component['showForm']()).toBe(false);
      expect(component['formName']()).toBe('');
      expect(component['formHost']()).toBe('');
    });
  });

  describe('Form validation', () => {
    beforeEach(() => {
      configureTestingModule({ id: '1' });
      adminServiceSpy.getIikoConnectionsByUserId.and.returnValue(of([]));
      const fixture = TestBed.createComponent(AdminUserDatabasesComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should show error when name is empty', () => {
      component['onAddDatabase']();
      component['formName'].set('');
      component['formHost'].set('host.com');
      component['formUsername'].set('user');
      component['formPassword'].set('pass');

      component['onSaveForm']();

      expect(component['formError']()).toBe('Название базы обязательно');
      expect(adminServiceSpy.createIikoConnection).not.toHaveBeenCalled();
    });

    it('should show error when name is only whitespace', () => {
      component['onAddDatabase']();
      component['formName'].set('   ');
      component['formHost'].set('host.com');
      component['formUsername'].set('user');
      component['formPassword'].set('pass');

      component['onSaveForm']();

      expect(component['formError']()).toBe('Название базы обязательно');
    });

    it('should show error when host is empty', () => {
      component['onAddDatabase']();
      component['formName'].set('Test');
      component['formHost'].set('');
      component['formUsername'].set('user');
      component['formPassword'].set('pass');

      component['onSaveForm']();

      expect(component['formError']()).toBe('Адрес базы обязателен');
    });

    it('should show error when username is empty', () => {
      component['onAddDatabase']();
      component['formName'].set('Test');
      component['formHost'].set('host.com');
      component['formUsername'].set('');
      component['formPassword'].set('pass');

      component['onSaveForm']();

      expect(component['formError']()).toBe('Имя пользователя обязательно');
    });

    it('should show error when password is empty', () => {
      component['onAddDatabase']();
      component['formName'].set('Test');
      component['formHost'].set('host.com');
      component['formUsername'].set('user');
      component['formPassword'].set('');

      component['onSaveForm']();

      expect(component['formError']()).toBe('Пароль обязателен');
    });
  });

  describe('Create connection', () => {
    beforeEach(() => {
      configureTestingModule({ id: '1' });
      adminServiceSpy.getIikoConnectionsByUserId.and.returnValue(of([]));
      const fixture = TestBed.createComponent(AdminUserDatabasesComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should call createIikoConnection when creating new connection with valid data', (done) => {
      const newConnection: IikoConnection = {
        id: 3,
        name: 'New DB',
        host: 'new.host.com',
        path: '/path',
        port: 8080,
        username_iiko: 'newuser',
        password_iiko: 'newpass'
      };
      adminServiceSpy.createIikoConnection.and.returnValue(of(newConnection));
      adminServiceSpy.getIikoConnectionsByUserId.and.returnValue(of([newConnection]));

      component['onAddDatabase']();
      component['formName'].set('New DB');
      component['formHost'].set('new.host.com');
      component['formPath'].set('/path');
      component['formPort'].set(8080);
      component['formUsername'].set('newuser');
      component['formPassword'].set('newpass');

      component['onSaveForm']();

      setTimeout(() => {
        const expectedData: IikoConnectionCreateRequest = {
          name: 'New DB',
          host: 'new.host.com',
          path: '/path',
          port: 8080,
          username_iiko: 'newuser',
          password_iiko: 'newpass'
        };
        expect(adminServiceSpy.createIikoConnection).toHaveBeenCalledWith(1, expectedData);
        expect(component['showForm']()).toBe(false);
        expect(component['formLoading']()).toBe(false);
        done();
      }, 0);
    });

    it('should handle 502 error with "None" detail as connection error', (done) => {
      const error = new HttpErrorResponse({
        status: 502,
        error: { detail: 'None' }
      });
      adminServiceSpy.createIikoConnection.and.returnValue(throwError(() => error));

      component['onAddDatabase']();
      component['formName'].set('Test');
      component['formHost'].set('invalid.host');
      component['formUsername'].set('user');
      component['formPassword'].set('pass');

      component['onSaveForm']();

      setTimeout(() => {
        expect(component['formError']()).toBe('Проверьте данные базы, не удалось подключиться');
        expect(component['formErrorType']()).toBe('connection');
        expect(component['formLoading']()).toBe(false);
        expect(component['showForm']()).toBe(true);
        done();
      }, 0);
    });

    it('should handle 502 error with "Неверный пароль" as password error', (done) => {
      const error = new HttpErrorResponse({
        status: 502,
        error: { detail: 'Неверный пароль от базы' }
      });
      adminServiceSpy.createIikoConnection.and.returnValue(throwError(() => error));

      component['onAddDatabase']();
      component['formName'].set('Test');
      component['formHost'].set('host.com');
      component['formUsername'].set('user');
      component['formPassword'].set('wrongpass');

      component['onSaveForm']();

      setTimeout(() => {
        expect(component['formError']()).toBe('Введён неверный пароль от базы');
        expect(component['formErrorType']()).toBe('password');
        expect(component['formLoading']()).toBe(false);
        done();
      }, 0);
    });

    it('should handle other HTTP errors', (done) => {
      const error = new HttpErrorResponse({
        status: 400,
        error: { detail: 'Bad request' }
      });
      adminServiceSpy.createIikoConnection.and.returnValue(throwError(() => error));

      component['onAddDatabase']();
      component['formName'].set('Test');
      component['formHost'].set('host.com');
      component['formUsername'].set('user');
      component['formPassword'].set('pass');

      component['onSaveForm']();

      setTimeout(() => {
        expect(component['formError']()).toBe('Не удалось сохранить базу данных');
        expect(component['formErrorType']()).toBeNull();
        expect(component['formLoading']()).toBe(false);
        done();
      }, 0);
    });
  });

  describe('Update connection', () => {
    beforeEach(() => {
      configureTestingModule({ id: '1' });
      adminServiceSpy.getIikoConnectionsByUserId.and.returnValue(of(mockDatabases));
      const fixture = TestBed.createComponent(AdminUserDatabasesComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should call updateIikoConnection when editing existing connection with valid data', (done) => {
      const updatedConnection: IikoConnection = {
        ...mockDatabases[0],
        name: 'Updated DB',
        host: 'updated.host.com'
      };
      adminServiceSpy.updateIikoConnection.and.returnValue(of(updatedConnection));
      adminServiceSpy.getIikoConnectionsByUserId.and.returnValue(of([updatedConnection]));

      component['onSettings'](mockDatabases[0]);
      component['formName'].set('Updated DB');
      component['formHost'].set('updated.host.com');
      component['formPassword'].set('pass1');

      component['onSaveForm']();

      setTimeout(() => {
        const expectedData: IikoConnectionUpdateRequest = {
          name: 'Updated DB',
          host: 'updated.host.com',
          path: '/api',
          port: 443,
          username_iiko: 'user1',
          password_iiko: 'pass1'
        };
        expect(adminServiceSpy.updateIikoConnection).toHaveBeenCalledWith(1, expectedData);
        expect(component['showForm']()).toBe(false);
        expect(component['formLoading']()).toBe(false);
        done();
      }, 0);
    });

    it('should handle 502 error with wrong password for update', (done) => {
      const error = new HttpErrorResponse({
        status: 502,
        error: { detail: 'Неверный пароль' }
      });
      adminServiceSpy.updateIikoConnection.and.returnValue(throwError(() => error));

      component['onSettings'](mockDatabases[0]);
      component['formPassword'].set('wrongpass');

      component['onSaveForm']();

      setTimeout(() => {
        expect(component['formError']()).toBe('Введён неверный пароль от базы');
        expect(component['formErrorType']()).toBe('password');
        expect(component['showForm']()).toBe(true);
        done();
      }, 0);
    });
  });

  describe('Delete connection', () => {
    beforeEach(() => {
      configureTestingModule({ id: '1' });
      adminServiceSpy.getIikoConnectionsByUserId.and.returnValue(of(mockDatabases));
      const fixture = TestBed.createComponent(AdminUserDatabasesComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should call deleteIikoConnection after confirmation', (done) => {
      spyOn(window, 'confirm').and.returnValue(true);
      adminServiceSpy.deleteIikoConnection.and.returnValue(of(undefined));
      adminServiceSpy.getIikoConnectionsByUserId.and.returnValue(of([mockDatabases[1]]));

      component['onSettings'](mockDatabases[0]);
      component['onDeleteConnection']();

      setTimeout(() => {
        expect(adminServiceSpy.deleteIikoConnection).toHaveBeenCalledWith(1);
        expect(component['showForm']()).toBe(false);
        expect(component['formLoading']()).toBe(false);
        done();
      }, 0);
    });

    it('should not delete if user cancels confirmation', () => {
      spyOn(window, 'confirm').and.returnValue(false);

      component['onSettings'](mockDatabases[0]);
      component['onDeleteConnection']();

      expect(adminServiceSpy.deleteIikoConnection).not.toHaveBeenCalled();
    });

    it('should handle errors during deletion', (done) => {
      spyOn(window, 'confirm').and.returnValue(true);
      const error = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });
      adminServiceSpy.deleteIikoConnection.and.returnValue(throwError(() => error));

      component['onSettings'](mockDatabases[0]);
      component['onDeleteConnection']();

      setTimeout(() => {
        expect(component['formError']()).toBe('Не удалось удалить базу данных');
        expect(component['formLoading']()).toBe(false);
        expect(component['showForm']()).toBe(true);
        done();
      }, 0);
    });

    it('should do nothing if no connection is being edited', () => {
      component['editingConnection'].set(null);
      component['onDeleteConnection']();

      expect(adminServiceSpy.deleteIikoConnection).not.toHaveBeenCalled();
    });
  });

  describe('trackByDatabaseId', () => {
    beforeEach(() => {
      configureTestingModule({ id: '1' });
      adminServiceSpy.getIikoConnectionsByUserId.and.returnValue(of([]));
      const fixture = TestBed.createComponent(AdminUserDatabasesComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should return database ID', () => {
      const database = mockDatabases[0];
      const result = component['trackByDatabaseId'](0, database);
      expect(result).toBe(database.id);
    });
  });

  describe('goBack', () => {
    beforeEach(() => {
      configureTestingModule({ id: '1' });
      adminServiceSpy.getIikoConnectionsByUserId.and.returnValue(of([]));
      const fixture = TestBed.createComponent(AdminUserDatabasesComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should navigate to /admin/users', () => {
      component['goBack']();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/admin/users']);
    });
  });
});
