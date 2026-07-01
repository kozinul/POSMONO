import mongoose, { Schema, Document } from 'mongoose';

export interface ITaxTransactionRecordDocument extends Document {
  tenantId: string;
  orderId: string;
  ruleSnapshot: Record<string, unknown>[];
  result: {
    subtotal: number;
    discount: number;
    discountAmount: number;
    taxableAmount: number;
    taxes: Array<{
      name: string;
      type: string;
      rate: number;
      calculationStrategy: string;
      taxBaseModifier: string | null;
      baseAmount: number;
      amount: number;
      compoundOrder: number;
    }>;
    totalTax: number;
    serviceCharge: number;
    grandTotal: number;
    pricingMode: string;
  };
  calculationVersion: number;
  createdAt: Date;
}

const TaxBreakdownItemSchema = new Schema(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    rate: { type: Number, required: true },
    calculationStrategy: { type: String, default: 'standard_percentage' },
    taxBaseModifier: { type: String, default: null },
    baseAmount: { type: Number, required: true },
    amount: { type: Number, required: true },
    compoundOrder: { type: Number, default: 0 },
  },
  { _id: false },
);

const TaxTransactionRecordSchema = new Schema<ITaxTransactionRecordDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, index: true },
    ruleSnapshot: [{ type: Schema.Types.Mixed }],
    result: {
      subtotal: { type: Number, required: true },
      discount: { type: Number, default: 0 },
      discountAmount: { type: Number, default: 0 },
      taxableAmount: { type: Number, required: true },
      taxes: [TaxBreakdownItemSchema],
      totalTax: { type: Number, required: true },
      serviceCharge: { type: Number, default: 0 },
      grandTotal: { type: Number, required: true },
      pricingMode: { type: String, required: true },
    },
    calculationVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

TaxTransactionRecordSchema.index({ tenantId: 1, orderId: 1 }, { unique: true });

export { TaxTransactionRecordSchema };
export const TaxTransactionRecordModel = mongoose.model<ITaxTransactionRecordDocument>(
  'TaxTransactionRecord',
  TaxTransactionRecordSchema,
);
