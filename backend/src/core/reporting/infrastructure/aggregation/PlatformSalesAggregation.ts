import { Model } from 'mongoose';

/**
 * Sales aggregations that span **many tenants at once** — the hub-level reads
 * (`/api/platform/hubs/:id/overview`, `/api/hub/outlet/overview`).
 *
 * These live apart from `ReportAggregation` for one reason: they do not answer
 * "how did this tenant do", they answer "how did these tenants do together",
 * which is a different question with a different grouping key and a different
 * caller. `ReportAggregation` delegates to this class so the DI wiring and every
 * existing caller keep working while the file stops growing.
 *
 * Revenue semantics are identical to the tenant-scoped aggregations on purpose —
 * `roundingAdjustment` is added to `total` and discount takes the `$max` of the
 * two duplicated fields — so a hub total and a per-tenant finance report can
 * never disagree.
 */

export interface PlatformSalesByTenantRow {
  _id: string;
  totalOrders: number;
  totalRevenue: number;
  totalTax: number;
  totalDiscount: number;
  totalRounding: number;
}

/**
 * Group row of `getSalesByOutlet` (one row per outlet).
 * `outletId: null` collects pre-outlet orders, which no outlet view reads.
 */
export interface PlatformSalesByOutletRow {
  _id: { tenantId: string; outletId: string | null };
  totalOrders: number;
  totalRevenue: number;
  totalTax: number;
  totalDiscount: number;
  totalRounding: number;
}

export interface PlatformSalesByTenant {
  tenantId: string;
  totalOrders: number;
  totalRevenue: number;
  totalTax: number;
  totalDiscount: number;
  totalRounding: number;
}

export interface PlatformSalesByOutlet {
  tenantId: string;
  outletId: string | null;
  totalOrders: number;
  totalRevenue: number;
  totalTax: number;
  totalDiscount: number;
  totalRounding: number;
}

/** An already-expanded window: start/end of day, not a `YYYY-MM-DD` string. */
export interface PlatformSalesRange {
  from: Date;
  to: Date;
}

export class PlatformSalesAggregation {
  constructor(private readonly orderModel: Model<any>) {}

  /** Orders that count as revenue: settled, voided/cancelled orders do not. */
  private static settledMatch(tenantIds: string[], range: PlatformSalesRange) {
    return {
      tenantId: { $in: tenantIds },
      createdAt: { $gte: range.from, $lte: range.to },
      status: { $in: ['paid', 'completed'] },
    };
  }

  private static totals() {
    return {
      totalOrders: { $sum: 1 },
      totalRevenue: { $sum: { $add: [{ $ifNull: ['$roundingAdjustment', 0] }, '$total'] } },
      totalTax: { $sum: { $ifNull: ['$tax', 0] } },
      // `$max`, not `$add`: `discount` and `discountTotal` always hold the same
      // value on new orders (the Finance double-count fix), so adding them would
      // report every discount twice.
      totalDiscount: {
        $sum: { $max: [{ $ifNull: ['$discount', 0] }, { $ifNull: ['$discountTotal', 0] }] },
      },
      totalRounding: { $sum: { $ifNull: ['$roundingAdjustment', 0] } },
    };
  }

  /**
   * Hub V2 Fase 19 — sales grouped by tenant across many tenants at once.
   *
   * Deliberately ONE grouped aggregation over `orders` instead of calling
   * `getFinanceAggregation` per tenant: a hub with N tenants would otherwise
   * issue 2N pipelines (totals + categories) just to draw one overview card.
   */
  async getSalesByTenant(
    tenantIds: string[],
    range: PlatformSalesRange,
  ): Promise<PlatformSalesByTenant[]> {
    if (tenantIds.length === 0) return [];

    const rows = await this.orderModel.aggregate([
      { $match: PlatformSalesAggregation.settledMatch(tenantIds, range) },
      { $group: { _id: '$tenantId', ...PlatformSalesAggregation.totals() } },
      { $sort: { totalRevenue: -1 } },
    ]);

    return rows.map((row: PlatformSalesByTenantRow) => ({
      tenantId: String(row._id),
      totalOrders: Number(row.totalOrders ?? 0),
      totalRevenue: Math.round(Number(row.totalRevenue ?? 0)),
      totalTax: Math.round(Number(row.totalTax ?? 0)),
      totalDiscount: Math.round(Number(row.totalDiscount ?? 0)),
      totalRounding: Math.round(Number(row.totalRounding ?? 0)),
    }));
  }

  /**
   * Hub V2 Fase 23 — sales per **outlet**, in one pass.
   *
   * Kept separate from `getSalesByTenant` on purpose. An outlet view that reused
   * the tenant aggregation and filtered its rows would show the *tenant's* whole
   * revenue on an outlet screen: it looks right, and it is wrong about money.
   * Grouping by `outletId` is what makes the number mean the outlet it is shown
   * under.
   *
   * Orders from before outlets existed carry `outletId: null` and group under
   * `null`. They are deliberately invisible to any outlet view — that matches the
   * strict-equality `outletId` filter every other outlet-scoped report already
   * applies (`MongoOrderRepository.getDailySales`, `findByTenant`), so an outlet
   * view and that tenant's outlet-filtered report never disagree.
   */
  async getSalesByOutlet(
    tenantIds: string[],
    range: PlatformSalesRange,
  ): Promise<PlatformSalesByOutlet[]> {
    if (tenantIds.length === 0) return [];

    const rows = await this.orderModel.aggregate([
      { $match: PlatformSalesAggregation.settledMatch(tenantIds, range) },
      {
        $group: {
          _id: { tenantId: '$tenantId', outletId: '$outletId' },
          ...PlatformSalesAggregation.totals(),
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    return rows.map((row: PlatformSalesByOutletRow) => ({
      tenantId: String(row._id?.tenantId),
      outletId: row._id?.outletId == null ? null : String(row._id.outletId),
      totalOrders: Number(row.totalOrders ?? 0),
      totalRevenue: Math.round(Number(row.totalRevenue ?? 0)),
      totalTax: Math.round(Number(row.totalTax ?? 0)),
      totalDiscount: Math.round(Number(row.totalDiscount ?? 0)),
      totalRounding: Math.round(Number(row.totalRounding ?? 0)),
    }));
  }
}