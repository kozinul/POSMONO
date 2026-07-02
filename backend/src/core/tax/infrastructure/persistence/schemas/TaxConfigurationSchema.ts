import { Schema } from 'mongoose';

const ModifierConfigSchema = new Schema({
  numerator: { type: Number },
  denominator: { type: Number },
  multiplier: { type: Number },
  deduction: { type: Number },
}, { _id: false });

const TaxRuleSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  taxType: { type: String, required: true, enum: ['vat', 'withholding', 'service_charge', 'custom', 'exemption'] },
  scope: {
    type: { type: String, required: true, enum: ['all', 'category', 'product', 'outlet', 'transaction_type', 'customer', 'service_type'] },
    entityId: { type: String, default: '' },
    entityName: { type: String, default: '' },
  },
  policy: {
    type: { type: String, required: true, enum: ['rate', 'amount', 'percentage_of_base', 'formula'] },
    value: { type: Number, required: true },
    roundingMode: { type: String, default: 'round', enum: ['round', 'floor', 'ceil'] },
    precision: { type: Number, default: 2 },
  },
  modifier: {
    type: { type: String, enum: ['none', 'fraction', 'multiplier', 'fixed_deduction'] },
    config: { type: ModifierConfigSchema },
  },
  priority: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  effectiveDate: { type: Date, required: true },
  expiresAt: { type: Date },
  conditions: {
    amountOperator: { type: String, enum: ['greater_than', 'less_than', 'equals', 'greater_or_equal', 'less_or_equal'] },
    amountThreshold: { type: Number },
    categoryIds: [{ type: String }],
    productIds: [{ type: String }],
    customerTypes: [{ type: String }],
  },
  metadata: { type: Schema.Types.Mixed },
}, { _id: false });

const TaxVersionSchema = new Schema({
  id: { type: String, required: true },
  versionNumber: { type: Number, required: true },
  effectiveDate: { type: Date, required: true },
  rules: [TaxRuleSchema],
  status: { type: String, required: true, enum: ['draft', 'active', 'deprecated'] },
  createdAt: { type: Date, required: true },
  deprecatedAt: { type: Date },
}, { _id: false });

export const TaxConfigurationSchema = new Schema(
  {
    id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    taxEnabled: { type: Boolean, default: true },
    pricingMode: { type: String, default: 'exclusive', enum: ['inclusive', 'exclusive'] },
    countryCode: { type: String, default: 'ID' },
    currency: { type: String, default: 'IDR' },
    activeVersionId: { type: String },
    versions: [TaxVersionSchema],
    metadata: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    _id: false,
    collection: 'taxconfigurations',
  },
);

TaxConfigurationSchema.index({ tenantId: 1 }, { unique: true });
