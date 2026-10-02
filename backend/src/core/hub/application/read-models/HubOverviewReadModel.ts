/**
 * The hub overview read model (Hub V2 Fase 19; reused by Fase 21).
 *
 * Kept out of any controller on purpose: this is a composition rule (which
 * outlets appear, when an outlet counts as stale, how zero-sales tenants are
 * presented), not HTTP plumbing, and it needs to be readable — and testable —
 * without an Express request.
 *
 * Lives under the hub context, not the platform one, because Fase 21 serves the
 * same projection to hub members through `/api/hub/:hubId/overview`; the Terminal
 * Center just became its second caller.
 *
 * The hub owns no business data. Everything here is a projection over
 * `orders` / `shifts` / `outlets` / `subscriptions` already scoped to the hub's
 * tenants, so this adds no collection.
 */

/** Outlets with no open shift and no activity within `staleHours` need a look. */
export const OVERVIEW_STALE_HOURS = 24;

export interface HubOverviewOutletRow {
  outletId: string | null;
  outletName: string | null;
  tenantId: string;
  tenantName: string | null;
  isActive: boolean;
  openShifts: number;
  lastShiftAt: string | null;
  hasOpenShift: boolean;
  isStale: boolean;
  idleHours: number | null;
}

export interface HubOverviewReadModel {
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  counts: { tenants: number; outlets: number; activeOutlets: number; members: number };
  operational: {
    staleHours: number;
    outletsWithOpenShift: number;
    outletsStale: number;
    outletsWithoutShift: number;
    outlets: HubOverviewOutletRow[];
  };
  sales: {
    currency: string;
    total: number;
    transactions: number;
    byTenant: Array<{ tenantId: string; tenantName: string | null; total: number; transactions: number }>;
  };
  subscription: Array<{
    tenantId: string;
    tenantName: string | null;
    planName: string | null;
    status: string;
    daysRemaining: number;
  }>;
}

/**
 * Structural sources: this read model declares only the data it reads, so a
 * caller can pass the real services, a wiring-time subset, or a test double
 * without the module importing four concrete classes.
 */
export interface OutletSource {
  listAllForPlatform(tenantIds: string[], activeOnly?: boolean): Promise<Array<{ serialize(): OutletDocument }>>;
}
export interface OutletDocument {
  id: string;
  name: string;
  tenantId: string;
  isActive: boolean;
}
export interface OutletActivityRow {
  tenantId: string;
  outletId: string | null;
  openShifts: number;
  hasOpenShift: boolean;
  lastShiftAt: string | null;
}
export interface ActivitySource {
  getPlatformOutletActivity(tenantIds: string[]): Promise<{ generatedAt: string; outlets: OutletActivityRow[] }>;
}
export interface SalesTotals {
  totalOrders: number;
  totalRevenue: number;
}
export interface SalesSource {
  getPlatformSalesByTenant(
    tenantIds: string[],
    options?: { dateFrom?: Date; dateTo?: Date },
  ): Promise<{ totals: SalesTotals; byTenant: Array<{ tenantId: string; totalOrders: number; totalRevenue: number }> }>;
}
export interface SubscriptionRow {
  tenantId: string;
  planName: string | null;
  status: string;
  daysRemaining: number;
}
export interface SubscriptionSource {
  getTenantSubscriptions(tenantIds: string[]): Promise<SubscriptionRow[]>;
}
export interface MemberSource {
  listMembers(hubId: string): Promise<unknown[]>;
  /**
   * Fase 21 — bulk head count. Optional so the read model still accepts a
   * caller that only decorates members (the platform wiring used to pass exactly
   * that); when present it replaces `listMembers`, which is one `findById` per
   * member and the N+1 Fase 19 left open.
   */
  countMembers?(hubId: string): Promise<number>;
}

export interface BuildHubOverviewInput {
  hubId: string;
  tenantIds: string[];
  tenantNameById: Record<string, string>;
  membersSource: MemberSource | null;
  dateFrom: Date;
  dateTo: Date;
  outletsSource: OutletSource;
  activitySource: ActivitySource;
  salesSource: SalesSource | null;
  subscriptionSource: SubscriptionSource | null;
}

/** Key that joins shift activity to an outlet; `null` outlet = the tenant default outlet. */
function outletKey(tenantId: string, outletId: string | null): string {
  return `${tenantId}:${outletId ?? 'default'}`;
}

