export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

export interface AuthResponse {
  user: AuthUser;
}

export interface AuthSessionResponse {
  user: AuthUser | null;
}

export interface AuthCompletion {
  mode: 'login' | 'register';
  user: AuthUser;
}

export interface RegistrationDraft {
  name: string;
  email: string;
  password: string;
}

export interface LoginDraft {
  email: string;
  password: string;
}
