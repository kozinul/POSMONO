import { UseCase } from '../../../../@shared/application/UseCase';
import {
  Order,
  IOrderItem,
  IPaymentBreakdownEntry,
  ITaxDetail,
  TransactionType,
} from '../../domain/Order';

interface CreateOrderInput {
  tenantId: string;
  items: IOrderItem[];
  customerId: string | null;
  customerName: string | null;
  cashierId: string;
  cashierName: string;
  notes?: string;
  source: 'pos' | 'waiter' | 'online';
  tableNumber?: string;
  transactionType?: TransactionType;
  metadata?: Record<string, unknown>;
}

interface UpdateOrderInput {
  id: string;
  tenantId: string;
  items?: IOrderItem[];
  notes?: string;
  tableNumber?: string;
  customerId?: string | null;
  customerName?: string | null;
  cashierId?: string;
  cashierName?: string;
  transactionType?: TransactionType;
  metadata?: Record<string, unknown>;
}

interface VoidOrderInput {
  id: string;
  voidedBy: string;
  voidedByName: string;
  reason: string;
}

interface VoidItemInput {
  id: string;
  itemIndex: number;
  reason: string;
  voidedBy: string;
  voidedByName: string;
}

interface PayOrderInput {
  id: string;
  paymentBreakdown: IPaymentBreakdownEntry[];
  cashierId: string;
  cashierName: string;
}

interface VoidPaymentInput {
  id: string;
  paymentIndex: number;
  reason: string;
  voidedBy: string;
  voidedByName: string;
}

interface ReopenOrderInput {
  id: string;
  reopenedBy: string;
}

interface SplitItemInput {
  orderId: string;
  itemIndex: number;
  quantities: number[];
}

interface RemoveItemInput {
  id: string;
  itemIndex: number;
}

interface UpdateItemQuantityInput {
  id: string;
  itemIndex: number;
  quantity: number;
}

interface VoidAndRollbackInput {
  id: string;
  reason: string;
  voidedBy: string;
  voidedByName: string;
}

export class CreateOrderService implements UseCase<CreateOrderInput, Order> {
  constructor(
    private readonly orderRepository: any,
    private readonly eventBus: any,
  ) {}

  async execute(input: CreateOrderInput): Promise<Order> {
    const subtotal = input.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const tax = input.items.reduce((sum, item) => sum + (item.tax?.amount || 0), 0);
    const discount = 0;
    const serviceCharge = 0;
    const dppTotal = subtotal - discount;

    const order = Order.create({
      tenantId: input.tenantId,
      items: input.items,
      subtotal,
      discount,
      discountTotal: discount,
      dppTotal,
      tax,
      taxDetails: input.items.map(item => {
        if (!item.tax || item.tax.rate === 0) return null;
        return {
          ruleId: '',
          name: 'tax',
          taxType: 'sales_tax',
          rate: item.tax.rate,
          amount: item.tax.amount,
          baseAmount: item.totalPrice - item.tax.amount,
        } as ITaxDetail;
      }).filter(Boolean) as ITaxDetail[],
      total: subtotal + tax,
      roundingAdjustment: 0,
      roundedPayable: 0,
      roundingMethod: 'nearest',
      serviceCharge,
      serviceChargeRate: 0,
      paymentBreakdown: [],
      promotions: [],
      discountBreakdown: [],
      customerId: input.customerId,
      customerName: input.customerName ?? null,
      cashierId: input.cashierId,
      cashierName: input.cashierName ?? '',
      tableNumber: input.tableNumber || null,
      transactionType: input.transactionType || 'dine_in',
      notes: input.notes || '',
      source: input.source,
      metadata: input.metadata || {},
      voidedItems: [],
    });

    await this.orderRepository.save(order);

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }

    return order;
  }
}

export class UpdateOrderService implements UseCase<UpdateOrderInput, Order> {
  constructor(
    private readonly orderRepository: any,
    private readonly eventBus: any,
  ) {}

  async execute(input: UpdateOrderInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.id);
    if (!order) throw new Error('Order not found');

    if (input.items) {
      for (const item of input.items) {
        order.addItem(item);
      }
    }

    if (input.notes !== undefined) (order as any).notes = input.notes;
    if (input.tableNumber !== undefined) (order as any)['tableNumber'] = input.tableNumber;
    if (input.customerId !== undefined) (order as any)['customerId'] = input.customerId;
    if (input.customerName !== undefined) (order as any)['customerName'] = input.customerName;
    if (input.cashierId) (order as any)['cashierId'] = input.cashierId;
    if (input.cashierName) (order as any)['cashierName'] = input.cashierName;
    if (input.transactionType) (order as any)['transactionType'] = input.transactionType;
    if (input.metadata) (order as any)['metadata'] = input.metadata;
    (order as any)['updatedAt'] = new Date();

    await this.orderRepository.save(order);

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }

    return order;
  }
}

export class VoidOrderService implements UseCase<VoidOrderInput, Order> {
  constructor(
    private readonly orderRepository: any,
    private readonly eventBus: any,
  ) {}

  async execute(input: VoidOrderInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.id);
    if (!order) throw new Error('Order not found');

