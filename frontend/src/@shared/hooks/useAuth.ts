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
  user: null,
  isAuthenticated: !!localStorage.getItem('accessToken'),
  setUser: (user) => set({ user, isAuthenticated: true }),
  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tenantId');
    set({ user: null, isAuthenticated: false });
    window.location.href = '/login';
  },
}));

export function hasPermission(user: AuthUser | null, permission: string): boolean {
  return !!user?.permissions?.includes(permission);
}
