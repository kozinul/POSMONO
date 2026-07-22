import { Schema } from 'mongoose';

export const RefundSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    paymentId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    reason: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    refundedBy: { type: String, default: '' },
    refundedByName: { type: String, default: '' },
    refundedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'refunds',
  },
);

RefundSchema.index({ tenantId: 1, paymentId: 1 });
RefundSchema.index({ tenantId: 1, orderId: 1 });
RefundSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
