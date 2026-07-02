export interface IPromoCode {
  id: string;
  tenantId: string;
  code: string;
  ruleId: string;
  maxUsageCount: number;
  currentUsageCount: number;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export class PromoCode {
  private constructor(private data: IPromoCode) {}

  static create(data: IPromoCode): PromoCode {
    return new PromoCode(data);
  }

  static new(
    tenantId: string,
    code: string,
    ruleId: string,
    overrides?: Partial<IPromoCode>,
  ): PromoCode {
    return new PromoCode({
      id: `promo_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      tenantId,
      code: code.toUpperCase(),
      ruleId,
      maxUsageCount: overrides?.maxUsageCount ?? 0,
      currentUsageCount: overrides?.currentUsageCount ?? 0,
      isActive: overrides?.isActive ?? true,
      expiresAt: overrides?.expiresAt,
      createdAt: overrides?.createdAt ?? new Date().toISOString(),
      updatedAt: overrides?.updatedAt ?? new Date().toISOString(),
    });
  }

  getId(): string { return this.data.id; }
  getCode(): string { return this.data.code; }
  getRuleId(): string { return this.data.ruleId; }
  isActive(): boolean { return this.data.isActive; }
  getMaxUsageCount(): number { return this.data.maxUsageCount; }
  getCurrentUsageCount(): number { return this.data.currentUsageCount; }
  getExpiresAt(): string | undefined { return this.data.expiresAt; }

  isValid(): boolean {
    if (!this.data.isActive) return false;
    if (this.data.expiresAt && new Date(this.data.expiresAt) < new Date()) return false;
    if (this.data.maxUsageCount > 0 && this.data.currentUsageCount >= this.data.maxUsageCount) return false;
    return true;
  }

  incrementUsage(): void {
    this.data.currentUsageCount++;
    this.data.updatedAt = new Date().toISOString();
  }

  deactivate(): void {
    this.data.isActive = false;
    this.data.updatedAt = new Date().toISOString();
  }

  serialize(): IPromoCode {
    return { ...this.data };
  }
}
