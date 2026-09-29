import { Schema } from 'mongoose';
import { HUB_MEMBER_ROLES } from '../../../domain/HubMembership';

export const HubMembershipSchema = new Schema(
  {
    _id: { type: String },
    hubId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    // Derived from the domain constant — Fase 16 added `manager` and a hand-written
    // enum here would silently drift (Mongoose does not run validators on
    // findOneAndUpdate, so a stale enum fails at read time, not write time).
    role: { type: String, enum: [...HUB_MEMBER_ROLES], required: true },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'hubmemberships',
  },
);

HubMembershipSchema.index({ hubId: 1, userId: 1 }, { unique: true });