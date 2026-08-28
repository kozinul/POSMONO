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
  costPrice: number;
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
  private costPrice: number;
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
    this.costPrice = props.costPrice;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<IStock, 'id' | 'updatedAt' | 'costPrice'> & { costPrice?: number }): Stock {
    return new Stock({
      ...props,
      costPrice: props.costPrice ?? 0,
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

  /**
   * Applies a quantity delta. When delta > 0 and unitCost is provided, updates the
   * weighted-average cost price: (oldQty*cost + delta*unitCost) / (oldQty + delta).
   */
  adjust(delta: number, reason: string, unitCost?: number): void {
    const oldQuantity = this.quantity;
    this.quantity += delta;

    if (delta > 0 && this.quantity > 0) {
      const incomingCost = unitCost ?? this.costPrice;
      const newCost = (oldQuantity * this.costPrice + delta * incomingCost) / this.quantity;
      this.costPrice = Math.round(newCost * 100) / 100;
    }

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

  get cost(): number {
    return this.costPrice;
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
      costPrice: this.costPrice,
      updatedAt: this.updatedAt,
    };
  }
}
