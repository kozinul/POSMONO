import { describe, it, expect, vi } from 'vitest';
import { buildHubOverview, OVERVIEW_STALE_HOURS } from '../../src/core/hub/application/read-models/HubOverviewReadModel';

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

function outletDoc(overrides: Partial<{ id: string; name: string; tenantId: string; isActive: boolean }> = {}) {
  return {
    id: 'out-1',
    name: 'Sanur',
    tenantId: 't-1',
    isActive: true,
    ...overrides,
  };
}

function outletSource(docs: ReturnType<typeof outletDoc>[]) {
  return {
    listAllForPlatform: vi.fn(async () => docs.map((d) => ({ serialize: () => d }))),
  };
}

function activitySource(rows: Array<{ tenantId: string; outletId: string | null; openShifts: number; lastShiftAt: string | null }>) {
  return {
    getPlatformOutletActivity: vi.fn(async () => ({
      generatedAt: new Date().toISOString(),
      outlets: rows.map((r) => ({ ...r, hasOpenShift: r.openShifts > 0 })),
    })),
  };
}

function salesSource(rows: Array<{ tenantId: string; totalOrders: number; totalRevenue: number }> | null) {
  if (rows === null) return null;
  return {
    getPlatformSalesByTenant: vi.fn(async () => ({
      totals: {
        totalOrders: rows.reduce((n, r) => n + r.totalOrders, 0),
        totalRevenue: rows.reduce((n, r) => n + r.totalRevenue, 0),
        totalTax: 0,
        totalDiscount: 0,
        totalRounding: 0,
      },
      byTenant: rows,
    })),
  };
}

const subscriptionSource = { getTenantSubscriptions: vi.fn(async () => []) };
const membersSource = { listMembers: vi.fn(async () => [{ id: 'u-1' }, { id: 'u-2' }]) };

const baseInput = {
  hubId: 'hub-1',
  tenantIds: ['t-1'],
  tenantNameById: { 't-1': 'Kopi Bali' },
  membersSource,
  dateFrom: new Date('2026-09-01T00:00:00.000Z'),
  dateTo: new Date('2026-09-30T23:59:59.999Z'),
  outletsSource: outletSource([]),
  activitySource: activitySource([]),
  salesSource: salesSource([]),
  subscriptionSource,
};

