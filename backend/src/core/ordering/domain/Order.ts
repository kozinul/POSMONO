import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { OrderId } from '../../../@shared/domain/Identifier';
import { DomainEvent } from '../../../@shared/domain/DomainEvent';

export type OrderStatus = 'draft' | 'confirmed' | 'paid' | 'preparing' | 'cancelled' | 'refunded';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type OrderSource = 'pos' | 'waiter' | 'online';

export interface IOrderItem {
  productId: string;
  variantId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  modifiers: Array<{ name: string; price: number }>;
  tax: { rate: number; amount: number };
}

export interface IOrder {
  id: string;
  tenantId: string;
  orderNumber: string;
  status: OrderStatus;
  items: IOrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentStatus: PaymentStatus;
  customerId: string | null;
  cashierId: string;
  notes: string;
  source: OrderSource;
  metadata: Record<string, unknown>;
  createdAt: Date;
  paidAt: Date | null;
  updatedAt: Date;
}

export class Order extends AggregateRoot<OrderId> {
  private tenantId: string;
  private orderNumber: string;
  private status: OrderStatus;
  private items: IOrderItem[];
  private subtotal: number;
  private discount: number;
  private tax: number;
  private total: number;
  private paymentStatus: PaymentStatus;
  private customerId: string | null;
  private cashierId: string;
  private notes: string;
  private source: OrderSource;
  private metadata: Record<string, unknown>;
  private createdAt: Date;
  private paidAt: Date | null;
  private updatedAt: Date;

  private constructor(props: IOrder) {
    super(new OrderId(props.id));
    this.tenantId = props.tenantId;
    this.orderNumber = props.orderNumber;
    this.status = props.status;
    this.items = [...props.items];
    this.subtotal = props.subtotal;
    this.discount = props.discount;
    this.tax = props.tax;
    this.total = props.total;
    this.paymentStatus = props.paymentStatus;
    this.customerId = props.customerId;
    this.cashierId = props.cashierId;
    this.notes = props.notes;
    this.source = props.source;
    this.metadata = { ...props.metadata };
    this.createdAt = props.createdAt;
    this.paidAt = props.paidAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<IOrder, 'id' | 'orderNumber' | 'status' | 'paymentStatus' | 'createdAt' | 'updatedAt' | 'paidAt'>): Order {
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

    const order = new Order({
      ...props,
      id: new OrderId().toValue(),
      orderNumber,
      status: 'draft',
      paymentStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      paidAt: null,
    });

    order.addDomainEvent(
      new DomainEvent({
        eventName: 'ordering.order.created',
        aggregateId: order.id.toValue(),
        aggregateType: 'Order',
        tenantId: order.tenantId,
        correlationId: undefined,
        payload: {
          orderId: order.id.toValue(),
          orderNumber: order.orderNumber,
          items: order.items,
          total: order.total,
          customerId: order.customerId,
          cashierId: order.cashierId,
          source: order.source,
          metadata: order.metadata,
        },
      }),
    );

    return order;
  }

  static hydrate(props: IOrder): Order {
    return new Order(props);
  }

  confirm(): void {
    if (this.status !== 'draft') throw new Error('Only draft orders can be confirmed');
    this.status = 'confirmed';
    this.updatedAt = new Date();

    this.addDomainEvent(
      new DomainEvent({
        eventName: 'ordering.order.confirmed',
        aggregateId: this.id.toValue(),
        aggregateType: 'Order',
        tenantId: this.tenantId,
        payload: { orderId: this.id.toValue(), confirmedAt: new Date() },
      }),
    );
  }

  markPaid(): void {
    this.paymentStatus = 'completed';
    this.status = 'paid';
    this.paidAt = new Date();
    this.updatedAt = new Date();
  }

  markPaymentFailed(): void {
    this.paymentStatus = 'failed';
    this.updatedAt = new Date();
  }

  cancel(reason: string): void {
    if (this.status === 'paid' || this.status === 'refunded') {
      throw new Error('Cannot cancel a paid/refunded order');
    }
    this.status = 'cancelled';
    this.updatedAt = new Date();

    this.addDomainEvent(
      new DomainEvent({
        eventName: 'ordering.order.cancelled',
        aggregateId: this.id.toValue(),
        aggregateType: 'Order',
        tenantId: this.tenantId,
        payload: { orderId: this.id.toValue(), reason },
      }),
    );
  }

  serialize(): IOrder {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      orderNumber: this.orderNumber,
      status: this.status,
      items: [...this.items],
      subtotal: this.subtotal,
      discount: this.discount,
      tax: this.tax,
      total: this.total,
      paymentStatus: this.paymentStatus,
      customerId: this.customerId,
      cashierId: this.cashierId,
      notes: this.notes,
      source: this.source,
      metadata: { ...this.metadata },
      createdAt: this.createdAt,
      paidAt: this.paidAt,
      updatedAt: this.updatedAt,
    };
  }
}
