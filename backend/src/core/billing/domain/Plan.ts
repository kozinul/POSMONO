import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { PlanId } from '../../../@shared/domain/Identifier';

export interface PlanLimits {
  maxUsers: number;
  maxProducts: number;
  maxCategories: number;
  maxOutlets: number;
  maxOrdersPerMonth: number;
  maxInventoryItems: number;
  maxWarehouses: number;
}

export interface PlanAddOn {
  id: string;
  name: string;
  description: string;
  price: number;
  type: 'module' | 'limit';
  value: string | number;
}

export interface IPlan {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  billingCycle: 'monthly' | 'annual' | 'custom';
  isActive: boolean;
  isPublic: boolean;
  isDefault: boolean;
  sortOrder: number;
  modules: string[];
  limits: PlanLimits;
  addOns: PlanAddOn[];
  createdAt: Date;
  updatedAt: Date;
}

export class Plan extends AggregateRoot<PlanId> {
  private name: string;
  private description: string;
  private basePrice: number;
  private billingCycle: 'monthly' | 'annual' | 'custom';
  private isActive: boolean;
  private isPublic: boolean;
  private isDefault: boolean;
  private sortOrder: number;
  private modules: string[];
  private limits: PlanLimits;
  private addOns: PlanAddOn[];
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IPlan) {
    super(new PlanId(props.id));
    this.name = props.name;
    this.description = props.description;
    this.basePrice = props.basePrice;
    this.billingCycle = props.billingCycle;
    this.isActive = props.isActive;
    this.isPublic = props.isPublic;
    this.isDefault = props.isDefault;
    this.sortOrder = props.sortOrder;
    this.modules = [...props.modules];
    this.limits = { ...props.limits };
    this.addOns = props.addOns.map((a) => ({ ...a }));
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<IPlan, 'id' | 'createdAt' | 'updatedAt'>): Plan {
    return new Plan({
      ...props,
      id: new PlanId().toValue(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static hydrate(props: IPlan): Plan {
    return new Plan(props);
  }

  serialize(): IPlan {
    return {
      id: this._id.toValue(),
      name: this.name,
      description: this.description,
      basePrice: this.basePrice,
      billingCycle: this.billingCycle,
      isActive: this.isActive,
      isPublic: this.isPublic,
      isDefault: this.isDefault,
      sortOrder: this.sortOrder,
      modules: [...this.modules],
      limits: { ...this.limits },
      addOns: this.addOns.map((a) => ({ ...a })),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  update(data: Partial<Omit<IPlan, 'id' | 'createdAt'>>): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.description !== undefined) this.description = data.description;
    if (data.basePrice !== undefined) this.basePrice = data.basePrice;
    if (data.billingCycle !== undefined) this.billingCycle = data.billingCycle;
    if (data.isActive !== undefined) this.isActive = data.isActive;
    if (data.isPublic !== undefined) this.isPublic = data.isPublic;
    if (data.isDefault !== undefined) this.isDefault = data.isDefault;
    if (data.sortOrder !== undefined) this.sortOrder = data.sortOrder;
    if (data.modules !== undefined) this.modules = [...data.modules];
    if (data.limits !== undefined) this.limits = { ...this.limits, ...data.limits };
    if (data.addOns !== undefined) this.addOns = data.addOns.map((a) => ({ ...a }));
    this.updatedAt = new Date();
  }

  setDefault(isDefault: boolean): void {
    this.isDefault = isDefault;
    this.updatedAt = new Date();
  }
}
