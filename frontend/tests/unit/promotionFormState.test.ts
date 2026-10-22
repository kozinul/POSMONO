import { describe, it, expect } from 'vitest';
import {
  promoToFormState,
  formStateToPayload,
  type FormState,
} from '../../src/core/promotions/utils/promotionFormState';
import type { Promotion } from '../../src/core/promotions/hooks/usePromotions';

function makePromotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: 'promo-1',
    tenantId: 'tenant-1',
    name: 'Buy 3 Pay 2',
    code: 'BUY3PAY2',
    description: 'Promo buy 3 pay 2',
    priority: 0,
    exclusive: false,
    stackable: false,
    ruleLogic: 'AND',
    rules: [{ type: 'min_purchase', params: { amount: 25000 } }],
    effects: [],
    usageLimit: null,
    usedCount: 0,
    minPurchase: 0,
    isActive: true,
    validFrom: null,
    validUntil: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeState(overrides: Partial<FormState> = {}): FormState {
  return {
    name: 'Promo',
    code: '',
    description: '',
    priority: 0,
    exclusive: false,
    stackable: false,
    ruleLogic: 'AND',
    usageLimit: null,
    isActive: true,
    validFrom: '',
    validUntil: '',
    rules: [],
    effects: [],
    ...overrides,
  };
}

describe('promotionFormState', () => {
  it('restores the stored effect parameters when editing a promotion', () => {
    const promo = makePromotion({
      effects: [
        {
          type: 'free_item',
          value: 0,
          target: 'cheapest_item',
          params: { quantity: 2, target: 'cheapest_item', allocation: 'cheapest' },
        },
      ],
    });

    const { effects } = promoToFormState(promo);

    expect(effects).toHaveLength(1);
    expect(effects[0].params.quantity).toBe(2);
    expect(effects[0].params.allocation).toBe('cheapest');
    expect(effects[0].params.target).toBe('cheapest_item');
  });

  it('keeps the buy quantity of a buy-x-pay-y effect', () => {
    const promo = makePromotion({
      effects: [
        {
          type: 'buy_x_pay_y',
          value: 0,
          target: 'order',
          params: { buyQuantity: 3, payQuantity: 2 },
        },
      ],
    });

    const { effects } = promoToFormState(promo);

    expect(effects[0].params.buyQuantity).toBe(3);
    expect(effects[0].params.payQuantity).toBe(2);
  });

  it('falls back to the order target when a legacy effect has no params', () => {
    const promo = makePromotion({
      effects: [{ type: 'nominal', value: 5000, target: 'order' }],
    });

    const { effects } = promoToFormState(promo);

    expect(effects[0].params.target).toBe('order');
    expect(effects[0].params.value).toBe(5000);
  });

  it('always sends the effect parameters in the payload', () => {
    const state = makeState({
      effects: [
        {
          id: 'effect_0',
          enabled: true,
          type: 'free_item',
          position: 0,
          params: { value: 0, target: 'specific_product', targetProductId: 'prod-1', quantity: 1 },
        },
      ],
    });

    const payload = formStateToPayload(state);

    expect(payload.effects).toHaveLength(1);
    expect(payload.effects[0].params).toMatchObject({
      quantity: 1,
      target: 'specific_product',
      targetProductId: 'prod-1',
    });
    expect(payload.effects[0].target).toBe('specific_product');
    expect(payload.effects[0].targetProductId).toBe('prod-1');
  });

  it('sends the buy-x-pay-y parameters in the payload', () => {
    const state = makeState({
      effects: [
        {
          id: 'effect_0',
          enabled: true,
          type: 'buy_x_pay_y',
          position: 0,
          params: { value: 0, target: 'order', buyQuantity: 3, payQuantity: 2 },
        },
      ],
    });

    const payload = formStateToPayload(state);

    expect(payload.effects[0].params).toMatchObject({ buyQuantity: 3, payQuantity: 2 });
    expect(payload.effects[0].type).toBe('buy_x_pay_y');
  });

  it('skips disabled effects and rules in the payload', () => {
    const state = makeState({
      rules: [
        { id: 'rule_0', enabled: false, label: '', type: 'min_purchase', params: { amount: 1 }, position: 0 },
      ],
      effects: [
        { id: 'effect_0', enabled: false, type: 'nominal', params: { value: 1 }, position: 0 },
      ],
    });

    const payload = formStateToPayload(state);

    expect(payload.rules).toHaveLength(0);
    expect(payload.effects).toHaveLength(0);
  });
});
