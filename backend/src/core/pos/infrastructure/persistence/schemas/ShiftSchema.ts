import { Schema } from 'mongoose';

const CashPickupSchema = new Schema(
  {
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    pickedAt: { type: Date, required: true },
    pickedBy: { type: String, required: true },
  },
  { _id: false },
);

const PaymentBreakdownEntrySchema = new Schema(
  {
    method: { type: String, required: true },
    code: { type: String, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false },
);

export const ShiftSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    registerId: { type: String, required: true },
    cashierId: { type: String, required: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    openingBalance: { type: Number, required: true },
    closingBalance: { type: Number, default: null },
    physicalCash: { type: Number, default: null },
    expectedCash: { type: Number, default: null },
    totalCashPickups: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 },
    cashSales: { type: Number, default: 0 },
    nonCashSales: { type: Number, default: 0 },
    totalTransactions: { type: Number, default: 0 },
    paymentBreakdown: { type: [PaymentBreakdownEntrySchema], default: [] },
    cashPickups: { type: [CashPickupSchema], default: [] },
    expectedTotal: { type: Number, default: null },
    actualTotal: { type: Number, default: null },
    openedAt: { type: Date },
    closedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'shifts',
  },
);

ShiftSchema.index({ tenantId: 1, status: 1 });
ShiftSchema.index({ tenantId: 1, cashierId: 1, status: 1 });
