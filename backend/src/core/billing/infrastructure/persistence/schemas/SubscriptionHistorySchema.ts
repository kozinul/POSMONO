import { Schema } from 'mongoose';

export const SubscriptionHistorySchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    subscriptionId: { type: String, default: null, index: true },
    action: { type: String, enum: ['assigned', 'changed', 'extended', 'cancelled', 'expired'], required: true, index: true },
    planId: { type: String, default: null },
    planName: { type: String, default: null },
    statusBefore: { type: String, default: null },
    statusAfter: { type: String, default: null },
    periodStartBefore: { type: Date, default: null },
    periodEndBefore: { type: Date, default: null },
    periodStartAfter: { type: Date, default: null },
    periodEndAfter: { type: Date, default: null },
    actorEmail: { type: String, default: null },
    reason: { type: String, default: null },
    at: { type: Date, required: true, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'subscription_history',
  },
);

SubscriptionHistorySchema.index({ tenantId: 1, at: -1 });