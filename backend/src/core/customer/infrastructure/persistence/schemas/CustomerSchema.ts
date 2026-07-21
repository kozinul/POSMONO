import { Schema } from 'mongoose';

export const CustomerSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    isMember: { type: Boolean, default: false },
    totalVisits: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    lastVisitAt: { type: Date, default: null },
    tags: { type: [String], default: [] },
    preferences: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'customers',
  },
);

CustomerSchema.index({ tenantId: 1, phone: 1 });
CustomerSchema.index({ tenantId: 1, name: 'text', phone: 'text', email: 'text' });
