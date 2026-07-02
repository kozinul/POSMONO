"use strict";

import { Model, Document } from 'mongoose';
import { TaxConfiguration, ITaxConfiguration } from '../../domain/TaxConfiguration';
import { ITaxConfigurationRepository } from './ITaxConfigurationRepository';

export class MongoTaxConfigurationRepository implements ITaxConfigurationRepository {
  constructor(private readonly model: Model<ITaxConfiguration & Document>) {}

  async save(config: TaxConfiguration): Promise<void> {
    const data = config.serialize();
    await this.model.findOneAndUpdate(
      { tenantId: data.tenantId },
      { $set: data },
      { upsert: true, new: true },
    );
  }

  async findByTenantId(tenantId: string): Promise<TaxConfiguration | null> {
    const doc = await this.model.findOne({ tenantId });
    if (!doc) return null;
    return TaxConfiguration.hydrate(doc.toObject());
  }

  async findByTenantIdOrFail(tenantId: string): Promise<TaxConfiguration> {
    const cfg = await this.findByTenantId(tenantId);
    if (!cfg) throw new Error(`TaxConfig not found for tenant: ${tenantId}`);
    return cfg;
  }

  async initializeDefault(tenantId: string): Promise<TaxConfiguration> {
    const config = TaxConfiguration.create({
      tenantId,
      taxEnabled: true,
      pricingMode: 'exclusive',
      countryCode: 'ID',
      currency: 'IDR',
      activeVersionId: '',
      versions: [],
      metadata: {},
    });
    await this.save(config);
    return config;
  }
}
