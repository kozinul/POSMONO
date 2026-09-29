import { Model, Document } from 'mongoose';
import {
  HubMemberTenantAccess,
  HubAccessStatus,
  IHubMemberTenantAccess,
} from '../../domain/HubMemberTenantAccess';
import { TenantAccessRole } from '../../../platform/defaults/roles';

interface HubMemberTenantAccessDoc extends Document<string> {
  _id: string;
  hubId: string;
  userId: string;
  tenantId: string;
  tenantRole: TenantAccessRole;
  outletIds: string[];
  status: HubAccessStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoHubMemberTenantAccessRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: HubMemberTenantAccessDoc): HubMemberTenantAccess {
    return HubMemberTenantAccess.hydrate({
      id: doc._id,
      hubId: doc.hubId,
      userId: doc.userId,
      tenantId: doc.tenantId,
      tenantRole: doc.tenantRole,
      outletIds: doc.outletIds ?? [],
      status: doc.status ?? 'active',
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }

  toPersistence(grant: HubMemberTenantAccess): Partial<HubMemberTenantAccessDoc> {
    const data = grant.serialize();
    return {
      _id: data.id,
      hubId: data.hubId,
      userId: data.userId,
      tenantId: data.tenantId,
      tenantRole: data.tenantRole,
      outletIds: data.outletIds,
      status: data.status,
    } as unknown as Partial<HubMemberTenantAccessDoc>;
  }

  async save(grant: HubMemberTenantAccess): Promise<void> {
    const data = this.toPersistence(grant);
    await this.model.findOneAndUpdate({ _id: grant.id.toValue() }, data, {
      upsert: true,
      new: true,
    });
    grant.clearEvents();
  }

  async findById(id: string): Promise<HubMemberTenantAccess | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByHubUserTenant(
    hubId: string,
    userId: string,
    tenantId: string,
  ): Promise<HubMemberTenantAccess | null> {
    const doc = await this.model.findOne({ hubId, userId, tenantId }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByHubAndUser(hubId: string, userId: string): Promise<HubMemberTenantAccess[]> {
    const docs = await this.model.find({ hubId, userId }).sort({ createdAt: -1 }).exec();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByUser(userId: string): Promise<HubMemberTenantAccess[]> {
    const docs = await this.model.find({ userId }).sort({ createdAt: -1 }).exec();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByHubAndTenant(hubId: string, tenantId: string): Promise<HubMemberTenantAccess[]> {
    const docs = await this.model.find({ hubId, tenantId }).exec();
    return docs.map((doc) => this.toDomain(doc));
  }

  async deleteByHubUserTenant(hubId: string, userId: string, tenantId: string): Promise<boolean> {
    const result = await this.model.deleteOne({ hubId, userId, tenantId }).exec();
    return result.deletedCount > 0;
  }
}
