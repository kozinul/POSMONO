import { describe, it, expect, vi } from 'vitest';
import { EntitlementService } from '../../src/core/billing/application/services/EntitlementService';

const plan = {
  id: 'plan-starter',
  name: 'Starter',
  modules: ['products', 'orders'],
  limits: { maxUsers: 3 },
  addOns: [
    { id: 'addon-kds', name: 'KDS', description: 'Kitchen display', price: 99000, type: 'module', value: 'kds' },
    { id: 'addon-seat', name: 'Extra seat', description: '', price: 20000, type: 'limit', value: 1 },
  ],
};

function makeService(options: { subscription?: Record<string, unknown> | null }) {
  const subscription = options.subscription === undefined
    ? { planId: 'plan-starter', status: 'active', enabledAddOns: ['addon-kds'] }
    : options.subscription;
  const subEntity = subscription
    ? {
        serialize: () => subscription,
        isActive: () => ['active', 'trial'].includes(String(subscription.status)),
      }
    : null;
  const service = new EntitlementService(
    { findByTenantId: vi.fn(async () => subEntity) } as never,
    {
      findById: vi.fn(async () => ({ serialize: () => plan })),
      findDefault: vi.fn(async () => ({ serialize: () => plan })),
    } as never,
    { findById: vi.fn(async () => null) } as never,
  );
  return service;
}

describe('EntitlementService add-ons', () => {
  it('adds enabled module add-ons on top of the plan modules', async () => {
    const entitlement = await makeService({}).getTenantEntitlement('tenant-1');

    expect(entitlement.modules).toEqual(['products', 'orders', 'kds']);
    expect(entitlement.enabledAddOns).toEqual(['addon-kds']);
    expect(entitlement.addOns).toHaveLength(2);
  });

  it('does not grant add-on modules when the subscription is cancelled', async () => {
    const entitlement = await makeService({
      subscription: { planId: 'plan-starter', status: 'cancelled', enabledAddOns: ['addon-kds'] },
    }).getTenantEntitlement('tenant-1');

    expect(entitlement.modules).toEqual(['products', 'orders']);
    expect(entitlement.enabledAddOns).toEqual([]);
  });

  it('ignores limit add-ons and unknown add-on ids', async () => {
    const entitlement = await makeService({
      subscription: { planId: 'plan-starter', status: 'trial', enabledAddOns: ['addon-seat', 'nope'] },
    }).getTenantEntitlement('tenant-1');

    expect(entitlement.modules).toEqual(['products', 'orders']);
    expect(entitlement.enabledAddOns).toEqual(['addon-seat', 'nope']);
  });

  it('hasModule follows the effective module list', async () => {
    const service = makeService({});

    expect(await service.hasModule('tenant-1', 'kds')).toBe(true);
  });

  it('hasModule is false when the subscription expired', async () => {
    const service = makeService({
      subscription: { planId: 'plan-starter', status: 'expired', enabledAddOns: ['addon-kds'] },
    });

    expect(await service.hasModule('tenant-1', 'kds')).toBe(false);
  });
});
