import { Schema } from 'mongoose';

export const TenantSchema = new Schema(
  {
    _id: { type: String },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    domain: { type: String, default: null },
    ownerId: { type: String, required: true },
    plan: { type: String, default: 'starter' },
    status: {
      type: String,
      enum: ['active', 'suspended', 'trial', 'cancelled'],
      default: 'trial',
    },
    businessType: {
      type: String,
      enum: ['retail', 'restaurant', 'hospitality', 'mixed'],
      required: true,
    },
    businessCategory: { type: String, default: '' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    modules: { type: [String], default: [] },
    databaseName: { type: String, required: true },
    config: {
      timezone: { type: String, default: 'Asia/Jakarta' },
      currency: { type: String, default: 'IDR' },
      locale: { type: String, default: 'id' },
      taxRate: { type: Number, default: 0.1 },
      taxName: { type: String, default: 'Pajak' },
      ppnEnabled: { type: Boolean, default: true },
      ppnRate: { type: Number, default: 0.12 },
      serviceChargeEnabled: { type: Boolean, default: false },
      serviceChargeRate: { type: Number, default: 0 },
      serviceChargeName: { type: String, default: 'Service Charge' },
      discountMaxPercent: { type: Number, default: 100 },
      discountMaxNominal: { type: Number, default: 1_000_000 },
      receiptFooter: { type: String, default: 'Terima kasih telah berbelanja' },
    },
    billingEmail: { type: String, required: true },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'tenants',
  },
);
