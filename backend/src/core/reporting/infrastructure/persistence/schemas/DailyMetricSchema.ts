import { Schema } from 'mongoose';

const TopProductSchema = new Schema(
  {
    productId: { type: String, required: true },
    name: { type: String, required: true },
    total: { type: Number, required: true },
  },
  { _id: false },
);

export const DailyMetricSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    date: { type: String, required: true },
    metrics: {
      totalOrders: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
      totalCustomers: { type: Number, default: 0 },
      avgOrderValue: { type: Number, default: 0 },
      topProducts: { type: [TopProductSchema], default: [] },
      paymentMethodBreakdown: { type: Schema.Types.Mixed, default: {} },
    },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'daily_metrics',
  },
);

DailyMetricSchema.index({ tenantId: 1, date: 1 }, { unique: true });
