export interface UserSession {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  emailConfirmed: boolean;
  createdAt: string;
}

export interface AuthState {
  user: UserSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
