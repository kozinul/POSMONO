import { DiscountRule, IDiscountRule } from './DiscountRule';

export interface IDiscountConfiguration {
  id: string;
  tenantId: string;
  enabled: boolean;
  rules: IDiscountRule[];
  createdAt: Date;
  updatedAt: Date;
}

export class DiscountConfiguration {
  private constructor(private data: IDiscountConfiguration) {}

  static create(data: Omit<IDiscountConfiguration, 'id' | 'createdAt' | 'updatedAt'>): DiscountConfiguration {
    const now = new Date();
    return new DiscountConfiguration({
      id: `disc_cfg_${data.tenantId}_${now.getTime()}`,
      ...data,
      createdAt: now,
      updatedAt: now,
    });
  }

  static hydrate(data: IDiscountConfiguration): DiscountConfiguration {
    return new DiscountConfiguration(data);
  }

  getId(): string { return this.data.id; }
  getTenantId(): string { return this.data.tenantId; }
  isEnabled(): boolean { return this.data.enabled; }
  getRules(): DiscountRule[] { return this.data.rules.map((r) => DiscountRule.create(r)); }

  enable(): void { this.data.enabled = true; this.touch(); }
  disable(): void { this.data.enabled = false; this.touch(); }
  setEnabled(enabled: boolean): void { this.data.enabled = enabled; this.touch(); }

  addRule(rule: DiscountRule): void {
    this.data.rules.push(rule.serialize());
    this.touch();
  }

  updateRule(rule: DiscountRule): void {
    const idx = this.data.rules.findIndex((r) => r.id === rule.getId());
    if (idx >= 0) {
      this.data.rules[idx] = rule.serialize();
      this.touch();
    }
  }

  removeRule(ruleId: string): void {
    this.data.rules = this.data.rules.filter((r) => r.id !== ruleId);
    this.touch();
  }

  getRule(ruleId: string): DiscountRule | undefined {
    const data = this.data.rules.find((r) => r.id === ruleId);
    return data ? DiscountRule.create(data) : undefined;
  }

  getActiveRules(): IDiscountRule[] {
    return this.data.rules.filter((r) => r.active);
  }

  serialize(): IDiscountConfiguration {
    return { ...this.data };
  }

  private touch(): void {
    this.data.updatedAt = new Date();
  }
}
