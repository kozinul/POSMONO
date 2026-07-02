import { IDiscountConfigurationRepository } from './IDiscountConfigurationRepository';
import { IDiscountConfiguration } from '../../domain/DiscountConfiguration';
import { DiscountConfigurationModel } from './schemas/DiscountConfigurationSchema';

export class MongoDiscountConfigurationRepository implements IDiscountConfigurationRepository {
  async findByTenantId(tenantId: string): Promise<IDiscountConfiguration | null> {
    const doc = await DiscountConfigurationModel.findOne({ tenantId }).exec();
    if (!doc) return null;
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    return {
      id: obj._id ?? obj.id,
      tenantId: obj.tenantId,
      enabled: obj.enabled,
      rules: obj.rules ?? [],
      createdAt: obj.createdAt ?? new Date(),
      updatedAt: obj.updatedAt ?? new Date(),
    } as IDiscountConfiguration;
  }

  async save(config: IDiscountConfiguration): Promise<void> {
    await DiscountConfigurationModel.findByIdAndUpdate(
      config.id,
      { $set: config },
      { upsert: true, new: true },
    ).exec();
  }

  async delete(id: string): Promise<void> {
    await DiscountConfigurationModel.findByIdAndDelete(id).exec();
  }
}
