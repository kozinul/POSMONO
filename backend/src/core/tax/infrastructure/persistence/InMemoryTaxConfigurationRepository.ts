"use strict";

import { TaxConfiguration, ITaxConfiguration } from '../../domain/TaxConfiguration';
import { ITaxConfigurationRepository } from './ITaxConfigurationRepository';

export class InMemoryTaxConfigurationRepository implements ITaxConfigurationRepository {
  private store = new Map<string, TaxConfiguration>();

  async save(config: TaxConfiguration): Promise<void> {
    this.store.set(config.serialize().id, config);
  }

  async findByTenantId(tenantId: string): Promise<TaxConfiguration | null> {
    for (const cfg of this.store.values()) {
      if (cfg.serialize().tenantId === tenantId) return cfg;
    }
    return null;
  }

  async findByTenantIdOrFail(tenantId: string): Promise<TaxConfiguration> {
    const cfg = await this.findByTenantId(tenantId);
    if (!cfg) throw new Error(`TaxConfig not found for tenant: ${tenantId}`);
    return cfg;
  }

  async initializeDefault(tenantId: string): Promise<TaxConfiguration> {
    const now = new Date();
    const config = TaxConfiguration.create({
      tenantId,
      taxEnabled: true,
      pricingMode: 'exclusive',
      countryCode: 'ID',
      currency: 'IDR',
      activeVersionId: '',
      versions: [
        {
          id: `v1_${now.getTime()}`,
          versionNumber: 1,
          effectiveDate: now,
          rules: [],
          status: 'active',
          createdAt: now,
        },
      ],
      metadata: {},
    });
    await this.save(config);
    return config;
  }
}
