import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { CustomerId } from '../../../@shared/domain/Identifier';
import { DomainEvent } from '../../../@shared/domain/DomainEvent';

export interface ICustomer {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  isMember: boolean;
  totalVisits: number;
  totalSpent: number;
  lastVisitAt: Date | null;
  tags: string[];
  preferences: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class Customer extends AggregateRoot<CustomerId> {
  private tenantId: string;
  private name: string;
  private phone: string;
  private email: string;
  private address: string;
  private isMember: boolean;
  private totalVisits: number;
  private totalSpent: number;
  private lastVisitAt: Date | null;
  private tags: string[];
  private preferences: Record<string, unknown>;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: ICustomer) {
    super(new CustomerId(props.id));
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.phone = props.phone;
    this.email = props.email;
    this.address = props.address;
    this.isMember = props.isMember;
    this.totalVisits = props.totalVisits;
    this.totalSpent = props.totalSpent;
    this.lastVisitAt = props.lastVisitAt;
    this.tags = [...props.tags];
    this.preferences = { ...props.preferences };
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<ICustomer, 'id' | 'totalVisits' | 'totalSpent' | 'lastVisitAt' | 'createdAt' | 'updatedAt'>): Customer {
    const customer = new Customer({
      ...props,
      id: new CustomerId().toValue(),
      totalVisits: 0,
      totalSpent: 0,
      lastVisitAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    customer.addDomainEvent(
      new DomainEvent({
        eventName: 'customer.profile.created',
        aggregateId: customer.id.toValue(),
        aggregateType: 'Customer',
        tenantId: customer.tenantId,
        payload: { customerId: customer.id.toValue(), name: customer.name },
      }),
    );

    return customer;
  }

  static hydrate(props: ICustomer): Customer {
    return new Customer(props);
  }

  recordVisit(amount: number): void {
    this.totalVisits += 1;
    this.totalSpent += amount;
    this.lastVisitAt = new Date();
    this.updatedAt = new Date();
  }

  serialize(): ICustomer {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      name: this.name,
      phone: this.phone,
      email: this.email,
      address: this.address,
      isMember: this.isMember,
      totalVisits: this.totalVisits,
      totalSpent: this.totalSpent,
      lastVisitAt: this.lastVisitAt,
      tags: [...this.tags],
      preferences: { ...this.preferences },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