export async function buildHubOverview(input: BuildHubOverviewInput): Promise<HubOverviewReadModel> {
  const { tenantIds, tenantNameById } = input;

  const [outlets, activity, sales, subscriptions, memberCount] = await Promise.all([
    input.outletsSource.listAllForPlatform(tenantIds),
    input.activitySource.getPlatformOutletActivity(tenantIds),
    input.salesSource ? input.salesSource.getPlatformSalesByTenant(tenantIds, { dateFrom: input.dateFrom, dateTo: input.dateTo }) : Promise.resolve(null),
    input.subscriptionSource ? input.subscriptionSource.getTenantSubscriptions(tenantIds) : Promise.resolve([]),
    input.membersSource
      ? input.membersSource.countMembers
        ? input.membersSource.countMembers(input.hubId)
        : input.membersSource.listMembers(input.hubId).then((rows) => rows.length)
      : Promise.resolve(0),
  ]);

  const outletDocuments = outlets.map((o) => o.serialize());
  const activeOutletCount = outletDocuments.filter((o) => o.isActive).length;

  const activityByKey: Record<string, OutletActivityRow> = {};
  for (const row of activity.outlets) {
    activityByKey[outletKey(row.tenantId, row.outletId)] = row;
  }

  const now = Date.now();
  const staleMs = OVERVIEW_STALE_HOURS * 60 * 60 * 1000;

  const rows: HubOverviewOutletRow[] = [];
  const pushRow = (base: {
    outletId: string | null;
    outletName: string | null;
    tenantId: string;
    isActive: boolean;
  }): void => {
    const activityRow = activityByKey[outletKey(base.tenantId, base.outletId)];
    const hasOpenShift = activityRow?.hasOpenShift ?? false;
    const lastShiftAt = activityRow?.lastShiftAt ?? null;
    const idleMs = lastShiftAt ? now - new Date(lastShiftAt).getTime() : null;
    rows.push({
      ...base,
      tenantName: tenantNameById[base.tenantId] ?? null,
      openShifts: activityRow?.openShifts ?? 0,
      lastShiftAt,
      hasOpenShift,
      // An outlet that never opened a shift is stale too: that is exactly the
      // case an operator needs to see, and it produces no shift row at all.
      isStale: !hasOpenShift && (idleMs === null || idleMs > staleMs),
      idleHours: idleMs === null ? null : Math.floor(idleMs / (60 * 60 * 1000)),
    });
  };

  // Rows are driven by the outlet list, not by shift activity, so a never-used
  // outlet is visible instead of silently absent.
  for (const outlet of outletDocuments) {
    pushRow({
      outletId: outlet.id,
      outletName: outlet.name,
      tenantId: outlet.tenantId,
      isActive: outlet.isActive,
    });
  }

  // Activity for an outlet with no document (deleted outlet, or a legacy
  // outletId-less shift) still has to appear, otherwise a live cashier silently
  // disappears from the overview.
  const knownOutletIds = new Set(outletDocuments.map((o) => o.id));
  for (const activityRow of activity.outlets) {
    if (activityRow.outletId && knownOutletIds.has(activityRow.outletId)) continue;
    pushRow({
      outletId: activityRow.outletId,
      outletName: null,
      tenantId: activityRow.tenantId,
      isActive: activityRow.outletId === null,
    });
  }

  rows.sort(
    (a, b) =>
      Number(b.hasOpenShift) - Number(a.hasOpenShift) ||
      (a.outletName ?? '').localeCompare(b.outletName ?? ''),
  );

  // Sales rows only exist for tenants that sold something; the overview lists
  // every tenant of the hub so "no sales" reads as Rp 0 instead of vanishing.
  const salesByTenantId: Record<string, { total: number; transactions: number }> = {};
  for (const row of sales?.byTenant ?? []) {
    salesByTenantId[row.tenantId] = { total: row.totalRevenue, transactions: row.totalOrders };
  }
  const byTenant = tenantIds.map((tenantId) => ({
    tenantId,
    tenantName: tenantNameById[tenantId] ?? null,
    total: salesByTenantId[tenantId]?.total ?? 0,
    transactions: salesByTenantId[tenantId]?.transactions ?? 0,
  }));
  byTenant.sort((a, b) => b.total - a.total);

  return {
    dateFrom: input.dateFrom.toISOString(),
    dateTo: input.dateTo.toISOString(),
    generatedAt: new Date().toISOString(),
    counts: {
      tenants: tenantIds.length,
      outlets: outletDocuments.length,
      activeOutlets: activeOutletCount,
      members: memberCount,
    },
    operational: {
      staleHours: OVERVIEW_STALE_HOURS,
      outletsWithOpenShift: rows.filter((r) => r.hasOpenShift).length,
      outletsStale: rows.filter((r) => r.isStale).length,
      outletsWithoutShift: rows.filter((r) => r.lastShiftAt === null).length,
      outlets: rows,
    },
    sales: {
      currency: 'IDR',
      total: sales?.totals.totalRevenue ?? 0,
      transactions: sales?.totals.totalOrders ?? 0,
      byTenant,
    },
    subscription: subscriptions.map((s) => ({
      tenantId: s.tenantId,
      tenantName: tenantNameById[s.tenantId] ?? null,
      planName: s.planName,
      status: s.status,
      daysRemaining: s.daysRemaining,
    })),
  };
}