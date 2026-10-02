import { Schema } from 'mongoose';
import { HUB_INVITATION_STATUSES } from '../../../domain/HubInvitation';
import { HUB_MEMBER_ROLES } from '../../../domain/HubMembership';

export const HubInvitationSchema = new Schema(
  {
    _id: { type: String },
    hubId: { type: String, required: true, index: true },
    /** Stored normalised — the duplicate guard and the accept-time check both rely on it. */
    email: { type: String, required: true },
    role: { type: String, enum: [...HUB_MEMBER_ROLES], required: true },
    /** SHA-256 of the token; the raw token is never written. */
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    invitedBy: { type: String, default: '' },
    status: { type: String, enum: [...HUB_INVITATION_STATUSES], required: true },
    acceptedBy: { type: String, default: null },
    acceptedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    _id: false,
    collection: 'hubinvitations',
  },
);

// Redemption is a single lookup by digest; without this it is a collection scan.
HubInvitationSchema.index({ tokenHash: 1 }, { unique: true });
// "One open invitation per address per hub." The service checks this too — the
// index is what makes it true under two concurrent admin submits.
HubInvitationSchema.index({ hubId: 1, email: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });
// The invitations tab reads one hub's history, newest first.
HubInvitationSchema.index({ hubId: 1, createdAt: -1 });
