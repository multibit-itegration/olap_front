export type UserRole = 'user' | 'admin';

export interface User {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  telegram_id: number | null;
  role: UserRole;
}
