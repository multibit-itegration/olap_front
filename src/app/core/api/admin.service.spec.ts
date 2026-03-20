import { TestBed } from '@angular/core/testing';
import { AdminService } from './admin.service';
import { ApiClientService } from './api-client.service';
import { of, throwError } from 'rxjs';
import { User } from './models/user.models';
import {
  License,
  IikoConnection,
  UserUpdateRequest,
  UserUpdateResponse,
  LicenseUpdateRequest,
  IikoConnectionCreateRequest,
  IikoConnectionUpdateRequest
} from './models/admin.models';

describe('AdminService', () => {
  let service: AdminService;
  let apiClientSpy: jasmine.SpyObj<ApiClientService>;

  const mockUsers: User[] = [
    {
      id: 1,
      name: 'Test User 1',
      phone: '+1234567890',
      email: 'user1@test.com',
      telegram_id: null,
      role: 'user'
    },
    {
      id: 2,
      name: 'Test Admin',
      phone: '+0987654321',
      email: 'admin@test.com',
      telegram_id: 12345,
      role: 'admin'
    }
  ];

  const mockLicenses: License[] = [
    {
      id: 1,
      user_id: 1,
      rms_id: 'RMS-001',
      contract_num: 'CONTRACT-001',
      expiration_date: '2026-12-31',
      comment: 'Test license 1',
      plan: 'Premium'
    },
    {
      id: 2,
      user_id: 2,
      rms_id: null,
      contract_num: null,
      expiration_date: '2026-06-30',
      comment: null,
      plan: 'Basic'
    }
  ];

  const mockIikoConnections: IikoConnection[] = [
    {
      id: 1,
      host: 'test.iiko.com',
      path: '/api',
      port: 443,
      username_iiko: 'testuser',
      password_iiko: 'testpass',
      name: 'Test Connection 1'
    },
    {
      id: 2,
      host: 'test2.iiko.com',
      path: '/api/v2',
      port: 443,
      username_iiko: 'testuser2',
      password_iiko: 'testpass2',
      name: 'Test Connection 2'
    }
  ];

  beforeEach(() => {
    const apiClientSpyObj = jasmine.createSpyObj('ApiClientService', [
      'get',
      'post',
      'patch',
      'delete'
    ]);

    TestBed.configureTestingModule({
      providers: [
        AdminService,
        { provide: ApiClientService, useValue: apiClientSpyObj }
      ]
    });

    service = TestBed.inject(AdminService);
    apiClientSpy = TestBed.inject(ApiClientService) as jasmine.SpyObj<ApiClientService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getAllUsers', () => {
    it('should call API client with correct endpoint', (done) => {
      apiClientSpy.get.and.returnValue(of(mockUsers));

      service.getAllUsers().subscribe({
        next: (users) => {
          expect(apiClientSpy.get).toHaveBeenCalledWith('/users/');
          expect(users).toEqual(mockUsers);
          done();
        }
      });
    });

    it('should return empty array when no users exist', (done) => {
      apiClientSpy.get.and.returnValue(of([]));

      service.getAllUsers().subscribe({
        next: (users) => {
          expect(users).toEqual([]);
          expect(users.length).toBe(0);
          done();
        }
      });
    });

    it('should propagate errors from API client', (done) => {
      const error = new Error('Network error');
      apiClientSpy.get.and.returnValue(throwError(() => error));

      service.getAllUsers().subscribe({
        next: () => fail('Should have failed'),
        error: (err) => {
          expect(err).toEqual(error);
          done();
        }
      });
    });

    it('should return users with all role types', (done) => {
      apiClientSpy.get.and.returnValue(of(mockUsers));

      service.getAllUsers().subscribe({
        next: (users) => {
          expect(users[0].role).toBe('user');
          expect(users[1].role).toBe('admin');
          done();
        }
      });
    });
  });

  describe('getAllLicenses', () => {
    it('should call API client with correct endpoint', (done) => {
      apiClientSpy.get.and.returnValue(of(mockLicenses));

      service.getAllLicenses().subscribe({
        next: (licenses) => {
          expect(apiClientSpy.get).toHaveBeenCalledWith('/licenses/');
          expect(licenses).toEqual(mockLicenses);
          done();
        }
      });
    });

    it('should return empty array when no licenses exist', (done) => {
      apiClientSpy.get.and.returnValue(of([]));

      service.getAllLicenses().subscribe({
        next: (licenses) => {
          expect(licenses).toEqual([]);
          expect(licenses.length).toBe(0);
          done();
        }
      });
    });

    it('should handle licenses with null optional fields', (done) => {
      apiClientSpy.get.and.returnValue(of([mockLicenses[1]]));

      service.getAllLicenses().subscribe({
        next: (licenses) => {
          expect(licenses[0].rms_id).toBeNull();
          expect(licenses[0].contract_num).toBeNull();
          expect(licenses[0].comment).toBeNull();
          done();
        }
      });
    });

    it('should propagate errors from API client', (done) => {
      const error = new Error('Server error');
      apiClientSpy.get.and.returnValue(throwError(() => error));

      service.getAllLicenses().subscribe({
        next: () => fail('Should have failed'),
        error: (err) => {
          expect(err).toEqual(error);
          done();
        }
      });
    });
  });

  describe('getIikoConnectionsByUserId', () => {
    it('should call API client with correct endpoint and user ID', (done) => {
      const userId = 1;
      apiClientSpy.get.and.returnValue(of(mockIikoConnections));

      service.getIikoConnectionsByUserId(userId).subscribe({
        next: (connections) => {
          expect(apiClientSpy.get).toHaveBeenCalledWith(`/iiko_connections/${userId}`);
          expect(connections).toEqual(mockIikoConnections);
          done();
        }
      });
    });

    it('should return empty array when user has no connections', (done) => {
      apiClientSpy.get.and.returnValue(of([]));

      service.getIikoConnectionsByUserId(999).subscribe({
        next: (connections) => {
          expect(connections).toEqual([]);
          done();
        }
      });
    });

    it('should handle different user IDs correctly', (done) => {
      const userId1 = 1;
      const userId2 = 2;
      apiClientSpy.get.and.returnValues(
        of([mockIikoConnections[0]]),
        of([mockIikoConnections[1]])
      );

      service.getIikoConnectionsByUserId(userId1).subscribe({
        next: (connections1) => {
          expect(apiClientSpy.get).toHaveBeenCalledWith(`/iiko_connections/${userId1}`);
          expect(connections1.length).toBe(1);

          service.getIikoConnectionsByUserId(userId2).subscribe({
            next: (connections2) => {
              expect(apiClientSpy.get).toHaveBeenCalledWith(`/iiko_connections/${userId2}`);
              expect(connections2.length).toBe(1);
              done();
            }
          });
        }
      });
    });

    it('should propagate errors from API client', (done) => {
      const error = new Error('Connection error');
      apiClientSpy.get.and.returnValue(throwError(() => error));

      service.getIikoConnectionsByUserId(1).subscribe({
        next: () => fail('Should have failed'),
        error: (err) => {
          expect(err).toEqual(error);
          done();
        }
      });
    });
  });

  describe('getUserById', () => {
    it('should call API client with correct endpoint and user ID', (done) => {
      const userId = 1;
      apiClientSpy.get.and.returnValue(of(mockUsers[0]));

      service.getUserById(userId).subscribe({
        next: (user) => {
          expect(apiClientSpy.get).toHaveBeenCalledWith(`/users/${userId}`);
          expect(user).toEqual(mockUsers[0]);
          done();
        }
      });
    });

    it('should return correct user for different IDs', (done) => {
      apiClientSpy.get.and.returnValue(of(mockUsers[1]));

      service.getUserById(2).subscribe({
        next: (user) => {
          expect(user.id).toBe(2);
          expect(user.role).toBe('admin');
          done();
        }
      });
    });

    it('should propagate errors for non-existent user', (done) => {
      const error = new Error('User not found');
      apiClientSpy.get.and.returnValue(throwError(() => error));

      service.getUserById(999).subscribe({
        next: () => fail('Should have failed'),
        error: (err) => {
          expect(err).toEqual(error);
          done();
        }
      });
    });
  });

  describe('updateUser', () => {
    it('should call API client with correct endpoint, user ID and data', (done) => {
      const userId = 1;
      const updateData: UserUpdateRequest = {
        name: 'Updated Name',
        phone: '+1111111111'
      };
      const response: UserUpdateResponse = {
        id: userId,
        name: 'Updated Name',
        phone: '+1111111111',
        email: 'user1@test.com'
      };

      apiClientSpy.patch.and.returnValue(of(response));

      service.updateUser(userId, updateData).subscribe({
        next: (result) => {
          expect(apiClientSpy.patch).toHaveBeenCalledWith(
            `/users/edit/${userId}`,
            updateData
          );
          expect(result).toEqual(response);
          done();
        }
      });
    });

    it('should handle partial updates with only name', (done) => {
      const userId = 1;
      const updateData: UserUpdateRequest = { name: 'New Name' };
      const response: UserUpdateResponse = {
        id: userId,
        name: 'New Name',
        phone: '+1234567890',
        email: 'user1@test.com'
      };

      apiClientSpy.patch.and.returnValue(of(response));

      service.updateUser(userId, updateData).subscribe({
        next: (result) => {
          expect(result.name).toBe('New Name');
          done();
        }
      });
    });

    it('should handle partial updates with only phone', (done) => {
      const userId = 1;
      const updateData: UserUpdateRequest = { phone: '+9999999999' };
      const response: UserUpdateResponse = {
        id: userId,
        name: 'Test User 1',
        phone: '+9999999999',
        email: 'user1@test.com'
      };

      apiClientSpy.patch.and.returnValue(of(response));

      service.updateUser(userId, updateData).subscribe({
        next: (result) => {
          expect(result.phone).toBe('+9999999999');
          done();
        }
      });
    });

    it('should handle password updates', (done) => {
      const userId = 1;
      const updateData: UserUpdateRequest = { password: 'newpassword123' };
      const response: UserUpdateResponse = {
        id: userId,
        name: 'Test User 1',
        phone: '+1234567890',
        email: 'user1@test.com'
      };

      apiClientSpy.patch.and.returnValue(of(response));

      service.updateUser(userId, updateData).subscribe({
        next: (result) => {
          expect(apiClientSpy.patch).toHaveBeenCalledWith(
            `/users/edit/${userId}`,
            { password: 'newpassword123' }
          );
          done();
        }
      });
    });

    it('should handle email updates including null', (done) => {
      const userId = 1;
      const updateData: UserUpdateRequest = { email: null };
      const response: UserUpdateResponse = {
        id: userId,
        name: 'Test User 1',
        phone: '+1234567890',
        email: null
      };

      apiClientSpy.patch.and.returnValue(of(response));

      service.updateUser(userId, updateData).subscribe({
        next: (result) => {
          expect(result.email).toBeNull();
          done();
        }
      });
    });

    it('should propagate errors from API client', (done) => {
      const error = new Error('Update failed');
      apiClientSpy.patch.and.returnValue(throwError(() => error));

      service.updateUser(1, { name: 'Test' }).subscribe({
        next: () => fail('Should have failed'),
        error: (err) => {
          expect(err).toEqual(error);
          done();
        }
      });
    });
  });

  describe('deleteUser', () => {
    it('should call API client with correct endpoint and user ID', (done) => {
      const userId = 1;
      apiClientSpy.delete.and.returnValue(of(undefined));

      service.deleteUser(userId).subscribe({
        next: () => {
          expect(apiClientSpy.delete).toHaveBeenCalledWith(`/users/${userId}`);
          done();
        }
      });
    });

    it('should complete successfully for different user IDs', (done) => {
      apiClientSpy.delete.and.returnValue(of(undefined));

      service.deleteUser(999).subscribe({
        next: () => {
          expect(apiClientSpy.delete).toHaveBeenCalledWith('/users/999');
          done();
        }
      });
    });

    it('should propagate errors from API client', (done) => {
      const error = new Error('Delete failed');
      apiClientSpy.delete.and.returnValue(throwError(() => error));

      service.deleteUser(1).subscribe({
        next: () => fail('Should have failed'),
        error: (err) => {
          expect(err).toEqual(error);
          done();
        }
      });
    });
  });

  describe('getLicenseByUserId', () => {
    it('should call API client with correct endpoint and user ID', (done) => {
      const userId = 1;
      apiClientSpy.get.and.returnValue(of(mockLicenses[0]));

      service.getLicenseByUserId(userId).subscribe({
        next: (license) => {
          expect(apiClientSpy.get).toHaveBeenCalledWith(`/licenses/${userId}`);
          expect(license).toEqual(mockLicenses[0]);
          done();
        }
      });
    });

    it('should return correct license for different user IDs', (done) => {
      apiClientSpy.get.and.returnValue(of(mockLicenses[1]));

      service.getLicenseByUserId(2).subscribe({
        next: (license) => {
          expect(license.user_id).toBe(2);
          expect(license.plan).toBe('Basic');
          done();
        }
      });
    });

    it('should propagate errors for non-existent license', (done) => {
      const error = new Error('License not found');
      apiClientSpy.get.and.returnValue(throwError(() => error));

      service.getLicenseByUserId(999).subscribe({
        next: () => fail('Should have failed'),
        error: (err) => {
          expect(err).toEqual(error);
          done();
        }
      });
    });
  });

  describe('updateLicense', () => {
    it('should call API client with correct endpoint, license ID and data', (done) => {
      const licenseId = 1;
      const updateData: LicenseUpdateRequest = {
        plan: 'Enterprise',
        expiration_date: '2027-12-31'
      };
      const response: License = {
        ...mockLicenses[0],
        plan: 'Enterprise',
        expiration_date: '2027-12-31'
      };

      apiClientSpy.patch.and.returnValue(of(response));

      service.updateLicense(licenseId, updateData).subscribe({
        next: (result) => {
          expect(apiClientSpy.patch).toHaveBeenCalledWith(
            `/licenses/${licenseId}`,
            updateData
          );
          expect(result).toEqual(response);
          done();
        }
      });
    });

    it('should handle partial updates with only plan', (done) => {
      const licenseId = 1;
      const updateData: LicenseUpdateRequest = { plan: 'Pro' };
      const response: License = { ...mockLicenses[0], plan: 'Pro' };

      apiClientSpy.patch.and.returnValue(of(response));

      service.updateLicense(licenseId, updateData).subscribe({
        next: (result) => {
          expect(result.plan).toBe('Pro');
          done();
        }
      });
    });

    it('should handle updates with null optional fields', (done) => {
      const licenseId = 1;
      const updateData: LicenseUpdateRequest = {
        rms_id: null,
        contract_num: null,
        comment: null
      };
      const response: License = {
        ...mockLicenses[0],
        rms_id: null,
        contract_num: null,
        comment: null
      };

      apiClientSpy.patch.and.returnValue(of(response));

      service.updateLicense(licenseId, updateData).subscribe({
        next: (result) => {
          expect(result.rms_id).toBeNull();
          expect(result.contract_num).toBeNull();
          expect(result.comment).toBeNull();
          done();
        }
      });
    });

    it('should handle expiration date updates', (done) => {
      const licenseId = 1;
      const updateData: LicenseUpdateRequest = { expiration_date: '2028-01-01' };
      const response: License = { ...mockLicenses[0], expiration_date: '2028-01-01' };

      apiClientSpy.patch.and.returnValue(of(response));

      service.updateLicense(licenseId, updateData).subscribe({
        next: (result) => {
          expect(result.expiration_date).toBe('2028-01-01');
          done();
        }
      });
    });

    it('should propagate errors from API client', (done) => {
      const error = new Error('Update failed');
      apiClientSpy.patch.and.returnValue(throwError(() => error));

      service.updateLicense(1, { plan: 'Test' }).subscribe({
        next: () => fail('Should have failed'),
        error: (err) => {
          expect(err).toEqual(error);
          done();
        }
      });
    });
  });

  describe('deleteLicense', () => {
    it('should call API client with correct endpoint and license ID', (done) => {
      const licenseId = 1;
      apiClientSpy.delete.and.returnValue(of(undefined));

      service.deleteLicense(licenseId).subscribe({
        next: () => {
          expect(apiClientSpy.delete).toHaveBeenCalledWith(`/licenses/${licenseId}`);
          done();
        }
      });
    });

    it('should complete successfully for different license IDs', (done) => {
      apiClientSpy.delete.and.returnValue(of(undefined));

      service.deleteLicense(999).subscribe({
        next: () => {
          expect(apiClientSpy.delete).toHaveBeenCalledWith('/licenses/999');
          done();
        }
      });
    });

    it('should propagate errors from API client', (done) => {
      const error = new Error('Delete failed');
      apiClientSpy.delete.and.returnValue(throwError(() => error));

      service.deleteLicense(1).subscribe({
        next: () => fail('Should have failed'),
        error: (err) => {
          expect(err).toEqual(error);
          done();
        }
      });
    });
  });

  describe('createIikoConnection', () => {
    it('should call API client with correct endpoint, user ID and data', (done) => {
      const userId = 1;
      const createData: IikoConnectionCreateRequest = {
        name: 'New Connection',
        host: 'newhost.iiko.com',
        path: '/api',
        port: 443,
        username_iiko: 'newuser',
        password_iiko: 'newpass'
      };
      const response: IikoConnection = {
        id: 3,
        ...createData
      };

      apiClientSpy.post.and.returnValue(of(response));

      service.createIikoConnection(userId, createData).subscribe({
        next: (result) => {
          expect(apiClientSpy.post).toHaveBeenCalledWith(
            `/iiko_connections/${userId}`,
            createData
          );
          expect(result).toEqual(response);
          expect(result.id).toBe(3);
          done();
        }
      });
    });

    it('should handle creation with different ports', (done) => {
      const userId = 1;
      const createData: IikoConnectionCreateRequest = {
        name: 'HTTP Connection',
        host: 'localhost',
        path: '/',
        port: 80,
        username_iiko: 'admin',
        password_iiko: 'password'
      };
      const response: IikoConnection = { id: 4, ...createData };

      apiClientSpy.post.and.returnValue(of(response));

      service.createIikoConnection(userId, createData).subscribe({
        next: (result) => {
          expect(result.port).toBe(80);
          done();
        }
      });
    });

    it('should handle creation with empty path', (done) => {
      const userId = 1;
      const createData: IikoConnectionCreateRequest = {
        name: 'No Path Connection',
        host: 'api.iiko.com',
        path: '',
        port: 443,
        username_iiko: 'user',
        password_iiko: 'pass'
      };
      const response: IikoConnection = { id: 5, ...createData };

      apiClientSpy.post.and.returnValue(of(response));

      service.createIikoConnection(userId, createData).subscribe({
        next: (result) => {
          expect(result.path).toBe('');
          done();
        }
      });
    });

    it('should propagate errors from API client', (done) => {
      const error = new Error('Creation failed');
      const createData: IikoConnectionCreateRequest = {
        name: 'Test',
        host: 'test.com',
        path: '/',
        port: 80,
        username_iiko: 'user',
        password_iiko: 'pass'
      };

      apiClientSpy.post.and.returnValue(throwError(() => error));

      service.createIikoConnection(1, createData).subscribe({
        next: () => fail('Should have failed'),
        error: (err) => {
          expect(err).toEqual(error);
          done();
        }
      });
    });

    it('should handle HTTP 502 error for connection issues', (done) => {
      const userId = 1;
      const createData: IikoConnectionCreateRequest = {
        name: 'Bad Connection',
        host: 'invalid.host',
        path: '/',
        port: 443,
        username_iiko: 'user',
        password_iiko: 'pass'
      };
      const error = { status: 502, error: { detail: 'Connection refused' } };

      apiClientSpy.post.and.returnValue(throwError(() => error));

      service.createIikoConnection(userId, createData).subscribe({
        next: () => fail('Should have failed'),
        error: (err) => {
          expect(err.status).toBe(502);
          done();
        }
      });
    });
  });

  describe('updateIikoConnection', () => {
    it('should call API client with correct endpoint, connection ID and data', (done) => {
      const connectionId = 1;
      const updateData: IikoConnectionUpdateRequest = {
        name: 'Updated Connection',
        host: 'updated.iiko.com'
      };
      const response: IikoConnection = {
        id: connectionId,
        name: 'Updated Connection',
        host: 'updated.iiko.com',
        path: '/api',
        port: 443,
        username_iiko: 'testuser',
        password_iiko: 'testpass'
      };

      apiClientSpy.patch.and.returnValue(of(response));

      service.updateIikoConnection(connectionId, updateData).subscribe({
        next: (result) => {
          expect(apiClientSpy.patch).toHaveBeenCalledWith(
            `/iiko_connections/edit/${connectionId}`,
            updateData
          );
          expect(result).toEqual(response);
          done();
        }
      });
    });

    it('should handle partial updates with only name', (done) => {
      const connectionId = 1;
      const updateData: IikoConnectionUpdateRequest = { name: 'New Name' };
      const response: IikoConnection = {
        ...mockIikoConnections[0],
        name: 'New Name'
      };

      apiClientSpy.patch.and.returnValue(of(response));

      service.updateIikoConnection(connectionId, updateData).subscribe({
        next: (result) => {
          expect(result.name).toBe('New Name');
          done();
        }
      });
    });

    it('should handle partial updates with only host', (done) => {
      const connectionId = 1;
      const updateData: IikoConnectionUpdateRequest = { host: 'newhost.com' };
      const response: IikoConnection = {
        ...mockIikoConnections[0],
        host: 'newhost.com'
      };

      apiClientSpy.patch.and.returnValue(of(response));

      service.updateIikoConnection(connectionId, updateData).subscribe({
        next: (result) => {
          expect(result.host).toBe('newhost.com');
          done();
        }
      });
    });

    it('should handle partial updates with port change', (done) => {
      const connectionId = 1;
      const updateData: IikoConnectionUpdateRequest = { port: 8080 };
      const response: IikoConnection = {
        ...mockIikoConnections[0],
        port: 8080
      };

      apiClientSpy.patch.and.returnValue(of(response));

      service.updateIikoConnection(connectionId, updateData).subscribe({
        next: (result) => {
          expect(result.port).toBe(8080);
          done();
        }
      });
    });

    it('should handle partial updates with path change', (done) => {
      const connectionId = 1;
      const updateData: IikoConnectionUpdateRequest = { path: '/v2/api' };
      const response: IikoConnection = {
        ...mockIikoConnections[0],
        path: '/v2/api'
      };

      apiClientSpy.patch.and.returnValue(of(response));

      service.updateIikoConnection(connectionId, updateData).subscribe({
        next: (result) => {
          expect(result.path).toBe('/v2/api');
          done();
        }
      });
    });

    it('should handle username and password updates', (done) => {
      const connectionId = 1;
      const updateData: IikoConnectionUpdateRequest = {
        username_iiko: 'newuser',
        password_iiko: 'newpass'
      };
      const response: IikoConnection = {
        ...mockIikoConnections[0],
        username_iiko: 'newuser',
        password_iiko: 'newpass'
      };

      apiClientSpy.patch.and.returnValue(of(response));

      service.updateIikoConnection(connectionId, updateData).subscribe({
        next: (result) => {
          expect(result.username_iiko).toBe('newuser');
          done();
        }
      });
    });

    it('should handle multiple field updates at once', (done) => {
      const connectionId = 1;
      const updateData: IikoConnectionUpdateRequest = {
        name: 'Multi Update',
        host: 'multi.iiko.com',
        port: 9000,
        path: '/multi'
      };
      const response: IikoConnection = {
        id: connectionId,
        name: 'Multi Update',
        host: 'multi.iiko.com',
        port: 9000,
        path: '/multi',
        username_iiko: 'testuser',
        password_iiko: 'testpass'
      };

      apiClientSpy.patch.and.returnValue(of(response));

      service.updateIikoConnection(connectionId, updateData).subscribe({
        next: (result) => {
          expect(result.name).toBe('Multi Update');
          expect(result.host).toBe('multi.iiko.com');
          expect(result.port).toBe(9000);
          expect(result.path).toBe('/multi');
          done();
        }
      });
    });

    it('should propagate errors from API client', (done) => {
      const error = new Error('Update failed');
      apiClientSpy.patch.and.returnValue(throwError(() => error));

      service.updateIikoConnection(1, { name: 'Test' }).subscribe({
        next: () => fail('Should have failed'),
        error: (err) => {
          expect(err).toEqual(error);
          done();
        }
      });
    });

    it('should handle HTTP 502 error with wrong password message', (done) => {
      const connectionId = 1;
      const updateData: IikoConnectionUpdateRequest = { password_iiko: 'wrongpass' };
      const error = { status: 502, error: { detail: 'Неверный пароль' } };

      apiClientSpy.patch.and.returnValue(throwError(() => error));

      service.updateIikoConnection(connectionId, updateData).subscribe({
        next: () => fail('Should have failed'),
        error: (err) => {
          expect(err.status).toBe(502);
          expect(err.error.detail).toContain('Неверный пароль');
          done();
        }
      });
    });
  });

  describe('deleteIikoConnection', () => {
    it('should call API client with correct endpoint and connection ID', (done) => {
      const connectionId = 1;
      apiClientSpy.delete.and.returnValue(of(undefined));

      service.deleteIikoConnection(connectionId).subscribe({
        next: () => {
          expect(apiClientSpy.delete).toHaveBeenCalledWith(`/iiko_connections/${connectionId}`);
          done();
        }
      });
    });

    it('should complete successfully for different connection IDs', (done) => {
      apiClientSpy.delete.and.returnValue(of(undefined));

      service.deleteIikoConnection(999).subscribe({
        next: () => {
          expect(apiClientSpy.delete).toHaveBeenCalledWith('/iiko_connections/999');
          done();
        }
      });
    });

    it('should propagate errors from API client', (done) => {
      const error = new Error('Delete failed');
      apiClientSpy.delete.and.returnValue(throwError(() => error));

      service.deleteIikoConnection(1).subscribe({
        next: () => fail('Should have failed'),
        error: (err) => {
          expect(err).toEqual(error);
          done();
        }
      });
    });

    it('should handle HTTP 404 error for non-existent connection', (done) => {
      const error = { status: 404, error: { detail: 'Connection not found' } };
      apiClientSpy.delete.and.returnValue(throwError(() => error));

      service.deleteIikoConnection(999).subscribe({
        next: () => fail('Should have failed'),
        error: (err) => {
          expect(err.status).toBe(404);
          done();
        }
      });
    });
  });
});
