import { create } from 'zustand';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  roleName?: string | null;
  permissions?: string[];
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setUser: (user: AuthState['user']) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: (() => {
    try {
      const raw = localStorage.getItem('authUser');
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  })(),
  isAuthenticated: !!localStorage.getItem('accessToken'),
  setUser: (user) => {
    if (user) localStorage.setItem('authUser', JSON.stringify(user));
    else localStorage.removeItem('authUser');
    set({ user, isAuthenticated: !!user });
  },
  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tenantId');
    localStorage.removeItem('authUser');
    set({ user: null, isAuthenticated: false });
    window.location.href = '/login';
  },
}));

export function hasPermission(user: AuthUser | null, permission: string): boolean {
  return !!user?.permissions?.includes(permission);
}
