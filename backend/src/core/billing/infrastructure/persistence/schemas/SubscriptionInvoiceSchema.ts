import { Schema } from 'mongoose';

export const SubscriptionInvoiceSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    subscriptionId: { type: String, default: null, index: true },
    number: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'paid', 'overdue', 'cancelled'],
      default: 'pending',
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'IDR' },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    paidAt: { type: Date, default: null },
    lineItems: {
      type: [
        {
          description: { type: String, required: true },
          amount: { type: Number, required: true },
          quantity: { type: Number, required: true },
          total: { type: Number, required: true },
        },
      ],
      default: [],
    },
    referenceType: {
      type: String,
      enum: ['plan_assigned', 'plan_changed', 'renewal', 'extended'],
      required: true,
    },
    notes: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: 'subscription_invoices',
  },
);

// Per-tenant invoice numbers are unique; the counter is count+1 so an E11000
// (two sequential writes racing) retries with the next number.
SubscriptionInvoiceSchema.index({ tenantId: 1, number: 1 }, { unique: true });
SubscriptionInvoiceSchema.index({ tenantId: 1, createdAt: -1 });