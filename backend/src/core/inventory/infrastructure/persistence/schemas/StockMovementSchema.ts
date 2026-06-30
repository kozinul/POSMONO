import { Schema } from 'mongoose';

export const StockMovementSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },
    variantId: { type: String, default: null },
    warehouseId: { type: String, default: '' },
    type: {
      type: String,
      enum: ['in', 'out', 'adjustment', 'reserve', 'release'],
      required: true,
    },
    quantity: { type: Number, required: true },
    beforeQuantity: { type: Number, required: true },
    afterQuantity: { type: Number, required: true },
    referenceType: { type: String, default: '' },
    referenceId: { type: String, default: '' },
    notes: { type: String, default: '' },
    userId: { type: String, default: '' },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'stock_movements',
  },
);

StockMovementSchema.index({ tenantId: 1, productId: 1, createdAt: -1 });
StockMovementSchema.index({ tenantId: 1, createdAt: -1 });
StockMovementSchema.index({ tenantId: 1, type: 1 });
