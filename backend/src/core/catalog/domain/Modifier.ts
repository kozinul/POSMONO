import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { Identifier } from '../../../@shared/domain/Identifier';
import { DomainEvent } from '../../../@shared/domain/DomainEvent';

class ModifierId extends Identifier {}

export interface IModifierOption {
  name: string;
  price: number;
}

export interface IModifier {
  id: string;
  tenantId: string;
  productId: string | null;
  familyId: string | null;
  name: string;
  options: IModifierOption[];
  required: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Modifier extends AggregateRoot<ModifierId> {
  private tenantId: string;
  private productId: string | null;
  private familyId: string | null;
  private name: string;
  private options: IModifierOption[];
  private required: boolean;
  private isActive: boolean;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IModifier) {
    super(new ModifierId(props.id));
    this.tenantId = props.tenantId;
    this.productId = props.productId;
    this.familyId = props.familyId;
    this.name = props.name;
    this.options = [...props.options];
    this.required = props.required;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<IModifier, 'id' | 'createdAt' | 'updatedAt'>): Modifier {
    const modifier = new Modifier({
      ...props,
      id: new ModifierId().toValue(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    modifier.addDomainEvent(
      new DomainEvent({
        eventName: 'catalog.modifier.created',
        aggregateId: modifier.id.toValue(),
        aggregateType: 'Modifier',
        tenantId: modifier.tenantId,
        payload: {
          modifierId: modifier.id.toValue(),
          name: modifier.name,
        },
      }),
    );

    return modifier;
  }

  static hydrate(props: IModifier): Modifier {
    return new Modifier(props);
  }

  update(data: Partial<Pick<IModifier, 'name' | 'options' | 'required' | 'isActive' | 'productId' | 'familyId'>>): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.options !== undefined) this.options = [...data.options];
    if (data.required !== undefined) this.required = data.required;
    if (data.isActive !== undefined) this.isActive = data.isActive;
    if (data.productId !== undefined) this.productId = data.productId;
    if (data.familyId !== undefined) this.familyId = data.familyId;
    this.updatedAt = new Date();
  }

  serialize(): IModifier {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      productId: this.productId,
      familyId: this.familyId,
      name: this.name,
      options: [...this.options],
      required: this.required,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
