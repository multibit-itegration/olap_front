// Request Models
export interface LoginRequest {
  phone: string;
  password: string;
}

export interface RegisterRequest {
  phone: string;
  password: string;
  name: string;
  email: string;
}

export interface TelegramAuthRequest {
  init_data: string;
}

// Response Models
export interface LoginResponse {
  session_token: string;
}

export interface RegisterResponse {
  result: string;
}

export interface TelegramAuthResponse {
  session_token: string;
}

// Error Models
export interface ApiError {
  detail?: string;
  msg?: string;
}
