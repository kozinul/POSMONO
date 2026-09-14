import { Plan } from '../../domain/Plan';
import { MongoPlanRepository } from '../../infrastructure/persistence/MongoPlanRepository';
import { ValidationError, NotFoundError } from '../../../../@shared/infrastructure/error/AppError';

export class PlanService {
  constructor(private readonly planRepository: MongoPlanRepository) {}

  async createPlan(data: {
    name: string;
    description?: string;
    basePrice: number;
    billingCycle?: 'monthly' | 'annual' | 'custom';
    isActive?: boolean;
    isPublic?: boolean;
    isDefault?: boolean;
    sortOrder?: number;
    modules?: string[];
    limits?: any;
    addOns?: any[];
  }): Promise<Plan> {
    const existing = await this.planRepository.findByName(data.name);
    if (existing) {
      throw new ValidationError(`Plan dengan nama "${data.name}" sudah ada.`);
    }

    if (data.isDefault) {
      const currentDefault = await this.planRepository.findDefault();
      if (currentDefault) {
        currentDefault.setDefault(false);
        await this.planRepository.save(currentDefault);
      }
    }

    const plan = Plan.create({
      name: data.name,
      description: data.description || '',
      basePrice: data.basePrice,
      billingCycle: data.billingCycle || 'monthly',
      isActive: data.isActive ?? true,
      isPublic: data.isPublic ?? true,
      isDefault: data.isDefault ?? false,
      sortOrder: data.sortOrder ?? 0,
      modules: data.modules || [],
      limits: data.limits || {
        maxUsers: 5,
        maxProducts: 100,
        maxCategories: 20,
        maxOutlets: 1,
        maxOrdersPerMonth: 500,
        maxInventoryItems: 500,
        maxWarehouses: 1,
      },
      addOns: data.addOns || [],
    });

    await this.planRepository.save(plan);
    return plan;
  }

  async updatePlan(id: string, data: Partial<any>): Promise<Plan> {
    const plan = await this.planRepository.findById(id);
    if (!plan) {
      throw new NotFoundError('Plan tidak ditemukan.');
    }

    if (data.name && data.name !== plan.serialize().name) {
      const existing = await this.planRepository.findByName(data.name);
      if (existing) {
        throw new ValidationError(`Plan dengan nama "${data.name}" sudah ada.`);
      }
    }

    if (data.isDefault) {
      const currentDefault = await this.planRepository.findDefault();
      if (currentDefault && currentDefault.serialize().id !== id) {
        currentDefault.setDefault(false);
        await this.planRepository.save(currentDefault);
      }
    }

    plan.update(data);
    await this.planRepository.save(plan);
    return plan;
  }

  async getPlan(id: string): Promise<Plan> {
    const plan = await this.planRepository.findById(id);
    if (!plan) {
      throw new NotFoundError('Plan tidak ditemukan.');
    }
    return plan;
  }

  async listPlans(isActiveOnly = false): Promise<Plan[]> {
    return this.planRepository.findAll(isActiveOnly);
  }

  async deletePlan(id: string): Promise<void> {
    const plan = await this.planRepository.findById(id);
    if (!plan) {
      throw new NotFoundError('Plan tidak ditemukan.');
    }
    if (plan.serialize().isDefault) {
      throw new ValidationError('Tidak dapat menghapus plan default.');
    }
    await this.planRepository.delete(id);
  }
}
