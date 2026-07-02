import { DiscountPolicy, IDiscountPolicy } from './DiscountPolicy';
import { DiscountScope, IDiscountScope, ScopeMatchContext } from './DiscountScope';
import { IDiscountCondition } from './strategies/conditions/ConditionStrategy';
import { IDiscountEffect } from './strategies/effects/EffectStrategy';
import { RoundingEngine } from '../../tax/domain/RoundingEngine';

export interface IDiscountRule {
  id: string;
  name: string;
  description?: string;
  priority: number;
  stackable: boolean;
  active: boolean;
  scope: IDiscountScope;
  policy: IDiscountPolicy;
  conditions: IDiscountCondition[];
  effects: IDiscountEffect[];
  promoCodeId?: string;
  maxUsageCount?: number;
  currentUsageCount: number;
  startDate?: string;
  endDate?: string;
  metadata?: Record<string, unknown>;
}

export interface DiscountRuleResult {
  ruleId: string;
  ruleName: string;
  discountAmount: number;
  description: string;
}

export class DiscountRule {
  private static readonly roundingEngine = new RoundingEngine();

  private constructor(private readonly data: IDiscountRule) {}

  static create(data: IDiscountRule): DiscountRule {
    return new DiscountRule(data);
  }

  static new(
    name: string,
    priority: number,
    scope: DiscountScope,
    policy: DiscountPolicy,
    overrides?: Partial<IDiscountRule>,
  ): DiscountRule {
    return new DiscountRule({
      id: overrides?.id || `disc_rule_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name,
      priority,
      stackable: overrides?.stackable ?? true,
      active: overrides?.active ?? true,
      scope: scope.serialize(),
      policy: policy.serialize(),
      conditions: overrides?.conditions ?? [],
      effects: overrides?.effects ?? [],
      currentUsageCount: overrides?.currentUsageCount ?? 0,
      ...overrides,
    });
  }

  getId(): string { return this.data.id; }
  getName(): string { return this.data.name; }
  getPriority(): number { return this.data.priority; }
  isStackable(): boolean { return this.data.stackable; }
  isActive(): boolean { return this.data.active; }
  getPolicy(): DiscountPolicy { return DiscountPolicy.create(this.data.policy); }
  getScope(): DiscountScope { return DiscountScope.create(this.data.scope); }
  getPromoCodeId(): string | undefined { return this.data.promoCodeId; }
  getConditions(): IDiscountCondition[] { return [...this.data.conditions]; }
  getEffects(): IDiscountEffect[] { return [...this.data.effects]; }
  getMaxUsageCount(): number | undefined { return this.data.maxUsageCount; }
  getCurrentUsageCount(): number { return this.data.currentUsageCount; }
  getStartDate(): string | undefined { return this.data.startDate; }
  getEndDate(): string | undefined { return this.data.endDate; }

  isExpired(): boolean {
    const now = new Date();
    if (this.data.endDate && new Date(this.data.endDate) < now) return true;
    if (this.data.startDate && new Date(this.data.startDate) > now) return true;
    if (this.data.maxUsageCount && this.data.currentUsageCount >= this.data.maxUsageCount) return true;
    return false;
  }

  scopeMatches(context: ScopeMatchContext): boolean {
    return this.getScope().matches(context);
  }

  calculate(subtotal: number, context?: { categoryTotals?: Record<string, number> }): DiscountRuleResult {
    const policy = this.getPolicy();
    let amount = 0;
    let description = this.data.name;

    switch (policy.getType()) {
      case 'percentage': {
        amount = subtotal * (policy.getValue() / 100);
        const cap = policy.getMaxCap();
        if (cap !== undefined && amount > cap) {
          amount = cap;
          description = `${this.data.name} (max Rp${cap.toLocaleString()})`;
        }
        break;
      }
      case 'nominal': {
        amount = Math.min(policy.getValue(), subtotal);
        break;
      }
      case 'free_item':
      case 'fixed_price':
      case 'bundle_price':
        amount = 0;
        description = `${this.data.name} (efek item)`;
        break;
    }

    amount = DiscountRule.roundingEngine.round(amount, policy.getRoundingMode(), policy.getPrecision());

    return { ruleId: this.data.id, ruleName: this.data.name, discountAmount: amount, description };
  }

  incrementUsage(): void {
    this.data.currentUsageCount++;
  }

  deactivate(): void {
    this.data.active = false;
  }

  serialize(): IDiscountRule {
    return { ...this.data };
  }
}
