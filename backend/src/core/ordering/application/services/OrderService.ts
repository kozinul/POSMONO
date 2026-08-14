import { UseCase } from '../../../../@shared/application/UseCase';
import { ValidationError } from '../../../../@shared/infrastructure/error/AppError';
import {
  Order,
  IOrderItem,
  IPaymentBreakdownEntry,
  ITaxDetail,
  TransactionType,
  IDiscountBreakdown,
  IVoidApproval,
} from '../../domain/Order';
import {
  VoidApprovalService,
  VOID_ORDER_PERMISSION,
  VOID_PAYMENT_PERMISSION,
} from './VoidApprovalService';

async function resolveCashierName(
  userRepository: any,
  cashierId: string,
  tenantId: string,
  fallback: string,
): Promise<string> {
  if (!userRepository) return fallback;
  try {
    const user = await userRepository.findByIdAndTenant(cashierId, tenantId);
    return user?.serialize().displayName || fallback;
  } catch {
    return fallback;
  }
}

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
  tenantId: string;
  voidedBy: string;
  voidedByName: string;
  reason: string;
  managerPin?: string;
}

interface VoidItemInput {
  id: string;
  tenantId: string;
  itemIndex: number;
  quantity?: number;
  reason: string;
  voidedBy: string;
  voidedByName: string;
  managerPin?: string;
}

interface PayOrderInput {
  id: string;
  paymentBreakdown: IPaymentBreakdownEntry[];
  cashierId: string;
  cashierName: string;
}

interface VoidPaymentInput {
  id: string;
  tenantId: string;
  paymentIndex: number;
  reason: string;
  voidedBy: string;
  voidedByName: string;
  managerPin?: string;
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
  tenantId: string;
  reason: string;
  voidedBy: string;
  voidedByName: string;
  managerPin?: string;
}

interface TopayInput {
  id: string;
  paymentBreakdown: IPaymentBreakdownEntry[];
  cashierId: string;
  cashierName: string;
}

interface RefundInput {
  id: string;
  refundedBy: string;
  refundedByName: string;
  reason: string;
}

interface ApplyDiscountInput {
  id: string;
  discountBreakdown: IDiscountBreakdown[];
}

interface SetServiceChargeInput {
  id: string;
  rate: number;
}

interface HoldOrderInput {
  id: string;
}

interface RecallOrderInput {
  id: string;
}

interface ReplaceOrderItemsInput {
  id: string;
  items: IOrderItem[];
  tableNumber?: string | null;
  customerName?: string | null;
  notes?: string;
}

interface VoidContext {
  tenantId: string;
  voidedBy: string;
  voidedByName: string;
  reason: string;
  managerPin?: string;
}

async function resolveVoidApproval(
  voidApprovalService: VoidApprovalService | undefined,
  context: VoidContext,
  requiredPermission: string,
): Promise<{ approverId: string; approverName: string }> {
  if (!voidApprovalService) {
    return { approverId: context.voidedBy, approverName: context.voidedByName };
  }
  return voidApprovalService.verifyApprover({
    tenantId: context.tenantId,
    userId: context.voidedBy,
    managerPin: context.managerPin,
    requiredPermission,
  });
}

function appendVoidApproval(
  order: Order,
  approval: { approverId: string; approverName: string },
  voidType: IVoidApproval['voidType'],
  context: VoidContext,
): void {
  order.addVoidApproval({
    voidType,
    requestedBy: context.voidedBy,
    reason: context.reason,
    approverId: approval.approverId,
    approverName: approval.approverName,
    approvedAt: new Date(),
  });
}

async function restoreVoidedStock(
  inventoryService: any,
  orderData: any,
  item: { productId: string; quantity: number; isFreeItem?: boolean },
  ctx: { reason: string; userId: string },
): Promise<void> {
  if (!inventoryService || item.isFreeItem || item.quantity <= 0) return;

  const wasPaid =
    orderData.paymentStatus === 'completed' ||
    (Array.isArray(orderData.paymentBreakdown) && orderData.paymentBreakdown.length > 0);

  try {
    if (wasPaid) {
      await inventoryService.restockForVoid({
        tenantId: orderData.tenantId,
        productId: item.productId,
        quantity: item.quantity,
        referenceId: orderData.id,
        orderNumber: orderData.orderNumber,
        reason: ctx.reason,
        userId: ctx.userId,
      });
    } else {
      await inventoryService.releaseStock({
        tenantId: orderData.tenantId,
        productId: item.productId,
        quantity: item.quantity,
        referenceId: orderData.id,
        userId: ctx.userId,
      });
    }
  } catch {
    // Best-effort restore/release; never block the void
  }
}

