import { Model, Document } from 'mongoose';
import { PricingProfile, IPricingProfile } from '../../domain/PricingProfile';
import { IPricingProfileRepository } from './IPricingProfileRepository';

export class MongoPricingProfileRepository implements IPricingProfileRepository {
  constructor(private readonly model: Model<IPricingProfile & Document>) {}

  private toDomain(doc: any): PricingProfile {
    return PricingProfile.hydrate(doc.toObject ? doc.toObject() : doc);
  }

  async findById(tenantId: string, id: string): Promise<PricingProfile | null> {
    const doc = await this.model.findOne({ _id: id, tenantId }).lean();
    return doc ? PricingProfile.hydrate(doc as any) : null;
  }

  async findByIds(tenantId: string, ids: string[]): Promise<PricingProfile[]> {
    const docs = await this.model.find({ _id: { $in: ids }, tenantId }).lean();
    return docs.map((doc: any) => PricingProfile.hydrate(doc));
  }

  async findByName(tenantId: string, name: string): Promise<PricingProfile | null> {
    const doc = await this.model.findOne({ tenantId, name }).lean();
    return doc ? PricingProfile.hydrate(doc as any) : null;
  }

  async findByTenant(tenantId: string): Promise<PricingProfile[]> {
    const docs = await this.model.find({ tenantId }).lean();
    return docs.map((doc: any) => PricingProfile.hydrate(doc));
  }

  async findDefault(tenantId: string): Promise<PricingProfile | null> {
    const doc = await this.model.findOne({ tenantId, isDefault: true }).lean();
    return doc ? PricingProfile.hydrate(doc as any) : null;
  }

  async save(profile: PricingProfile): Promise<void> {
    const data = profile.serialize();
    await this.model.findOneAndUpdate(
      { _id: data.id, tenantId: data.tenantId },
      { $set: data },
      { upsert: true, new: true },
    );
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.model.deleteOne({ _id: id, tenantId });
  }
}
