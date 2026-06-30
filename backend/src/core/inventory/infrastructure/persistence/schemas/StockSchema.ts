import { Schema } from 'mongoose';

export const StockSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    productId: { type: String, required: true },
    variantId: { type: String, default: null },
    warehouseId: { type: String, required: true },
    quantity: { type: Number, required: true, default: 0 },
    reservedQuantity: { type: Number, default: 0 },
    minLevel: { type: Number, default: 5 },
    maxLevel: { type: Number, default: 100 },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'stock_items',
  },
);

StockSchema.index({ tenantId: 1, productId: 1, variantId: 1, warehouseId: 1 }, { unique: true });
StockSchema.index({ tenantId: 1, quantity: 1 });
