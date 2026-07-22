import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromotionService } from '../../src/core/promotion/application/services/PromotionService';

const TENANT_ID = 'tenant-test-1';

function createMockRepo() {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    findByCode: vi.fn(),
    findByTenant: vi.fn(),
    findActive: vi.fn(),
    delete: vi.fn(),
  };
}

function createMockPromotion(overrides?: Record<string, any>) {
  const data = {
    id: 'promo-1',
    tenantId: TENANT_ID,
    name: 'Diskon 10%',
    code: 'DISC10',
    description: 'Diskon 10%',
    priority: 1,
    exclusive: false,
    stackable: false,
    ruleLogic: 'AND',
    rules: [{ type: 'min_purchase', params: { amount: 50000 } }],
    effects: [{ type: 'percentage', value: 10, target: 'order' }],
    usageLimit: null,
    usedCount: 0,
    minPurchase: 50000,
    isActive: true,
    validFrom: null,
    validUntil: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  return {
    serialize: vi.fn().mockReturnValue(data),
    isApplicable: vi.fn().mockReturnValue(true),
    calculateDiscount: vi.fn().mockReturnValue({ totalDiscount: 5000, breakdown: [] }),
    incrementUsage: vi.fn(),
    domainEvents: [],
  };
}

describe('PromotionService', () => {
  let repo: ReturnType<typeof createMockRepo>;
  let service: PromotionService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new PromotionService(repo);
  });

  describe('create', () => {
    it('creates a promotion and saves it', async () => {
      repo.findByCode.mockResolvedValue(null);
      const result = await service.create({
        tenantId: TENANT_ID,
        name: 'Diskon 10%',
        code: 'DISC10',
        rules: [{ type: 'min_purchase', params: { amount: 50000 } }],
        effects: [{ type: 'percentage', value: 10, target: 'order' }],
      });

      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('throws when code already exists', async () => {
      repo.findByCode.mockResolvedValue(createMockPromotion());
      await expect(
        service.create({
          tenantId: TENANT_ID,
          name: 'Test',
          code: 'DISC10',
          rules: [],
          effects: [{ type: 'percentage', value: 10, target: 'order' }],
        }),
      ).rejects.toThrow('Promotion with this code already exists');
    });
  });

  describe('update', () => {
    it('updates a promotion', async () => {
      const mock = createMockPromotion();
      repo.findById.mockResolvedValue(mock);
      const result = await service.update({
        id: 'promo-1',
        tenantId: TENANT_ID,
        name: 'Diskon 20%',
      });

      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('throws when promotion not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.update({ id: 'not-found', tenantId: TENANT_ID, name: 'Test' }),
      ).rejects.toThrow('Promotion not found');
    });

    it('throws when tenant does not match', async () => {
      const mock = createMockPromotion({ tenantId: 'other-tenant' });
      repo.findById.mockResolvedValue(mock);
      await expect(
        service.update({ id: 'promo-1', tenantId: TENANT_ID, name: 'Test' }),
      ).rejects.toThrow('Promotion not found');
    });
  });

  describe('getById', () => {
    it('returns promotion when found and tenant matches', async () => {
      const mock = createMockPromotion();
      repo.findById.mockResolvedValue(mock);
      const result = await service.getById(TENANT_ID, 'promo-1');
      expect(result).toBe(mock);
    });

    it('returns null when not found', async () => {
      repo.findById.mockResolvedValue(null);
      const result = await service.getById(TENANT_ID, 'not-found');
      expect(result).toBeNull();
    });

    it('returns null when tenant does not match', async () => {
      const mock = createMockPromotion({ tenantId: 'other-tenant' });
      repo.findById.mockResolvedValue(mock);
      const result = await service.getById(TENANT_ID, 'promo-1');
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('returns promotions from repository', async () => {
      repo.findByTenant.mockResolvedValue({ promotions: [], total: 0 });
      const result = await service.list(TENANT_ID, { page: 1, limit: 10 });
      expect(repo.findByTenant).toHaveBeenCalledWith(TENANT_ID, { page: 1, limit: 10 });
      expect(result.total).toBe(0);
    });
  });

  describe('validate', () => {
    it('returns valid when promotion exists and is applicable', async () => {
      const mock = createMockPromotion();
      repo.findByCode.mockResolvedValue(mock);
      const result = await service.validate({
        tenantId: TENANT_ID,
        code: 'DISC10',
        subtotal: 100000,
        itemCount: 3,
        productIds: ['p1'],
        categoryIds: ['cat-1'],
        customerTags: [],
      });

      expect(result.valid).toBe(true);
      expect(result.promotion).toBe(mock);
    });

    it('returns invalid when code not found', async () => {
      repo.findByCode.mockResolvedValue(null);
      const result = await service.validate({
        tenantId: TENANT_ID,
        code: 'NOPE',
        subtotal: 100000,
        itemCount: 3,
        productIds: [],
        categoryIds: [],
        customerTags: [],
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Promotion not found');
    });

    it('returns invalid when not applicable', async () => {
      const mock = createMockPromotion();
      mock.isApplicable.mockReturnValue(false);
      repo.findByCode.mockResolvedValue(mock);
      const result = await service.validate({
        tenantId: TENANT_ID,
        code: 'DISC10',
        subtotal: 100000,
        itemCount: 3,
        productIds: [],
        categoryIds: [],
        customerTags: [],
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Promotion conditions not met');
    });
  });

  describe('apply', () => {
    it('calculates discount and increments usage', async () => {
      const mock = createMockPromotion();
      repo.findById.mockResolvedValue(mock);
      const result = await service.apply({
        tenantId: TENANT_ID,
        promotionId: 'promo-1',
        subtotal: 100000,
        items: [{ productId: 'p1', categoryId: 'cat-1', unitPrice: 25000, quantity: 2 }],
      });

      expect(result.totalDiscount).toBe(5000);
      expect(mock.incrementUsage).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });

    it('throws when promotion not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.apply({
          tenantId: TENANT_ID,
          promotionId: 'not-found',
          subtotal: 100000,
          items: [],
        }),
      ).rejects.toThrow('Promotion not found');
    });
  });

  describe('delete', () => {
    it('deletes a promotion', async () => {
      const mock = createMockPromotion();
      repo.findById.mockResolvedValue(mock);
      await service.delete(TENANT_ID, 'promo-1');
      expect(repo.delete).toHaveBeenCalledWith('promo-1');
    });

    it('throws when not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.delete(TENANT_ID, 'not-found')).rejects.toThrow('Promotion not found');
    });
  });
});
