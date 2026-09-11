import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { Identifier } from '../../../@shared/domain/Identifier';
import { DomainEvent } from '../../../@shared/domain/DomainEvent';

class OutletId extends Identifier {}

export interface IOutlet {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  phone: string;
  warehouseId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type OutletProps = Omit<IOutlet, 'id' | 'createdAt' | 'updatedAt'>;

export class Outlet extends AggregateRoot<OutletId> {
  private tenantId: string;
  private name: string;
  private address: string;
  private phone: string;
  private warehouseId: string | null;
  private isActive: boolean;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IOutlet) {
    super(new OutletId(props.id));
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.address = props.address;
    this.phone = props.phone;
    this.warehouseId = props.warehouseId;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: OutletProps): Outlet {
    const outlet = new Outlet({
      ...props,
      id: new OutletId().toValue(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    outlet.addDomainEvent(
      new DomainEvent({
        eventName: 'outlet.created',
        aggregateId: outlet.id.toValue(),
        aggregateType: 'Outlet',
        tenantId: outlet.tenantId,
        payload: { outletId: outlet.id.toValue(), name: outlet.name },
      }),
    );

    return outlet;
  }

  static hydrate(props: IOutlet): Outlet {
    return new Outlet(props);
  }

  update(data: Partial<Pick<IOutlet, 'name' | 'address' | 'phone' | 'warehouseId' | 'isActive'>>): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.address !== undefined) this.address = data.address;
    if (data.phone !== undefined) this.phone = data.phone;
    if (data.warehouseId !== undefined) this.warehouseId = data.warehouseId;
    if (data.isActive !== undefined) this.isActive = data.isActive;
    this.updatedAt = new Date();
  }

  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  assignWarehouse(warehouseId: string): void {
    this.warehouseId = warehouseId;
    this.updatedAt = new Date();
  }

  serialize(): IOutlet {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      name: this.name,
      address: this.address,
      phone: this.phone,
      warehouseId: this.warehouseId,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
