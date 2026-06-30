import { Schema } from 'mongoose';

export const ShiftSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    registerId: { type: String, required: true },
    cashierId: { type: String, required: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    openingBalance: { type: Number, required: true },
    closingBalance: { type: Number, default: null },
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
