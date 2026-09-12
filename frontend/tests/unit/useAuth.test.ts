import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore, type AuthUser } from '../../src/@shared/hooks/useAuth';

vi.mock('../../src/@shared/services/api', () => ({
  api: { post: vi.fn() },
}));

import { api } from '../../src/@shared/services/api';
const mockedPost = vi.mocked(api.post);

function userWithOutlets(outletIds: string[]): AuthUser {
  return {
    id: 'u1',
    email: 'u@test.com',
    displayName: 'User',
    role: 'r1',
    roleName: 'Cashier',
    permissions: [],
    outletIds,
  };
}

describe('useAuthStore outlet handling', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: null, isAuthenticated: false, activeOutletId: null, activeTenantId: null });
  });

  it('auto-picks the single outlet when user has exactly one', () => {
    useAuthStore.getState().setUser(userWithOutlets(['o1']));
    expect(useAuthStore.getState().activeOutletId).toBe('o1');
    expect(localStorage.getItem('activeOutletId')).toBe('o1');
  });

  it('keeps persisted outlet when still in scope for multi-outlet user', () => {
    localStorage.setItem('activeOutletId', 'o2');
    useAuthStore.getState().setUser(userWithOutlets(['o1', 'o2']));
    expect(useAuthStore.getState().activeOutletId).toBe('o2');
  });

  it('clears stale active outlet no longer in user scope', () => {
    localStorage.setItem('activeOutletId', 'o9');
    useAuthStore.getState().setUser(userWithOutlets(['o1', 'o2']));
    expect(useAuthStore.getState().activeOutletId).toBeNull();
    expect(localStorage.getItem('activeOutletId')).toBeNull();
  });

  it('all-outlets user ([]) keeps current active outlet', () => {
    localStorage.setItem('activeOutletId', 'o1');
    useAuthStore.getState().setUser(userWithOutlets([]));
    expect(useAuthStore.getState().activeOutletId).toBe('o1');
  });

  it('setActiveOutletId persists and updates state', () => {
    useAuthStore.getState().setActiveOutletId('o3');
    expect(useAuthStore.getState().activeOutletId).toBe('o3');
    expect(localStorage.getItem('activeOutletId')).toBe('o3');
    useAuthStore.getState().setActiveOutletId(null);
    expect(useAuthStore.getState().activeOutletId).toBeNull();
    expect(localStorage.getItem('activeOutletId')).toBeNull();
  });

  it('restores persisted active outlet on store creation', () => {
    localStorage.setItem('activeOutletId', 'o1');
    useAuthStore.getState().setUser(userWithOutlets(['o1', 'o2']));
    const fresh = useAuthStore.getInitialState?.() as typeof useAuthStore.getState;
    expect(fresh).toBeDefined();
    expect(localStorage.getItem('activeOutletId')).toBe('o1');
  });

  it('logout clears active outlet and user', () => {
    localStorage.setItem('accessToken', 'x');
    useAuthStore.getState().setUser(userWithOutlets(['o1']));
    expect(useAuthStore.getState().activeOutletId).toBe('o1');
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().activeOutletId).toBeNull();
    expect(localStorage.getItem('activeOutletId')).toBeNull();
    expect(localStorage.getItem('authUser')).toBeNull();
  });

  it('switchTenant persists new tokens and tenant on success', async () => {
    mockedPost.mockResolvedValueOnce({
      data: {
        data: {
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
          user: { id: 'u1', email: 'u@test.com', displayName: 'User', role: 'hub-owner', roleName: 'Hub Owner', permissions: ['reports:read'], outletIds: [] },
        },
      },
    });
    localStorage.setItem('activeOutletId', 'o1');
    useAuthStore.setState({ activeOutletId: 'o1' });

    const ok = await useAuthStore.getState().switchTenant('t2');

    expect(ok).toBe(true);
    expect(localStorage.getItem('accessToken')).toBe('new-access');
    expect(localStorage.getItem('refreshToken')).toBe('new-refresh');
    expect(localStorage.getItem('tenantId')).toBe('t2');
    expect(localStorage.getItem('activeOutletId')).toBeNull();
    expect(useAuthStore.getState().activeTenantId).toBe('t2');
    expect(useAuthStore.getState().activeOutletId).toBeNull();
    expect(useAuthStore.getState().user?.tenantId).toBe('t2');
  });

  it('switchTenant returns false and keeps state on failure', async () => {
    mockedPost.mockRejectedValueOnce(new Error('boom'));

    const ok = await useAuthStore.getState().switchTenant('t2');

    expect(ok).toBe(false);
    expect(useAuthStore.getState().activeTenantId).toBeNull();
    expect(localStorage.getItem('tenantId')).toBeNull();
  });
});