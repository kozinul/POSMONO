import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  usePlatformAudit,
  usePlatformSubscriptionHistory,
  usePlatformProvisioningRuns,
  usePlatformExtendSubscriptionDays,
} from '../../src/@shared/hooks/usePlatform';

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../../src/@shared/services/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('usePlatformAudit', () => {
  it('fetches the platform audit log with filters', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          items: [{ id: 'a1', action: 'TENANT_CREATED', description: 'Tenant dibuat', actorEmail: 'admin@kuire.id', occurredAt: '2026-09-20T08:00:00.000Z' }],
          total: 1,
          page: 1,
          limit: 30,
        },
      },
    });

    const { result } = renderHook(
      () => usePlatformAudit({ action: 'TENANT_CREATED', tenantId: 'tenant-1', page: 1, limit: 30, enabled: true }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith(
      '/platform/audit?tenantId=tenant-1&action=TENANT_CREATED&page=1&limit=30',
    );
    expect(result.current.data?.items[0].action).toBe('TENANT_CREATED');
  });
});

describe('usePlatformSubscriptionHistory', () => {
  it('fetches subscription ledger for a tenant', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        success: true,
        data: { items: [{ id: 'h1', action: 'extended', planName: 'Pro', periodEndAfter: '2026-10-01T00:00:00.000Z' }], total: 1 },
      },
    });

    const { result } = renderHook(() => usePlatformSubscriptionHistory('tenant-1', 50), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith('/platform/tenants/tenant-1/subscription/history?limit=50');
    expect(result.current.data?.items[0].action).toBe('extended');
  });

  it('is disabled without a tenant id', () => {
    const { result } = renderHook(() => usePlatformSubscriptionHistory(null), { wrapper });
    expect(result.current.isPending).toBe(true);
    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe('usePlatformProvisioningRuns', () => {
  it('fetches provisioning run history', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        success: true,
        data: { data: [{ id: 'r1', tenantName: 'Kopi Bali', overallStatus: 'success', steps: [] }], total: 1, page: 1, limit: 5 },
      },
    });

    const { result } = renderHook(() => usePlatformProvisioningRuns({ limit: 5, enabled: true }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith('/platform/provisioning-runs?limit=5');
    expect(result.current.data?.data[0].tenantName).toBe('Kopi Bali');
  });
});

describe('usePlatformExtendSubscriptionDays', () => {
  it('posts extend days and returns data', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true, data: { days: 30 } } });

    const { result } = renderHook(() => usePlatformExtendSubscriptionDays(), { wrapper });
    await result.current.mutateAsync({ tenantId: 'tenant-1', days: 30 });

    expect(mockPost).toHaveBeenCalledWith('/platform/tenants/tenant-1/subscription/extend', { days: 30 });
  });
});