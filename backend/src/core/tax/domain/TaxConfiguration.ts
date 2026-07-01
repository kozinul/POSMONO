import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { TaxConfigurationId } from '../../../@shared/domain/Identifier';
import { TaxRule, ITaxRule, TaxRuleType } from './TaxRule';

export type TaxPricingMode = 'inclusive' | 'exclusive';

export interface ITaxConfiguration {
  id: string;
  tenantId: string;
  taxEnabled: boolean;
  pricingMode: TaxPricingMode;
  countryCode: string;
  currency: string;
  rules: ITaxRule[];
  version: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class TaxConfiguration extends AggregateRoot<TaxConfigurationId> {
  private tenantId: string;
  private taxEnabled: boolean;
  private pricingMode: TaxPricingMode;
  private countryCode: string;
  private currency: string;
  private rules: TaxRule[];
  private version: number;
  private metadata: Record<string, unknown>;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: ITaxConfiguration) {
    super(new TaxConfigurationId(props.id));
    this.tenantId = props.tenantId;
    this.taxEnabled = props.taxEnabled;
    this.pricingMode = props.pricingMode;
    this.countryCode = props.countryCode;
    this.currency = props.currency;
    this.rules = (props.rules || []).map((r) => TaxRule.hydrate(r));
    this.version = props.version;
    this.metadata = { ...props.metadata };
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<ITaxConfiguration, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'rules'> & { rules?: ITaxRule[] }): TaxConfiguration {
    return new TaxConfiguration({
      ...props,
      id: new TaxConfigurationId().toValue(),
      rules: props.rules || [],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static hydrate(props: ITaxConfiguration): TaxConfiguration {
    return new TaxConfiguration(props);
  }

  isTaxEnabled(): boolean {
    return this.taxEnabled;
  }

  getPricingMode(): TaxPricingMode {
    return this.pricingMode;
  }

  getCountryCode(): string {
    return this.countryCode;
  }

  getCurrency(): string {
    return this.currency;
  }

  getActiveRules(): TaxRule[] {
    return this.rules.filter((r) => r.serialize().isActive);
  }

  getCompoundRules(): TaxRule[] {
    return this.getActiveRules()
      .filter((r) => r.isCompound())
      .sort((a, b) => a.serialize().compoundOrder - b.serialize().compoundOrder);
  }

  getSimpleRules(): TaxRule[] {
    return this.getActiveRules().filter((r) => !r.isCompound());
  }

  getRulesAppliedTo(productId: string, categoryId: string, customerTags: string[]): TaxRule[] {
    return this.getActiveRules().filter((r) => r.appliesTo(productId, categoryId, customerTags));
  }

  enable(): void {
    this.taxEnabled = true;
    this.touch();
  }

  disable(): void {
    this.taxEnabled = false;
    this.touch();
  }

  setPricingMode(mode: TaxPricingMode): void {
    this.pricingMode = mode;
    this.touch();
  }

  setCountryCode(code: string): void {
    this.countryCode = code;
    this.touch();
  }

  setCurrency(currency: string): void {
    this.currency = currency;
    this.touch();
  }

  addRule(rule: TaxRule): void {
    this.rules.push(rule);
    this.bumpVersion();
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id.toValue() !== ruleId);
    this.bumpVersion();
  }

  updateRule(ruleId: string, partial: Partial<ITaxRule>): void {
    const idx = this.rules.findIndex((r) => r.id.toValue() === ruleId);
    if (idx === -1) throw new Error(`TaxRule not found: ${ruleId}`);
    const existing = this.rules[idx].serialize();
    this.rules[idx] = TaxRule.hydrate({ ...existing, ...partial });
    this.bumpVersion();
  }

  private bumpVersion(): void {
    this.version++;
    this.touch();
  }

  private touch(): void {
    this.updatedAt = new Date();
  }

  serialize(): ITaxConfiguration {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      taxEnabled: this.taxEnabled,
      pricingMode: this.pricingMode,
      countryCode: this.countryCode,
      currency: this.currency,
      rules: this.rules.map((r) => r.serialize()),
      version: this.version,
      metadata: { ...this.metadata },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
