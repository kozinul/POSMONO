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
    getPaymentReconciliationAggregation: vi.fn(),
    getInventorySummaryAggregation: vi.fn(),
    getStockMovementTotalsAggregation: vi.fn(),
    getCogsAggregation: vi.fn(),
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

  describe('getProfitLoss', () => {
    it('computes gross profit, net profit and margin from finance + cogs', async () => {
      aggregation.getFinanceAggregation.mockResolvedValue({
        totalOrders: 12,
        totalRevenue: 1_200_000,
        netRevenue: 1_000_000,
        totalTax: 110_000,
        totalServiceCharge: 90_000,
        totalDiscount: 50_000,
        totalRounding: 0,
        categories: [],
      });
      aggregation.getCogsAggregation.mockResolvedValue({
        totalCogs: 720_000,
        totalUnits: 40,
      });

      const result = await service.getProfitLoss(TENANT_ID, '2026-08-01', '2026-08-06');

      expect(aggregation.getFinanceAggregation).toHaveBeenCalledWith(
        TENANT_ID,
        '2026-08-01',
        '2026-08-06',
      );
      expect(aggregation.getCogsAggregation).toHaveBeenCalledWith(
        TENANT_ID,
        '2026-08-01',
        '2026-08-06',
      );
      expect(result.totalOrders).toBe(12);
      expect(result.totalRevenue).toBe(1_200_000);
      expect(result.totalCogs).toBe(720_000);
      expect(result.cogsUnits).toBe(40);
      expect(result.grossProfit).toBe(480_000);
      expect(result.grossMarginPct).toBe(40);
      expect(result.netProfit).toBe(430_000);
    });

    it('returns zeros when there are no movements or sales', async () => {
      aggregation.getFinanceAggregation.mockResolvedValue({
        totalOrders: 0,
        totalRevenue: 0,
        netRevenue: 0,
        totalTax: 0,
        totalServiceCharge: 0,
        totalDiscount: 0,
        totalRounding: 0,
        categories: [],
      });
      aggregation.getCogsAggregation.mockResolvedValue({ totalCogs: 0, totalUnits: 0 });

      const result = await service.getProfitLoss(TENANT_ID, '2026-08-01', '2026-08-06');

      expect(result.totalRevenue).toBe(0);
      expect(result.totalCogs).toBe(0);
      expect(result.grossProfit).toBe(0);
      expect(result.netProfit).toBe(0);
      expect(result.grossMarginPct).toBe(0);
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

  describe('getPaymentReconciliation', () => {
    it('returns reconciliation report from aggregation', async () => {
      aggregation.getPaymentReconciliationAggregation.mockResolvedValue({
        items: [
          {
            method: 'cash',
            paymentTotal: 400_000,
            paymentCount: 4,
            orderTotal: 400_000,
            orderCount: 4,
            pendingTotal: 0,
            pendingCount: 0,
            difference: 0,
          },
          {
            method: 'transfer',
            paymentTotal: 100_000,
            paymentCount: 1,
            orderTotal: 100_000,
            orderCount: 1,
            pendingTotal: 100_000,
            pendingCount: 1,
            difference: 0,
          },
        ],
        totals: {
          paymentTotal: 500_000,
          orderTotal: 500_000,
          paymentCount: 5,
          orderCount: 5,
          pendingTotal: 100_000,
          pendingCount: 1,
          difference: 0,
        },
        dateFrom: '2026-08-01',
        dateTo: '2026-08-06',
        generatedAt: new Date(),
      });

      const result = await service.getPaymentReconciliation(TENANT_ID, '2026-08-01', '2026-08-06');

      expect(aggregation.getPaymentReconciliationAggregation).toHaveBeenCalledWith(
        TENANT_ID,
        '2026-08-01',
        '2026-08-06',
      );
      expect(result.items).toHaveLength(2);
      expect(result.totals.paymentTotal).toBe(500_000);
      expect(result.totals.pendingCount).toBe(1);
    });
  });

  describe('getInventorySummary', () => {
    it('merges stock snapshot with movement totals per product-warehouse', async () => {
      aggregation.getInventorySummaryAggregation.mockResolvedValue([
        {
          productId: 'p1',
          warehouseId: 'wh-1',
          warehouseName: 'Gudang Utama',
          productName: 'Kopi Susu',
          sku: 'KS-01',
          categoryName: 'Minuman',
          quantity: 10,
          reservedQuantity: 2,
          availableQuantity: 8,
          minLevel: 5,
          maxLevel: 100,
          costPrice: 5000,
          value: 50000,
          lowStock: false,
        },
      ]);
      aggregation.getStockMovementTotalsAggregation.mockResolvedValue([
        { productId: 'p1', warehouseId: 'wh-1', type: 'in', total: 8 },
        { productId: 'p1', warehouseId: 'wh-1', type: 'out', total: 3 },
      ]);

      const result = await service.getInventorySummary(TENANT_ID, '2026-08-01', '2026-08-31');

      expect(aggregation.getInventorySummaryAggregation).toHaveBeenCalledWith(TENANT_ID);
      expect(aggregation.getStockMovementTotalsAggregation).toHaveBeenCalledWith(
        TENANT_ID,
        '2026-08-01',
        '2026-08-31',
      );
      expect(result.dateFrom).toBe('2026-08-01');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].movements).toEqual({
        in: 8,
        out: 3,
        adjustment: 0,
        void: 0,
        reserve: 0,
        release: 0,
      });
      expect(result.items[0].openingQuantity).toBe(5);
      expect(result.items[0].openingReservedQuantity).toBe(2);
      expect(result.items[0].openingAvailableQuantity).toBe(3);
      expect(result.items[0].openingValue).toBe(25000);
      expect(result.totals.totalItems).toBe(10);
      expect(result.totals.totalValue).toBe(50000);
      expect(result.totals.totalOpeningItems).toBe(5);
      expect(result.totals.totalOpeningValue).toBe(25000);
      expect(result.lowStockCount).toBe(0);
      expect(typeof result.generatedAt).toBe('string');
    });

    it('marks low stock items and computes value from costPrice', async () => {
      aggregation.getInventorySummaryAggregation.mockResolvedValue([
        {
          productId: 'p1',
          warehouseId: 'wh-1',
          warehouseName: 'Gudang Utama',
          productName: 'Teh Manis',
          sku: 'TM-01',
          categoryName: 'Minuman',
          quantity: 3,
          reservedQuantity: 0,
          availableQuantity: 3,
          minLevel: 5,
          maxLevel: 100,
          costPrice: 2000,
          value: 6000,
          lowStock: true,
        },
      ]);
      aggregation.getStockMovementTotalsAggregation.mockResolvedValue([]);

      const result = await service.getInventorySummary(TENANT_ID);

      expect(result.items[0].lowStock).toBe(true);
      expect(result.lowStockCount).toBe(1);
      expect(result.totals.totalValue).toBe(6000);
      expect(result.items[0].openingQuantity).toBe(3);
      expect(result.items[0].openingValue).toBe(6000);
    });

    it('computes opening reserved quantity from reserve/release movements', async () => {
      aggregation.getInventorySummaryAggregation.mockResolvedValue([
        {
          productId: 'p1',
          warehouseId: 'wh-1',
          warehouseName: 'Gudang Utama',
          productName: 'Es Teh',
          sku: 'ET-01',
          categoryName: 'Minuman',
          quantity: 10,
          reservedQuantity: 7,
          availableQuantity: 3,
          minLevel: 0,
          maxLevel: 100,
          costPrice: 1000,
          value: 10000,
          lowStock: false,
        },
      ]);
      aggregation.getStockMovementTotalsAggregation.mockResolvedValue([
        { productId: 'p1', warehouseId: 'wh-1', type: 'in', total: 4 },
        { productId: 'p1', warehouseId: 'wh-1', type: 'out', total: 2 },
        { productId: 'p1', warehouseId: 'wh-1', type: 'reserve', total: 3 },
        { productId: 'p1', warehouseId: 'wh-1', type: 'release', total: 1 },
      ]);

      const result = await service.getInventorySummary(TENANT_ID, '2026-08-01', '2026-08-31');

      expect(result.items[0].openingQuantity).toBe(8);
      expect(result.items[0].openingReservedQuantity).toBe(5);
      expect(result.items[0].openingAvailableQuantity).toBe(3);
      expect(result.items[0].openingValue).toBe(8000);
      expect(result.items[0].movements.reserve).toBe(3);
      expect(result.items[0].movements.release).toBe(1);
    });
  });
});
