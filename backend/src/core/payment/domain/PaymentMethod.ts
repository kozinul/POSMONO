import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { Identifier } from '../../../@shared/domain/Identifier';
import { DomainEvent } from '../../../@shared/domain/DomainEvent';

class PaymentMethodId extends Identifier {}

export interface IPaymentMethod {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  requiresReference: boolean;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class PaymentMethod extends AggregateRoot<PaymentMethodId> {
  private tenantId: string;
  private name: string;
  private code: string;
  private description: string;
  private icon: string;
  private color: string;
  private sortOrder: number;
  private isActive: boolean;
  private requiresReference: boolean;
  private config: Record<string, unknown>;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IPaymentMethod) {
    super(new PaymentMethodId(props.id));
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.code = props.code;
    this.description = props.description;
    this.icon = props.icon;
    this.color = props.color;
    this.sortOrder = props.sortOrder;
    this.isActive = props.isActive;
    this.requiresReference = props.requiresReference;
    this.config = { ...props.config };
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<IPaymentMethod, 'id' | 'createdAt' | 'updatedAt'>): PaymentMethod {
    const method = new PaymentMethod({
      ...props,
      id: new PaymentMethodId().toValue(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    method.addDomainEvent(
      new DomainEvent({
        eventName: 'payment.method.created',
        aggregateId: method.id.toValue(),
        aggregateType: 'PaymentMethod',
        tenantId: method.tenantId,
        payload: {
          paymentMethodId: method.id.toValue(),
          name: method.name,
          code: method.code,
        },
      }),
    );

    return method;
  }

  static hydrate(props: IPaymentMethod): PaymentMethod {
    return new PaymentMethod(props);
  }

  update(data: Partial<Pick<IPaymentMethod, 'name' | 'description' | 'icon' | 'color' | 'sortOrder' | 'isActive' | 'requiresReference' | 'config'>>): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.description !== undefined) this.description = data.description;
    if (data.icon !== undefined) this.icon = data.icon;
    if (data.color !== undefined) this.color = data.color;
    if (data.sortOrder !== undefined) this.sortOrder = data.sortOrder;
    if (data.isActive !== undefined) this.isActive = data.isActive;
    if (data.requiresReference !== undefined) this.requiresReference = data.requiresReference;
    if (data.config !== undefined) this.config = { ...data.config };
    this.updatedAt = new Date();
  }

  serialize(): IPaymentMethod {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      name: this.name,
      code: this.code,
      description: this.description,
      icon: this.icon,
      color: this.color,
      sortOrder: this.sortOrder,
      isActive: this.isActive,
      requiresReference: this.requiresReference,
      config: { ...this.config },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
