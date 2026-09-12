import { create } from 'zustand';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  roleName?: string | null;
  permissions?: string[];
  outletIds?: string[];
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  activeOutletId: string | null;
  setUser: (user: AuthState['user']) => void;
  setActiveOutletId: (id: string | null) => void;
  logout: () => void;
}

function defaultActiveOutletId(): string | null {
  try {
    const persisted = localStorage.getItem('activeOutletId');
    if (persisted) return persisted;
  } catch {
    // ignore
  }
  try {
    const raw = localStorage.getItem('authUser');
    const user = raw ? (JSON.parse(raw) as AuthUser) : null;
    if (user?.outletIds?.length === 1) return user.outletIds[0];
  } catch {
    // ignore
  }
  return null;
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
  activeOutletId: defaultActiveOutletId(),
  setUser: (user) => {
    let nextActiveOutletId: string | null = null;
    if (user) {
      localStorage.setItem('authUser', JSON.stringify(user));
      const current = localStorage.getItem('activeOutletId');
      if (
        user.outletIds &&
        user.outletIds.length > 0 &&
        current &&
        !user.outletIds.includes(current)
      ) {
        localStorage.removeItem('activeOutletId');
      }
      if (user.outletIds?.length === 1) {
        localStorage.setItem('activeOutletId', user.outletIds[0]);
        nextActiveOutletId = user.outletIds[0];
      } else {
        nextActiveOutletId = localStorage.getItem('activeOutletId');
      }
    } else {
      localStorage.removeItem('authUser');
      localStorage.removeItem('activeOutletId');
    }
    set({ user, isAuthenticated: !!user, activeOutletId: nextActiveOutletId });
  },
  setActiveOutletId: (id) => {
    if (id) localStorage.setItem('activeOutletId', id);
    else localStorage.removeItem('activeOutletId');
    set({ activeOutletId: id });
  },
  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tenantId');
    localStorage.removeItem('authUser');
    localStorage.removeItem('activeOutletId');
    set({ user: null, isAuthenticated: false, activeOutletId: null });
    window.location.href = '/login';
  },
}));

export function hasPermission(user: AuthUser | null, permission: string): boolean {
  return !!user?.permissions?.includes(permission);
}
