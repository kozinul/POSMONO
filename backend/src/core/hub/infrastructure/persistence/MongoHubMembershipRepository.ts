import { Model, Document } from 'mongoose';
import { HubMembership, HubMemberRole, IHubMembership } from '../../domain/HubMembership';

interface HubMembershipDoc extends Document<string> {
  _id: string;
  hubId: string;
  userId: string;
  role: HubMemberRole;
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
      role: doc.role,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }

  toPersistence(membership: HubMembership): Partial<HubMembershipDoc> {
    const data = membership.serialize();
    return {
      _id: data.id,
      hubId: data.hubId,
      userId: data.userId,
      role: data.role,
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