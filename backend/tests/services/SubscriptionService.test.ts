import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionService } from '../../src/core/billing/application/services/SubscriptionService';
import { Subscription } from '../../src/core/billing/domain/Subscription';
import { Tenant } from '../../src/core/tenant/domain/Tenant';

function makeSubscriptionRepo(store: Map<string, any>) {
  return {
    findByTenantId: vi.fn(async (tenantId: string) => {
      const data = store.get(tenantId);
      return data ? Subscription.hydrate({ ...data }) : null;
    }),
    save: vi.fn(async (sub: Subscription) => {
      store.set(sub.serialize().tenantId, sub.serialize());
    }),
  };
}

function makeBaseSub(partial: Partial<Record<string, unknown>> = {}) {
  const sub = Subscription.create({
    tenantId: 't1',
    planId: 'plan-1',
    status: 'active',
    billingCycle: 'monthly',
    currentPeriodStart: new Date('2026-09-01T00:00:00Z'),
    currentPeriodEnd: new Date('2026-10-01T00:00:00Z'),
  });
  const data = sub.serialize();
  return { ...data, ...partial };
}

function makeHistoryRepo() {
  const store: any[] = [];
  return {
    save: vi.fn(async (entry: any) => {
      store.push(entry.serialize());
    }),
    findByTenantId: vi.fn(async (_tenantId: string, _limit: number) => store),
  };
}

function makeTenantRepo(store: Map<string, any>) {
  return {
    findById: vi.fn(async (id: string) =>
      store.get(id) ? { serialize: () => store.get(id), assignPlan: vi.fn(), deactivate: vi.fn(), extendSubscription: vi.fn(), save: undefined } : null,
    ),
    save: vi.fn(async (t: any) => {
      store.set(t.serialize().id, t.serialize());
    }),
  };
}

function makePlanRepo() {
  return {
    findById: vi.fn(async (id: string) =>
      id === 'plan-1'
        ? { serialize: () => ({ id: 'plan-1', name: 'Pro', billingCycle: 'monthly', modules: ['products'] }) }
        : null,
    ),
  };
}

describe('SubscriptionService ledger', () => {
  let subStore: Map<string, any>;
  let historyRepo: any;
  let tenantStore: Map<string, any>;
  let service: SubscriptionService;

  beforeEach(() => {
    subStore = new Map();
    historyRepo = makeHistoryRepo();
    tenantStore = new Map();
    tenantStore.set('t1', {
      id: 't1',
      name: 'Kopi Bali',
      planId: 'trial',
      planName: 'Trial',
      subscriptionExpiresAt: new Date('2026-10-01T00:00:00Z'),
      tenantStatus: 'active',
      config: { timezone: 'Asia/Jakarta' },
      modules: [],
    });
    service = new SubscriptionService(
      makeSubscriptionRepo(subStore) as any,
      makePlanRepo() as any,
      makeTenantRepo(tenantStore) as any,
      historyRepo,
    );
  });

  it('records an assigned entry on first plan assignment', async () => {
    await service.assignPlan('t1', 'plan-1', 'monthly', { actorEmail: 'admin@kuire.id' });

    expect(historyRepo.save).toHaveBeenCalledTimes(1);
    const saved = historyRepo.save.mock.calls[0][0].serialize();
    expect(saved.action).toBe('assigned');
    expect(saved.planName).toBe('Pro');
    expect(saved.actorEmail).toBe('admin@kuire.id');
    expect(saved.tenantId).toBe('t1');
  });

  it('records a changed entry when the plan already exists', async () => {
    subStore.set('t1', makeBaseSub({ planId: 'trial', status: 'trialing' }));

    await service.assignPlan('t1', 'plan-1', 'monthly');

    expect(historyRepo.save).toHaveBeenCalledTimes(1);
    const saved = historyRepo.save.mock.calls[0][0].serialize();
    expect(saved.action).toBe('changed');
    expect(saved.statusBefore).toBe('trialing');
  });

  it('records an extended entry and moves the period end forward', async () => {
    const t1 = tenantStore.get('t1');
    const before = t1.subscriptionExpiresAt;
    subStore.set('t1', makeBaseSub());

    await service.extendSubscription('t1', 30, { actorEmail: 'admin@kuire.id' });

    const saved = await historyRepo.findByTenantId('t1', 100);
    expect(saved).toHaveLength(1);
    expect(saved[0].action).toBe('extended');
    expect(saved[0].periodEndBefore?.toISOString?.()).toBe('2026-10-01T00:00:00.000Z');
    expect(new Date(saved[0].periodEndAfter).getTime()).toBeGreaterThan(new Date(before).getTime());
  });

  it('records a cancelled entry and keeps the old period as before', async () => {
    subStore.set('t1', makeBaseSub());

    await service.cancelSubscription('t1', 'Dilunasi penuh via manual.', { actorEmail: 'admin@kuire.id' });

    const saved = await historyRepo.findByTenantId('t1', 100);
    expect(saved).toHaveLength(1);
    expect(saved[0].action).toBe('cancelled');
    expect(saved[0].reason).toBe('Dilunasi penuh via manual.');
    expect(saved[0].statusAfter).toBe('cancelled');
  });

  it('returns early-empty history when repository is not wired', async () => {
    const svc = new SubscriptionService(
      makeSubscriptionRepo(subStore) as any,
      makePlanRepo() as any,
      makeTenantRepo(tenantStore) as any,
      undefined,
    );
    expect(await svc.getTenantSubscriptionHistory('t1')).toEqual([]);
  });
});