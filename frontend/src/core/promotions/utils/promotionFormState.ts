import type { Promotion } from '../hooks/usePromotions';

export interface RuleInput {
  id: string;
  enabled: boolean;
  label: string;
  type: string;
  params: Record<string, unknown>;
  position: number;
}

export interface EffectInput {
  id: string;
  enabled: boolean;
  type: string;
  params: Record<string, unknown>;
  position: number;
}

export interface FormState {
  name: string;
  code: string;
  description: string;
  priority: number;
  exclusive: boolean;
  stackable: boolean;
  ruleLogic: 'AND' | 'OR';
  usageLimit: number | null;
  isActive: boolean;
  validFrom: string;
  validUntil: string;
  rules: RuleInput[];
  effects: EffectInput[];
}

export function promoToFormState(promo: Promotion): { rules: RuleInput[]; effects: EffectInput[] } {
  const rules: RuleInput[] = promo.rules.map((r, i) => ({
    id: `rule_${i}`,
    enabled: true,
    label: '',
    type: r.type,
    params: { ...r.params },
    position: i,
  }));
  const effects: EffectInput[] = promo.effects.map((e, i) => ({
    id: `effect_${i}`,
    enabled: true,
    type: e.type,
    // The effect details (buy quantity, free quantity, target, …) live in
    // `params`. They have to be restored, otherwise editing a promotion wipes
    // them and the promotion silently behaves differently after the save.
    params: {
      ...(e.params ?? {}),
      value: e.value ?? 0,
      target: e.target ?? ((e.params?.target as string) ?? 'order'),
      ...(e.targetProductId ? { targetProductId: e.targetProductId } : {}),
      ...(e.targetProductName ? { targetProductName: e.targetProductName } : {}),
      ...(e.maxDiscount ? { maxDiscount: e.maxDiscount } : {}),
    },
    position: i,
  }));
  return { rules, effects };
}

export function formStateToPayload(state: FormState) {
  const rules = state.rules
    .filter((r) => r.enabled)
    .map((r) => ({ type: r.type, params: r.params }));

  const effects = state.effects
    .filter((e) => e.enabled)
    .map((e) => {
      const p = e.params;
      // The parameters are always sent: the backend reads the effect details
      // (buy quantity, free quantity, allocation) from `params`. The flat
      // fields stay for the parts the backend still reads from the top level.
      return {
        type: e.type,
        value: (p.value as number) ?? 0,
        target: (p.target as string) ?? 'order',
        params: { ...p },
        ...(p.targetProductId ? { targetProductId: p.targetProductId as string } : {}),
        ...(p.targetProductName ? { targetProductName: p.targetProductName as string } : {}),
        ...(p.maxDiscount ? { maxDiscount: p.maxDiscount as number } : {}),
      };
    });

  return {
    name: state.name,
    code: state.code || undefined,
    description: state.description,
    priority: state.priority,
    exclusive: state.exclusive,
    stackable: state.stackable,
    ruleLogic: state.ruleLogic,
    rules,
    effects,
    usageLimit: state.usageLimit,
    minPurchase: 0,
    isActive: state.isActive,
    validFrom: state.validFrom ? new Date(state.validFrom).toISOString() : null,
    validUntil: state.validUntil ? new Date(state.validUntil).toISOString() : null,
  };
}
