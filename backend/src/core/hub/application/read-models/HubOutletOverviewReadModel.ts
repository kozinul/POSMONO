/**
 * The **outlet view** of a hub (`/hub/outlet`) — Hub V2 Fase 23.
 *
 * A separate read model from `HubOverviewReadModel`, not a parameterised one.
 * The group view answers "how is this group of businesses doing?" across every
 * tenant and outlet of the hub; this one answers "how is *this outlet* doing?".
 * Forcing both through one signature is how a read model loses its boundary and
 * grows a `tenantId?` / `outletId?` / `hubId?` argument list that silently answers
 * neither question. What they genuinely share — the outlet row list, the stale
 * rule, the member head count — lives in `HubOverviewPrimitives`.
 *
 * The single most important difference, and the reason this file exists: sales
 * are counted **per outlet**. The group view may reuse a tenant-wide total
 * because it is labelled as one; an outlet screen showing a tenant's whole
 * revenue would look correct and be wrong about money.
 */

import {
  OVERVIEW_STALE_HOURS,
  buildOutletRows,
  countHubMembers,
  type HubMemberCountSource,
} from './HubOverviewPrimitives';
import type { ActivitySource } from './HubOverviewReadModel';

export interface HubOutletSalesRow {
  tenantId: string;
  outletId: string | null;
  totalOrders: number;
  totalRevenue: number;
  totalTax: number;
  totalDiscount: number;
  totalRounding: number;
}

/**
 * Structural source for outlet-level sales. Separate from the group view's
 * `SalesSource` on purpose: a caller cannot satisfy the outlet view with a
 * per-tenant aggregation by accident.
 */
export interface OutletSalesSource {
  getPlatformSalesByOutlet(
    tenantIds: string[],
    options?: { dateFrom?: Date; dateTo?: Date },
  ): Promise<{ byOutlet: HubOutletSalesRow[] }>;
}

export interface HubOutletOverviewReadModel {
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  outlet: {
    id: string;
    name: string;
    tenantId: string;
    tenantName: string | null;
    isActive: boolean;
  };
  sales: {
    currency: string;
    total: number;
    transactions: number;
    tax: number;
    discount: number;
    rounding: number;
  };
  operational: {
    staleHours: number;
    hasOpenShift: boolean;
    openShifts: number;
    lastShiftAt: string | null;
    isStale: boolean;
    idleHours: number | null;
  };
  /** Hub members, not outlet members — membership is a hub-level fact. */
  members: { total: number };
}

export interface BuildHubOutletOverviewInput {
  hubId: string;
  outletId: string;
  outletName: string;
  outletTenantId: string;
  outletIsActive: boolean;
  tenantName: string | null;
  membersSource: HubMemberCountSource | null;
  dateFrom: Date;
  dateTo: Date;
  activitySource: ActivitySource;
  salesSource: OutletSalesSource | null;
}

export async function buildHubOutletOverview(
  input: BuildHubOutletOverviewInput,
): Promise<HubOutletOverviewReadModel> {
  // Scoped to the outlet's own tenant: the activity source groups by
  // `{tenantId, outletId}` already, so one tenant's rows are enough and the
  // outlet view never pays for the whole hub.
  const [activity, sales, memberCount] = await Promise.all([
    input.activitySource.getPlatformOutletActivity([input.outletTenantId]),
    input.salesSource
      ? input.salesSource.getPlatformSalesByOutlet([input.outletTenantId], {
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
        })
      : Promise.resolve(null),
    countHubMembers(input.membersSource, input.hubId),
  ]);

  const rows = buildOutletRows({
    outletDocuments: [
      {
        id: input.outletId,
        name: input.outletName,
        tenantId: input.outletTenantId,
        isActive: input.outletIsActive,
      },
    ],
    activityRows: activity.outlets.filter((row) => row.outletId === input.outletId),
    tenantNameById: { [input.outletTenantId]: input.tenantName ?? '' },
  });

  // The outlet document is always pushed, so exactly one row comes back — even
  // for an outlet that has never opened a shift, which is precisely the case an
  // operator needs to see.
  const row = rows[0];
  const operational = {
    staleHours: OVERVIEW_STALE_HOURS,
    hasOpenShift: row?.hasOpenShift ?? false,
    openShifts: row?.openShifts ?? 0,
    lastShiftAt: row?.lastShiftAt ?? null,
    isStale: row?.isStale ?? true,
    idleHours: row?.idleHours ?? null,
  };

  // Only this outlet's row counts. A `null` outletId row is pre-outlet history
  // and belongs to no outlet screen.
  const salesRow = sales?.byOutlet.find(
    (candidate) => candidate.tenantId === input.outletTenantId && candidate.outletId === input.outletId,
  );

  return {
    dateFrom: input.dateFrom.toISOString(),
    dateTo: input.dateTo.toISOString(),
    generatedAt: new Date().toISOString(),
    outlet: {
      id: input.outletId,
      name: input.outletName,
      tenantId: input.outletTenantId,
      tenantName: input.tenantName ?? row?.tenantName ?? null,
      isActive: input.outletIsActive,
    },
    sales: {
      currency: 'IDR',
      total: salesRow?.totalRevenue ?? 0,
      transactions: salesRow?.totalOrders ?? 0,
      tax: salesRow?.totalTax ?? 0,
      discount: salesRow?.totalDiscount ?? 0,
      rounding: salesRow?.totalRounding ?? 0,
    },
    operational,
    members: { total: memberCount },
  };
}
