import { Schema } from 'mongoose';

export const RoleSchema = new Schema(
  {
    _id: { type: String },
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'roles',
  },
);

RoleSchema.index({ tenantId: 1, name: 1 }, { unique: true });
