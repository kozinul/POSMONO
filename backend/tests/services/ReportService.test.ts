import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportService } from '../../src/core/reporting/application/services/ReportService';

const TENANT_ID = 'tenant-test-1';

function createMockOrderRepo() {
  return {
    getSummary: vi.fn(),
    findByTenant: vi.fn(),
    getDailySales: vi.fn(),
  };
}

function createMockShiftRepo() {
  return { findByDate: vi.fn() };
}

function createMockDailyMetricRepo() {
  return { findByDate: vi.fn(), findByDateRange: vi.fn(), save: vi.fn() };
}

function createMockAggregation() {
  return {
    getTopProductsAggregation: vi.fn(),
    getPaymentBreakdownAggregation: vi.fn(),
    getSalesByCategoryAggregation: vi.fn(),
    getCashierPerformanceAggregation: vi.fn(),
    getSalesPerProductAggregation: vi.fn(),
    getFinanceAggregation: vi.fn(),
    getCashierReceiptsAggregation: vi.fn(),
    getSalesPerCashierAggregation: vi.fn(),
  };
}

describe('ReportService', () => {
  let orderRepo: ReturnType<typeof createMockOrderRepo>;
  let shiftRepo: ReturnType<typeof createMockShiftRepo>;
  let dailyMetricRepo: ReturnType<typeof createMockDailyMetricRepo>;
  let aggregation: ReturnType<typeof createMockAggregation>;
  let service: ReportService;

  beforeEach(() => {
    orderRepo = createMockOrderRepo();
    shiftRepo = createMockShiftRepo();
    dailyMetricRepo = createMockDailyMetricRepo();
    aggregation = createMockAggregation();
    service = new ReportService(orderRepo, shiftRepo, dailyMetricRepo, aggregation);
  });

  describe('getFinanceReport', () => {
    it('returns finance summary from aggregation', async () => {
      aggregation.getFinanceAggregation.mockResolvedValue({
        totalOrders: 12,
        totalRevenue: 1_200_000,
        netRevenue: 1_000_000,
        totalTax: 110_000,
        totalServiceCharge: 90_000,
        totalDiscount: 50_000,
        categories: [
          {
            categoryId: 'cat-1',
            totalOrders: 8,
            totalItems: 20,
            revenue: 900_000,
            dpp: 750_000,
            tax: 80_000,
            serviceCharge: 70_000,
          },
        ],
      });

      const result = await service.getFinanceReport(TENANT_ID, '2026-08-01', '2026-08-06');

      expect(aggregation.getFinanceAggregation).toHaveBeenCalledWith(
        TENANT_ID,
        '2026-08-01',
        '2026-08-06',
      );
      expect(result).toEqual({
        dateFrom: '2026-08-01',
        dateTo: '2026-08-06',
        totalOrders: 12,
        totalRevenue: 1_200_000,
        netRevenue: 1_000_000,
        totalTax: 110_000,
        totalServiceCharge: 90_000,
        totalDiscount: 50_000,
        categories: [
          {
            categoryId: 'cat-1',
            totalOrders: 8,
            totalItems: 20,
            revenue: 900_000,
            dpp: 750_000,
            tax: 80_000,
            serviceCharge: 70_000,
          },
        ],
      });
    });

    it('returns zeros when aggregation returns empty', async () => {
      aggregation.getFinanceAggregation.mockResolvedValue({
        totalOrders: 0,
        totalRevenue: 0,
        netRevenue: 0,
        totalTax: 0,
        totalServiceCharge: 0,
        totalDiscount: 0,
        categories: [],
      });

      const result = await service.getFinanceReport(TENANT_ID, '2026-08-01', '2026-08-06');

      expect(result.totalOrders).toBe(0);
      expect(result.totalRevenue).toBe(0);
      expect(result.categories).toEqual([]);
    });
  });

  describe('getCashierReceiptsReport', () => {
    it('returns cashier receipts grouped by payment method', async () => {
      aggregation.getCashierReceiptsAggregation.mockResolvedValue({
        cashiers: [
          {
            cashierId: 'cashier-1',
            cashierName: 'Kasir 1',
            methods: [
              { method: 'cash', total: 200_000, count: 3 },
              { method: 'qris', total: 100_000, count: 1 },
            ],
            total: 300_000,
            totalTransactions: 4,
          },
        ],
        totals: {
          total: 300_000,
          totalTransactions: 4,
          methods: [
            { method: 'cash', total: 200_000 },
            { method: 'qris', total: 100_000 },
          ],
        },
      });

      const result = await service.getCashierReceiptsReport(TENANT_ID, '2026-08-01', '2026-08-06');

      expect(aggregation.getCashierReceiptsAggregation).toHaveBeenCalledWith(
        TENANT_ID,
        '2026-08-01',
        '2026-08-06',
      );
      expect(result).toEqual({
        dateFrom: '2026-08-01',
        dateTo: '2026-08-06',
        cashiers: [
          {
            cashierId: 'cashier-1',
            cashierName: 'Kasir 1',
            methods: [
              { method: 'cash', total: 200_000, count: 3 },
              { method: 'qris', total: 100_000, count: 1 },
            ],
            total: 300_000,
            totalTransactions: 4,
          },
        ],
        totals: {
          total: 300_000,
          totalTransactions: 4,
          methods: [
            { method: 'cash', total: 200_000 },
            { method: 'qris', total: 100_000 },
          ],
        },
      });
    });
  });

  describe('getSalesPerCashierReport', () => {
    it('returns sales per cashier from aggregation', async () => {
      aggregation.getSalesPerCashierAggregation.mockResolvedValue({
        cashiers: [
          {
            cashierId: 'cashier-1',
            cashierName: 'Kasir 1',
            totalOrders: 5,
            totalItems: 12,
            totalRevenue: 400_000,
            dpp: 360_000,
            serviceCharge: 10_000,
            tax: 30_000,
            avgOrderValue: 80_000,
          },
        ],
        totals: {
          totalOrders: 5,
          totalItems: 12,
          totalRevenue: 400_000,
          dpp: 360_000,
          serviceCharge: 10_000,
          tax: 30_000,
        },
      });

      const result = await service.getSalesPerCashierReport(TENANT_ID, '2026-08-01', '2026-08-06');

      expect(aggregation.getSalesPerCashierAggregation).toHaveBeenCalledWith(
        TENANT_ID,
        '2026-08-01',
        '2026-08-06',
      );
      expect(result.dateFrom).toBe('2026-08-01');
      expect(result.cashiers).toHaveLength(1);
      expect(result.cashiers[0].totalRevenue).toBe(400_000);
      expect(result.totals.totalOrders).toBe(5);
    });
  });
});
