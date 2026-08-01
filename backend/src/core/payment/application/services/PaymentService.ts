import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';
import { Payment, PaymentMethod, ISplitBill } from '../../domain/Payment';
import { Refund } from '../../domain/Refund';
import { Order, IOrderItem, IPromotionBreakdown, IDiscountBreakdown } from '../../../ordering/domain/Order';
import { ReceiptRenderResult } from '../../../template/application/services/ReceiptRenderService';

export class PaymentService {
  constructor(
    private readonly paymentRepository: any,
    private readonly orderRepository: any,
    private readonly refundRepository: any,
    private readonly tenantRepository: any,
    private readonly taxService: any,
    private readonly discountService: any,
    private readonly eventBus: any,
    private readonly receiptRenderService?: any,
    private readonly inventoryService?: any,
  ) {}

  private async applyStockDeductions(order: Order, tenantId: string, userId: string): Promise<void> {
    if (!this.inventoryService) return;
    const orderData = order.serialize();
    for (const item of orderData.items) {
      await this.inventoryService.decrementForSale({
        tenantId,
        productId: item.productId,
        quantity: item.quantity,
        referenceId: orderData.id,
        userId,
      });
    }
  }

  private async applyStockRestore(order: Order, tenantId: string, userId: string): Promise<void> {
    if (!this.inventoryService) return;
    const orderData = order.serialize();
    for (const item of orderData.items) {
      await this.inventoryService.incrementForReturn({
        tenantId,
        productId: item.productId,
        quantity: item.quantity,
        referenceId: orderData.id,
        userId,
      });
    }
  }

  async payCash(input: {
    tenantId: string;
    cashierId: string;
    items: Array<{ productId: string; productName?: string; categoryId?: string; quantity: number; unitPrice: number; pricingMode?: 'inclusive' | 'exclusive' }>;
    amountPaid: number;
    method?: PaymentMethod;
    discount?: number;
    discountType?: 'percentage' | 'nominal';
    promoCode?: string;
    referenceNumber?: string;
    cardLastFour?: string;
  }): Promise<{ payment: Payment; order: any; receipt: ReceiptRenderResult | null }> {
    const roundMoney = (value: number) => Math.round(value);
    const rawSubtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const manualDiscountInput = input.discount ?? 0;
    const manualDiscountValue = input.discountType === 'percentage'
      ? roundMoney(rawSubtotal * (Math.min(manualDiscountInput, 100) / 100))
      : Math.min(manualDiscountInput, rawSubtotal);

    let promoDiscount = 0;
    let promotionBreakdown: IPromotionBreakdown[] = [];
    let discountBreakdownList: IDiscountBreakdown[] = [];

    if (this.discountService) {
      const discountResult = await this.discountService.apply({
        tenantId: input.tenantId,
        items: input.items.map((item) => ({
          productId: item.productId,
          categoryId: item.categoryId ?? '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        promoCode: input.promoCode,
      });

      if (discountResult.totalDiscount > 0) {
        promoDiscount = discountResult.totalDiscount;
        promotionBreakdown = discountResult.appliedRules.map((rule: any) => ({
          id: rule.ruleId,
          name: rule.ruleName,
          code: input.promoCode ?? '',
          totalDiscount: rule.discountAmount,
          description: rule.description,
        }));
        discountBreakdownList = discountResult.appliedRules.map((rule: any) => ({
          id: rule.ruleId,
          name: rule.ruleName,
          type: 'percentage' as const,
          amount: rule.discountAmount,
          appliedTo: 'order',
        }));
      }
    }

    const totalDiscountValue = manualDiscountValue + promoDiscount;

    const taxResult = await this.taxService.calculate({
      tenantId: input.tenantId,
      items: input.items.map((item) => ({
        productId: item.productId,
        productName: item.productName || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        categoryId: item.categoryId ?? '',
        pricingMode: item.pricingMode,
      })),
      discount: totalDiscountValue,
      discountType: 'nominal',
      customerTags: [],
    });

    const total = roundMoney(taxResult.grandTotal);
    const serviceChargeTotal = roundMoney(taxResult.charges.reduce((sum: number, c: { amount: number }) => sum + c.amount, 0));
    const taxRate = taxResult.taxes.length > 0 ? taxResult.taxes[0].rate : 0;

    const orderItems: IOrderItem[] = input.items.map((item) => {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemTaxAmount = taxResult.subtotal > 0
        ? (itemSubtotal / taxResult.subtotal) * taxResult.taxAmount
        : 0;
      const itemSC = taxResult.subtotal > 0
        ? (itemSubtotal / taxResult.subtotal) * serviceChargeTotal
        : 0;
      const itemDpp = taxResult.subtotal > 0
        ? (itemSubtotal / taxResult.subtotal) * taxResult.taxBase
        : 0;
      return {
        productId: item.productId,
        variantId: null,
        productName: item.productName || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.unitPrice * item.quantity,
        modifiers: [],
        tax: {
          rate: taxRate,
          amount: Math.round(itemTaxAmount),
        },
        serviceCharge: Math.round(itemSC),
        dpp: Math.round(itemDpp),
      };
    });

    const subtotal = roundMoney(taxResult.subtotal);
    const discount = roundMoney(taxResult.discount);
    const dppTotal = roundMoney(taxResult.taxBase);
    const tax = roundMoney(taxResult.taxAmount);

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
      serviceCharge: serviceChargeTotal,
      serviceChargeRate: 0,
      paymentBreakdown: [],
      promotions: promotionBreakdown,
      discountBreakdown: discountBreakdownList,
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
        discountType: input.promoCode ? 'promo' : (input.discountType ?? 'nominal'),
        discountValue: totalDiscountValue,
        promoCode: input.promoCode ?? null,
        promoDiscount,
        manualDiscount: manualDiscountValue,
      serviceCharge: serviceChargeTotal,
        taxBreakdown: taxResult.taxes,
      },
    });

    order.confirm();

    if (input.amountPaid < total) {
      throw new ValidationError(`Insufficient amount. Need ${total}, got ${input.amountPaid}`);
    }

    const paymentMethod = (input.method || 'cash') as PaymentMethod;
    const refNumber = input.referenceNumber || `${paymentMethod.toUpperCase()}-${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`;

    const payment = Payment.create({
      tenantId: input.tenantId,
      orderId: order.serialize().id,
      amount: input.amountPaid,
      status: 'pending',
      method: paymentMethod,
      referenceNumber: refNumber,
      splitBills: [],
      qrCodeUrl: null,
      paymentTransactionId: null,
      provider: null,
      cardLastFour: input.cardLastFour || null,
      metadata: {
        cashierId: input.cashierId,
        discountAmount: discount,
        promoCode: input.promoCode ?? null,
        promoDiscount,
        manualDiscount: manualDiscountValue,
      },
      paidAt: null,
    });

    payment.complete();
    order.markPaid();

    await this.orderRepository.save(order);
    await this.paymentRepository.save(payment);

    await this.applyStockDeductions(order, input.tenantId, input.cashierId);

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }
    for (const event of payment.domainEvents) {
      this.eventBus.publish(event);
    }

