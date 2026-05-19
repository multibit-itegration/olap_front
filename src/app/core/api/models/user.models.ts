export type UserRole = 'user' | 'admin';

export interface User {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  telegram_id: number | null;
  role: UserRole;
  onboarding_complete?: boolean | null;
  onboarding_completed_at?: string | null;
}

export interface UserProfileUpdateRequest {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  password?: string | null;
  onboarding_complete?: boolean | null;
  onboarding_completed_at?: string | null;
}

export interface UserProfileUpdateResponse {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  onboarding_complete?: boolean | null;
  onboarding_completed_at?: string | null;
}
