import { TaxPolicy, ITaxPolicy } from './TaxPolicy';
import { TaxScope, ITaxScope, ScopeMatchContext } from './TaxScope';
import { IModifierConfig, ModifierEngine } from './ModifierEngine';
import { RoundingEngine } from './RoundingEngine';

export type TaxType = 'vat' | 'withholding' | 'custom' | 'exemption';

export interface ITaxRule {
  id: string;
  name: string;
  taxType: TaxType;
  scope: ITaxScope;
  policy: ITaxPolicy;
  modifier?: IModifierConfig;
  priority: number;
  sequence?: number;
  isActive: boolean;
  effectiveDate: Date;
  expiresAt?: Date;
  conditions?: {
    amountOperator?: 'greater_than' | 'less_than' | 'equals' | 'greater_or_equal' | 'less_or_equal';
    amountThreshold?: number;
    categoryIds?: string[];
    productIds?: string[];
    customerTypes?: string[];
  };
  metadata?: Record<string, unknown>;
}

export class TaxRule {
  private static readonly modifierEngine = new ModifierEngine();
  private static readonly roundingEngine = new RoundingEngine();

  private constructor(private readonly data: ITaxRule) {}

  static create(data: ITaxRule): TaxRule {
    return new TaxRule(data);
  }

  static new(
    name: string,
    taxType: TaxType,
    priority: number,
    scope: TaxScope,
    policy: TaxPolicy,
    overrides?: Partial<ITaxRule>,
  ): TaxRule {
    return new TaxRule({
      id: overrides?.id || `rule_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name,
      taxType,
      scope: scope.serialize(),
      policy: policy.serialize(),
      modifier: overrides?.modifier,
      priority,
      sequence: overrides?.sequence,
      isActive: overrides?.isActive ?? true,
      effectiveDate: overrides?.effectiveDate ?? new Date(),
      expiresAt: overrides?.expiresAt,
      conditions: overrides?.conditions,
      metadata: overrides?.metadata,
    });
  }

  getId(): string { return this.data.id; }
  getName(): string { return this.data.name; }
  getTaxType(): TaxType { return this.data.taxType; }
  getPriority(): number { return this.data.priority; }
  getSequence(): number { return this.data.sequence ?? 30; }
  getModifier(): IModifierConfig | undefined { return this.data.modifier; }

  getScope(): TaxScope {
    return TaxScope.create(this.data.scope);
  }

  getPolicy(): TaxPolicy {
    return TaxPolicy.create(this.data.policy);
  }

  isExemption(): boolean {
    return this.data.taxType === 'exemption';
  }

  isEnabled(): boolean {
    if (!this.data.isActive) return false;
    const now = new Date();
    if (now < this.data.effectiveDate) return false;
    if (this.data.expiresAt && now > this.data.expiresAt) return false;
    return true;
  }

  shouldApply(context: ScopeMatchContext): boolean {
    if (!this.isEnabled()) return false;

    const matchesScope = this.getScope().appliesTo(context);
    if (!matchesScope) return false;

    if (this.data.conditions?.amountOperator) {
      const total = context.items
        ? context.items.reduce((sum, item) => sum + (item as any).unitPrice * (item as any).quantity, 0)
        : 0;
      const threshold = this.data.conditions.amountThreshold ?? 0;
      switch (this.data.conditions.amountOperator) {
        case 'greater_than':
          if (total <= threshold) return false;
          break;
        case 'less_than':
          if (total >= threshold) return false;
          break;
        case 'equals':
          if (total !== threshold) return false;
          break;
        case 'greater_or_equal':
          if (total < threshold) return false;
          break;
        case 'less_or_equal':
          if (total > threshold) return false;
          break;
      }
    }

    return true;
  }

  calculateTax(taxableAmount: number, isInclusive = false): number {
    if (this.isExemption()) return 0;
    const policyVal = Number(this.data.policy?.value) || 0;
    if (this.data.policy.type === 'amount') return policyVal;

    const modifiedBase = TaxRule.modifierEngine.apply(taxableAmount, this.data.modifier);

    if (isInclusive) {
      const divisor = 1 + policyVal / 100;
      if (divisor <= 0) return 0;
      const rawTax = modifiedBase - modifiedBase / divisor;
      return TaxRule.roundingEngine.round(rawTax, this.data.policy.roundingMode, this.data.policy.precision);
    }

    const rawTax = modifiedBase * (policyVal / 100);
    return TaxRule.roundingEngine.round(rawTax, this.data.policy.roundingMode, this.data.policy.precision);
  }

  serialize(): ITaxRule {
    return {
      ...this.data,
      scope: this.data.scope,
      policy: this.data.policy,
      modifier: this.data.modifier ? { ...this.data.modifier, config: this.data.modifier.config ? { ...this.data.modifier.config } : undefined } : undefined,
      conditions: this.data.conditions ? { ...this.data.conditions } : undefined,
    };
  }
}
