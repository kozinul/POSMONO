import { Schema } from 'mongoose';

const gatewaySchema = new Schema(
  {
    provider: { type: String, default: null },
    txId: { type: String, default: null },
    vaNumber: { type: String, default: null },
    qrUrl: { type: String, default: null },
  },
  { _id: false },
);

export const PaymentAttemptSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    invoiceId: { type: String, required: true, index: true },
    number: { type: String, default: null },
    amount: { type: Number, required: true },
    method: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'completed', 'expired', 'failed'],
      default: 'pending',
      required: true,
      index: true,
    },
    gateway: { type: gatewaySchema, default: null },
    actorEmail: { type: String, default: null },
    notes: { type: String, default: null },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'payment_attempts',
  },
);

// One-to-many: an invoice can own many attempts, ordered by when they started.
// Deliberately no unique index on invoiceId — a failed/expired attempt must
// not block a later successful one.
PaymentAttemptSchema.index({ tenantId: 1, invoiceId: 1, startedAt: -1 });