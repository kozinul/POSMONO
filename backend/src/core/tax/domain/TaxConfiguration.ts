"use strict";

import { TaxRule, ITaxRule } from './TaxRule';

export type PricingMode = 'inclusive' | 'exclusive';
export type TaxVersionStatus = 'draft' | 'active' | 'deprecated';

export interface ITaxVersion {
  id: string;
  versionNumber: number;
  effectiveDate: Date;
  rules: ITaxRule[];
  status: TaxVersionStatus;
  createdAt: Date;
  deprecatedAt?: Date;
}

export interface ITaxConfiguration {
  id: string;
  tenantId: string;
  taxEnabled: boolean;
  pricingMode: PricingMode;
  countryCode: string;
  currency: string;
  activeVersionId: string;
  versions: ITaxVersion[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class TaxConfiguration {
  private constructor(private data: ITaxConfiguration) {}

  static create(data: Omit<ITaxConfiguration, 'id' | 'createdAt' | 'updatedAt'>): TaxConfiguration {
    const now = new Date();
    const id = `taxcfg_${data.tenantId}_${now.getTime()}`;

    const hasActiveVersion = data.versions.some((v) => v.status === 'active');
    const versions = hasActiveVersion
      ? data.versions
      : [
          {
            id: `v1_${now.getTime()}`,
            versionNumber: 1,
            effectiveDate: now,
            rules: [],
            status: 'active' as TaxVersionStatus,
            createdAt: now,
          },
        ];

    return new TaxConfiguration({
      id,
      tenantId: data.tenantId,
      taxEnabled: data.taxEnabled ?? true,
      pricingMode: data.pricingMode ?? 'exclusive',
      countryCode: data.countryCode ?? 'ID',
      currency: data.currency ?? 'IDR',
      activeVersionId: data.activeVersionId || versions[0].id,
      versions,
      metadata: data.metadata,
      createdAt: now,
      updatedAt: now,
    });
  }

  static hydrate(data: ITaxConfiguration): TaxConfiguration {
    return new TaxConfiguration(data);
  }

  // --- State ---

  isTaxEnabled(): boolean {
    return this.data.taxEnabled;
  }

  enable(): void {
    this.data.taxEnabled = true;
    this.touch();
  }

  disable(): void {
    this.data.taxEnabled = false;
    this.touch();
  }

  getPricingMode(): PricingMode {
    return this.data.pricingMode;
  }

  setPricingMode(mode: PricingMode): void {
    this.data.pricingMode = mode;
    this.touch();
  }

  getCountryCode(): string {
    return this.data.countryCode;
  }

  getCurrency(): string {
    return this.data.currency;
  }

  // --- Versions ---

  getActiveVersion(): ITaxVersion {
    const v = this.data.versions.find((v) => v.id === this.data.activeVersionId);
    if (!v) throw new Error(`Active version ${this.data.activeVersionId} not found`);
    return v;
  }

  getActiveRules(): TaxRule[] {
    return this.getActiveVersion().rules.map((r) => TaxRule.create(r));
  }

  getAllVersions(): ITaxVersion[] {
    return [...this.data.versions];
  }

  addVersion(effectiveDate: Date, description?: string): ITaxVersion {
    const lastVersion = this.data.versions[this.data.versions.length - 1];
    const newVersion: ITaxVersion = {
      id: `v${(lastVersion?.versionNumber ?? 0) + 1}_${Date.now()}`,
      versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
      effectiveDate,
      rules: lastVersion ? [...lastVersion.rules] : [],
      status: 'draft',
      createdAt: new Date(),
    };
    this.data.versions.push(newVersion);
    this.touch();
    return newVersion;
  }

  activateVersion(versionId: string): void {
    const idx = this.data.versions.findIndex((v) => v.id === versionId);
    if (idx === -1) throw new Error(`Version ${versionId} not found`);

    this.data.versions.forEach((v) => {
      if (v.status === 'active') {
        v.status = 'deprecated';
        v.deprecatedAt = new Date();
      }
    });

    this.data.versions[idx].status = 'active';
    this.data.activeVersionId = versionId;
    this.touch();
  }

  // --- Rules ---

  addRule(rule: TaxRule): void {
    const version = this.getActiveVersion();
    const idx = this.data.versions.findIndex((v) => v.id === version.id);
    this.data.versions[idx] = {
      ...version,
      rules: [...version.rules, rule.serialize()],
    };
    this.touch();
  }

  removeRule(ruleId: string): void {
    const version = this.getActiveVersion();
    const idx = this.data.versions.findIndex((v) => v.id === version.id);
    this.data.versions[idx] = {
      ...version,
      rules: version.rules.filter((r) => r.id !== ruleId),
    };
    this.touch();
  }

  updateRule(ruleId: string, partial: Partial<ITaxRule>): void {
    const version = this.getActiveVersion();
    const vIdx = this.data.versions.findIndex((v) => v.id === version.id);
    this.data.versions[vIdx].rules = version.rules.map((r) =>
      r.id === ruleId ? { ...r, ...partial } : r,
    );
    this.touch();
  }

  // --- Serialization ---

  serialize(): ITaxConfiguration {
    return { ...this.data, metadata: this.data.metadata ? { ...this.data.metadata } : undefined };
  }

  private touch(): void {
    this.data.updatedAt = new Date();
  }
}
