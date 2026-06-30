import { Entity } from '../../../@shared/domain/Entity';
import { StockMovementId } from '../../../@shared/domain/Identifier';

export type StockMovementType = 'in' | 'out' | 'adjustment' | 'reserve' | 'release';

export interface IStockMovement {
  id: string;
  tenantId: string;
  productId: string;
  variantId: string | null;
  warehouseId: string;
  type: StockMovementType;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  referenceType: string;
  referenceId: string;
  notes: string;
  userId: string;
  createdAt: Date;
}

export class StockMovement extends Entity<StockMovementId> {
  private tenantId: string;
  private productId: string;
  private variantId: string | null;
  private warehouseId: string;
  private type: StockMovementType;
  private quantity: number;
  private beforeQuantity: number;
  private afterQuantity: number;
  private referenceType: string;
  private referenceId: string;
  private notes: string;
  private userId: string;
  private createdAt: Date;

  private constructor(props: IStockMovement) {
    super(new StockMovementId(props.id));
    this.tenantId = props.tenantId;
    this.productId = props.productId;
    this.variantId = props.variantId;
    this.warehouseId = props.warehouseId;
    this.type = props.type;
    this.quantity = props.quantity;
    this.beforeQuantity = props.beforeQuantity;
    this.afterQuantity = props.afterQuantity;
    this.referenceType = props.referenceType;
    this.referenceId = props.referenceId;
    this.notes = props.notes;
    this.userId = props.userId;
    this.createdAt = props.createdAt;
  }

  static create(props: Omit<IStockMovement, 'id' | 'createdAt'>): StockMovement {
    return new StockMovement({
      ...props,
      id: new StockMovementId().toValue(),
      createdAt: new Date(),
    });
  }

  static hydrate(props: IStockMovement): StockMovement {
    return new StockMovement(props);
  }

  serialize(): IStockMovement {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      productId: this.productId,
      variantId: this.variantId,
      warehouseId: this.warehouseId,
      type: this.type,
      quantity: this.quantity,
      beforeQuantity: this.beforeQuantity,
      afterQuantity: this.afterQuantity,
      referenceType: this.referenceType,
      referenceId: this.referenceId,
      notes: this.notes,
      userId: this.userId,
      createdAt: this.createdAt,
    };
  }
}
