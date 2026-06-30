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
  status: string;
  businessType: string;
  modules: string[];
  databaseName: string;
  config: { timezone: string; currency: string; locale: string };
  billingEmail: string;
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
      status: doc.status as ITenant['status'],
      businessType: doc.businessType as ITenant['businessType'],
      modules: doc.modules,
      databaseName: doc.databaseName,
      config: doc.config,
      billingEmail: doc.billingEmail,
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
      status: data.status,
      businessType: data.businessType,
      modules: data.modules,
      databaseName: data.databaseName,
      config: data.config,
      billingEmail: data.billingEmail,
    } as unknown as Partial<TenantDoc>;
  }

  async save(tenant: Tenant): Promise<void> {
    const data = this.toPersistence(tenant);
    await this.model.findOneAndUpdate({ _id: tenant.id.toValue() }, data, {
      upsert: true,
      new: true,
    });
    tenant.clearEvents();
  }

  async findById(id: string): Promise<Tenant | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
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
}
