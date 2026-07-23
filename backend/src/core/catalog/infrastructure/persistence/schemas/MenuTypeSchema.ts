import { Schema } from 'mongoose';

export const MenuTypeSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'menu_types',
  },
);

MenuTypeSchema.index({ tenantId: 1, name: 1 }, { unique: true });
