import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useInventorySummaryReport } from '../../src/core/reports/hooks/useInventorySummaryReport';

const mockGet = vi.fn();
vi.mock('../../src/@shared/services/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

const summary = {
  dateFrom: '2026-08-01',
  dateTo: '2026-08-31',
  generatedAt: '2026-08-31T10:00:00.000Z',
  items: [
    {
      productId: 'p1',
      warehouseId: 'wh-1',
      warehouseName: 'Gudang Utama',
      productName: 'Kopi Susu',
      sku: 'KS-01',
      categoryName: 'Minuman',
      quantity: 20,
      reservedQuantity: 4,
      availableQuantity: 16,
      minLevel: 5,
      maxLevel: 100,
      costPrice: 5000,
      value: 100000,
      lowStock: false,
      movements: { in: 10, out: 5, adjustment: 0, void: 0, reserve: 0, release: 0 },
    },
  ],
  totals: { totalItems: 20, totalReserved: 4, totalAvailable: 16, totalValue: 100000 },
  lowStockCount: 0,
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

describe('useInventorySummaryReport', () => {
  it('fetches the inventory summary for the selected period', async () => {
    mockGet.mockResolvedValueOnce({ data: { success: true, data: summary } });

    const { result } = renderHook(() => useInventorySummaryReport('2026-08-01', '2026-08-31'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith(
      '/reports/inventory-summary?dateFrom=2026-08-01&dateTo=2026-08-31',
    );
    expect(result.current.data?.totals.totalValue).toBe(100000);
    expect(result.current.data?.items[0].costPrice).toBe(5000);
  });

  it('does not fetch when dates are empty', () => {
    const { result } = renderHook(() => useInventorySummaryReport('', ''), { wrapper });

    expect(result.current.isPending).toBe(true);
    expect(mockGet).not.toHaveBeenCalled();
  });
});