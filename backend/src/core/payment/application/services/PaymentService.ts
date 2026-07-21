import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';
import { Payment, PaymentMethod, ISplitBill } from '../../domain/Payment';
import { Order, IOrderItem } from '../../../ordering/domain/Order';

export class PaymentService {
  constructor(
    private readonly paymentRepository: any,
    private readonly orderRepository: any,
    private readonly tenantRepository: any,
    private readonly taxService: any,
    private readonly eventBus: any,
  ) {}

  async payCash(input: {
    tenantId: string;
    cashierId: string;
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    amountPaid: number;
    discount?: number;
    discountType?: 'percentage' | 'nominal';
  }): Promise<{ payment: Payment; order: any }> {
    const discountValue = input.discount ?? 0;

    const taxResult = await this.taxService.calculate({
      tenantId: input.tenantId,
      items: input.items.map((item) => ({
        productId: item.productId,
        productName: '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        categoryId: '',
      })),
      discount: discountValue,
      discountType: input.discountType ?? 'nominal',
      customerTags: [],
    });

    const total = taxResult.grandTotal;

    const orderItems: IOrderItem[] = input.items.map((item) => ({
      productId: item.productId,
      variantId: null,
      productName: '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.unitPrice * item.quantity,
      modifiers: [],
      tax: { rate: 0, amount: 0 },
    }));

    const subtotal = taxResult.subtotal;
    const discount = taxResult.discountAmount;
    const dppTotal = subtotal - discount;
    const serviceCharge = taxResult.serviceCharge || 0;
    const tax = taxResult.totalTax;

    const order = Order.create({
      tenantId: input.tenantId,
      items: orderItems,
      subtotal,
      discount,
      discountTotal: discount,
      dppTotal,
      tax,
      taxDetails: [],
      total,
      roundingAdjustment: 0,
      roundedPayable: 0,
      roundingMethod: 'nearest',
      serviceCharge,
      serviceChargeRate: 0,
      paymentBreakdown: [],
      promotions: [],
      discountBreakdown: [],
      customerId: null,
      customerName: null,
      cashierId: input.cashierId,
      cashierName: '',
      tableNumber: null,
      transactionType: 'dine_in',
      notes: '',
      source: 'pos',
      voidedItems: [],
      metadata: {
        discountType: input.discountType,
        discountValue,
        serviceCharge,
        taxBreakdown: taxResult.taxes,
      },
    });

    order.confirm();

    if (input.amountPaid < total) {
      throw new ValidationError(`Insufficient amount. Need ${total}, got ${input.amountPaid}`);
    }

    const payment = Payment.create({
      tenantId: input.tenantId,
      orderId: order.serialize().id,
      amount: input.amountPaid,
      status: 'pending',
      method: 'cash' as PaymentMethod,
      referenceNumber: `CASH-${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`,
      splitBills: [],
      qrCodeUrl: null,
      paymentTransactionId: null,
      provider: null,
      cardLastFour: null,
      metadata: { cashierId: input.cashierId, discountAmount: taxResult.discountAmount },
      paidAt: null,
    });

    payment.complete();
    order.markPaid();

    await this.orderRepository.save(order);
    await this.paymentRepository.save(payment);

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }
    for (const event of payment.domainEvents) {
      this.eventBus.publish(event);
    }

