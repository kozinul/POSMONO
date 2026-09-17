import { Schema } from 'mongoose';

const ModifierOptionSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    priceAdjustment: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
  },
  { _id: false },
);

export const ModifierSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    productId: { type: String, default: null },
    familyId: { type: String, default: null },
    name: { type: String, required: true },
    displayType: { type: String, enum: ['radio', 'checkbox', 'stepper'], default: 'radio' },
    minSelections: { type: Number, default: 0 },
    maxSelections: { type: Number, default: 1 },
    options: { type: [ModifierOptionSchema], default: [] },
    required: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'modifiers',
  },
);

ModifierSchema.index({ tenantId: 1, productId: 1 });
ModifierSchema.index({ tenantId: 1, familyId: 1 });