export class CreateOrderService implements UseCase<CreateOrderInput, Order> {
  constructor(
    private readonly orderRepository: any,
    private readonly eventBus: any,
    private readonly userRepository?: any,
    private readonly shiftRepository?: any,
  ) {}

  async execute(input: CreateOrderInput): Promise<Order> {
    if (input.source === 'pos' && this.shiftRepository) {
      const shift = await this.shiftRepository.findOpenShift(input.tenantId, input.cashierId);
      if (!shift) {
        throw new ValidationError('Buka shift terlebih dahulu sebelum bertransaksi');
      }
    }
    const subtotal = input.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const tax = input.items.reduce((sum, item) => sum + (item.tax?.amount || 0), 0);
    const discount = 0;
    const serviceCharge = 0;
    const dppTotal = subtotal - discount;

    const cashierName = await resolveCashierName(this.userRepository, input.cashierId, input.tenantId, input.cashierName ?? '');

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
      roundingDenomination: 0,
      serviceCharge,
      serviceChargeRate: 0,
      paymentBreakdown: [],
      promotions: [],
      discountBreakdown: [],
      customerId: input.customerId,
      customerName: input.customerName ?? null,
      cashierId: input.cashierId,
      cashierName,
      tableNumber: input.tableNumber || null,
      transactionType: input.transactionType || 'dine_in',
      notes: input.notes || '',
      source: input.source,
      metadata: input.metadata || {},
      voidedItems: [],
      voidApprovals: [],
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

export class ReplaceOrderItemsService implements UseCase<ReplaceOrderItemsInput, Order> {
  constructor(
    private readonly orderRepository: any,
    private readonly eventBus: any,
  ) {}

  async execute(input: ReplaceOrderItemsInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.id);
    if (!order) throw new Error('Order not found');

    order.replaceItems(input.items);

    if (input.tableNumber !== undefined) (order as any)['tableNumber'] = input.tableNumber;
    if (input.customerName !== undefined) (order as any)['customerName'] = input.customerName;
    if (input.notes !== undefined) (order as any).notes = input.notes;
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
    private readonly voidApprovalService?: VoidApprovalService,
    private readonly inventoryService?: any,
  ) {}

  async execute(input: VoidOrderInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.id);
    if (!order) throw new Error('Order not found');

    const orderData = order.serialize();
    const itemsToRestore = orderData.items;

    const approval = await resolveVoidApproval(this.voidApprovalService, input, VOID_ORDER_PERMISSION);
    order.voidOrder(input.voidedBy, input.voidedByName, input.reason);
    appendVoidApproval(order, approval, 'order', input);

    await this.orderRepository.save(order);

    if (this.inventoryService) {
      for (const item of itemsToRestore) {
        await restoreVoidedStock(this.inventoryService, orderData, item, {
          reason: input.reason,
          userId: input.voidedBy,
        });
      }
    }

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
    private readonly voidApprovalService?: VoidApprovalService,
    private readonly inventoryService?: any,
  ) {}

  async execute(input: VoidItemInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.id);
    if (!order) throw new Error('Order not found');

    const orderData = order.serialize();
    const item = orderData.items[input.itemIndex];
    if (!item) throw new Error('Item not found');
    const voidQty = input.quantity && input.quantity < item.quantity ? input.quantity : item.quantity;

    const approval = await resolveVoidApproval(this.voidApprovalService, input, VOID_ORDER_PERMISSION);
    order.voidItem(input.itemIndex, input.reason, input.voidedBy, input.voidedByName, input.quantity);
    appendVoidApproval(order, approval, 'item', input);

    await this.orderRepository.save(order);

