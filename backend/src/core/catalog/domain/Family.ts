import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { Identifier } from '../../../@shared/domain/Identifier';
import { DomainEvent } from '../../../@shared/domain/DomainEvent';

class FamilyId extends Identifier {}

export type MenuType = 'food' | 'beverage';

export interface IFamily {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  menuType: MenuType;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Family extends AggregateRoot<FamilyId> {
  private tenantId: string;
  private name: string;
  private description: string;
  private menuType: MenuType;
  private sortOrder: number;
  private isActive: boolean;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IFamily) {
    super(new FamilyId(props.id));
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.description = props.description;
    this.menuType = props.menuType;
    this.sortOrder = props.sortOrder;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<IFamily, 'id' | 'createdAt' | 'updatedAt'>): Family {
    const family = new Family({
      ...props,
      menuType: props.menuType ?? 'food',
      id: new FamilyId().toValue(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    family.addDomainEvent(
      new DomainEvent({
        eventName: 'catalog.family.created',
        aggregateId: family.id.toValue(),
        aggregateType: 'Family',
        tenantId: family.tenantId,
        payload: {
          familyId: family.id.toValue(),
          name: family.name,
        },
      }),
    );

    return family;
  }

  static hydrate(props: IFamily): Family {
    return new Family(props);
  }

  update(data: Partial<Pick<IFamily, 'name' | 'description' | 'menuType' | 'sortOrder' | 'isActive'>>): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.description !== undefined) this.description = data.description;
    if (data.menuType !== undefined) this.menuType = data.menuType;
    if (data.sortOrder !== undefined) this.sortOrder = data.sortOrder;
    if (data.isActive !== undefined) this.isActive = data.isActive;
    this.updatedAt = new Date();
  }

  serialize(): IFamily {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      name: this.name,
      description: this.description,
      menuType: this.menuType,
      sortOrder: this.sortOrder,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
