import { Schema } from 'mongoose';
import { HUB_MEMBER_ROLES, HUB_MEMBERSHIP_STATUSES } from '../../../domain/HubMembership';

export const HubMembershipSchema = new Schema(
  {
    _id: { type: String },
    hubId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    // Derived from the domain constant — Fase 16 added `manager` and a hand-written
    // enum here would silently drift (Mongoose does not run validators on
    // findOneAndUpdate, so a stale enum fails at read time, not write time).
    role: { type: String, enum: [...HUB_MEMBER_ROLES], required: true },
    // No `default` on purpose. A `default: 'active'` would resurrect legacy
    // documents that were meant to be left untouched on every save, and this
    // field only earns a value when a suspension is actually recorded.
    status: { type: String, enum: [...HUB_MEMBERSHIP_STATUSES] },
    suspendedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'hubmemberships',
  },
);

HubMembershipSchema.index({ hubId: 1, userId: 1 }, { unique: true });