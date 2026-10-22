import { describe, it, expect, vi } from 'vitest';
import { PricingService } from '../PricingService';
import type { DiscountServiceAdapter } from '../../../../discount/application/services/DiscountServiceAdapter';
import type { ITaxConfigurationRepository } from '../../../../tax/infrastructure/persistence/ITaxConfigurationRepository';

const buildService = (discountResult: Record<string, unknown>) => {
  const discountService = {
    apply: vi.fn().mockResolvedValue({
      totalDiscount: 0,
      freeItems: [],
      freeItemValue: 0,
      generatedLineItems: [],
      itemDiscounts: [],
      appliedRules: [],
      ...discountResult,
    }),
  } as unknown as DiscountServiceAdapter;

  const taxConfigRepo = {
    findByTenantId: vi.fn().mockResolvedValue(null),
  } as unknown as ITaxConfigurationRepository;

  return new PricingService(discountService, taxConfigRepo);
};

describe('PricingService — free item lines', () => {
  it('splits the free unit out of the cart line', async () => {
    const sut = buildService({
      freeItems: [{ productId: 'prod-1', quantity: 1 }],
      freeItemValue: 15000,
    });

    const result = await sut.calculate({
      tenantId: 'tenant-1',
      items: [{ productId: 'prod-1', productName: 'Kopi', categoryId: 'cat-1', quantity: 2, unitPrice: 15000 }],
    });

    expect(result.promotionDiscount).toBe(15000);
    expect(result.netSubtotal).toBe(15000);
    expect(result.lineItems).toHaveLength(2);
    expect(result.lineItems[0]).toMatchObject({ quantity: 1, unitPrice: 0, originalUnitPrice: 15000, discount: 15000, lineTotal: 0, isFreeItem: true });
    expect(result.lineItems[1]).toMatchObject({ quantity: 1, unitPrice: 15000, lineTotal: 15000, isFreeItem: false });
  });

  it('takes the free unit from the cheapest line when the product sits in the cart twice', async () => {
    const sut = buildService({
      freeItems: [{ productId: 'prod-1', quantity: 1 }],
      freeItemValue: 15000,
    });

    const result = await sut.calculate({
      tenantId: 'tenant-1',
      items: [
        { productId: 'prod-1', productName: 'Kopi', categoryId: 'cat-1', quantity: 1, unitPrice: 25000 },
        { productId: 'prod-1', productName: 'Kopi', categoryId: 'cat-1', quantity: 1, unitPrice: 15000 },
      ],
    });

    const freeLine = result.lineItems.find((l) => l.isFreeItem);
    expect(freeLine).toMatchObject({ originalUnitPrice: 15000, discount: 15000 });
    expect(result.lineItems.filter((l) => !l.isFreeItem).map((l) => l.unitPrice)).toEqual([25000]);
    expect(result.netSubtotal).toBe(25000);
  });

  it('hands over a unit that is not in the cart as a gift worth nothing', async () => {
    const sut = buildService({
      freeItems: [{ productId: 'prod-2', quantity: 1 }],
      freeItemValue: 0,
    });

    const result = await sut.calculate({
      tenantId: 'tenant-1',
      items: [{ productId: 'prod-1', productName: 'Kopi', categoryId: 'cat-1', quantity: 1, unitPrice: 15000 }],
    });

    const gift = result.lineItems.find((l) => l.isFreeItem);
    expect(gift).toMatchObject({ productId: 'prod-2', quantity: 1, originalUnitPrice: 0, discount: 0, lineTotal: 0 });
    expect(result.netSubtotal).toBe(15000);
  });
});
