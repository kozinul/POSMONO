import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Shift } from '../../src/core/pos/domain/Shift';
import { Payment } from '../../src/core/payment/domain/Payment';
import { Outlet } from '../../src/core/outlet/domain/Outlet';
import { ShiftService } from '../../src/core/pos/application/services/ShiftService';
import { PaymentService } from '../../src/core/payment/application/services/PaymentService';
import { OutletService } from '../../src/core/outlet/application/services/OutletService';
import { TenantService } from '../../src/core/tenant/application/services/TenantService';
import { resolvePlatformScope } from '../../src/core/platform/application/helpers/resolvePlatformScope';

function tenantRef(id: string, name: string) {
  return { serialize: vi.fn(() => ({ id, name })) };
}

describe('resolvePlatformScope', () => {
  it('resolves a single tenant when tenantId given', async () => {
    const repo = { findById: vi.fn(async () => tenantRef('t-1', 'Alpha')), findByHubId: vi.fn(), findAll: vi.fn() };
    const scope = await resolvePlatformScope(repo, { tenantId: 't-1' });
    expect(scope.tenantIds).toEqual(['t-1']);
    expect(scope.tenantNameById).toEqual({ 't-1': 'Alpha' });
    expect(repo.findByHubId).not.toHaveBeenCalled();
  });

  it('resolves tenants of a hub when hubId given', async () => {
    const repo = { findById: vi.fn(), findByHubId: vi.fn(async () => [tenantRef('t-1', 'Alpha'), tenantRef('t-2', 'Beta')]), findAll: vi.fn() };
    const scope = await resolvePlatformScope(repo, { hubId: 'hub-1' });
    expect(scope.tenantIds.sort()).toEqual(['t-1', 't-2']);
    expect(scope.tenantNameById['t-2']).toBe('Beta');
  });

  it('resolves every tenant when no scope given', async () => {
    const repo = { findById: vi.fn(), findByHubId: vi.fn(), findAll: vi.fn(async () => [tenantRef('t-1', 'Alpha')]) };
    const scope = await resolvePlatformScope(repo, {});
    expect(scope.tenantIds).toEqual(['t-1']);
  });

  it('returns empty scope for unknown tenantId', async () => {
    const repo = { findById: vi.fn(async () => null), findByHubId: vi.fn(), findAll: vi.fn() };
    const scope = await resolvePlatformScope(repo, { tenantId: 'nope' });
    expect(scope.tenantIds).toEqual([]);
  });
});

describe('ShiftService.getPlatformShiftsSummary', () => {
  function makeShift(tenantId: string, outletId: string | null, sales: { total: number; cash: number; nonCash: number; tx: number }, close = false) {
    const shift = Shift.open({ tenantId, outletId, registerId: 'r1', cashierId: 'cashier-1', cashierName: 'Kasir', openingBalance: 0 });
    shift.updateSales({ totalSales: sales.total, cashSales: sales.cash, nonCashSales: sales.nonCash, totalTransactions: sales.tx, paymentBreakdown: [] });
    if (close) shift.close(sales.cash);
    return shift;
  }

  it('aggregates per tenant and globally', async () => {
    const shiftRepo = {
      findByTenantIds: vi.fn(async () => [
        makeShift('t-a', 'out-a', { total: 100000, cash: 80000, nonCash: 20000, tx: 3 }),
        makeShift('t-b', 'out-b', { total: 50000, cash: 50000, nonCash: 0, tx: 1 }, true),
      ]),
    };
    const service = new ShiftService(shiftRepo as any);

    const summary = await service.getPlatformShiftsSummary(['t-a', 't-b'], {
      dateFrom: new Date('2026-01-01T00:00:00.000Z'),
      dateTo: new Date('2026-12-31T23:59:59.999Z'),
    });

    expect(shiftRepo.findByTenantIds).toHaveBeenCalledWith(['t-a', 't-b'], expect.objectContaining({ from: expect.any(Date), to: expect.any(Date) }));
    expect(summary.totals).toEqual({ openShifts: 1, closedShifts: 1, totalSales: 150000, cashSales: 130000, nonCashSales: 20000, totalTransactions: 4 });

    const tenantA = summary.tenants.find((t: any) => t.tenantId === 't-a')!;
    expect(tenantA.openShifts).toBe(1);
    expect(tenantA.totalSales).toBe(100000);
    expect(tenantA.outlets).toHaveLength(1);
    expect(tenantA.outlets[0].outletId).toBe('out-a');
  });

  it('returns zeroed totals when no shifts match', async () => {
    const shiftRepo = { findByTenantIds: vi.fn(async () => []) };
    const service = new ShiftService(shiftRepo as any);
    const summary = await service.getPlatformShiftsSummary(['t-a']);
    expect(summary.totals).toEqual({ openShifts: 0, closedShifts: 0, totalSales: 0, cashSales: 0, nonCashSales: 0, totalTransactions: 0 });
    expect(summary.tenants).toEqual([]);
  });
});

