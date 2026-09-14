import { Model, Document } from 'mongoose';
import { Plan, IPlan } from '../../domain/Plan';

interface PlanDoc extends Document<string> {
  _id: string;
  name: string;
  description: string;
  basePrice: number;
  billingCycle: 'monthly' | 'annual' | 'custom';
  isActive: boolean;
  isPublic: boolean;
  isDefault: boolean;
  sortOrder: number;
  modules: string[];
  limits: any;
  addOns: any[];
  createdAt: Date;
  updatedAt: Date;
}

export class MongoPlanRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: PlanDoc): Plan {
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    return Plan.hydrate({
      id: obj._id || obj.id,
      name: obj.name,
      description: obj.description || '',
      basePrice: obj.basePrice,
      billingCycle: obj.billingCycle,
      isActive: obj.isActive,
      isPublic: obj.isPublic,
      isDefault: obj.isDefault,
      sortOrder: obj.sortOrder,
      modules: obj.modules ? [...obj.modules] : [],
      limits: obj.limits ? { ...obj.limits } : {
        maxUsers: 5,
        maxProducts: 100,
        maxCategories: 20,
        maxOutlets: 1,
        maxOrdersPerMonth: 500,
        maxInventoryItems: 500,
        maxWarehouses: 1,
      },
      addOns: obj.addOns ? obj.addOns.map((a: any) => ({ ...a })) : [],
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    } as IPlan);
  }

  toPersistence(plan: Plan): Partial<PlanDoc> {
    const data = plan.serialize();
    return {
      _id: data.id,
      name: data.name,
      description: data.description,
      basePrice: data.basePrice,
      billingCycle: data.billingCycle,
      isActive: data.isActive,
      isPublic: data.isPublic,
      isDefault: data.isDefault,
      sortOrder: data.sortOrder,
      modules: data.modules,
      limits: data.limits,
      addOns: data.addOns,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  async findById(id: string): Promise<Plan | null> {
    const doc = await this.model.findById(id).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findByName(name: string): Promise<Plan | null> {
    const doc = await this.model.findOne({ name }).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findDefault(): Promise<Plan | null> {
    const doc = await this.model.findOne({ isDefault: true, isActive: true }).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findAll(isActiveOnly = false): Promise<Plan[]> {
    const query = isActiveOnly ? { isActive: true } : {};
    const docs = await this.model.find(query).sort({ sortOrder: 1, basePrice: 1 }).exec();
    return docs.map((doc: PlanDoc) => this.toDomain(doc));
  }

  async save(plan: Plan): Promise<void> {
    const persistence = this.toPersistence(plan);
    await this.model.findByIdAndUpdate(persistence._id, persistence, { upsert: true, new: true });
  }

  async delete(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id);
  }
}
