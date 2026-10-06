import { describe, it, expect, vi } from 'vitest';
import { PlatformSalesAggregation } from '../../src/core/reporting/infrastructure/aggregation/PlatformSalesAggregation';

const range = { from: new Date('2026-08-01T00:00:00.000Z'), to: new Date('2026-08-31T23:59:59.999Z') };

/** Captures the pipeline so a test can assert the `$match`/`$group` shape. */
function modelReturning(rows: unknown[]) {
  const aggregate = vi.fn(async () => rows);
  return { aggregate, model: { aggregate } as never };
}

const tenantRow = (overrides: Record<string, unknown> = {}) => ({
  _id: 't-a',
  totalOrders: 3,
  totalRevenue: 300_000,
  totalTax: 30_000,
  totalDiscount: 0,
  totalRounding: 0,
  ...overrides,
});

describe('PlatformSalesAggregation', () => {
  describe('getSalesByTenant', () => {
    it('groups by tenant and normalises every figure to a number', async () => {
      const { aggregate, model } = modelReturning([
        tenantRow({ totalOrders: '4', totalRevenue: 1234.6, totalTax: null, totalDiscount: undefined }),
      ]);

      const result = await new PlatformSalesAggregation(model).getSalesByTenant(['t-a'], range);

      expect(result).toEqual([
        { tenantId: 't-a', totalOrders: 4, totalRevenue: 1235, totalTax: 0, totalDiscount: 0, totalRounding: 0 },
      ]);
      expect(aggregate).toHaveBeenCalledTimes(1);
    });

    it('short-circuits an empty tenant list without touching Mongo', async () => {
      const { aggregate, model } = modelReturning([]);

      await expect(new PlatformSalesAggregation(model).getSalesByTenant([], range)).resolves.toEqual([]);
      expect(aggregate).not.toHaveBeenCalled();
    });

    it('adds roundingAdjustment to total and takes discount as the max of both fields', async () => {
      const { aggregate, model } = modelReturning([]);

      await new PlatformSalesAggregation(model).getSalesByTenant(['t-a'], range);

      const group = aggregate.mock.calls[0][0][1].$group;
      // Rounding is part of what the customer pays, so it counts as revenue.
      expect(group.totalRevenue.$sum).toEqual({ $add: [{ $ifNull: ['$roundingAdjustment', 0] }, '$total'] });
      // `$max`, not `$add`: both fields hold the same discount on new orders, so
      // adding them would report every discount twice (the Finance fix).
      expect(group.totalDiscount.$sum).toEqual({
        $max: [{ $ifNull: ['$discount', 0] }, { $ifNull: ['$discountTotal', 0] }],
      });
    });

    it('matches only settled orders inside the window, for the given tenants', async () => {
      const { aggregate, model } = modelReturning([]);

      await new PlatformSalesAggregation(model).getSalesByTenant(['t-a', 't-b'], range);

      const [match] = aggregate.mock.calls[0][0];
      expect(match.$match).toEqual({
        tenantId: { $in: ['t-a', 't-b'] },
        createdAt: { $gte: range.from, $lte: range.to },
        status: { $in: ['paid', 'completed'] },
      });
    });

    it('groups by tenantId alone, never by outlet', async () => {
      const { aggregate, model } = modelReturning([]);

      await new PlatformSalesAggregation(model).getSalesByTenant(['t-a'], range);

      const group = aggregate.mock.calls[0][0][1].$group;
      expect(group._id).toBe('$tenantId');
    });
  });
});
