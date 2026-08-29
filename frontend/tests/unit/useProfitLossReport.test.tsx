import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useProfitLossReport } from '../../src/core/reports/hooks/useProfitLossReport';

const mockGet = vi.fn();
vi.mock('../../src/@shared/services/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

const pl = {
  dateFrom: '2026-08-01',
  dateTo: '2026-08-31',
  generatedAt: '2026-08-31T10:00:00.000Z',
  totalOrders: 12,
  totalRevenue: 1_200_000,
  totalCogs: 720_000,
  cogsUnits: 40,
  totalDiscount: 50_000,
  totalTax: 110_000,
  totalServiceCharge: 90_000,
  totalRounding: 0,
  grossProfit: 480_000,
  netProfit: 430_000,
  grossMarginPct: 40,
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockGet.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useProfitLossReport', () => {
  it('fetches the profit loss report for the selected period', async () => {
    mockGet.mockResolvedValueOnce({ data: { success: true, data: pl } });

    const { result } = renderHook(() => useProfitLossReport('2026-08-01', '2026-08-31'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith('/reports/profit-loss?dateFrom=2026-08-01&dateTo=2026-08-31');
    expect(result.current.data?.totalRevenue).toBe(1_200_000);
    expect(result.current.data?.totalCogs).toBe(720_000);
    expect(result.current.data?.grossProfit).toBe(480_000);
    expect(result.current.data?.netProfit).toBe(430_000);
    expect(result.current.data?.grossMarginPct).toBe(40);
  });

  it('does not fetch when dates are empty', () => {
    const { result } = renderHook(() => useProfitLossReport('', ''), { wrapper });

    expect(result.current.isPending).toBe(true);
    expect(mockGet).not.toHaveBeenCalled();
  });
});