describe('buildHubOverview (Hub V2 Fase 19)', () => {
  it('counts tenants, outlets, active outlets and members', async () => {
    const model = await buildHubOverview({
      ...baseInput,
      outletsSource: outletSource([
        outletDoc({ id: 'out-1', isActive: true }),
        outletDoc({ id: 'out-2', name: 'Ubud', isActive: false }),
      ]),
    });

    expect(model.counts).toEqual({ tenants: 1, outlets: 2, activeOutlets: 1, members: 2 });
  });

  it('lists an outlet that never opened a shift and counts it as stale', async () => {
    const model = await buildHubOverview({
      ...baseInput,
      outletsSource: outletSource([outletDoc(), outletDoc({ id: 'out-2', name: 'Kemang' })]),
      activitySource: activitySource([{ tenantId: 't-1', outletId: 'out-1', openShifts: 0, lastShiftAt: hoursAgo(2) }]),
    });

    const kemang = model.operational.outlets.find((o) => o.outletId === 'out-2');
    expect(kemang).toMatchObject({ outletName: 'Kemang', lastShiftAt: null, idleHours: null, isStale: true, openShifts: 0 });
    expect(model.operational.outletsWithoutShift).toBe(1);
    expect(model.operational.staleHours).toBe(OVERVIEW_STALE_HOURS);
  });

  it('treats an outlet idle beyond the stale threshold as stale, and a fresh idle one as fine', async () => {
    const model = await buildHubOverview({
      ...baseInput,
      outletsSource: outletSource([outletDoc(), outletDoc({ id: 'out-2', name: 'Ubud' })]),
      activitySource: activitySource([
        { tenantId: 't-1', outletId: 'out-1', openShifts: 0, lastShiftAt: hoursAgo(3) },
        { tenantId: 't-1', outletId: 'out-2', openShifts: 0, lastShiftAt: hoursAgo(OVERVIEW_STALE_HOURS + 5) },
      ]),
    });

    expect(model.operational.outlets.find((o) => o.outletId === 'out-1')?.isStale).toBe(false);
    expect(model.operational.outlets.find((o) => o.outletId === 'out-2')?.isStale).toBe(true);
    expect(model.operational.outletsStale).toBe(1);
  });

  it('never marks an outlet with an open shift as stale', async () => {
    const model = await buildHubOverview({
      ...baseInput,
      outletsSource: outletSource([outletDoc()]),
      activitySource: activitySource([{ tenantId: 't-1', outletId: 'out-1', openShifts: 1, lastShiftAt: hoursAgo(200) }]),
    });

    expect(model.operational.outlets[0]).toMatchObject({ hasOpenShift: true, isStale: false });
    expect(model.operational.outletsWithOpenShift).toBe(1);
    expect(model.operational.outletsStale).toBe(0);
  });

  it('keeps shift activity for an outlet with no document visible', async () => {
    const model = await buildHubOverview({
      ...baseInput,
      outletsSource: outletSource([]),
      activitySource: activitySource([{ tenantId: 't-1', outletId: 'out-hilang', openShifts: 1, lastShiftAt: hoursAgo(1) }]),
    });

    expect(model.operational.outlets).toEqual([
      expect.objectContaining({ outletId: 'out-hilang', outletName: null, hasOpenShift: true, isActive: false }),
    ]);
  });

  it('sorts outlets with an open shift first, then by name', async () => {
    const model = await buildHubOverview({
      ...baseInput,
      outletsSource: outletSource([
        outletDoc({ id: 'out-a', name: 'Zeta' }),
        outletDoc({ id: 'out-b', name: 'Alpha' }),
        outletDoc({ id: 'out-c', name: 'Middle' }),
      ]),
      activitySource: activitySource([{ tenantId: 't-1', outletId: 'out-c', openShifts: 1, lastShiftAt: hoursAgo(1) }]),
    });

    expect(model.operational.outlets.map((o) => o.outletName)).toEqual(['Middle', 'Alpha', 'Zeta']);
  });

  it('shows a tenant with no sales as Rp 0 instead of dropping it, and sorts by revenue', async () => {
    const model = await buildHubOverview({
      ...baseInput,
      tenantIds: ['t-1', 't-2'],
      tenantNameById: { 't-1': 'Kopi Bali', 't-2': 'Roti Manis' },
      salesSource: salesSource([{ tenantId: 't-2', totalOrders: 4, totalRevenue: 400_000 }]),
    });

    expect(model.sales.byTenant).toEqual([
      { tenantId: 't-2', tenantName: 'Roti Manis', total: 400_000, transactions: 4 },
      { tenantId: 't-1', tenantName: 'Kopi Bali', total: 0, transactions: 0 },
    ]);
    expect(model.sales.total).toBe(400_000);
    expect(model.sales.currency).toBe('IDR');
  });

  it('degrades to zeroed sales when the reports service is not wired', async () => {
    const model = await buildHubOverview({ ...baseInput, salesSource: null });

    expect(model.sales).toEqual({ currency: 'IDR', total: 0, transactions: 0, byTenant: [{ tenantId: 't-1', tenantName: 'Kopi Bali', total: 0, transactions: 0 }] });
  });

  it('degrades to zeroed member count when the membership service is not wired', async () => {
    const model = await buildHubOverview({ ...baseInput, membersSource: null });

    expect(model.counts.members).toBe(0);
  });

  // Fase 21 — the N+1 Fase 19 left open. `listMembers` hydrates one user per row,
  // so a surface that only needs a head count must not call it.
  it('prefers countMembers over listMembers when the source can count', async () => {
    const listMembers = vi.fn(async () => [{ id: 'u-1' }, { id: 'u-2' }]);
    const countMembers = vi.fn(async () => 7);
    const model = await buildHubOverview({
      ...baseInput,
      membersSource: { listMembers, countMembers },
    });

    expect(model.counts.members).toBe(7);
    expect(countMembers).toHaveBeenCalledWith(baseInput.hubId);
    expect(listMembers).not.toHaveBeenCalled();
  });

  it('falls back to counting the decorated list when countMembers is absent', async () => {
    const listMembers = vi.fn(async () => [{ id: 'u-1' }]);
    const model = await buildHubOverview({ ...baseInput, membersSource: { listMembers } });

    expect(model.counts.members).toBe(1);
    expect(listMembers).toHaveBeenCalledWith(baseInput.hubId);
  });

  it('passes the requested range and tenant list to every source', async () => {
    const outletsSource = outletSource([]);
    const activitySourceMock = activitySource([]);
    const salesSourceMock = salesSource([]);

    await buildHubOverview({ ...baseInput, outletsSource, activitySource: activitySourceMock, salesSource: salesSourceMock });

    expect(outletsSource.listAllForPlatform).toHaveBeenCalledWith(['t-1']);
    expect(activitySourceMock.getPlatformOutletActivity).toHaveBeenCalledWith(['t-1']);
    expect(salesSourceMock.getPlatformSalesByTenant).toHaveBeenCalledWith(['t-1'], {
      dateFrom: baseInput.dateFrom,
      dateTo: baseInput.dateTo,
    });
  });

  it('returns empty sections for a hub with no tenants', async () => {
    const model = await buildHubOverview({
      ...baseInput,
      tenantIds: [],
      tenantNameById: {},
      outletsSource: outletSource([]),
      activitySource: activitySource([]),
      salesSource: salesSource([]),
    });

    expect(model.counts).toEqual({ tenants: 0, outlets: 0, activeOutlets: 0, members: 2 });
    expect(model.operational).toMatchObject({ outletsWithOpenShift: 0, outletsStale: 0, outletsWithoutShift: 0, outlets: [] });
    expect(model.sales).toEqual({ currency: 'IDR', total: 0, transactions: 0, byTenant: [] });
  });
});