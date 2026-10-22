import { describe, it, expect } from 'vitest';
import { validatePromotionForm } from '../../src/core/promotions/utils/promotionFormValidation';
import type { FormState } from '../../src/core/promotions/utils/promotionFormState';

function makeState(overrides: Partial<FormState> = {}): FormState {
  return {
    name: 'Promo Test',
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
    rules: [{ id: 'r1', enabled: true, type: 'min_purchase', params: { amount: 10000 } }],
    effects: [{ id: 'e1', enabled: true, type: 'percentage', params: { value: 10 }, position: 0 }],
    ...overrides,
  };
}

describe('validatePromotionForm', () => {
  it('returns no errors for a valid promotion form', () => {
    const state = makeState();
    const errors = validatePromotionForm(state);
    expect(errors).toEqual({});
  });

  it('reports an error when the name is empty', () => {
    const state = makeState({ name: '   ' });
    const errors = validatePromotionForm(state);
    expect(errors.name).toBeTruthy();
  });

  it('reports an error when payQuantity is 0 or undefined for buy_x_pay_y', () => {
    const state = makeState({
      effects: [
        {
          id: 'e1',
          enabled: true,
          type: 'buy_x_pay_y',
          params: { buyQuantity: 3, payQuantity: 0, allocationStrategy: 'cheapest' },
          position: 0,
        },
      ],
    });
    const errors = validatePromotionForm(state);
    expect(errors.effect_0_payQty).toBeTruthy();
  });

  it('reports an error when payQuantity >= buyQuantity for buy_x_pay_y', () => {
    const state = makeState({
      effects: [
        {
          id: 'e1',
          enabled: true,
          type: 'buy_x_pay_y',
          params: { buyQuantity: 2, payQuantity: 2, allocationStrategy: 'cheapest' },
          position: 0,
        },
      ],
    });
    const errors = validatePromotionForm(state);
    expect(errors.effect_0_invalid).toBeTruthy();
  });
});
