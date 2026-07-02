export interface IPricingProfile {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  taxRuleIds: string[];
  isDefault: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class PricingProfile {
  private constructor(private data: IPricingProfile) {}

  static create(data: Omit<IPricingProfile, 'id' | 'createdAt' | 'updatedAt'>): PricingProfile {
    const now = new Date();
    return new PricingProfile({
      id: `pp_${data.tenantId}_${now.getTime()}`,
      tenantId: data.tenantId,
      name: data.name,
      description: data.description || '',
      taxRuleIds: data.taxRuleIds || [],
      isDefault: data.isDefault ?? false,
      active: data.active ?? true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static hydrate(data: IPricingProfile): PricingProfile {
    return new PricingProfile(data);
  }

  getId(): string { return this.data.id; }
  getTenantId(): string { return this.data.tenantId; }
  getName(): string { return this.data.name; }
  getDescription(): string { return this.data.description; }
  getTaxRuleIds(): string[] { return [...this.data.taxRuleIds]; }
  isDefault(): boolean { return this.data.isDefault; }
  isActive(): boolean { return this.data.active; }

  update(data: Partial<Pick<IPricingProfile, 'name' | 'description' | 'taxRuleIds' | 'isDefault' | 'active'>>): void {
    if (data.name !== undefined) this.data.name = data.name;
    if (data.description !== undefined) this.data.description = data.description;
    if (data.taxRuleIds !== undefined) this.data.taxRuleIds = [...data.taxRuleIds];
    if (data.isDefault !== undefined) this.data.isDefault = data.isDefault;
    if (data.active !== undefined) this.data.active = data.active;
    this.data.updatedAt = new Date();
  }

  addRuleId(ruleId: string): void {
    if (!this.data.taxRuleIds.includes(ruleId)) {
      this.data.taxRuleIds.push(ruleId);
      this.data.updatedAt = new Date();
    }
  }

  removeRuleId(ruleId: string): void {
    this.data.taxRuleIds = this.data.taxRuleIds.filter((id) => id !== ruleId);
    this.data.updatedAt = new Date();
  }

  serialize(): IPricingProfile {
    return { ...this.data, taxRuleIds: [...this.data.taxRuleIds] };
  }
}
