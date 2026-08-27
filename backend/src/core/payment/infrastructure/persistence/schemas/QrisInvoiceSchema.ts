import { Schema } from 'mongoose';

export const QrisInvoiceSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true },
    referenceNumber: { type: String, required: true },
    invid: { type: String, default: null },
    amount: { type: Number, required: true },
    trxDate: { type: String, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    _id: false,
    collection: 'qris_invoices',
  },
);

QrisInvoiceSchema.index({ tenantId: 1, referenceNumber: 1 }, { unique: true });
