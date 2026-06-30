import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { Identifier } from '../../../@shared/domain/Identifier';
import { DomainEvent } from '../../../@shared/domain/DomainEvent';

class StockId extends Identifier {}

export interface IStock {
  id: string;
  tenantId: string;
  productId: string;
  variantId: string | null;
  warehouseId: string;
  quantity: number;
  reservedQuantity: number;
  minLevel: number;
  maxLevel: number;
  updatedAt: Date;
}

export class Stock extends AggregateRoot<StockId> {
  private tenantId: string;
  private productId: string;
  private variantId: string | null;
  private warehouseId: string;
  private quantity: number;
  private reservedQuantity: number;
  private minLevel: number;
  private maxLevel: number;
  private updatedAt: Date;

  private constructor(props: IStock) {
    super(new StockId(props.id));
    this.tenantId = props.tenantId;
    this.productId = props.productId;
    this.variantId = props.variantId;
    this.warehouseId = props.warehouseId;
    this.quantity = props.quantity;
    this.reservedQuantity = props.reservedQuantity;
    this.minLevel = props.minLevel;
    this.maxLevel = props.maxLevel;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<IStock, 'id' | 'updatedAt'>): Stock {
    return new Stock({
      ...props,
      id: new StockId().toValue(),
      updatedAt: new Date(),
    });
  }

  static hydrate(props: IStock): Stock {
    return new Stock(props);
  }

  reserve(quantity: number): void {
    if (this.availableQuantity < quantity) {
      throw new Error('Insufficient stock');
    }
    this.reservedQuantity += quantity;
    this.updatedAt = new Date();
  }

  release(quantity: number): void {
    this.reservedQuantity = Math.max(0, this.reservedQuantity - quantity);
    this.updatedAt = new Date();
  }

  adjust(delta: number, reason: string): void {
    this.quantity += delta;
    this.updatedAt = new Date();

    this.addDomainEvent(
      new DomainEvent({
        eventName: 'inventory.stock.adjusted',
        aggregateId: this.id.toValue(),
        aggregateType: 'Stock',
        tenantId: this.tenantId,
        payload: { productId: this.productId, delta, reason },
      }),
    );

    if (this.quantity <= this.minLevel) {
      this.addDomainEvent(
        new DomainEvent({
          eventName: 'inventory.stock.low_alert',
          aggregateId: this.id.toValue(),
          aggregateType: 'Stock',
          tenantId: this.tenantId,
          payload: {
            productId: this.productId,
            currentStock: this.quantity,
            minLevel: this.minLevel,
          },
        }),
      );
    }
  }

  get availableQuantity(): number {
    return this.quantity - this.reservedQuantity;
  }

  serialize(): IStock {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      productId: this.productId,
      variantId: this.variantId,
      warehouseId: this.warehouseId,
      quantity: this.quantity,
      reservedQuantity: this.reservedQuantity,
      minLevel: this.minLevel,
      maxLevel: this.maxLevel,
      updatedAt: this.updatedAt,
    };
  }
}
