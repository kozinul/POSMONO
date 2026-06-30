import { Schema } from 'mongoose';

export const WarehouseSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    address: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'warehouses',
  },
);

WarehouseSchema.index({ tenantId: 1, name: 1 }, { unique: true });
