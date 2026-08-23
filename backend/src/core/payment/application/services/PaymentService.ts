import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';
import { Payment, PaymentMethod, ISplitBill } from '../../domain/Payment';
import { Refund } from '../../domain/Refund';
import { Order, IOrderItem, IPromotionBreakdown, IDiscountBreakdown } from '../../../ordering/domain/Order';
import { roundToDenomination, TotalRoundingMode } from '../../../tax/domain/RoundingEngine';
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
    private readonly userRepository?: any,
    private readonly shiftRepository?: any,
    private readonly printService?: any,
    private readonly qrisGatewayService?: any,
  ) {}

  private async assertOpenShift(tenantId: string, cashierId: string, providedShiftId?: string | null): Promise<string> {
    if (!this.shiftRepository) return providedShiftId ?? '';
    const shift = await this.shiftRepository.findOpenShift(tenantId, cashierId);
    if (!shift) {
      throw new ValidationError('Buka shift terlebih dahulu sebelum bertransaksi');
    }
    return shift.serialize().id;
  }

  private async resolveCashierName(cashierId: string, tenantId: string, fallback?: string): Promise<string> {
    if (this.userRepository) {
      try {
        const user = await this.userRepository.findByIdAndTenant(cashierId, tenantId);
        const name = user?.serialize().displayName;
        if (name) return name;
      } catch {
        // fall through to fallback
      }
    }
    return fallback ?? '';
  }

  private async getRoundingConfig(tenantId: string): Promise<{ enabled: boolean; mode: TotalRoundingMode; denomination: number }> {
    if (!this.tenantRepository) return { enabled: false, mode: 'nearest', denomination: 0 };
    const tenant = await this.tenantRepository.findById(tenantId);
    const cfg = tenant?.serialize().config;
    if (!cfg?.roundingEnabled || !cfg.roundingDenomination) return { enabled: false, mode: 'nearest', denomination: 0 };
    return { enabled: true, mode: (cfg.roundingMode || 'nearest') as TotalRoundingMode, denomination: cfg.roundingDenomination };
  }

  private async applyStockDeductions(order: Order, tenantId: string, userId: string): Promise<void> {
    if (!this.inventoryService) return;
    const orderData = order.serialize();
    for (const item of orderData.items) {
      if (item.isFreeItem) continue;
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
      if (item.isFreeItem) continue;
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
    items: Array<{ productId: string; productName?: string; categoryId?: string; quantity: number; unitPrice: number; pricingMode?: 'inclusive' | 'exclusive'; isFreeItem?: boolean }>;
    amountPaid: number;
    method?: PaymentMethod;
    discount?: number;
    discountType?: 'percentage' | 'nominal';
    promoCode?: string;
    referenceNumber?: string;
    cardLastFour?: string;
    splitIndex?: number;
    splitBaseOrderNumber?: string;
    shiftId?: string | null;
    cashierName?: string;
  }): Promise<{ payment: Payment; order: any; receipt: ReceiptRenderResult | null }> {
    const shiftId = await this.assertOpenShift(input.tenantId, input.cashierId, input.shiftId);
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

    const paymentMethod = (input.method || 'cash') as PaymentMethod;
    const roundingConfig = await this.getRoundingConfig(input.tenantId);
    const isCash = paymentMethod === 'cash';
    const roundedPayable = isCash && roundingConfig.enabled
      ? roundToDenomination(total, roundingConfig.mode, roundingConfig.denomination)
      : total;
    const roundingAdjustment = roundedPayable - total;
    const roundingMethod = isCash && roundingConfig.enabled ? roundingConfig.mode : 'none';

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
        isFreeItem: item.isFreeItem || false,
      };
    });

    const subtotal = roundMoney(taxResult.subtotal);
    const discount = roundMoney(taxResult.discount);
    const dppTotal = roundMoney(taxResult.taxBase);
    const tax = roundMoney(taxResult.taxAmount);

    const cashierName = await this.resolveCashierName(input.cashierId, input.tenantId, input.cashierName);

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
      roundingAdjustment,
      roundedPayable,
      roundingMethod,
      roundingDenomination: isCash && roundingConfig.enabled ? roundingConfig.denomination : 0,
      serviceCharge: serviceChargeTotal,
      serviceChargeRate: 0,
      paymentBreakdown: [],
      promotions: promotionBreakdown,
      discountBreakdown: discountBreakdownList,
      customerId: null,
      customerName: null,
      cashierId: input.cashierId,
      cashierName,
      tableNumber: null,
      transactionType: 'dine_in',
      notes: '',
      source: 'pos',
      voidedItems: [],
      voidApprovals: [],
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

    if (input.amountPaid < roundedPayable) {
      throw new ValidationError(`Insufficient amount. Need ${roundedPayable}, got ${input.amountPaid}`);
    }

    const refNumber = input.referenceNumber || `${paymentMethod.toUpperCase()}-${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`;

    const payment = Payment.create({
      tenantId: input.tenantId,
      orderId: order.serialize().id,
      amount: input.amountPaid,
      status: 'pending',
      method: paymentMethod,
      shiftId,
      referenceNumber: refNumber,
      splitBills: [],
      qrCodeUrl: null,
      paymentTransactionId: null,
      provider: null,
      cardLastFour: input.cardLastFour || null,
      metadata: {
        cashierId: input.cashierId,
        cashierName,
        discountAmount: discount,
        promoCode: input.promoCode ?? null,
        promoDiscount,
        manualDiscount: manualDiscountValue,
        splitIndex: input.splitIndex ?? null,
        splitBaseOrderNumber: input.splitBaseOrderNumber ?? null,
      },
      paidAt: null,
    });

    payment.complete();

    const paymentBreakdownEntry = {
      method: paymentMethod,
      code: refNumber,
      amount: input.amountPaid,
      change: Math.max(0, input.amountPaid - roundedPayable),
      cardLastFour: input.cardLastFour || undefined,
    };
    order.pay([paymentBreakdownEntry], input.cashierId, cashierName);

    await this.orderRepository.save(order);
    await this.paymentRepository.save(payment);

    await this.applyStockDeductions(order, input.tenantId, input.cashierId);

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }
    for (const event of payment.domainEvents) {
      this.eventBus.publish(event);
    }

    const receipt = await this.renderReceipt(order, payment, input.splitIndex, undefined, input.splitBaseOrderNumber);

    void this.autoPrintReceipt(input.tenantId, receipt);

    return { payment, order, receipt };
  }

  private async autoPrintReceipt(tenantId: string, receipt: ReceiptRenderResult | null): Promise<void> {
    if (!receipt || !this.printService) return;
    try {
      const tenant = await this.tenantRepository.findById(tenantId);
      if (!tenant) return;
      if (!tenant.serialize().config?.autoPrintReceipt) return;
      await this.printService.printEscPos({ tenantId, purpose: 'receipt', buffer: receipt.thermal });
    } catch {
      // auto-print must never break the transaction
    }
  }

  private async renderReceipt(order: Order, payment: Payment, splitIndex?: number, totalSplits?: number, splitBaseOrderNumber?: string): Promise<ReceiptRenderResult | null> {
    if (!this.receiptRenderService) return null;
    try {
      const tenant = await this.tenantRepository.findById(order.serialize().tenantId);
      if (!tenant) return null;
      return await this.receiptRenderService.render({
        tenantId: order.serialize().tenantId,
        order: order.serialize(),
        payment: payment.serialize(),
        tenant: tenant.serialize(),
        splitIndex,
        totalSplits,
        splitBaseOrderNumber,
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
    referenceNumber?: string;
    shiftId?: string | null;
  }): Promise<{ payment: Payment; order: Order; receipt: ReceiptRenderResult | null }> {
    const shiftId = await this.assertOpenShift(input.tenantId, input.cashierId, input.shiftId);
    const order = await this.orderRepository.findById(input.orderId);
    if (!order) throw new NotFoundError('Order not found');

    const orderData = order.serialize();
    if (orderData.tenantId !== input.tenantId) throw new NotFoundError('Order not found');
    if (orderData.paymentStatus === 'completed') throw new ValidationError('Order is already paid');

    const wasUnpaid = orderData.paymentBreakdown.length === 0;

    const totalDue = orderData.total - orderData.paymentBreakdown.reduce((s: number, p: { amount: number }) => s + p.amount, 0);

    let expectedPayable = totalDue;
    if (wasUnpaid && input.method === 'cash') {
      const roundingConfig = await this.getRoundingConfig(input.tenantId);
      if (roundingConfig.enabled) {
        expectedPayable = roundToDenomination(orderData.roundedPayable || totalDue, roundingConfig.mode, roundingConfig.denomination);
      }
    }

    if (input.amount < expectedPayable) {
      throw new ValidationError(`Insufficient amount. Need ${expectedPayable}, got ${input.amount}`);
    }

    const payment = Payment.create({
      tenantId: input.tenantId,
      orderId: input.orderId,
      amount: input.amount,
      status: 'pending',
      method: input.method,
      shiftId,
      referenceNumber: input.referenceNumber || `${input.method.toUpperCase()}-${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`,
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
      change: Math.max(0, input.amount - expectedPayable),
      cardLastFour: input.cardLastFour,
    };

    const updatedBreakdown = [...orderData.paymentBreakdown, breakdownEntry];
    const cashierName = await this.resolveCashierName(input.cashierId, input.tenantId, input.cashierName);

    if (wasUnpaid && input.method === 'cash' && expectedPayable !== totalDue) {
      const roundingConfig = await this.getRoundingConfig(input.tenantId);
      order.applyCashRounding(expectedPayable - totalDue, roundingConfig.mode, roundingConfig.denomination);
    }

    order.pay(updatedBreakdown, input.cashierId, cashierName);

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

    void this.autoPrintReceipt(input.tenantId, receipt);

    return { payment, order, receipt };
  }

  async confirmQrisPayment(input: {
    tenantId: string;
    referenceNumber: string;
    amount: number;
    orderId?: string;
    items?: Array<{ productId: string; productName?: string; categoryId?: string; quantity: number; unitPrice: number; pricingMode?: 'inclusive' | 'exclusive'; isFreeItem?: boolean }>;
    discount?: number;
    discountType?: 'percentage' | 'nominal';
    promoCode?: string;
    cashierId: string;
    cashierName?: string;
    shiftId?: string | null;
  }): Promise<{ payment: Payment; order: Order; receipt: ReceiptRenderResult | null }> {
    if (!this.qrisGatewayService) {
      throw new ValidationError('Layanan QRIS Gateway tidak tersedia');
    }
    if (!input.referenceNumber) {
      throw new ValidationError('Nomor referensi QRIS wajib diisi');
    }

    let order: Order | null = null;
    if (input.orderId) {
      order = await this.orderRepository.findById(input.orderId);
      if (!order) throw new NotFoundError('Order not found');
      const orderData = order.serialize();
      if (orderData.tenantId !== input.tenantId) throw new NotFoundError('Order not found');
      if (orderData.paymentStatus === 'completed') throw new ValidationError('Order is already paid');
      const totalDue = orderData.total - orderData.paymentBreakdown.reduce((s: number, p: { amount: number }) => s + p.amount, 0);
      if (input.amount < totalDue) {
        throw new ValidationError(`Insufficient amount. Need ${totalDue}, got ${input.amount}`);
      }
    } else if (!input.items || input.items.length === 0) {
      throw new ValidationError('orderId atau items wajib diisi untuk finalisasi QRIS');
    }

    if (typeof this.paymentRepository.findByReferenceNumber === 'function') {
      const existing = await this.paymentRepository.findByReferenceNumber(input.tenantId, input.referenceNumber);
      if (existing) {
        throw new ValidationError('Pembayaran QRIS ini sudah dikonfirmasi sebelumnya');
      }
    }

    const status = await this.qrisGatewayService.checkStatus(input.tenantId, input.referenceNumber);
    if (status.status === 'expired') {
      throw new ValidationError('Invoice QRIS sudah kedaluwarsa. Buat QR baru.');
    }
    if (status.status === 'cancelled') {
      throw new ValidationError('Invoice QRIS sudah dibatalkan.');
    }
    if (status.status !== 'paid') {
      throw new ValidationError(`QRIS belum dibayar (status: ${status.status}). Tunggu konfirmasi pembayaran.`);
    }
    if (status.amount != null && status.amount !== input.amount) {
      throw new ValidationError(`Nominal bayar gateway (${status.amount}) tidak sesuai tagihan (${input.amount})`);
    }

    if (order) {
      return this.processByOrderId({
        tenantId: input.tenantId,
        orderId: order.serialize().id,
        amount: input.amount,
        method: 'qris',
        cashierId: input.cashierId,
        cashierName: input.cashierName,
        provider: 'qris-gateway',
        paymentTransactionId: input.referenceNumber,
        referenceNumber: input.referenceNumber,
        shiftId: input.shiftId,
      });
    }

    return this.payCash({
      tenantId: input.tenantId,
      cashierId: input.cashierId,
      items: input.items!,
      amountPaid: input.amount,
      method: 'qris',
      discount: input.discount,
      discountType: input.discountType,
      promoCode: input.promoCode,
      referenceNumber: input.referenceNumber,
      shiftId: input.shiftId,
      cashierName: input.cashierName,
    });
  }

  async refund(input: {
    tenantId: string;
    paymentId: string;
    reason: string;
    refundedBy: string;
    refundedByName: string;
  }): Promise<{ refund: Refund; payment: Payment; order: Order | null }> {
    const payment = await this.paymentRepository.findById(input.paymentId);
    if (!payment) throw new NotFoundError('Payment not found');

    const paymentData = payment.serialize();
    if (paymentData.tenantId !== input.tenantId) throw new NotFoundError('Payment not found');

    if (this.shiftRepository) {
      const shift = paymentData.shiftId
        ? await this.shiftRepository.findById(paymentData.shiftId)
        : null;
      if (!shift) {
        throw new ValidationError('Transaksi tidak tercatat pada shift, tidak dapat direfund.');
      }
      if (shift.serialize().status === 'open') {
        throw new ValidationError('Shift masih berjalan. Gunakan void untuk membatalkan transaksi.');
      }
    }

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
      order.markRefunded(input.refundedBy, input.refundedByName, input.reason);
      await this.orderRepository.save(order);
    }

    for (const event of payment.domainEvents) {
      this.eventBus.publish(event);
    }
    for (const event of refund.domainEvents) {
      this.eventBus.publish(event);
    }
    if (order) {
      for (const event of order.domainEvents) {
        this.eventBus.publish(event);
      }
    }

    return { refund, payment, order };
  }

  async listRefundable(tenantId: string, dateFrom?: string, dateTo?: string) {
    if (!this.paymentRepository.findRefundable) return [];
    return this.paymentRepository.findRefundable(tenantId, dateFrom, dateTo);
  }

  async payOpenBill(input: {
    tenantId: string;
    orderId: string;
    paymentBreakdown: Array<{ method: string; code: string; amount: number; change: number; cardLastFour?: string }>;
    cashierId: string;
    cashierName: string;
  }): Promise<Order> {
    await this.assertOpenShift(input.tenantId, input.cashierId);
    const order = await this.orderRepository.findById(input.orderId);
    if (!order) throw new NotFoundError('Order not found');

    const orderData = order.serialize();
    if (orderData.tenantId !== input.tenantId) throw new NotFoundError('Order not found');

    const wasUnpaid = orderData.paymentBreakdown.length === 0;

    const cashierName = await this.resolveCashierName(input.cashierId, input.tenantId, input.cashierName);
    order.pay(input.paymentBreakdown, input.cashierId, cashierName);

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
    shiftId?: string | null;
  }): Promise<{ payments: Payment[]; order: Order; receipts: (ReceiptRenderResult | null)[] }> {
    const shiftId = await this.assertOpenShift(input.tenantId, input.cashierId, input.shiftId);
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
    const receipts: (ReceiptRenderResult | null)[] = [];
    const breakdown: Array<{ method: string; code: string; amount: number; change: number; cardLastFour?: string }> = [];

    const totalSplits = input.splitBills.length;

    for (let i = 0; i < input.splitBills.length; i++) {
      const bill = input.splitBills[i];
      const payment = Payment.create({
        tenantId: input.tenantId,
        orderId: input.orderId,
        amount: bill.amount,
        status: 'pending',
        method: bill.method as PaymentMethod,
        shiftId,
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

      const receipt = await this.renderReceipt(order, payment, i + 1, totalSplits);
      receipts.push(receipt);
      void this.autoPrintReceipt(input.tenantId, receipt);
    }

    const cashierName = await this.resolveCashierName(input.cashierId, input.tenantId, '');
    order.pay(breakdown, input.cashierId, cashierName);
    await this.orderRepository.save(order);

    if (wasUnpaid) {
      await this.applyStockDeductions(order, input.tenantId, input.cashierId);
    }

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }

    return { payments, order, receipts };
  }

  async getByOrder(tenantId: string, orderId: string): Promise<Payment | null> {
    return this.paymentRepository.findByOrder(tenantId, orderId);
  }

  async list(tenantId: string): Promise<Payment[]> {
    return this.paymentRepository.findByTenant(tenantId);
  }
}
