import { Entity } from '../../../@shared/domain/Entity';
import { TaxRuleId } from '../../../@shared/domain/Identifier';

export type TaxRuleType = 'percentage' | 'compound' | 'category_based' | 'product_based' | 'exemption';
export type TaxApplyTo = 'all' | 'categories' | 'products' | 'exempt';
export type TaxCalculationStrategy = 'standard_percentage' | 'indonesia_ppn_2025' | 'compound';

export interface ITaxRule {
  id?: string;
  name: string;
  type: TaxRuleType;
  rate: number;
  compoundOrder: number;
  calculationStrategy: TaxCalculationStrategy;
  taxBaseModifier: string | null;
  applyTo: TaxApplyTo;
  categoryIds: string[];
  productIds: string[];
  exemptProductIds: string[];
  exemptCustomerTags: string[];
  isActive: boolean;
  metadata: Record<string, unknown>;
}

export class TaxRule extends Entity<TaxRuleId> {
  private name: string;
  private type: TaxRuleType;
  private rate: number;
  private compoundOrder: number;
  private calculationStrategy: TaxCalculationStrategy;
  private taxBaseModifier: string | null;
  private applyTo: TaxApplyTo;
  private categoryIds: string[];
  private productIds: string[];
  private exemptProductIds: string[];
  private exemptCustomerTags: string[];
  private isActive: boolean;
  private metadata: Record<string, unknown>;

  private constructor(props: ITaxRule) {
    super(new TaxRuleId(props.id));
    this.name = props.name;
    this.type = props.type;
    this.rate = props.rate;
    this.compoundOrder = props.compoundOrder;
    this.calculationStrategy = props.calculationStrategy ?? 'standard_percentage';
    this.taxBaseModifier = props.taxBaseModifier ?? null;
    this.applyTo = props.applyTo;
    this.categoryIds = [...props.categoryIds];
    this.productIds = [...props.productIds];
    this.exemptProductIds = [...props.exemptProductIds];
    this.exemptCustomerTags = [...props.exemptCustomerTags];
    this.isActive = props.isActive;
    this.metadata = { ...props.metadata };
  }

  static create(props: Omit<ITaxRule, 'id'>): TaxRule {
    return new TaxRule({ ...props, id: new TaxRuleId().toValue() });
  }

  static hydrate(props: ITaxRule): TaxRule {
    return new TaxRule(props);
  }

  appliesTo(productId: string, categoryId: string, customerTags: string[]): boolean {
    if (!this.isActive) return false;

    if (this.applyTo === 'all') {
      return !this.exemptProductIds.includes(productId) &&
        !this.exemptCustomerTags.some((t) => customerTags.includes(t));
    }

    if (this.applyTo === 'categories') return this.categoryIds.includes(categoryId);
    if (this.applyTo === 'products') return this.productIds.includes(productId);
    if (this.applyTo === 'exempt') return false;

    return false;
  }

  isCompound(): boolean {
    return this.type === 'compound';
  }

  getRate(): number {
    return this.rate;
  }

  getCalculationStrategy(): TaxCalculationStrategy {
    return this.calculationStrategy;
  }

  getTaxBaseModifier(): string | null {
    return this.taxBaseModifier;
  }

  serialize(): ITaxRule {
    return {
      id: this._id.toValue(),
      name: this.name,
      type: this.type,
      rate: this.rate,
      compoundOrder: this.compoundOrder,
      calculationStrategy: this.calculationStrategy,
      taxBaseModifier: this.taxBaseModifier,
      applyTo: this.applyTo,
      categoryIds: [...this.categoryIds],
      productIds: [...this.productIds],
      exemptProductIds: [...this.exemptProductIds],
      exemptCustomerTags: [...this.exemptCustomerTags],
      isActive: this.isActive,
      metadata: { ...this.metadata },
    };
  }
}
