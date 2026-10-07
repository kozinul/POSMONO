import { Model, Document } from 'mongoose';
import { TenantId } from '../../../../@shared/domain/Identifier';
import { Tenant, ITenant } from '../../domain/Tenant';

interface TenantDoc extends Document<string> {
  _id: string;
  name: string;
  slug: string;
  domain: string | null;
  ownerId: string;
  plan: string;
  planId: string | null;
  status: string;
  subscriptionExpiresAt: Date | null;
  businessType: string;
  businessCategory: string;
  address: string;
  phone: string;
  modules: string[];
  databaseName: string;
  config: any;
  billingEmail: string;
  hubId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoTenantRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: TenantDoc): Tenant {
    return Tenant.hydrate({
      id: doc._id,
      name: doc.name,
      slug: doc.slug,
      domain: doc.domain,
      ownerId: doc.ownerId,
      plan: doc.plan,
      planId: doc.planId ?? null,
      status: doc.status as ITenant['status'],
      subscriptionExpiresAt: doc.subscriptionExpiresAt ?? null,
      businessType: doc.businessType as ITenant['businessType'],
      businessCategory: doc.businessCategory ?? '',
      address: doc.address ?? '',
      phone: doc.phone ?? '',
      modules: doc.modules,
      databaseName: doc.databaseName,
      config: doc.config,
      billingEmail: doc.billingEmail,
      hubId: doc.hubId ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    } as ITenant);
  }

  toPersistence(tenant: Tenant): Partial<TenantDoc> {
    const data = tenant.serialize();
    return {
      _id: data.id,
      name: data.name,
      slug: data.slug,
      domain: data.domain,
      ownerId: data.ownerId,
      plan: data.plan,
      planId: data.planId,
      status: data.status,
      subscriptionExpiresAt: data.subscriptionExpiresAt,
      businessType: data.businessType,
      businessCategory: data.businessCategory,
      address: data.address,
      phone: data.phone,
      modules: data.modules,
      databaseName: data.databaseName,
      config: data.config,
      billingEmail: data.billingEmail,
      hubId: data.hubId,
    } as unknown as Partial<TenantDoc>;
  }

  async save(tenant: Tenant, options?: { session?: any }): Promise<void> {
    const data = this.toPersistence(tenant);
    await this.model.findOneAndUpdate({ _id: tenant.id.toValue() }, data, {
      upsert: true,
      new: true,
      session: options?.session,
    });
    tenant.clearEvents();
  }

  async findById(id: string): Promise<Tenant | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async delete(id: string): Promise<boolean> {
    const res = await this.model.deleteOne({ _id: id }).exec();
    return (res.deletedCount ?? 0) > 0;
  }

  async findAll(): Promise<Tenant[]> {
    const docs = await this.model.find({}).sort({ name: 1 }).exec();
    return docs.map((doc: TenantDoc) => this.toDomain(doc));
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const doc = await this.model.findOne({ slug }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByDomain(domain: string): Promise<Tenant | null> {
    const doc = await this.model.findOne({ domain }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByHubId(hubId: string): Promise<Tenant[]> {
    const docs = await this.model.find({ hubId }).exec();
    return docs.map((doc: TenantDoc) => this.toDomain(doc));
  }

  /** Tenants whose active period has run out but are still usable: the sweep
   *  (`SubscriptionSweepService`) and the lazy gates only ever touch these —
   *  an admin-chosen `suspended/frozen/cancelled/deactivated` is never undone. */
  async findActiveExpired(before: Date): Promise<Tenant[]> {
    const docs = await this.model
      .find({
        status: { $in: ['active', 'trial'] },
        subscriptionExpiresAt: { $lt: before },
      })
      .exec();
    return docs.map((doc: TenantDoc) => this.toDomain(doc));
  }

  async list(options: {
    hubId?: string | null;
    search?: string;
    limit?: number;
    skip?: number;
  }): Promise<{ items: Tenant[]; total: number }> {
    const filter: any = {};
    if (options.hubId !== undefined && options.hubId !== null) {
      filter.hubId = options.hubId;
    }
    if (options.search && options.search.trim()) {
      const escaped = options.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'i');
      filter.$or = [{ name: re }, { slug: re }, { domain: re }];
    }

    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const skip = Math.max(options.skip ?? 0, 0);

    const [docs, total] = await Promise.all([
      this.model.find(filter).sort({ name: 1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return { items: docs.map((doc: TenantDoc) => this.toDomain(doc)), total };
  }
}
