export type UserRole = 'user' | 'admin';

export interface User {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  telegram_id: number | null;
  role: UserRole;
}

export interface UserProfileUpdateRequest {
  name?: string | null;
  email?: string | null;
  password?: string | null;
}

export interface UserProfileUpdateResponse {
  id: number;
  name: string;
  phone: string;
  email: string | null;
}