    const receipt = await this.renderReceipt(order, payment);

    return { payment, order, receipt };
  }

  private async renderReceipt(order: Order, payment: Payment): Promise<ReceiptRenderResult | null> {
    if (!this.receiptRenderService) return null;
    try {
      const tenant = await this.tenantRepository.findById(order.serialize().tenantId);
      if (!tenant) return null;
      return await this.receiptRenderService.render({
        tenantId: order.serialize().tenantId,
        order: order.serialize(),
        payment: payment.serialize(),
        tenant: tenant.serialize(),
      });
    } catch {
      return null;
    }
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
  }): Promise<{ payment: Payment; order: Order; receipt: ReceiptRenderResult | null }> {
    const order = await this.orderRepository.findById(input.orderId);
    if (!order) throw new NotFoundError('Order not found');

    const orderData = order.serialize();
    if (orderData.tenantId !== input.tenantId) throw new NotFoundError('Order not found');
    if (orderData.paymentStatus === 'completed') throw new ValidationError('Order is already paid');

    const wasUnpaid = orderData.paymentBreakdown.length === 0;

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

    if (wasUnpaid) {
      await this.applyStockDeductions(order, input.tenantId, input.cashierId);
    }

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }
    for (const event of payment.domainEvents) {
      this.eventBus.publish(event);
    }

    const receipt = await this.renderReceipt(order, payment);

    return { payment, order, receipt };
  }

  async refund(input: {
    tenantId: string;
    paymentId: string;
    reason: string;
    refundedBy: string;
    refundedByName: string;
  }): Promise<{ refund: Refund; payment: Payment }> {
    const payment = await this.paymentRepository.findById(input.paymentId);
    if (!payment) throw new NotFoundError('Payment not found');

    const paymentData = payment.serialize();
    if (paymentData.tenantId !== input.tenantId) throw new NotFoundError('Payment not found');

    payment.refund(input.refundedBy, input.refundedByName, input.reason);

    const refund = Refund.create({
      tenantId: input.tenantId,
      paymentId: input.paymentId,
      orderId: paymentData.orderId,
      amount: paymentData.amount,
      reason: input.reason,
      refundedBy: input.refundedBy,
      refundedByName: input.refundedByName,
    });
    refund.complete();

    await this.paymentRepository.save(payment);
    await this.refundRepository.save(refund);

    const order = await this.orderRepository.findById(paymentData.orderId);
    if (order && order.serialize().paymentBreakdown.length === 1) {
      await this.applyStockRestore(order, input.tenantId, input.refundedBy);
    }

    for (const event of payment.domainEvents) {
      this.eventBus.publish(event);
    }
    for (const event of refund.domainEvents) {
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

    const wasUnpaid = orderData.paymentBreakdown.length === 0;

    order.pay(input.paymentBreakdown, input.cashierId, input.cashierName);

    await this.orderRepository.save(order);

    if (wasUnpaid) {
      await this.applyStockDeductions(order, input.tenantId, input.cashierId);
    }

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

    const wasUnpaid = orderData.paymentBreakdown.length === 0;

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

    if (wasUnpaid) {
      await this.applyStockDeductions(order, input.tenantId, input.cashierId);
    }

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
