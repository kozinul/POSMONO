import { Schema } from 'mongoose';

const ModifierOptionSchema = new Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
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
