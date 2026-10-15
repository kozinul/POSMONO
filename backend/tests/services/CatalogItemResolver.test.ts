import { describe, it, expect, vi } from 'vitest';
import { CatalogItemResolver } from '../../src/core/catalog/application/services/CatalogItemResolver';
import { ValidationError } from '../../src/@shared/infrastructure/error/AppError';

const TENANT = 'tenant-1';

function productSource(products: Record<string, Record<string, unknown>>) {
  return {
    findById: vi.fn(async (id: string) => {
      const product = products[id];
      return product ? { serialize: () => product } : null;
    }),
  };
}

function modifierSource(groups: Array<Record<string, unknown>> = []) {
  return {
    findByIds: vi.fn(async (_tenantId: string, ids: string[]) => groups.filter((g) => ids.includes(g.id as string))),
    findByProduct: vi.fn(async () => []),
    findByFamily: vi.fn(async () => []),
  };
}

function buildProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    tenantId: TENANT,
    name: 'Nasi Goreng',
    categoryId: 'cat-1',
    basePrice: 25000,
    modifierGroupIds: [],
    isActive: true,
    ...overrides,
  };
}

function buildGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: 'grp-1',
    tenantId: TENANT,
    name: 'Custom',
    displayType: 'checkbox',
    minSelections: 0,
    maxSelections: 5,
    required: false,
    options: [{ id: 'opt-large', name: 'Besar', priceAdjustment: 3000, isActive: true }],
    ...overrides,
  };
}

describe('CatalogItemResolver', () => {
  it('ALLOW: overrides a tampered client unitPrice with the catalog base price', async () => {
    const resolver = new CatalogItemResolver(
      productSource({ p1: buildProduct() }) as never,
      modifierSource() as never,
    );

    const [item] = await resolver.resolve(TENANT, [
      { productId: 'p1', quantity: 2, unitPrice: 1 },
    ]);

    expect(item.unitPrice).toBe(25000);
    expect(item.totalPrice).toBe(50000);
  });

  it('ALLOW: prices modifiers from the server, ignoring client-sent adjustments', async () => {
    const resolver = new CatalogItemResolver(
      productSource({ p1: buildProduct({ basePrice: 16000, modifierGroupIds: ['grp-1'] }) }) as never,
      modifierSource([buildGroup()]) as never,
    );

    const [item] = await resolver.resolve(TENANT, [
      {
        productId: 'p1',
        quantity: 2,
        unitPrice: 1,
        modifiers: [
          { groupId: 'grp-1', groupName: 'x', optionId: 'opt-large', optionName: 'x', priceAdjustment: 9_999_999 },
        ],
      },
    ]);

    expect(item.unitPrice).toBe(19000);
    expect(item.totalPrice).toBe(38000);
    expect(item.modifiers).toEqual([
      { groupId: 'grp-1', groupName: 'Custom', optionId: 'opt-large', optionName: 'Besar', priceAdjustment: 3000 },
    ]);
  });

  it('DENY: rejects an unknown product', async () => {
    const resolver = new CatalogItemResolver(productSource({}) as never, modifierSource() as never);

    await expect(
      resolver.resolve(TENANT, [{ productId: 'ghost', quantity: 1, unitPrice: 100 }]),
    ).rejects.toThrow(ValidationError);
  });

  it('DENY: rejects a product owned by another tenant', async () => {
    const resolver = new CatalogItemResolver(
      productSource({ p1: buildProduct({ tenantId: 'tenant-other' }) }) as never,
      modifierSource() as never,
    );

    await expect(
      resolver.resolve(TENANT, [{ productId: 'p1', quantity: 1, unitPrice: 100 }]),
    ).rejects.toThrow(ValidationError);
  });

  it('DENY: rejects an inactive product', async () => {
    const resolver = new CatalogItemResolver(
      productSource({ p1: buildProduct({ isActive: false }) }) as never,
      modifierSource() as never,
    );

    await expect(
      resolver.resolve(TENANT, [{ productId: 'p1', quantity: 1, unitPrice: 100 }]),
    ).rejects.toThrow(/tidak aktif/);
  });

  it('DENY: rejects a missing required modifier group', async () => {
    const resolver = new CatalogItemResolver(
      productSource({ p1: buildProduct({ modifierGroupIds: ['grp-req'] }) }) as never,
      modifierSource([buildGroup({ id: 'grp-req', name: 'Wajib', required: true, minSelections: 1 })]) as never,
    );

    await expect(
      resolver.resolve(TENANT, [{ productId: 'p1', quantity: 1, unitPrice: 100 }]),
    ).rejects.toThrow(/wajib/i);
  });

  it('ALLOW: resolves the same product at most once per request', async () => {
    const products = productSource({ p1: buildProduct() });
    const resolver = new CatalogItemResolver(products as never, modifierSource() as never);

    await resolver.resolve(TENANT, [
      { productId: 'p1', quantity: 1, unitPrice: 1 },
      { productId: 'p1', quantity: 3, unitPrice: 1 },
    ]);

    expect(products.findById).toHaveBeenCalledTimes(1);
  });
});
