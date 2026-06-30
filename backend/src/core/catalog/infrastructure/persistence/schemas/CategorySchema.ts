import { Schema } from 'mongoose';

export const CategorySchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    parentId: { type: String, default: null },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'categories',
  },
);

CategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });
