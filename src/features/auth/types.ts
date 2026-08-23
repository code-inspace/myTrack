export interface UserSession {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  isDemo: boolean;
  createdAt: string;
}

export interface AuthState {
  user: UserSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
