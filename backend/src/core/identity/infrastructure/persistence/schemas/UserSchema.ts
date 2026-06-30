import { Schema } from 'mongoose';

export const UserSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    email: { type: String, required: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true },
    roleId: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
    preferences: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'users',
  },
);

UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });
