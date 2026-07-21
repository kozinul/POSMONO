import { Model, Document } from 'mongoose';
import { Setting, ISetting } from '../../domain/Setting';

interface SettingDoc extends Document<string> {
  _id: string;
  tenantId: string;
  key: string;
  value: unknown;
  category: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoSettingRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: SettingDoc): Setting {
    return Setting.hydrate({
      id: doc._id,
      tenantId: doc.tenantId,
      key: doc.key,
      value: doc.value,
      category: doc.category,
      description: doc.description,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    } as ISetting);
  }

  toPersistence(setting: Setting): Partial<SettingDoc> {
    const data = setting.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      key: data.key,
      value: data.value,
      category: data.category,
      description: data.description,
    } as unknown as Partial<SettingDoc>;
  }

  async save(setting: Setting): Promise<void> {
    const data = this.toPersistence(setting);
    await this.model.findOneAndUpdate({ _id: setting.id.toValue() }, data, {
      upsert: true,
      new: true,
    });
    setting.clearEvents();
  }

  async findByKey(tenantId: string, key: string): Promise<Setting | null> {
    const doc = await this.model.findOne({ tenantId, key }).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByTenant(tenantId: string, category?: string): Promise<Setting[]> {
    const filter: any = { tenantId };
    if (category) filter.category = category;

    const docs = await this.model.find(filter).sort({ key: 1 }).exec();
    return docs.map((d: SettingDoc) => this.toDomain(d));
  }

  async upsertByKey(tenantId: string, key: string, value: unknown, category?: string, description?: string): Promise<Setting> {
    const existing = await this.findByKey(tenantId, key);
    if (existing) {
      existing.updateValue(value);
      await this.save(existing);
      return existing;
    }

    const setting = Setting.create({
      tenantId,
      key,
      value,
      category: category ?? 'general',
      description: description ?? '',
    });

    await this.save(setting);
    return setting;
  }

  async deleteByKey(tenantId: string, key: string): Promise<void> {
    await this.model.findOneAndDelete({ tenantId, key }).exec();
  }
}
