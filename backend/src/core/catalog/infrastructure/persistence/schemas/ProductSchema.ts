import { Schema } from 'mongoose';

export const ProductSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    sku: { type: String, required: true },
    barcode: { type: String, default: '' },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    categoryId: { type: String, required: true },
    basePrice: { type: Number, required: true },
    pricingProfileId: { type: String },
    imageUrls: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'products',
  },
);

ProductSchema.index({ tenantId: 1, sku: 1 }, { unique: true });
ProductSchema.index({ tenantId: 1, barcode: 1 });
ProductSchema.index({ tenantId: 1, categoryId: 1 });
ProductSchema.index({ tenantId: 1, name: 'text' });
