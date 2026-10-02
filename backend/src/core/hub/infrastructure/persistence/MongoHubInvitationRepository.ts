import { Model, Document } from 'mongoose';
import {
  HubInvitation,
  HUB_INVITATION_STATUSES,
  type HubInvitationStatus,
  type IHubInvitation,
} from '../../domain/HubInvitation';
import { HUB_MEMBER_ROLES, type HubMemberRole } from '../../domain/HubMembership';

interface HubInvitationDoc extends Document<string> {
  _id: string;
  hubId: string;
  email: string;
  role: HubMemberRole;
  tokenHash: string;
  expiresAt: Date;
  invitedBy: string;
  status: HubInvitationStatus;
  acceptedBy: string | null;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Both enums are written from the domain constants, so a legacy/hand-edited row
 *  cannot put the aggregate into a state its own methods would refuse. */
function resolveStatus(doc: HubInvitationDoc): HubInvitationStatus {
  const stored = doc.status;
  return stored && (HUB_INVITATION_STATUSES as readonly string[]).includes(stored)
    ? (stored as HubInvitationStatus)
    : 'expired';
}

function resolveRole(doc: HubInvitationDoc): HubMemberRole {
  const stored = doc.role;
  return stored && (HUB_MEMBER_ROLES as readonly string[]).includes(stored)
    ? (stored as HubMemberRole)
    : 'viewer';
}

export class MongoHubInvitationRepository {
  constructor(private readonly model: Model<HubInvitationDoc>) {}

  toDomain(doc: HubInvitationDoc): HubInvitation {
    return HubInvitation.hydrate({
      id: doc._id,
      hubId: doc.hubId,
      email: doc.email,
      role: resolveRole(doc),
      tokenHash: doc.tokenHash,
      expiresAt: doc.expiresAt,
      invitedBy: doc.invitedBy ?? '',
      status: resolveStatus(doc),
      acceptedBy: doc.acceptedBy ?? null,
      acceptedAt: doc.acceptedAt ?? null,
      revokedAt: doc.revokedAt ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    } as IHubInvitation);
  }

  toPersistence(invitation: HubInvitation): Partial<HubInvitationDoc> {
    const data = invitation.serialize();
    return {
      _id: data.id,
      hubId: data.hubId,
      email: data.email,
      role: data.role,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      invitedBy: data.invitedBy,
      status: data.status,
      acceptedBy: data.acceptedBy,
      acceptedAt: data.acceptedAt,
      revokedAt: data.revokedAt,
    } as unknown as Partial<HubInvitationDoc>;
  }

  async save(invitation: HubInvitation): Promise<void> {
    const data = this.toPersistence(invitation);
    await this.model.findOneAndUpdate({ _id: invitation.id.toValue() }, data, {
      upsert: true,
      new: true,
      runValidators: true,
    });
    invitation.clearEvents();
  }

  async findById(id: string): Promise<HubInvitation | null> {
    const doc = await this.model.findById(id).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<HubInvitation | null> {
    const doc = await this.model.findOne({ tokenHash }).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findPendingByHubAndEmail(hubId: string, email: string): Promise<HubInvitation | null> {
    const doc = await this.model.findOne({ hubId, email, status: 'pending' }).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findByHub(hubId: string): Promise<HubInvitation[]> {
    const docs = await this.model.find({ hubId }).sort({ createdAt: -1 }).exec();
    return docs.map((doc) => this.toDomain(doc));
  }

  async countUsablePendingByHub(hubId: string, now: Date): Promise<number> {
    // Expiry lives in the query, not in a post-filter: an invite that lapsed
    // while nobody opened the hub must not keep inflating the number.
    return this.model.countDocuments({ hubId, status: 'pending', expiresAt: { $gt: now } }).exec();
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }
}
