export interface License {
  id: number;
  user_id: number;
  rms_id: string | null;
  contract_num: string | null;
  expiration_date: string; // date format
  comment: string | null;
  plan: string;
}

export interface IikoConnection {
  id: number;
  host: string;
  path: string;
  port: number;
  username_iiko: string;
  password_iiko: string;
  name: string;
}

export interface UserUpdateRequest {
  name?: string | null;
  phone?: string | null;
  password?: string | null;
  email?: string | null;
}

export interface UserUpdateResponse {
  id: number;
  name: string;
  phone: string;
  email: string | null;
}

export interface LicenseUpdateRequest {
  rms_id?: string | null;
  contract_num?: string | null;
  expiration_date?: string | null;
  comment?: string | null;
  plan?: string | null;
}

export interface IikoConnectionCreateRequest {
  host: string;
  path: string;
  port: number;
  username_iiko: string;
  password_iiko: string;
  name: string;
}

export interface IikoConnectionUpdateRequest {
  host?: string;
  path?: string;
  port?: number;
  username_iiko?: string;
  password_iiko?: string;
  name?: string;
}
