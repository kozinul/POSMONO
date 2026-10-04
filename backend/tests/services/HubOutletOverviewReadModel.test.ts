import { describe, it, expect, vi } from 'vitest';
import {
  buildHubOutletOverview,
  type HubOutletSalesRow,
} from '../../src/core/hub/application/read-models/HubOutletOverviewReadModel';
import { OVERVIEW_STALE_HOURS } from '../../src/core/hub/application/read-models/HubOverviewPrimitives';

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

function activitySource(
  rows: Array<{ tenantId: string; outletId: string | null; openShifts: number; lastShiftAt: string | null }>,
) {
  return {
    getPlatformOutletActivity: vi.fn(async () => ({
      generatedAt: new Date().toISOString(),
      outlets: rows.map((r) => ({ ...r, hasOpenShift: r.openShifts > 0 })),
    })),
  };
}

function salesSource(rows: HubOutletSalesRow[] | null) {
  if (rows === null) return null;
  return {
    getPlatformSalesByOutlet: vi.fn(async () => ({ byOutlet: rows })),
  };
}

function salesRow(overrides: Partial<HubOutletSalesRow> = {}): HubOutletSalesRow {
  return {
    tenantId: 't-1',
    outletId: 'out-1',
    totalOrders: 5,
    totalRevenue: 500_000,
    totalTax: 50_000,
    totalDiscount: 10_000,
    totalRounding: 500,
    ...overrides,
  };
}

const baseInput = {
  hubId: 'hub-1',
  outletId: 'out-1',
  outletName: 'Sanur',
  outletTenantId: 't-1',
  outletIsActive: true,
  tenantName: 'Kopi Bali',
  membersSource: { listMembers: vi.fn(async () => [{ id: 'u-1' }, { id: 'u-2' }]) },
  dateFrom: new Date('2026-09-01T00:00:00.000Z'),
  dateTo: new Date('2026-09-30T23:59:59.999Z'),
  activitySource: activitySource([]),
  salesSource: salesSource([salesRow()]),
};

describe('buildHubOutletOverview (Hub V2 Fase 23)', () => {
  it('reports the outlet identity and the tenant it belongs to', async () => {
    const model = await buildHubOutletOverview(baseInput);

    expect(model.outlet).toEqual({
      id: 'out-1',
      name: 'Sanur',
      tenantId: 't-1',
      tenantName: 'Kopi Bali',
      isActive: true,
    });
  });

  it('counts sales for THIS outlet only, ignoring the tenant total', async () => {
    // A sibling outlet of the same tenant, plus the tenant's outletId-less
    // history. Neither may leak into this screen.
    const model = await buildHubOutletOverview({
      ...baseInput,
      salesSource: salesSource([
        salesRow(),
        salesRow({ outletId: 'out-2', totalOrders: 9, totalRevenue: 9_000_000 }),
        salesRow({ outletId: null, totalOrders: 3, totalRevenue: 300_000 }),
      ]),
    });

    expect(model.sales).toEqual({
      currency: 'IDR',
      total: 500_000,
      transactions: 5,
      tax: 50_000,
      discount: 10_000,
      rounding: 500,
    });
  });

  it('asks the sales source only for the outlet tenant, in the requested range', async () => {
    const sales = salesSource([salesRow()]);
    await buildHubOutletOverview({ ...baseInput, salesSource: sales });

    // Scoping to the outlet's own tenant: the outlet view never pays for the
    // whole hub.
    expect(sales!.getPlatformSalesByOutlet).toHaveBeenCalledWith(['t-1'], {
      dateFrom: baseInput.dateFrom,
      dateTo: baseInput.dateTo,
    });
  });

  it('scopes shift activity to the outlet tenant as well', async () => {
    const activity = activitySource([
      { tenantId: 't-1', outletId: 'out-1', openShifts: 0, lastShiftAt: hoursAgo(2) },
      { tenantId: 't-2', outletId: 'zzz', openShifts: 3, lastShiftAt: hoursAgo(1) },
    ]);

    await buildHubOutletOverview({ ...baseInput, activitySource: activity });

    expect(activity.getPlatformOutletActivity).toHaveBeenCalledWith(['t-1']);
  });

  it('reports zero sales rather than failing when no sales source is wired', async () => {
    const model = await buildHubOutletOverview({ ...baseInput, salesSource: null });

    expect(model.sales.total).toBe(0);
    expect(model.sales.transactions).toBe(0);
  });

  it('shows an outlet that never opened a shift as stale, with a null idle time', async () => {
    const model = await buildHubOutletOverview({ ...baseInput });

    expect(model.operational).toMatchObject({
      staleHours: OVERVIEW_STALE_HOURS,
      hasOpenShift: false,
      openShifts: 0,
      lastShiftAt: null,
      isStale: true,
      idleHours: null,
    });
  });

  it('reports an open shift as not stale', async () => {
    const model = await buildHubOutletOverview({
      ...baseInput,
      activitySource: activitySource([
        { tenantId: 't-1', outletId: 'out-1', openShifts: 2, lastShiftAt: hoursAgo(1) },
      ]),
    });

    expect(model.operational).toMatchObject({ hasOpenShift: true, openShifts: 2, isStale: false });
  });

  it('shares the stale rule with the group view: idle past the threshold is stale', async () => {
    const model = await buildHubOutletOverview({
      ...baseInput,
      activitySource: activitySource([
        { tenantId: 't-1', outletId: 'out-1', openShifts: 0, lastShiftAt: hoursAgo(OVERVIEW_STALE_HOURS + 1) },
      ]),
    });

    expect(model.operational.isStale).toBe(true);
    expect(model.operational.idleHours).toBe(OVERVIEW_STALE_HOURS + 1);
  });

  it('ignores activity rows belonging to another outlet of the same tenant', async () => {
    const model = await buildHubOutletOverview({
      ...baseInput,
      activitySource: activitySource([
        { tenantId: 't-1', outletId: 'out-1', openShifts: 0, lastShiftAt: hoursAgo(2) },
        { tenantId: 't-1', outletId: 'out-2', openShifts: 4, lastShiftAt: hoursAgo(1) },
      ]),
    });

    expect(model.operational.openShifts).toBe(0);
    expect(model.operational.hasOpenShift).toBe(false);
  });

  it('counts hub members via countMembers when available, so listMembers is skipped', async () => {
    const membersSource = {
      listMembers: vi.fn(async () => [{ id: 'u-1' }]),
      countMembers: vi.fn(async () => 12),
    };

    const model = await buildHubOutletOverview({ ...baseInput, membersSource });

    expect(membersSource.countMembers).toHaveBeenCalledWith('hub-1');
    expect(membersSource.listMembers).not.toHaveBeenCalled();
    expect(model.members.total).toBe(12);
  });

  it('falls back to listMembers when the source cannot count', async () => {
    const model = await buildHubOutletOverview(baseInput);

    expect(model.members.total).toBe(2);
  });

  it('reports zero members when no member source is wired', async () => {
    const model = await buildHubOutletOverview({ ...baseInput, membersSource: null });

    expect(model.members.total).toBe(0);
  });

  it('echoes the requested range and marks the moment it was generated', async () => {
    const model = await buildHubOutletOverview(baseInput);

    expect(model.dateFrom).toBe('2026-09-01T00:00:00.000Z');
    expect(model.dateTo).toBe('2026-09-30T23:59:59.999Z');
    expect(Number.isNaN(Date.parse(model.generatedAt))).toBe(false);
  });
});