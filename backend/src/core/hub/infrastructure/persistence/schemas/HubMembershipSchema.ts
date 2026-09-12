import { Schema } from 'mongoose';

export const HubMembershipSchema = new Schema(
  {
    _id: { type: String },
    hubId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: ['owner', 'admin', 'viewer'], required: true },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'hubmemberships',
  },
);

HubMembershipSchema.index({ hubId: 1, userId: 1 }, { unique: true });