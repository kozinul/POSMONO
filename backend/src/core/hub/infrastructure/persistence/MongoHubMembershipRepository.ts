import { Model, Document } from 'mongoose';
import {
  HubMembership,
  HUB_MEMBERSHIP_STATUSES,
  HUB_MEMBER_ROLES,
  type HubMemberRole,
  type HubMembershipStatus,
  type IHubMembership,
} from '../../domain/HubMembership';

interface HubMembershipDoc extends Document<string> {
  _id: string;
  hubId: string;
  userId: string;
  role: HubMemberRole;
  status?: HubMembershipStatus;
  suspendedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoHubMembershipRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: HubMembershipDoc): HubMembership {
    return HubMembership.hydrate({
      id: doc._id,
      hubId: doc.hubId,
      userId: doc.userId,
      // Fase 20: every membership written before `status` existed is active, so
      // an absent (or hand-corrupted) value must not be read as a suspension.
      role: resolveRole(doc),
      status: resolveStatus(doc),
      suspendedAt: doc.suspendedAt ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    } as IHubMembership);
  }

  toPersistence(membership: HubMembership): Partial<HubMembershipDoc> {
    const data = membership.serialize();
    return {
      _id: data.id,
      hubId: data.hubId,
      userId: data.userId,
      role: data.role,
      status: data.status,
      suspendedAt: data.suspendedAt,
    } as unknown as Partial<HubMembershipDoc>;
  }

  async save(membership: HubMembership): Promise<void> {
    const data = this.toPersistence(membership);
    await this.model.findOneAndUpdate({ _id: membership.id.toValue() }, data, {
      upsert: true,
      new: true,
      runValidators: true,
    });
    membership.clearEvents();
  }

  async findById(id: string): Promise<HubMembership | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByHubAndUser(hubId: string, userId: string): Promise<HubMembership | null> {
    const doc = await this.model.findOne({ hubId, userId }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByHub(hubId: string): Promise<HubMembership[]> {
    const docs = await this.model.find({ hubId }).sort({ createdAt: -1 }).exec();
    return docs.map((doc: HubMembershipDoc) => this.toDomain(doc));
  }

  async findByUser(userId: string): Promise<HubMembership[]> {
    const docs = await this.model.find({ userId }).sort({ createdAt: -1 }).exec();
    return docs.map((doc: HubMembershipDoc) => this.toDomain(doc));
  }

  async deleteByHubAndUser(hubId: string, userId: string): Promise<boolean> {
    const result = await this.model.deleteOne({ hubId, userId }).exec();
    return result.deletedCount > 0;
  }
}

function resolveStatus(doc: HubMembershipDoc): HubMembershipStatus {
  const stored = doc.status;
  return stored && (HUB_MEMBERSHIP_STATUSES as readonly string[]).includes(stored)
    ? (stored as HubMembershipStatus)
    : 'active';
}

function resolveRole(doc: HubMembershipDoc): HubMemberRole {
  const stored = doc.role;
  return stored && (HUB_MEMBER_ROLES as readonly string[]).includes(stored)
    ? (stored as HubMemberRole)
    : 'viewer';
}