    return { payment, order };
  }

  async processByOrderId(input: {
    tenantId: string;
    orderId: string;
    amount: number;
    method: PaymentMethod;
    cashierId: string;
    cashierName?: string;
    cardLastFour?: string;
    provider?: string;
    qrCodeUrl?: string;
    paymentTransactionId?: string;
  }): Promise<{ payment: Payment; order: Order }> {
    const order = await this.orderRepository.findById(input.orderId);
    if (!order) throw new NotFoundError('Order not found');

    const orderData = order.serialize();
    if (orderData.tenantId !== input.tenantId) throw new NotFoundError('Order not found');
    if (orderData.paymentStatus === 'completed') throw new ValidationError('Order is already paid');

    const totalDue = orderData.total - orderData.paymentBreakdown.reduce((s: number, p: { amount: number }) => s + p.amount, 0);
    if (input.amount < totalDue) {
      throw new ValidationError(`Insufficient amount. Need ${totalDue}, got ${input.amount}`);
    }

    const payment = Payment.create({
      tenantId: input.tenantId,
      orderId: input.orderId,
      amount: input.amount,
      status: 'pending',
      method: input.method,
      referenceNumber: `${input.method.toUpperCase()}-${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`,
      splitBills: [],
      qrCodeUrl: input.qrCodeUrl ?? null,
      paymentTransactionId: input.paymentTransactionId ?? null,
      provider: input.provider ?? null,
      cardLastFour: input.cardLastFour ?? null,
      metadata: { cashierId: input.cashierId },
      paidAt: null,
    });

    payment.complete();

    const breakdownEntry = {
      method: input.method,
      code: payment.serialize().referenceNumber,
      amount: input.amount,
      change: Math.max(0, input.amount - totalDue),
      cardLastFour: input.cardLastFour,
    };

    const updatedBreakdown = [...orderData.paymentBreakdown, breakdownEntry];
    order.pay(updatedBreakdown, input.cashierId, input.cashierName ?? '');

    await this.orderRepository.save(order);
    await this.paymentRepository.save(payment);

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }
    for (const event of payment.domainEvents) {
      this.eventBus.publish(event);
    }

    return { payment, order };
  }

  async refund(input: {
    tenantId: string;
    paymentId: string;
    reason: string;
    refundedBy: string;
    refundedByName: string;
  }): Promise<{ refund: any; payment: Payment }> {
    const payment = await this.paymentRepository.findById(input.paymentId);
    if (!payment) throw new NotFoundError('Payment not found');

    const paymentData = payment.serialize();
    if (paymentData.tenantId !== input.tenantId) throw new NotFoundError('Payment not found');

    const refund = payment.refund(input.refundedBy, input.refundedByName, input.reason);

    await this.paymentRepository.save(payment);

    for (const event of payment.domainEvents) {
      this.eventBus.publish(event);
    }

    return { refund, payment };
  }

  async payOpenBill(input: {
    tenantId: string;
    orderId: string;
    paymentBreakdown: Array<{ method: string; code: string; amount: number; change: number; cardLastFour?: string }>;
    cashierId: string;
    cashierName: string;
  }): Promise<Order> {
    const order = await this.orderRepository.findById(input.orderId);
    if (!order) throw new NotFoundError('Order not found');

    const orderData = order.serialize();
    if (orderData.tenantId !== input.tenantId) throw new NotFoundError('Order not found');

    order.pay(input.paymentBreakdown, input.cashierId, input.cashierName);

    await this.orderRepository.save(order);

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }

    return order;
  }

  async splitBill(input: {
    tenantId: string;
    orderId: string;
    splitBills: ISplitBill[];
    cashierId: string;
  }): Promise<{ payments: Payment[]; order: Order }> {
    const order = await this.orderRepository.findById(input.orderId);
    if (!order) throw new NotFoundError('Order not found');

    const orderData = order.serialize();
    if (orderData.tenantId !== input.tenantId) throw new NotFoundError('Order not found');

    const totalSplit = input.splitBills.reduce((s, b) => s + b.amount, 0);
    if (totalSplit < orderData.total) {
      throw new ValidationError(`Split total ${totalSplit} is less than order total ${orderData.total}`);
    }

    const payments: Payment[] = [];
    const breakdown: Array<{ method: string; code: string; amount: number; change: number; cardLastFour?: string }> = [];

    for (const bill of input.splitBills) {
      const payment = Payment.create({
        tenantId: input.tenantId,
        orderId: input.orderId,
        amount: bill.amount,
        status: 'pending',
        method: bill.method as PaymentMethod,
        referenceNumber: bill.referenceNumber || `${bill.method.toUpperCase()}-${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`,
        splitBills: input.splitBills,
        qrCodeUrl: null,
        paymentTransactionId: null,
        provider: null,
        cardLastFour: null,
        metadata: { cashierId: input.cashierId, portion: bill.portion },
        paidAt: null,
      });

      payment.complete();
      await this.paymentRepository.save(payment);

      for (const event of payment.domainEvents) {
        this.eventBus.publish(event);
      }

      payments.push(payment);
      breakdown.push({
        method: bill.method,
        code: payment.serialize().referenceNumber,
        amount: bill.amount,
        change: 0,
      });
    }

    order.pay(breakdown, input.cashierId, '');
    await this.orderRepository.save(order);

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }

    return { payments, order };
  }

  async getByOrder(tenantId: string, orderId: string): Promise<Payment | null> {
    return this.paymentRepository.findByOrder(tenantId, orderId);
  }

  async list(tenantId: string): Promise<Payment[]> {
    return this.paymentRepository.findByTenant(tenantId);
  }
}
