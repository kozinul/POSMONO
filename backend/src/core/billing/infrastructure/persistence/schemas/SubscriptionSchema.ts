import { Schema } from 'mongoose';

export const SubscriptionSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, unique: true, index: true },
    planId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['active', 'past_due', 'cancelled', 'expired', 'trial'],
      required: true,
      default: 'trial',
      index: true,
    },
    billingCycle: { type: String, enum: ['monthly', 'annual', 'custom'], required: true, default: 'monthly' },
    currentPeriodStart: { type: Date, required: true, default: Date.now },
    currentPeriodEnd: { type: Date, required: true },
    startedAt: { type: Date, default: null },
    trialEndsAt: { type: Date, default: null },
    autoRenew: { type: Boolean, default: false },
    assignedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: 'subscriptions',
  },
);