describe('PaymentService.getPlatformPaymentsSummary', () => {
  function makePayment(tenantId: string, amount: number, method: 'cash' | 'qris', orderId: string) {
    const payment = Payment.create({ tenantId, orderId, amount, status: 'pending', method, referenceNumber: `REF-${orderId}`, metadata: {}, paidAt: null });
    payment.complete();
    return payment;
  }

  let service: PaymentService;

  beforeEach(() => {
    service = new PaymentService(
      {} as any,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
    );
  });

  it('aggregates payment totals + method breakdown', async () => {
    const paymentRepo = {
      findCompletedByTenantIds: vi.fn(async () => [
        makePayment('t-a', 80000, 'cash', 'o1'),
        makePayment('t-a', 20000, 'qris', 'o2'),
        makePayment('t-b', 30000, 'cash', 'o3'),
      ]),
    };
    (service as any).paymentRepository = paymentRepo;

    const summary = await service.getPlatformPaymentsSummary(['t-a', 't-b'], {
      dateFrom: new Date('2026-01-01T00:00:00.000Z'),
      dateTo: new Date('2026-12-31T23:59:59.999Z'),
    });

    expect(summary.totals.totalAmount).toBe(130000);
    expect(summary.totals.totalTransactions).toBe(3);
    expect(summary.totals.methods.find((m: any) => m.method === 'cash')).toEqual({ method: 'cash', total: 110000, count: 2 });
    expect(summary.totals.methods.find((m: any) => m.method === 'qris')).toEqual({ method: 'qris', total: 20000, count: 1 });

    const tenantA = summary.tenants.find((t: any) => t.tenantId === 't-a')!;
    expect(tenantA.totalAmount).toBe(100000);
    expect(tenantA.totalTransactions).toBe(2);
  });

  it('returns zeroed totals when no payments found', async () => {
    const paymentRepo = { findCompletedByTenantIds: vi.fn(async () => []) };
    (service as any).paymentRepository = paymentRepo;
    const summary = await service.getPlatformPaymentsSummary(['t-a']);
    expect(summary.totals.totalAmount).toBe(0);
    expect(summary.totals.totalTransactions).toBe(0);
    expect(summary.totals.methods).toEqual([]);
  });
});

describe('TenantService.list', () => {
  it('maps repo results + computes page/limit', async () => {
    const repo = {
      list: vi.fn(async () => ({
        items: [{ serialize: () => ({ id: 't-1', name: 'Alpha' }) }, { serialize: () => ({ id: 't-2', name: 'Beta' }) }],
        total: 2,
      })),
    };
    const service = new TenantService(repo as any);
    const result = await service.list({ hubId: 'hub-1', search: 'alpha', page: 2, limit: 10 });
    expect(repo.list).toHaveBeenCalledWith({ hubId: 'hub-1', search: 'alpha', limit: 10, skip: 10 });
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
  });

  it('defaults pagination when omitted', async () => {
    const repo = { list: vi.fn(async () => ({ items: [], total: 0 })) };
    const service = new TenantService(repo as any);
    await service.list({});
    expect(repo.list).toHaveBeenCalledWith({ hubId: null, search: undefined, limit: 50, skip: 0 });
  });
});

describe('OutletService.listAllForPlatform', () => {
  it('fans out across tenants and filters by isActive', async () => {
    const outletA1 = Outlet.create({ tenantId: 't-a', name: 'Zeta', address: '', phone: '', warehouseId: null, isActive: true });
    const outletA2 = Outlet.create({ tenantId: 't-a', name: 'Alpha', address: '', phone: '', warehouseId: null, isActive: false });
    const outletB1 = Outlet.create({ tenantId: 't-b', name: 'Beta', address: '', phone: '', warehouseId: null, isActive: true });

    const outletRepo = {
      findByTenant: vi.fn(async (tenantId: string) => (tenantId === 't-a' ? [outletA1, outletA2] : [outletB1])),
      findActiveByTenant: vi.fn(),
    };
    const service = new OutletService(outletRepo as any, {} as any);

    const active = await service.listAllForPlatform(['t-a', 't-b'], true);
    expect(active.map((o) => o.serialize().name)).toEqual(['Beta', 'Zeta']);

    const all = await service.listAllForPlatform(['t-a', 't-b']);
    expect(all).toHaveLength(3);
    expect(all[0].serialize().name).toBe('Alpha');
  });

  it('returns empty when no tenants given', async () => {
    const outletRepo = { findByTenant: vi.fn() };
    const service = new OutletService(outletRepo as any, {} as any);
    const result = await service.listAllForPlatform([]);
    expect(result).toEqual([]);
    expect(outletRepo.findByTenant).not.toHaveBeenCalled();
  });
});