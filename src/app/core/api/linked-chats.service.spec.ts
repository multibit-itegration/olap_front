import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { LinkedChatsService } from './linked-chats.service';
import { LinkedChat, LinkedChatUpdate } from './models/linked-chats.models';
import { environment } from '../../../environments/environment';

describe('LinkedChatsService', () => {
  let service: LinkedChatsService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        LinkedChatsService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(LinkedChatsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getLinkedChats', () => {
    it('should retrieve linked chats for a specific user', (done) => {
      const userId = 123;

      service.getLinkedChats(userId).subscribe({
        next: (chats) => {
          expect(chats).toEqual(mockLinkedChats);
          expect(chats.length).toBe(2);
          expect(chats[0].group_name).toBe('Test Group 1');
          done();
        },
        error: () => fail('Should not have errored')
      });

      const req = httpMock.expectOne(`${baseUrl}/linked_chats/${userId}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockLinkedChats);
    });

    it('should handle empty array when user has no linked chats', (done) => {
      const userId = 456;

      service.getLinkedChats(userId).subscribe({
        next: (chats) => {
          expect(chats).toEqual([]);
          expect(chats.length).toBe(0);
          done();
        },
        error: () => fail('Should not have errored')
      });

      const req = httpMock.expectOne(`${baseUrl}/linked_chats/${userId}`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should handle 404 error when user not found', (done) => {
      const userId = 999;

      service.getLinkedChats(userId).subscribe({
        next: () => fail('Should have errored'),
        error: (error) => {
          expect(error.status).toBe(404);
          done();
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/linked_chats/${userId}`);
      req.flush('User not found', { status: 404, statusText: 'Not Found' });
    });

    it('should handle server error', (done) => {
      const userId = 123;

      service.getLinkedChats(userId).subscribe({
        next: () => fail('Should have errored'),
        error: (error) => {
          expect(error.status).toBe(500);
          done();
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/linked_chats/${userId}`);
      req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    });
  });

  describe('updateLinkedChat', () => {
    it('should update linked chat status to active', (done) => {
      const linkedChatId = 1;
      const updateData: LinkedChatUpdate = { is_active: true };
      const updatedChat: LinkedChat = {
        ...mockLinkedChats[0],
        is_active: true
      };

      service.updateLinkedChat(linkedChatId, updateData).subscribe({
        next: (chat) => {
          expect(chat).toEqual(updatedChat);
          expect(chat.is_active).toBe(true);
          done();
        },
        error: () => fail('Should not have errored')
      });

      const req = httpMock.expectOne(`${baseUrl}/linked_chats/${linkedChatId}`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(updateData);
      req.flush(updatedChat);
    });

    it('should update linked chat status to inactive', (done) => {
      const linkedChatId = 2;
      const updateData: LinkedChatUpdate = { is_active: false };
      const updatedChat: LinkedChat = {
        ...mockLinkedChats[1],
        is_active: false
      };

      service.updateLinkedChat(linkedChatId, updateData).subscribe({
        next: (chat) => {
          expect(chat).toEqual(updatedChat);
          expect(chat.is_active).toBe(false);
          done();
        },
        error: () => fail('Should not have errored')
      });

      const req = httpMock.expectOne(`${baseUrl}/linked_chats/${linkedChatId}`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(updateData);
      req.flush(updatedChat);
    });

    it('should handle 404 error when linked chat not found', (done) => {
      const linkedChatId = 999;
      const updateData: LinkedChatUpdate = { is_active: true };

      service.updateLinkedChat(linkedChatId, updateData).subscribe({
        next: () => fail('Should have errored'),
        error: (error) => {
          expect(error.status).toBe(404);
          done();
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/linked_chats/${linkedChatId}`);
      req.flush('Linked chat not found', { status: 404, statusText: 'Not Found' });
    });

    it('should handle permission error (403)', (done) => {
      const linkedChatId = 1;
      const updateData: LinkedChatUpdate = { is_active: false };

      service.updateLinkedChat(linkedChatId, updateData).subscribe({
        next: () => fail('Should have errored'),
        error: (error) => {
          expect(error.status).toBe(403);
          done();
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/linked_chats/${linkedChatId}`);
      req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });
    });
  });

  describe('API URL construction', () => {
    it('should construct correct URL for getLinkedChats', (done) => {
      const userId = 789;

      service.getLinkedChats(userId).subscribe({
        next: () => done(),
        error: () => fail('Should not have errored')
      });

      const req = httpMock.expectOne(`${baseUrl}/linked_chats/${userId}`);
      expect(req.request.url).toContain('/linked_chats/');
      expect(req.request.url).toContain(userId.toString());
      req.flush([]);
    });

    it('should construct correct URL for updateLinkedChat', (done) => {
      const linkedChatId = 42;
      const updateData: LinkedChatUpdate = { is_active: true };

      service.updateLinkedChat(linkedChatId, updateData).subscribe({
        next: () => done(),
        error: () => fail('Should not have errored')
      });

      const req = httpMock.expectOne(`${baseUrl}/linked_chats/${linkedChatId}`);
      expect(req.request.url).toContain('/linked_chats/');
      expect(req.request.url).toContain(linkedChatId.toString());
      req.flush(mockLinkedChats[0]);
    });
  });
});
