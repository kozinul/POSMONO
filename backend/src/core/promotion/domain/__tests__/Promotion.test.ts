import { describe, it, expect } from 'vitest';
import { Promotion } from '../Promotion';
import { validPromotionInput, validPromotionWithUsageLimit } from '../../../../../tests/fixtures/promotion.fixtures';

describe('Promotion', () => {
  describe('create', () => {
    it('creates a promotion with given fields', () => {
      const promo = Promotion.create(validPromotionInput);
      const data = promo.serialize();

      expect(data.name).toBe('Diskon 10%');
      expect(data.code).toBe('DISC10');
      expect(data.isActive).toBe(true);
      expect(data.usedCount).toBe(0);
      expect(data.priority).toBe(1);
      expect(data.exclusive).toBe(false);
      expect(data.stackable).toBe(false);
      expect(data.ruleLogic).toBe('AND');
      expect(data.createdAt).toBeInstanceOf(Date);
    });

    it('generates a unique id', () => {
      const p1 = Promotion.create(validPromotionInput);
      const p2 = Promotion.create(validPromotionInput);
      expect(p1.serialize().id).not.toBe(p2.serialize().id);
    });

    it('emits promotion.created domain event', () => {
      const promo = Promotion.create(validPromotionInput);
      const events = promo.domainEvents;

      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('promotion.created');
      expect(events[0].aggregateType).toBe('Promotion');
      expect(events[0].tenantId).toBe('tenant-test-1');
      expect(events[0].payload.name).toBe('Diskon 10%');
      expect(events[0].payload.code).toBe('DISC10');
    });
  });

  describe('isApplicable', () => {
    const baseContext = {
      subtotal: 100000,
      itemCount: 5,
      productIds: ['p1', 'p2'],
      categoryIds: ['cat-1'],
      customerTags: ['vip'],
      dayOfWeek: 1,
      currentTime: new Date('2026-07-15T10:00:00'),
    };

    it('returns true when all conditions are met', () => {
      const promo = Promotion.create(validPromotionInput);
      expect(promo.isApplicable(baseContext)).toBe(true);
    });

    it('returns false when inactive', () => {
      const promo = Promotion.create(validPromotionInput);
      promo.deactivate();
      expect(promo.isApplicable(baseContext)).toBe(false);
    });

    it('returns false when usage limit reached', () => {
      const promo = Promotion.create(validPromotionWithUsageLimit);
      for (let i = 0; i < 5; i++) promo.incrementUsage();
      expect(promo.isApplicable(baseContext)).toBe(false);
    });

    it('returns false when validFrom is in the future', () => {
      const promo = Promotion.create({
        ...validPromotionInput,
        validFrom: new Date('2027-01-01'),
      });
      expect(promo.isApplicable(baseContext)).toBe(false);
    });

    it('returns false when validUntil is in the past', () => {
      const promo = Promotion.create({
        ...validPromotionInput,
        validUntil: new Date('2020-01-01'),
      });
      expect(promo.isApplicable(baseContext)).toBe(false);
    });

    it('returns false when min_purchase rule fails', () => {
      const promo = Promotion.create(validPromotionInput);
      expect(promo.isApplicable({ ...baseContext, subtotal: 10000 })).toBe(false);
    });

    it('returns true when min_purchase rule passes', () => {
      const promo = Promotion.create(validPromotionInput);
      expect(promo.isApplicable({ ...baseContext, subtotal: 50000 })).toBe(true);
    });

    it('evaluates min_items rule', () => {
      const promo = Promotion.create({
        ...validPromotionInput,
        rules: [{ type: 'min_items', params: { count: 3 } }],
      });
      expect(promo.isApplicable({ ...baseContext, itemCount: 2 })).toBe(false);
      expect(promo.isApplicable({ ...baseContext, itemCount: 3 })).toBe(true);
    });

    it('evaluates product_match rule', () => {
      const promo = Promotion.create({
        ...validPromotionInput,
        rules: [{ type: 'product_match', params: { productId: 'p1' } }],
      });
      expect(promo.isApplicable(baseContext)).toBe(true);
      expect(promo.isApplicable({ ...baseContext, productIds: ['p3'] })).toBe(false);
    });

    it('evaluates category_match rule', () => {
      const promo = Promotion.create({
        ...validPromotionInput,
        rules: [{ type: 'category_match', params: { categoryId: 'cat-1' } }],
      });
      expect(promo.isApplicable(baseContext)).toBe(true);
      expect(promo.isApplicable({ ...baseContext, categoryIds: ['cat-99'] })).toBe(false);
    });

    it('evaluates day_of_week rule', () => {
      const promo = Promotion.create({
        ...validPromotionInput,
        rules: [{ type: 'day_of_week', params: { days: [1, 3, 5] } }],
      });
      expect(promo.isApplicable({ ...baseContext, dayOfWeek: 1 })).toBe(true);
      expect(promo.isApplicable({ ...baseContext, dayOfWeek: 2 })).toBe(false);
    });

    it('evaluates date_range rule', () => {
      const promo = Promotion.create({
        ...validPromotionInput,
        rules: [{ type: 'date_range', params: { from: '2026-07-01', to: '2026-07-31' } }],
      });
      expect(promo.isApplicable({ ...baseContext, currentTime: new Date('2026-07-15') })).toBe(true);
      expect(promo.isApplicable({ ...baseContext, currentTime: new Date('2026-08-01') })).toBe(false);
    });

    it('evaluates time_range rule', () => {
      const promo = Promotion.create({
        ...validPromotionInput,
        rules: [{ type: 'time_range', params: { fromHour: 9, fromMinute: 0, toHour: 17, toMinute: 0 } }],
      });
      expect(promo.isApplicable({ ...baseContext, currentTime: new Date('2026-07-15T12:00:00') })).toBe(true);
      expect(promo.isApplicable({ ...baseContext, currentTime: new Date('2026-07-15T18:00:00') })).toBe(false);
    });

    it('evaluates customer_tag rule', () => {
      const promo = Promotion.create({
        ...validPromotionInput,
        rules: [{ type: 'customer_tag', params: { tags: ['vip'] } }],
      });
      expect(promo.isApplicable(baseContext)).toBe(true);
      expect(promo.isApplicable({ ...baseContext, customerTags: ['regular'] })).toBe(false);
    });

    it('evaluates buy_x_get_y rule', () => {
      const promo = Promotion.create({
        ...validPromotionInput,
        rules: [{ type: 'buy_x_get_y', params: { buyQuantity: 3 } }],
      });
      expect(promo.isApplicable({ ...baseContext, itemCount: 2 })).toBe(false);
      expect(promo.isApplicable({ ...baseContext, itemCount: 3 })).toBe(true);
    });

    describe('AND/OR logic', () => {
      it('returns true only when ALL rules pass with AND', () => {
        const promo = Promotion.create({
          ...validPromotionInput,
          ruleLogic: 'AND',
          rules: [
            { type: 'min_purchase', params: { amount: 50000 } },
            { type: 'min_items', params: { count: 3 } },
          ],
        });
        expect(promo.isApplicable({ ...baseContext, subtotal: 100000, itemCount: 5 })).toBe(true);
        expect(promo.isApplicable({ ...baseContext, subtotal: 100000, itemCount: 1 })).toBe(false);
      });

      it('returns true when ANY rule passes with OR', () => {
        const promo = Promotion.create({
          ...validPromotionInput,
          ruleLogic: 'OR',
          rules: [
            { type: 'min_purchase', params: { amount: 500000 } },
            { type: 'min_items', params: { count: 3 } },
          ],
        });
        expect(promo.isApplicable({ ...baseContext, subtotal: 100000, itemCount: 5 })).toBe(true);
        expect(promo.isApplicable({ ...baseContext, subtotal: 100000, itemCount: 1 })).toBe(false);
      });
    });
  });

  describe('calculateDiscount', () => {
    const items = [
      { productId: 'p1', categoryId: 'cat-1', unitPrice: 25000, quantity: 2 },
      { productId: 'p2', categoryId: 'cat-1', unitPrice: 15000, quantity: 1 },
    ];

    it('calculates percentage discount', () => {
      const promo = Promotion.create({
        ...validPromotionInput,
        effects: [{ type: 'percentage', value: 10, target: 'order' }],
      });
      const result = promo.calculateDiscount({ subtotal: 65000, itemCount: 3, items });

      expect(result.totalDiscount).toBe(6500); // 10% of 65000
      expect(result.breakdown).toHaveLength(1);
      expect(result.breakdown[0].type).toBe('percentage');
    });

    it('caps percentage discount at maxDiscount', () => {
      const promo = Promotion.create({
        ...validPromotionInput,
        effects: [{ type: 'percentage', value: 50, target: 'order', maxDiscount: 10000 }],
      });
      const result = promo.calculateDiscount({ subtotal: 65000, itemCount: 3, items });

      expect(result.totalDiscount).toBe(10000);
    });

    it('calculates nominal discount', () => {
      const promo = Promotion.create({
        ...validPromotionInput,
        effects: [{ type: 'nominal', value: 5000, target: 'order' }],
      });
      const result = promo.calculateDiscount({ subtotal: 65000, itemCount: 3, items });

      expect(result.totalDiscount).toBe(5000);
    });

    it('caps nominal discount at subtotal', () => {
      const promo = Promotion.create({
        ...validPromotionInput,
        effects: [{ type: 'nominal', value: 100000, target: 'order' }],
      });
      const result = promo.calculateDiscount({ subtotal: 65000, itemCount: 3, items });

      expect(result.totalDiscount).toBe(65000);
    });

    it('calculates fixed_price discount', () => {
      const promo = Promotion.create({
        ...validPromotionInput,
        effects: [{ type: 'fixed_price', value: 50000, target: 'order' }],
      });
      const result = promo.calculateDiscount({ subtotal: 65000, itemCount: 3, items });

      expect(result.totalDiscount).toBe(15000); // 65000 - 50000
    });

    it('calculates free_item discount (cheapest)', () => {
      const promo = Promotion.create({
        ...validPromotionInput,
        effects: [{ type: 'free_item', value: 0, target: 'cheapest_item' }],
      });
      const result = promo.calculateDiscount({ subtotal: 65000, itemCount: 3, items });

      expect(result.totalDiscount).toBe(15000); // cheapest item price
    });

    it('calculates free_item discount (specific product)', () => {
      const promo = Promotion.create({
        ...validPromotionInput,
        effects: [{ type: 'free_item', value: 0, target: 'specific_product', targetProductId: 'p1' }],
      });
      const result = promo.calculateDiscount({ subtotal: 65000, itemCount: 3, items });

      expect(result.totalDiscount).toBe(25000); // p1 unitPrice
    });

    it('calculates bundle_price discount', () => {
      const promo = Promotion.create({
        ...validPromotionInput,
        effects: [{ type: 'bundle_price', value: 40000, target: 'order' }],
      });
      const result = promo.calculateDiscount({ subtotal: 65000, itemCount: 3, items });

      expect(result.totalDiscount).toBe(25000); // 65000 - 40000
    });

    it('returns 0 discount when no effects', () => {
      const promo = Promotion.create({
        ...validPromotionInput,
        effects: [],
      });
      const result = promo.calculateDiscount({ subtotal: 65000, itemCount: 3, items });

      expect(result.totalDiscount).toBe(0);
      expect(result.breakdown).toHaveLength(0);
    });
  });

  describe('incrementUsage', () => {
    it('increments usedCount', () => {
      const promo = Promotion.create(validPromotionInput);
      promo.incrementUsage();
      promo.incrementUsage();
      expect(promo.serialize().usedCount).toBe(2);
    });

    it('updates updatedAt', () => {
      const promo = Promotion.create(validPromotionInput);
      const before = promo.serialize().updatedAt;
      promo.incrementUsage();
      expect(promo.serialize().updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('activate/deactivate', () => {
    it('deactivates promotion', () => {
      const promo = Promotion.create(validPromotionInput);
      promo.deactivate();
      expect(promo.serialize().isActive).toBe(false);
    });

    it('activates promotion', () => {
      const promo = Promotion.create(validPromotionInput);
      promo.deactivate();
      promo.activate();
      expect(promo.serialize().isActive).toBe(true);
    });
  });

  describe('hydrate', () => {
    it('restores a promotion from persisted data', () => {
      const promo = Promotion.create(validPromotionInput);
      promo.incrementUsage();
      const data = promo.serialize();
      const restored = Promotion.hydrate(data);

      expect(restored.serialize()).toEqual(data);
    });
  });

  describe('serialize', () => {
    it('returns all promotion properties', () => {
      const promo = Promotion.create(validPromotionInput);
      const data = promo.serialize();

      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('tenantId');
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('code');
      expect(data).toHaveProperty('rules');
      expect(data).toHaveProperty('effects');
      expect(data).toHaveProperty('usageLimit');
      expect(data).toHaveProperty('usedCount');
      expect(data).toHaveProperty('isActive');
      expect(data).toHaveProperty('createdAt');
      expect(data).toHaveProperty('updatedAt');
    });
  });
});
