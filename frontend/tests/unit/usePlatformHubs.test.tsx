import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  usePlatformAssignTenantToHub,
  usePlatformCreateHub,
  usePlatformDeleteHub,
  usePlatformUnassignTenantFromHub,
  usePlatformUpdateHub,
} from '../../src/@shared/hooks/usePlatform';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();
vi.mock('../../src/@shared/services/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  mockGet.mockReset();
  mockPost.mockReset();
  mockPut.mockReset();
  mockDelete.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

function seedCache() {
  queryClient.setQueryData(['platform-hubs'], [{ id: 'hub-1', name: 'BCA' }]);
  queryClient.setQueryData(['platform-hub', 'hub-1'], { id: 'hub-1', name: 'BCA', tenants: [], tenantCount: 0 });
  queryClient.setQueryData(['platform-tenants', {}], { data: [], total: 0, page: 1, limit: 20 });
  queryClient.setQueryData(['platform-tenant', 'tenant-1'], { id: 'tenant-1', name: 'Kopi' });
  queryClient.setQueryData(['platform-audit', {}], { items: [], total: 0 });
}

describe('usePlatformCreateHub', () => {
  it('posts the hub and invalidates hub-scoped queries', async () => {
    seedCache();
    mockPost.mockResolvedValueOnce({ data: { success: true, data: { id: 'hub-2', name: 'Maju' } } });

    const { result } = renderHook(() => usePlatformCreateHub(), { wrapper });
    const hub = await result.current.mutateAsync({ name: ' Maju ', description: 'Grup baru' });

    expect(mockPost).toHaveBeenCalledWith('/hubs', {
      name: ' Maju ',
      description: 'Grup baru',
      code: undefined,
    });
    expect(hub.id).toBe('hub-2');
    await waitFor(() => {
      expect(queryClient.getQueryState(['platform-hubs'])?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(['platform-tenants', {}])?.isInvalidated).toBe(true);
    });
  });
});

describe('usePlatformUpdateHub', () => {
  it('puts profile changes and invalidates the hub detail', async () => {
    seedCache();
    mockPut.mockResolvedValueOnce({ data: { success: true, data: { id: 'hub-1', status: 'active' } } });

    const { result } = renderHook(() => usePlatformUpdateHub(), { wrapper });
    await result.current.mutateAsync({
      hubId: 'hub-1',
      name: 'BCA Grup',
      code: 'BCA-GRUP',
      status: 'suspended',
    });

    expect(mockPut).toHaveBeenCalledWith('/hubs/hub-1', {
      name: 'BCA Grup',
      code: 'BCA-GRUP',
      status: 'suspended',
    });
    await waitFor(() => {
      expect(queryClient.getQueryState(['platform-hub', 'hub-1'])?.isInvalidated).toBe(true);
    });
  });

  it('never puts isActive — the API ignores the derived mirror', async () => {
    seedCache();
    mockPut.mockResolvedValueOnce({ data: { success: true, data: { id: 'hub-1' } } });

    const { result } = renderHook(() => usePlatformUpdateHub(), { wrapper });
    await result.current.mutateAsync({ hubId: 'hub-1', name: 'BCA Grup', status: 'archived' });

    const [, body] = mockPut.mock.calls[0];
    expect(Object.keys(body)).not.toContain('isActive');
  });
});

describe('usePlatformDeleteHub', () => {
  it('handles the 204 response and drops stale hub detail from cache', async () => {
    seedCache();
    mockDelete.mockResolvedValueOnce({ status: 204, data: '' });

    const { result } = renderHook(() => usePlatformDeleteHub(), { wrapper });
    await result.current.mutateAsync('hub-1');

    expect(mockDelete).toHaveBeenCalledWith('/hubs/hub-1');
    expect(queryClient.getQueryData(['platform-hub', 'hub-1'])).toBeUndefined();
    await waitFor(() => {
      expect(queryClient.getQueryState(['platform-hubs'])?.isInvalidated).toBe(true);
    });
  });
});

describe('hub tenant assignment', () => {
  it('assigns a tenant and refreshes hub, tenant list and detail caches', async () => {
    seedCache();
    mockPost.mockResolvedValueOnce({ data: { success: true, data: { success: true } } });

    const { result } = renderHook(() => usePlatformAssignTenantToHub(), { wrapper });
    await result.current.mutateAsync({ hubId: 'hub-1', tenantId: 'tenant-1' });

    expect(mockPost).toHaveBeenCalledWith('/hubs/hub-1/tenants/tenant-1');
    await waitFor(() => {
      expect(queryClient.getQueryState(['platform-hub', 'hub-1'])?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(['platform-tenant', 'tenant-1'])?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(['platform-tenants', {}])?.isInvalidated).toBe(true);
    });
  });

  it('unassigns a tenant through the delete endpoint', async () => {
    seedCache();
    mockDelete.mockResolvedValueOnce({ data: { success: true, data: { success: true } } });

    const { result } = renderHook(() => usePlatformUnassignTenantFromHub(), { wrapper });
    await result.current.mutateAsync({ hubId: 'hub-1', tenantId: 'tenant-1' });

    expect(mockDelete).toHaveBeenCalledWith('/hubs/hub-1/tenants/tenant-1');
    await waitFor(() => {
      expect(queryClient.getQueryState(['platform-hub', 'hub-1'])?.isInvalidated).toBe(true);
    });
  });

  it('surfaces backend errors (e.g. hub with assigned tenants)', async () => {
    mockPost.mockRejectedValueOnce({
      response: { data: { error: { message: 'Cannot delete hub with assigned tenants. Unassign all tenants first.' } } },
    });

    const { result } = renderHook(() => usePlatformAssignTenantToHub(), { wrapper });
    await expect(
      result.current.mutateAsync({ hubId: 'hub-1', tenantId: 'tenant-1' }),
    ).rejects.toThrow();
  });
});
