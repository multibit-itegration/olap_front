import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiClientService } from './api-client.service';
import { LinkedChat, LinkedChatUpdate } from './models/linked-chats.models';
import { getCachedRequest, RequestCacheEntry } from './request-cache';

@Injectable({
  providedIn: 'root'
})
export class LinkedChatsService {
  private readonly apiClient = inject(ApiClientService);
  private readonly cacheTtlMs = 2 * 60 * 1000;
  private readonly linkedChatsCache = new Map<string, RequestCacheEntry<LinkedChat[]>>();

  /**
   * Get all linked chats for a specific user
   * GET /linked_chats/{user_id}
   */
  getLinkedChats(userId: number): Observable<LinkedChat[]> {
    return getCachedRequest(
      this.linkedChatsCache,
      String(userId),
      this.cacheTtlMs,
      () => this.apiClient.get<LinkedChat[]>(`/linked_chats/${userId}`)
    );
  }

  /**
   * Update linked chat status (active/inactive)
   * PATCH /linked_chats/{linked_chat_id}
   */
  updateLinkedChat(linkedChatId: number, data: LinkedChatUpdate): Observable<LinkedChat> {
    return this.apiClient.patch<LinkedChat>(`/linked_chats/${linkedChatId}`, data).pipe(
      tap(() => this.linkedChatsCache.clear())
    );
  }
}
