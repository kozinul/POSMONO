import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { WarehouseId } from '../../../@shared/domain/Identifier';
import { DomainEvent } from '../../../@shared/domain/DomainEvent';

export interface IWarehouse {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Warehouse extends AggregateRoot<WarehouseId> {
  private tenantId: string;
  private name: string;
  private address: string;
  private isActive: boolean;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IWarehouse) {
    super(new WarehouseId(props.id));
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.address = props.address;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<IWarehouse, 'id' | 'createdAt' | 'updatedAt'>): Warehouse {
    const warehouse = new Warehouse({
      ...props,
      id: new WarehouseId().toValue(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    warehouse.addDomainEvent(
      new DomainEvent({
        eventName: 'inventory.warehouse.created',
        aggregateId: warehouse.id.toValue(),
        aggregateType: 'Warehouse',
        tenantId: warehouse.tenantId,
        payload: {
          warehouseId: warehouse.id.toValue(),
          name: warehouse.name,
        },
      }),
    );

    return warehouse;
  }

  static hydrate(props: IWarehouse): Warehouse {
    return new Warehouse(props);
  }

  update(data: Partial<Pick<IWarehouse, 'name' | 'address' | 'isActive'>>): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.address !== undefined) this.address = data.address;
    if (data.isActive !== undefined) this.isActive = data.isActive;
    this.updatedAt = new Date();
  }

  serialize(): IWarehouse {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      name: this.name,
      address: this.address,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
