import { Model, Document } from 'mongoose';
import { Modifier, IModifier, IModifierOption, ModifierDisplayType } from '../../domain/Modifier';

interface ModifierDoc extends Document<string> {
  _id: string;
  tenantId: string;
  productId: string | null;
  familyId: string | null;
  name: string;
  displayType: ModifierDisplayType;
  minSelections: number;
  maxSelections: number;
  options: Array<{ id: string; name: string; priceAdjustment: number; isActive: boolean }>;
  required: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoModifierRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: ModifierDoc): Modifier {
    return Modifier.hydrate({
      id: doc._id,
      tenantId: doc.tenantId,
      productId: doc.productId,
      familyId: doc.familyId,
      name: doc.name,
      displayType: doc.displayType || 'radio',
      minSelections: doc.minSelections ?? 0,
      maxSelections: doc.maxSelections ?? 1,
      options: (doc.options || []).map((o) => ({
        id: o.id || '',
        name: o.name,
        priceAdjustment: o.priceAdjustment ?? (o as any).price ?? 0,
        isActive: o.isActive ?? true,
      })) as IModifierOption[],
      required: doc.required,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    } as IModifier);
  }

  toPersistence(modifier: Modifier): Partial<ModifierDoc> {
    const data = modifier.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      productId: data.productId,
      familyId: data.familyId,
      name: data.name,
      displayType: data.displayType,
      minSelections: data.minSelections,
      maxSelections: data.maxSelections,
      options: data.options,
      required: data.required,
      isActive: data.isActive,
    } as unknown as Partial<ModifierDoc>;
  }

  async save(modifier: Modifier): Promise<void> {
    const data = this.toPersistence(modifier);
    await this.model.findOneAndUpdate({ _id: modifier.id.toValue() }, data, {
      upsert: true,
      new: true,
    });
  }

  async findById(id: string): Promise<Modifier | null> {
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByTenant(tenantId: string): Promise<Modifier[]> {
    const docs = await this.model.find({ tenantId }).exec();
    return docs.map((d: ModifierDoc) => this.toDomain(d));
  }

  async findByProduct(productId: string): Promise<Modifier[]> {
    const docs = await this.model.find({ productId }).exec();
    return docs.map((d: ModifierDoc) => this.toDomain(d));
  }

  async findByFamily(familyId: string): Promise<Modifier[]> {
    const docs = await this.model.find({ familyId }).exec();
    return docs.map((d: ModifierDoc) => this.toDomain(d));
  }

  async findGlobal(tenantId: string): Promise<Modifier[]> {
    const docs = await this.model.find({ tenantId, productId: null }).exec();
    return docs.map((d: ModifierDoc) => this.toDomain(d));
  }

  async findByIds(tenantId: string, ids: string[]): Promise<Modifier[]> {
    const docs = await this.model.find({ _id: { $in: ids }, tenantId }).exec();
    return docs.map((d: ModifierDoc) => this.toDomain(d));
  }

  async delete(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id).exec();
  }
}
