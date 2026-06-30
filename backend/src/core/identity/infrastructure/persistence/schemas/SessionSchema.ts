import { Schema } from 'mongoose';

export const SessionSchema = new Schema(
  {
    _id: { type: String },
    userId: { type: String, required: true, index: true },
    tenantId: { type: String, required: true, index: true },
    refreshToken: { type: String, required: true },
    userAgent: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'sessions',
  },
);

SessionSchema.index({ refreshToken: 1 }, { unique: true });
SessionSchema.index({ userId: 1, isActive: 1 });
