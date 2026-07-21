import { Schema } from 'mongoose';

const SplitBillSchema = new Schema(
  {
    portion: { type: Number, required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['cash', 'qris', 'transfer', 'card'], required: true },
    referenceNumber: { type: String, default: '' },
  },
  { _id: false },
);

const RefundSchema = new Schema(
  {
    _id: { type: String },
    paymentId: { type: String, required: true },
    orderId: { type: String, required: true },
    amount: { type: Number, required: true },
    reason: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    refundedBy: { type: String, default: '' },
    refundedByName: { type: String, default: '' },
    refundedAt: { type: Date, default: null },
  },
  { _id: false, timestamps: true },
);

export { RefundSchema };

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
    splitBills: { type: [SplitBillSchema], default: [] },
    qrCodeUrl: { type: String, default: null },
    paymentTransactionId: { type: String, default: null },
    provider: { type: String, default: null },
    cardLastFour: { type: String, default: null },
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
