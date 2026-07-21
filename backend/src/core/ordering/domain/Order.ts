import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { OrderId } from '../../../@shared/domain/Identifier';
import { DomainEvent } from '../../../@shared/domain/DomainEvent';

export type OrderStatus = 'draft' | 'confirmed' | 'paid' | 'preparing' | 'completed' | 'cancelled' | 'refunded' | 'voided' | 'partially-voided';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type OrderSource = 'pos' | 'waiter' | 'online';
export type TransactionType = 'dine_in' | 'takeaway' | 'delivery' | 'online';

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

export interface IVoidedItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  reason: string;
  voidedBy: string;
  voidedByName: string;
  voidedAt: Date;
}

export interface IPaymentBreakdownEntry {
  method: string;
  code: string;
  amount: number;
  change: number;
  cardLastFour?: string;
}

export interface ITaxDetail {
  ruleId: string;
  name: string;
  taxType: string;
  rate: number;
  amount: number;
  baseAmount: number;
}

export interface IPromotionBreakdown {
  id: string;
  name: string;
  code: string;
  totalDiscount: number;
  description: string;
}

export interface IOrder {
  id: string;
  tenantId: string;
  orderNumber: string;
  status: OrderStatus;
  items: IOrderItem[];
  subtotal: number;
  discount: number;
  discountTotal: number;
  dppTotal: number;
  tax: number;
  taxDetails: ITaxDetail[];
  total: number;
  roundingAdjustment: number;
  roundedPayable: number;
  roundingMethod: string;
  serviceCharge: number;
  serviceChargeRate: number;
  paymentStatus: PaymentStatus;
  paymentBreakdown: IPaymentBreakdownEntry[];
  promotions: IPromotionBreakdown[];
  customerId: string | null;
  customerName: string | null;
  cashierId: string;
  cashierName: string;
  tableNumber: string | null;
  transactionType: TransactionType;
  notes: string;
  source: OrderSource;
  voidedItems: IVoidedItem[];
  voidedAt: Date | null;
  voidedBy: string | null;
  voidedByName: string | null;
  voidReason: string | null;
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
  private discountTotal: number;
  private dppTotal: number;
  private tax: number;
  private taxDetails: ITaxDetail[];
  private total: number;
  private roundingAdjustment: number;
  private roundedPayable: number;
  private roundingMethod: string;
  private serviceCharge: number;
  private serviceChargeRate: number;
  private paymentStatus: PaymentStatus;
  private paymentBreakdown: IPaymentBreakdownEntry[];
  private promotions: IPromotionBreakdown[];
  private customerId: string | null;
  private customerName: string | null;
  private cashierId: string;
  private cashierName: string;
  private tableNumber: string | null;
  private transactionType: TransactionType;
  private notes: string;
  private source: OrderSource;
  private voidedItems: IVoidedItem[];
  private voidedAt: Date | null;
  private voidedBy: string | null;
  private voidedByName: string | null;
  private voidReason: string | null;
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
    this.discountTotal = props.discountTotal;
    this.dppTotal = props.dppTotal;
    this.tax = props.tax;
    this.taxDetails = [...props.taxDetails];
    this.total = props.total;
    this.roundingAdjustment = props.roundingAdjustment;
    this.roundedPayable = props.roundedPayable;
    this.roundingMethod = props.roundingMethod;
    this.serviceCharge = props.serviceCharge;
    this.serviceChargeRate = props.serviceChargeRate;
    this.paymentStatus = props.paymentStatus;
    this.paymentBreakdown = [...props.paymentBreakdown];
    this.promotions = [...props.promotions];
    this.customerId = props.customerId;
    this.customerName = props.customerName;
    this.cashierId = props.cashierId;
    this.cashierName = props.cashierName;
    this.tableNumber = props.tableNumber;
    this.transactionType = props.transactionType;
    this.notes = props.notes;
    this.source = props.source;
    this.voidedItems = [...props.voidedItems];
    this.voidedAt = props.voidedAt;
    this.voidedBy = props.voidedBy;
    this.voidedByName = props.voidedByName;
    this.voidReason = props.voidReason;
    this.metadata = { ...props.metadata };
    this.createdAt = props.createdAt;
    this.paidAt = props.paidAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<IOrder, 'id' | 'orderNumber' | 'status' | 'paymentStatus' | 'createdAt' | 'updatedAt' | 'paidAt' | 'voidedAt' | 'voidedBy' | 'voidedByName' | 'voidReason'>): Order {
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

    const order = new Order({
      ...props,
      id: new OrderId().toValue(),
      orderNumber,
      status: 'draft',
      paymentStatus: 'pending',
      taxDetails: props.taxDetails ?? [],
      paymentBreakdown: props.paymentBreakdown ?? [],
      promotions: props.promotions ?? [],
      voidedItems: [],
      voidedAt: null,
      voidedBy: null,
      voidedByName: null,
      voidReason: null,
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

  voidItem(itemIndex: number, reason: string, voidedBy: string, voidedByName: string): void {
    if (itemIndex < 0 || itemIndex >= this.items.length) {
      throw new Error('Invalid item index');
    }
    if (this.status === 'voided' || this.status === 'refunded') {
      throw new Error('Cannot void item on a voided/refunded order');
    }

    const item = this.items[itemIndex];
    if (!item) {
      throw new Error('Item not found');
    }

    const voidedItem: IVoidedItem = {
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      reason,
      voidedBy,
      voidedByName,
      voidedAt: new Date(),
    };

    this.voidedItems.push(voidedItem);
    this.items.splice(itemIndex, 1);
    this.updatedAt = new Date();

    this.recalculateTotals();

    if (this.items.length === 0) {
      this.status = 'voided';
      this.voidedAt = new Date();
      this.voidedBy = voidedBy;
      this.voidedByName = voidedByName;
      this.voidReason = reason;
    } else {
      this.status = 'partially-voided';
    }

    this.addDomainEvent(
      new DomainEvent({
        eventName: 'ordering.order.item-voided',
        aggregateId: this.id.toValue(),
        aggregateType: 'Order',
        tenantId: this.tenantId,
        payload: {
          orderId: this.id.toValue(),
          orderNumber: this.orderNumber,
          voidedItem,
          remainingItems: this.items.length,
          status: this.status,
        },
      }),
    );
  }

  voidOrder(voidedBy: string, voidedByName: string, reason: string): void {
    if (this.status === 'voided' || this.status === 'refunded') {
      throw new Error('Cannot void an already voided/refunded order');
    }

    this.status = 'voided';
    this.voidedAt = new Date();
    this.voidedBy = voidedBy;
    this.voidedByName = voidedByName;
    this.voidReason = reason;
    this.updatedAt = new Date();

    for (const item of this.items) {
      this.voidedItems.push({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        reason,
        voidedBy,
        voidedByName,
        voidedAt: new Date(),
      });
    }
    this.items = [];

    this.addDomainEvent(
      new DomainEvent({
        eventName: 'ordering.order.voided',
        aggregateId: this.id.toValue(),
        aggregateType: 'Order',
        tenantId: this.tenantId,
        payload: {
          orderId: this.id.toValue(),
          orderNumber: this.orderNumber,
          voidedBy,
          voidedByName,
          reason,
        },
      }),
    );
  }

  pay(paymentBreakdown: IPaymentBreakdownEntry[], cashierId: string, cashierName: string): void {
    if (this.status === 'voided' || this.status === 'cancelled') {
      throw new Error('Cannot pay a voided/cancelled order');
    }
    if (this.paymentStatus === 'completed') {
      throw new Error('Order is already paid');
    }

    this.paymentBreakdown = [...paymentBreakdown];
    this.paymentStatus = 'completed';
    this.status = 'paid';
    this.paidAt = new Date();
    this.cashierId = cashierId;
    this.cashierName = cashierName;
    this.updatedAt = new Date();

    this.addDomainEvent(
      new DomainEvent({
        eventName: 'ordering.order.paid',
        aggregateId: this.id.toValue(),
        aggregateType: 'Order',
        tenantId: this.tenantId,
        payload: {
          orderId: this.id.toValue(),
          orderNumber: this.orderNumber,
          paymentBreakdown,
          total: this.total,
        },
      }),
    );
  }

  addItem(item: IOrderItem): void {
    if (this.status === 'voided' || this.status === 'cancelled' || this.status === 'paid') {
      throw new Error('Cannot add items to a voided/cancelled/paid order');
    }

    this.items.push(item);
    this.recalculateTotals();
    this.updatedAt = new Date();
  }

  voidPayment(paymentIndex: number, reason: string, voidedBy: string, voidedByName: string): void {
    if (paymentIndex < 0 || paymentIndex >= this.paymentBreakdown.length) {
      throw new Error('Invalid payment index');
    }
    if (this.paymentBreakdown.length === 0) {
      throw new Error('No payments to void');
    }

    const voided = this.paymentBreakdown.splice(paymentIndex, 1)[0];
    this.updatedAt = new Date();

    if (this.paymentBreakdown.length === 0) {
      this.paymentStatus = 'pending';
      this.status = 'confirmed';
      this.paidAt = null;
    }

    this.addDomainEvent(
      new DomainEvent({
        eventName: 'ordering.order.payment_voided',
        aggregateId: this.id.toValue(),
        aggregateType: 'Order',
        tenantId: this.tenantId,
        payload: {
          orderId: this.id.toValue(),
          orderNumber: this.orderNumber,
          voidedPayment: voided,
          reason,
          voidedBy,
          voidedByName,
        },
      }),
    );
  }

  reopen(reopenedBy: string): void {
    if (this.status !== 'cancelled' && this.status !== 'voided') {
      throw new Error('Only cancelled or voided orders can be reopened');
    }

    this.status = 'draft';
    this.paymentStatus = 'pending';
    this.paidAt = null;
    this.voidedAt = null;
    this.voidedBy = null;
    this.voidedByName = null;
    this.voidReason = null;
    this.updatedAt = new Date();

    this.addDomainEvent(
      new DomainEvent({
        eventName: 'ordering.order.reopened',
        aggregateId: this.id.toValue(),
        aggregateType: 'Order',
        tenantId: this.tenantId,
        payload: {
          orderId: this.id.toValue(),
          orderNumber: this.orderNumber,
          reopenedBy,
        },
      }),
    );
  }

  private recalculateTotals(): void {
    this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
    this.discount = 0;
    this.discountTotal = 0;
    this.dppTotal = this.subtotal - this.discount;
    this.tax = this.items.reduce((sum, item) => sum + (item.tax?.amount || 0), 0);
    this.taxDetails = this.items.map(item => {
      if (!item.tax || item.tax.rate === 0) return null;
      return {
        ruleId: '',
        name: 'tax',
        taxType: 'sales_tax',
        rate: item.tax.rate,
        amount: item.tax.amount,
        baseAmount: item.totalPrice - item.tax.amount,
      } as ITaxDetail;
    }).filter(Boolean) as ITaxDetail[];
    this.total = this.subtotal + this.tax;
    this.roundingAdjustment = 0;
    this.roundedPayable = this.total;
    this.roundingMethod = 'nearest';
    this.serviceCharge = 0;
    this.serviceChargeRate = 0;
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
      discountTotal: this.discountTotal,
      dppTotal: this.dppTotal,
      tax: this.tax,
      taxDetails: [...this.taxDetails],
      total: this.total,
      roundingAdjustment: this.roundingAdjustment,
      roundedPayable: this.roundedPayable,
      roundingMethod: this.roundingMethod,
      serviceCharge: this.serviceCharge,
      serviceChargeRate: this.serviceChargeRate,
      paymentStatus: this.paymentStatus,
      paymentBreakdown: [...this.paymentBreakdown],
      promotions: [...this.promotions],
      customerId: this.customerId,
      customerName: this.customerName,
      cashierId: this.cashierId,
      cashierName: this.cashierName,
      tableNumber: this.tableNumber,
      transactionType: this.transactionType,
      notes: this.notes,
      source: this.source,
      voidedItems: [...this.voidedItems],
      voidedAt: this.voidedAt,
      voidedBy: this.voidedBy,
      voidedByName: this.voidedByName,
      voidReason: this.voidReason,
      metadata: { ...this.metadata },
      createdAt: this.createdAt,
      paidAt: this.paidAt,
      updatedAt: this.updatedAt,
    };
  }
}
