import { Schema } from 'mongoose';

export const PaymentSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    orderId: { type: String, required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    method: {
      type: String,
      enum: ['cash', 'qris', 'transfer', 'card'],
      required: true,
    },
    referenceNumber: { type: String, default: '' },
    metadata: { type: Schema.Types.Mixed, default: {} },
    paidAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'payments',
  },
);

PaymentSchema.index({ tenantId: 1, orderId: 1 }, { unique: true });
PaymentSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
