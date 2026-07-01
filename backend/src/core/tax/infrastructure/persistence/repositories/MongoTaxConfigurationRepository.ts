import { TaxConfiguration, ITaxConfiguration } from '../../../domain/TaxConfiguration';
import { TaxRule } from '../../../domain/TaxRule';
import {
  TaxConfigurationModel,
  ITaxConfigurationDocument,
} from '../schemas/TaxConfigurationSchema';

export interface TaxConfigurationRepository {
  findByTenantId(tenantId: string): Promise<TaxConfiguration | null>;
  findByTenantIdOrFail(tenantId: string): Promise<TaxConfiguration>;
  save(config: TaxConfiguration): Promise<TaxConfiguration>;
  delete(tenantId: string): Promise<void>;
  initializeDefault(tenantId: string): Promise<TaxConfiguration>;
}

function toDomain(doc: ITaxConfigurationDocument): TaxConfiguration {
  return TaxConfiguration.hydrate({
    id: (doc._id as unknown as string)?.toString() ?? '',
    tenantId: doc.tenantId,
    taxEnabled: doc.taxEnabled,
    pricingMode: doc.pricingMode as 'inclusive' | 'exclusive',
    countryCode: doc.countryCode,
    currency: doc.currency,
    rules: ((doc.rules as unknown[]) ?? []).map((r: any) => ({
      id: r._id?.toString() ?? '',
      name: r.name,
      type: r.type,
      rate: r.rate,
      compoundOrder: r.compoundOrder ?? 0,
      applyTo: r.applyTo ?? 'all',
      categoryIds: r.categoryIds ?? [],
      productIds: r.productIds ?? [],
      exemptProductIds: r.exemptProductIds ?? [],
      exemptCustomerTags: r.exemptCustomerTags ?? [],
      calculationStrategy: r.calculationStrategy ?? 'standard_percentage',
      taxBaseModifier: r.taxBaseModifier ?? null,
      isActive: r.isActive ?? true,
      metadata: r.metadata ?? {},
    })),
    version: doc.version ?? 1,
    metadata: doc.metadata ?? {},
    createdAt: doc.createdAt ?? new Date(),
    updatedAt: doc.updatedAt ?? new Date(),
  });
}

function toDocument(config: TaxConfiguration): Record<string, unknown> {
  const plain = config.serialize();
  return {
    tenantId: plain.tenantId,
    taxEnabled: plain.taxEnabled,
    pricingMode: plain.pricingMode,
    countryCode: plain.countryCode,
    currency: plain.currency,
    rules: plain.rules.map((r) => ({
      ...r,
      _id: undefined,
      id: undefined,
    })),
    version: plain.version,
    metadata: plain.metadata,
  };
}

export class MongoTaxConfigurationRepository implements TaxConfigurationRepository {
  async findByTenantId(tenantId: string): Promise<TaxConfiguration | null> {
    const doc = await TaxConfigurationModel.findOne({ tenantId }).lean();
    if (!doc) return null;
    return toDomain(doc as unknown as ITaxConfigurationDocument);
  }

  async findByTenantIdOrFail(tenantId: string): Promise<TaxConfiguration> {
    const doc = await TaxConfigurationModel.findOne({ tenantId }).lean();
    if (!doc) {
      throw new Error(`TaxConfiguration not found for tenant: ${tenantId}`);
    }
    return toDomain(doc as unknown as ITaxConfigurationDocument);
  }

  async save(config: TaxConfiguration): Promise<TaxConfiguration> {
    const data = toDocument(config);
    const doc = await TaxConfigurationModel.findOneAndUpdate(
      { tenantId: config.serialize().tenantId },
      { $set: data },
      { upsert: true, new: true },
    ).lean();
    return toDomain(doc as unknown as ITaxConfigurationDocument);
  }

  async initializeDefault(tenantId: string): Promise<TaxConfiguration> {
    const config = TaxConfiguration.create({
      tenantId,
      taxEnabled: true,
      pricingMode: 'exclusive',
      countryCode: 'ID',
      currency: 'IDR',
      rules: [
        TaxRule.create({
          name: 'PPN',
          type: 'percentage',
          rate: 12,
          calculationStrategy: 'indonesia_ppn_2025',
          taxBaseModifier: null,
          compoundOrder: 0,
          applyTo: 'all',
          categoryIds: [],
          productIds: [],
          exemptProductIds: [],
          exemptCustomerTags: [],
          isActive: true,
          metadata: {},
        }).serialize(),
      ],
      metadata: {},
    });
    return this.save(config);
  }

  async delete(tenantId: string): Promise<void> {
    await TaxConfigurationModel.deleteOne({ tenantId });
  }
}
