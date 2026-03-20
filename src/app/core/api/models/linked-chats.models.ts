/**
 * TypeScript interfaces for LinkedChats API
 * Corresponds to backend schemas from /linked_chats endpoints
 */

/**
 * LinkedChats retrieve schema - returned by GET /linked_chats/{user_id}
 */
export interface LinkedChat {
  id: number;
  group_name: string;
  is_active: boolean;
}

/**
 * LinkedChats update schema - request body for PATCH /linked_chats/{linked_chat_id}
 */
export interface LinkedChatUpdate {
  is_active: boolean;
}
