import { EffectStrategy, IDiscountEffect, EffectContext, EffectResult } from './EffectStrategy';
import { countQualifyingSets, getQualifyingItems } from './qualifyingSets';

export class FreeItemEffect implements EffectStrategy {
  readonly type = 'free_item' as const;

  apply(effect: IDiscountEffect, context: EffectContext): EffectResult {
    const target = (effect.config.target as string) || '';
    const perSet = (effect.config.quantity as number) || 1;
    const productName = (effect.config.productName as string) || '';
    const conditions = context.conditions ?? [];

    let productId = (effect.config.productId as string) || '';
    let resolvedFromCart = false;
    let availableQty = 0;

    // An explicitly named product wins — the promotion says what is given away.
    // "cheapest_item" / "most_expensive_item" (and a missing product id) resolve
    // to a real line inside the promotion's own scope, so the free value is an
    // amount instead of nothing.
    if (!productId) {
      const pool = getQualifyingItems(conditions, context.items);
      const picked =
        target === 'most_expensive_item'
          ? [...pool].sort((a, b) => b.unitPrice - a.unitPrice)[0]
          : [...pool].sort((a, b) => a.unitPrice - b.unitPrice)[0];
      if (picked) {
        productId = picked.productId;
        resolvedFromCart = true;
        availableQty = picked.quantity;
      }
    }

    // Defensive gate for "Gratis Item + rule Minimal Item = 2" (cheapest_item):
    // The condition evaluator must already block this, but we enforce it here
    // as well so the first item can never be given away before the minimum
    // quantity is met. Only applies when resolving from the cart (no explicit
    // productId).
    if (resolvedFromCart && !productId && conditions.length) {
      const minItemsCond = conditions.find((c) => c.type === 'min_items');
      if (minItemsCond) {
        const minItems = Number(minItemsCond.config.minItems) || 0;
        if (minItems > 0) {
          const totalQty = context.items.reduce((sum, i) => sum + (i.quantity || 0), 0);
          if (totalQty < minItems) {
            return { discountAmount: 0, description: `${productName || 'Item'} gratis` };
          }
        }
      }
    }

    // How many sets the promotion grants. A resolved line is given away once:
    // the promotion names one line, so scaling it by the qualifying count would
    // hand over the whole qualifying product (three coffees in the cart would
    // make all three free). An explicitly named product keeps the per
    // qualifying-set scaling — that is the "buy 2, get 1 gift" contract.
    const hasScopeCondition = conditions.some(
      (c) => c.type === 'product_match' || c.type === 'category_match',
    );
    const hasMinItems = conditions.some((c) => c.type === 'min_items');
    const sets = resolvedFromCart
      ? 1
      : hasScopeCondition || hasMinItems
        ? Math.max(countQualifyingSets(conditions, context.items), 0)
        : 1;
    const quantity = perSet * sets;

    if (quantity <= 0) {
      return { discountAmount: 0, description: `${productName || (effect.config.productId as string) || 'Item'} gratis` };
    }

    const item = context.items.find((i) => i.productId === productId);

    if (!item) {
      // The product is not in the cart — it is handed over as a gift.
      return {
        discountAmount: 0,
        description: `${quantity}x ${productName || productId} gratis`,
        generatedLineItems: [{ productId, productName, categoryId: '', quantity, unitPrice: 0 }],
      };
    }

    // A resolved line can only be free as far as it is in the cart; an explicitly
    // named product may exceed it — the surplus is handed over as a gift.
    const freeQty = resolvedFromCart ? Math.min(quantity, availableQty) : quantity;

    return {
      discountAmount: 0,
      description: `${freeQty}x ${item.productId} gratis`,
      freeItems: [{ productId, quantity: freeQty }],
    };
  }
}
