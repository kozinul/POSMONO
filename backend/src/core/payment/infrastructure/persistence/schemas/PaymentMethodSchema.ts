import { Schema } from 'mongoose';

export const PaymentMethodSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: String, default: '' },
    color: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    requiresReference: { type: Boolean, default: false },
    config: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'payment_methods',
  },
);

PaymentMethodSchema.index({ tenantId: 1, code: 1 }, { unique: true });
PaymentMethodSchema.index({ tenantId: 1, isActive: 1 });
