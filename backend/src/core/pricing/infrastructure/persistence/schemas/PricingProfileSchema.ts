import { Schema } from 'mongoose';

export const PricingProfileSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    taxRuleIds: { type: [String], default: [] },
    isDefault: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'pricingprofiles',
  },
);

PricingProfileSchema.index({ tenantId: 1, name: 1 });
