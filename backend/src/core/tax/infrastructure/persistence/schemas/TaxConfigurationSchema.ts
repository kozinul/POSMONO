import mongoose, { Schema, Document } from 'mongoose';

export interface ITaxConfigurationDocument extends Document {
  tenantId: string;
  taxEnabled: boolean;
  pricingMode: string;
  countryCode: string;
  currency: string;
  rules: ITaxRuleEmbedded[];
  version: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITaxRuleEmbedded {
  name: string;
  type: string;
  rate: number;
  compoundOrder: number;
  calculationStrategy: string;
  taxBaseModifier: string | null;
  applyTo: string;
  categoryIds: string[];
  productIds: string[];
  exemptProductIds: string[];
  exemptCustomerTags: string[];
  isActive: boolean;
  metadata: Record<string, unknown>;
}

const TaxRuleEmbeddedSchema = new Schema<ITaxRuleEmbedded>(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['percentage', 'compound', 'category_based', 'product_based', 'exemption'],
      required: true,
    },
    rate: { type: Number, required: true, min: 0, max: 100 },
    compoundOrder: { type: Number, default: 0 },
    calculationStrategy: {
      type: String,
      enum: ['standard_percentage', 'indonesia_ppn_2025', 'compound'],
      default: 'standard_percentage',
    },
    taxBaseModifier: { type: String, default: null },
    applyTo: {
      type: String,
      enum: ['all', 'categories', 'products', 'exempt'],
      default: 'all',
    },
    categoryIds: [{ type: String }],
    productIds: [{ type: String }],
    exemptProductIds: [{ type: String }],
    exemptCustomerTags: [{ type: String }],
    isActive: { type: Boolean, default: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: true },
);

const TaxConfigurationSchema = new Schema<ITaxConfigurationDocument>(
  {
    tenantId: { type: String, required: true, unique: true, index: true },
    taxEnabled: { type: Boolean, default: true },
    pricingMode: {
      type: String,
      enum: ['inclusive', 'exclusive'],
      default: 'exclusive',
    },
    countryCode: { type: String, default: 'ID' },
    currency: { type: String, default: 'IDR' },
    rules: [TaxRuleEmbeddedSchema],
    version: { type: Number, default: 1 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export { TaxConfigurationSchema };
export const TaxConfigurationModel = mongoose.model<ITaxConfigurationDocument>(
  'TaxConfiguration',
  TaxConfigurationSchema,
);