    order.voidOrder(input.voidedBy, input.voidedByName, input.reason);

    await this.orderRepository.save(order);

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }

    return order;
  }
}

export class VoidItemService implements UseCase<VoidItemInput, Order> {
  constructor(
    private readonly orderRepository: any,
    private readonly eventBus: any,
  ) {}

  async execute(input: VoidItemInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.id);
    if (!order) throw new Error('Order not found');

    order.voidItem(input.itemIndex, input.reason, input.voidedBy, input.voidedByName);

    await this.orderRepository.save(order);

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }

    return order;
  }
}

export class PayOrderService implements UseCase<PayOrderInput, Order> {
  constructor(
    private readonly orderRepository: any,
    private readonly eventBus: any,
  ) {}

  async execute(input: PayOrderInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.id);
    if (!order) throw new Error('Order not found');

    order.pay(input.paymentBreakdown, input.cashierId, input.cashierName);

    await this.orderRepository.save(order);

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }

    return order;
  }
}

export class VoidPaymentService implements UseCase<VoidPaymentInput, Order> {
  constructor(
    private readonly orderRepository: any,
    private readonly eventBus: any,
  ) {}

  async execute(input: VoidPaymentInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.id);
    if (!order) throw new Error('Order not found');

    order.voidPayment(input.paymentIndex, input.reason, input.voidedBy, input.voidedByName);

    await this.orderRepository.save(order);

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }

    return order;
  }
}

export class ReopenOrderService implements UseCase<ReopenOrderInput, Order> {
  constructor(
    private readonly orderRepository: any,
    private readonly eventBus: any,
  ) {}

  async execute(input: ReopenOrderInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.id);
    if (!order) throw new Error('Order not found');

    order.reopen(input.reopenedBy);

    await this.orderRepository.save(order);

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }

    return order;
  }
}

export class SplitItemService implements UseCase<SplitItemInput, Order> {
  constructor(
    private readonly orderRepository: any,
    private readonly eventBus: any,
    private readonly createOrderService: CreateOrderService,
  ) {}

  async execute(input: SplitItemInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.orderId);
    if (!order) throw new Error('Order not found');

    const item = order.serialize().items[input.itemIndex];
    if (!item) throw new Error('Item not found');

    const totalQty = input.quantities.reduce((a, b) => a + b, 0);
    if (totalQty > item.quantity) throw new Error('Split quantities exceed item quantity');

    const ratio = item.unitPrice / item.quantity;
    for (const qty of input.quantities) {
      const splitItem: IOrderItem = {
        ...item,
        quantity: qty,
        totalPrice: Math.round(ratio * qty * 100) / 100,
        tax: {
          rate: item.tax.rate,
          amount: Math.round((ratio * qty * item.tax.rate) * 100) / 100,
        },
      };
      const newOrder = Order.create({
        tenantId: order.serialize().tenantId,
        items: [splitItem],
        subtotal: splitItem.totalPrice,
        discount: 0,
        discountTotal: 0,
        dppTotal: splitItem.totalPrice,
        tax: splitItem.tax.amount,
        taxDetails: [],
        total: splitItem.totalPrice + splitItem.tax.amount,
        roundingAdjustment: 0,
        roundedPayable: splitItem.totalPrice + splitItem.tax.amount,
        roundingMethod: 'nearest',
        serviceCharge: 0,
        serviceChargeRate: 0,
        paymentBreakdown: [],
        promotions: [],
        discountBreakdown: [],
        customerName: null,
        cashierName: '',
        customerId: null,
        tableNumber: null,
        transactionType: 'dine_in',
        cashierId: order.serialize().cashierId,
        notes: `Split from order ${order.serialize().orderNumber}`,
        source: order.serialize().source,
        metadata: {},
        voidedItems: [],
      });
      await this.orderRepository.save(newOrder);
      for (const event of newOrder.domainEvents) {
        this.eventBus.publish(event);
      }
    }
    return order;
  }
}

export class RemoveItemService implements UseCase<RemoveItemInput, Order> {
  constructor(
    private readonly orderRepository: any,
    private readonly eventBus: any,
  ) {}

  async execute(input: RemoveItemInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.id);
    if (!order) throw new Error('Order not found');

    order.removeItem(input.itemIndex);

    await this.orderRepository.save(order);

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }

    return order;
  }
}

export class UpdateItemQuantityService implements UseCase<UpdateItemQuantityInput, Order> {
  constructor(
    private readonly orderRepository: any,
    private readonly eventBus: any,
  ) {}

  async execute(input: UpdateItemQuantityInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.id);
    if (!order) throw new Error('Order not found');

    order.updateItemQuantity(input.itemIndex, input.quantity);

    await this.orderRepository.save(order);

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }

    return order;
  }
}

export class VoidAndRollbackService implements UseCase<VoidAndRollbackInput, Order> {
  constructor(
    private readonly orderRepository: any,
    private readonly eventBus: any,
  ) {}

  async execute(input: VoidAndRollbackInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.id);
    if (!order) throw new Error('Order not found');

    order.voidAndRollback(input.reason, input.voidedBy, input.voidedByName);

    await this.orderRepository.save(order);

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }

    return order;
  }
}
