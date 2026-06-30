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
    modules: { type: [String], default: [] },
    databaseName: { type: String, required: true },
    config: {
      timezone: { type: String, default: 'Asia/Jakarta' },
      currency: { type: String, default: 'IDR' },
      locale: { type: String, default: 'id' },
    },
    billingEmail: { type: String, required: true },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'tenants',
  },
);
