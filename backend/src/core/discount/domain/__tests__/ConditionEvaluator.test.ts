import { describe, it, expect } from 'vitest';
import { ConditionEvaluator } from '../ConditionEvaluator';
import { IDiscountCondition } from '../strategies/conditions/ConditionStrategy';

describe('ConditionEvaluator', () => {
  const evaluator = new ConditionEvaluator();

  it('returns true for empty conditions', () => {
    expect(evaluator.evaluate([], { subtotal: 0, items: [] })).toBe(true);
  });

  it('evaluates min_purchase condition', () => {
    const conditions: IDiscountCondition[] = [
      { type: 'min_purchase', config: { minAmount: 100000 } },
    ];
    expect(evaluator.evaluate(conditions, { subtotal: 150000, items: [] })).toBe(true);
    expect(evaluator.evaluate(conditions, { subtotal: 50000, items: [] })).toBe(false);
  });

  it('evaluates min_items condition', () => {
    const conditions: IDiscountCondition[] = [
      { type: 'min_items', config: { minItems: 3 } },
    ];
    expect(evaluator.evaluate(conditions, { subtotal: 0, items: [
      { productId: 'p1', categoryId: 'c1', quantity: 2, unitPrice: 1000 },
      { productId: 'p2', categoryId: 'c1', quantity: 1, unitPrice: 2000 },
    ] })).toBe(true);
    expect(evaluator.evaluate(conditions, { subtotal: 0, items: [
      { productId: 'p1', categoryId: 'c1', quantity: 1, unitPrice: 1000 },
    ] })).toBe(false);
  });

  it('evaluates category_match condition', () => {
    const conditions: IDiscountCondition[] = [
      { type: 'category_match', config: { categoryIds: ['cat_drink'] } },
    ];
    expect(evaluator.evaluate(conditions, { subtotal: 0, items: [
      { productId: 'p1', categoryId: 'cat_food', quantity: 1, unitPrice: 1000 },
      { productId: 'p2', categoryId: 'cat_drink', quantity: 1, unitPrice: 2000 },
    ] })).toBe(true);
    expect(evaluator.evaluate(conditions, { subtotal: 0, items: [
      { productId: 'p1', categoryId: 'cat_food', quantity: 1, unitPrice: 1000 },
    ] })).toBe(false);
  });

  it('evaluates product_match condition', () => {
    const conditions: IDiscountCondition[] = [
      { type: 'product_match', config: { productIds: ['prod_kopi'] } },
    ];
    expect(evaluator.evaluate(conditions, { subtotal: 0, items: [
      { productId: 'prod_kopi', categoryId: 'c1', quantity: 1, unitPrice: 5000 },
    ] })).toBe(true);
    expect(evaluator.evaluate(conditions, { subtotal: 0, items: [
      { productId: 'prod_teh', categoryId: 'c1', quantity: 1, unitPrice: 3000 },
    ] })).toBe(false);
  });

  it('evaluates day_of_week condition', () => {
    const monday = new Date('2026-06-29'); // Monday
    const tuesday = new Date('2026-06-30'); // Tuesday
    const conditions: IDiscountCondition[] = [
      { type: 'day_of_week', config: { days: [1] } }, // Monday
    ];
    expect(evaluator.evaluate(conditions, { subtotal: 0, items: [], currentDate: monday })).toBe(true);
    expect(evaluator.evaluate(conditions, { subtotal: 0, items: [], currentDate: tuesday })).toBe(false);
  });

  it('evaluates date_range condition', () => {
    const conditions: IDiscountCondition[] = [
      { type: 'date_range', config: { startDate: '2026-01-01', endDate: '2026-12-31' } },
    ];
    expect(evaluator.evaluate(conditions, { subtotal: 0, items: [], currentDate: new Date('2026-06-15') })).toBe(true);
    expect(evaluator.evaluate(conditions, { subtotal: 0, items: [], currentDate: new Date('2025-12-31') })).toBe(false);
  });

  it('evaluates quantity_threshold condition', () => {
    const conditions: IDiscountCondition[] = [
      { type: 'quantity_threshold', config: { productId: 'prod_kopi', minQuantity: 3 } },
    ];
    expect(evaluator.evaluate(conditions, { subtotal: 0, items: [
      { productId: 'prod_kopi', categoryId: 'c1', quantity: 5, unitPrice: 10000 },
    ] })).toBe(true);
    expect(evaluator.evaluate(conditions, { subtotal: 0, items: [
      { productId: 'prod_kopi', categoryId: 'c1', quantity: 1, unitPrice: 10000 },
    ] })).toBe(false);
  });

  it('evaluates AND logic (all conditions must pass)', () => {
    const conditions: IDiscountCondition[] = [
      { type: 'min_purchase', config: { minAmount: 50000 } },
      { type: 'day_of_week', config: { days: [1] } },
    ];
    const monday = new Date('2026-06-29');
    const tuesday = new Date('2026-06-30');
    expect(evaluator.evaluate(conditions, { subtotal: 100000, items: [], currentDate: monday })).toBe(true);
    expect(evaluator.evaluate(conditions, { subtotal: 100000, items: [], currentDate: tuesday })).toBe(false);
    expect(evaluator.evaluate(conditions, { subtotal: 10000, items: [], currentDate: monday })).toBe(false);
  });
});
