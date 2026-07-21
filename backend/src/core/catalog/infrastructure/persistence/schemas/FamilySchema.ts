import { Schema } from 'mongoose';

export const FamilySchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    menuType: { type: String, enum: ['food', 'beverage'], default: 'food', required: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'families',
  },
);

FamilySchema.index({ tenantId: 1, name: 1 }, { unique: true });
FamilySchema.index({ tenantId: 1, menuType: 1 });
