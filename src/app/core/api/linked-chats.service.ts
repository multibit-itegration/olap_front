import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { LinkedChat, LinkedChatUpdate } from './models/linked-chats.models';

@Injectable({
  providedIn: 'root'
})
export class LinkedChatsService {
  private readonly apiClient = inject(ApiClientService);

  /**
   * Get all linked chats for a specific user
   * GET /linked_chats/{user_id}
   */
  getLinkedChats(userId: number): Observable<LinkedChat[]> {
    return this.apiClient.get<LinkedChat[]>(`/linked_chats/${userId}`);
  }

  /**
   * Update linked chat status (active/inactive)
   * PATCH /linked_chats/{linked_chat_id}
   */
  updateLinkedChat(linkedChatId: number, data: LinkedChatUpdate): Observable<LinkedChat> {
    return this.apiClient.patch<LinkedChat>(`/linked_chats/${linkedChatId}`, data);
  }
}
