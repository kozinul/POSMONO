import { Schema } from 'mongoose';

export const OutletSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    warehouseId: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'outlets',
  },
);

OutletSchema.index({ tenantId: 1, name: 1 }, { unique: true });
