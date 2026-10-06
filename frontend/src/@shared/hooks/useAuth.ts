import { create } from 'zustand';
import { api } from '../services/api';
import type { AccessibleTenant } from './useHubMemberships';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  roleName?: string | null;
  permissions?: string[];
  outletIds?: string[];
  tenantId?: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  activeOutletId: string | null;
  activeTenantId: string | null;
  setUser: (user: AuthState['user']) => void;
  setActiveOutletId: (id: string | null) => void;
  switchTenant: (tenantId: string) => Promise<boolean>;
  logout: () => void;
}

/** Shared with `HubCenterPage`; kept here so logout can clear it. */
export const ACTIVE_HUB_KEY = 'posmono.activeHubId';

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
  activeTenantId: (() => {
    try {
      const raw = localStorage.getItem('authUser');
      const user = raw ? (JSON.parse(raw) as AuthUser) : null;
      return user?.tenantId ?? localStorage.getItem('tenantId') ?? null;
    } catch {
      return null;
    }
  })(),
  setUser: (user) => {
    let nextActiveOutletId: string | null = null;
    let nextActiveTenantId: string | null = user?.tenantId ?? null;
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
      localStorage.removeItem('authUser');
      localStorage.removeItem(ACTIVE_HUB_KEY);
    }
    set({ user, isAuthenticated: !!user, activeOutletId: nextActiveOutletId, activeTenantId: nextActiveTenantId });
  },
  setActiveOutletId: (id) => {
    if (id) localStorage.setItem('activeOutletId', id);
    else localStorage.removeItem('activeOutletId');
    set({ activeOutletId: id });
  },
  switchTenant: async (tenantId) => {
    try {
      const { data } = await api.post('/auth/switch-tenant', { tenantId });
      const payload = data.data;
      const user: AuthUser = { ...payload.user, tenantId };
      localStorage.setItem('accessToken', payload.accessToken);
      localStorage.setItem('refreshToken', payload.refreshToken);
      localStorage.setItem('tenantId', tenantId);
      localStorage.setItem('authUser', JSON.stringify(user));
      localStorage.removeItem('activeOutletId');
      set({ user, isAuthenticated: true, activeOutletId: null, activeTenantId: tenantId });
      return true;
    } catch {
      return false;
    }
  },
  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tenantId');
    localStorage.removeItem('authUser');
    localStorage.removeItem('activeOutletId');
    // Hub console selection: never let it survive into the next account.
    localStorage.removeItem(ACTIVE_HUB_KEY);
    set({ user: null, isAuthenticated: false, activeOutletId: null, activeTenantId: null });
    window.location.href = '/login';
  },
}));

export function hasPermission(user: AuthUser | null, permission: string): boolean {
  return !!user?.permissions?.includes(permission);
}