    await restoreVoidedStock(this.inventoryService, orderData, { ...item, quantity: voidQty }, {
      reason: input.reason,
      userId: input.voidedBy,
    });

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
    private readonly userRepository?: any,
  ) {}

  async execute(input: PayOrderInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.id);
    if (!order) throw new Error('Order not found');

    const orderData = order.serialize();
    const cashierName = await resolveCashierName(this.userRepository, input.cashierId, orderData.tenantId, input.cashierName);
    order.pay(input.paymentBreakdown, input.cashierId, cashierName);

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
    private readonly voidApprovalService?: VoidApprovalService,
  ) {}

  async execute(input: VoidPaymentInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.id);
    if (!order) throw new Error('Order not found');

    const approval = await resolveVoidApproval(this.voidApprovalService, input, VOID_PAYMENT_PERMISSION);
    order.voidPayment(input.paymentIndex, input.reason, input.voidedBy, input.voidedByName);
    appendVoidApproval(order, approval, 'payment', input);

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
        roundingDenomination: 0,
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
        voidApprovals: [],
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
    private readonly voidApprovalService?: VoidApprovalService,
    private readonly inventoryService?: any,
  ) {}

  async execute(input: VoidAndRollbackInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.id);
    if (!order) throw new Error('Order not found');

    const orderData = order.serialize();
    const itemsToRestore = orderData.items;

    const approval = await resolveVoidApproval(this.voidApprovalService, input, VOID_ORDER_PERMISSION);
    order.voidAndRollback(input.reason, input.voidedBy, input.voidedByName);
    appendVoidApproval(order, approval, 'order', input);

    await this.orderRepository.save(order);

    if (this.inventoryService) {
      for (const item of itemsToRestore) {
        await restoreVoidedStock(this.inventoryService, orderData, item, {
          reason: input.reason,
          userId: input.voidedBy,
        });
      }
    }

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }

    return order;
  }
}

export class TopayService implements UseCase<TopayInput, Order> {
  constructor(
    private readonly orderRepository: any,
    private readonly eventBus: any,
    private readonly userRepository?: any,
  ) {}

  async execute(input: TopayInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.id);
    if (!order) throw new Error('Order not found');

    const orderData = order.serialize();
    const cashierName = await resolveCashierName(this.userRepository, input.cashierId, orderData.tenantId, input.cashierName);
    order.topay(input.paymentBreakdown, input.cashierId, cashierName);

    await this.orderRepository.save(order);

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }

    return order;
  }
}

export class RefundService implements UseCase<RefundInput, Order> {
  constructor(
    private readonly orderRepository: any,
    private readonly eventBus: any,
  ) {}

  async execute(input: RefundInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.id);
    if (!order) throw new Error('Order not found');

    order.refund(input.refundedBy, input.refundedByName, input.reason);

    await this.orderRepository.save(order);

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }

    return order;
  }
}

export class ApplyDiscountService implements UseCase<ApplyDiscountInput, Order> {
  constructor(
    private readonly orderRepository: any,
    private readonly eventBus: any,
  ) {}

  async execute(input: ApplyDiscountInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.id);
    if (!order) throw new Error('Order not found');

    order.applyDiscount(input.discountBreakdown);

    await this.orderRepository.save(order);

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }

    return order;
  }
}

export class SetServiceChargeService implements UseCase<SetServiceChargeInput, Order> {
  constructor(
    private readonly orderRepository: any,
    private readonly eventBus: any,
  ) {}

  async execute(input: SetServiceChargeInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.id);
    if (!order) throw new Error('Order not found');

    order.setServiceCharge(input.rate);

    await this.orderRepository.save(order);

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }

    return order;
  }
}

export class HoldOrderService implements UseCase<HoldOrderInput, Order> {
  constructor(
    private readonly orderRepository: any,
    private readonly eventBus: any,
    private readonly inventoryService?: any,
  ) {}

  async execute(input: HoldOrderInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.id);
    if (!order) throw new Error('Order not found');

    order.hold();

    await this.orderRepository.save(order);

    if (this.inventoryService) {
      const data = order.serialize();
      for (const item of data.items) {
        if (item.isFreeItem) continue;
        try {
          await this.inventoryService.reserveStock({
            tenantId: data.tenantId,
            productId: item.productId,
            quantity: item.quantity,
            referenceId: data.id,
          });
        } catch {
          // Stock reservation is best-effort; don't block hold
        }
      }
    }

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }

    return order;
  }
}

export class RecallOrderService implements UseCase<RecallOrderInput, Order> {
  constructor(
    private readonly orderRepository: any,
    private readonly eventBus: any,
    private readonly inventoryService?: any,
  ) {}

  async execute(input: RecallOrderInput): Promise<Order> {
    const order = await this.orderRepository.findById(input.id);
    if (!order) throw new Error('Order not found');

    order.recall();

    await this.orderRepository.save(order);

    if (this.inventoryService) {
      const data = order.serialize();
      for (const item of data.items) {
        if (item.isFreeItem) continue;
        try {
          await this.inventoryService.releaseStock({
            tenantId: data.tenantId,
            productId: item.productId,
            quantity: item.quantity,
            referenceId: data.id,
          });
        } catch {
          // Stock release is best-effort; don't block recall
        }
      }
    }

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }

    return order;
  }
}
