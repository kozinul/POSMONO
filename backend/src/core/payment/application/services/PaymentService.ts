import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';
import { logger } from '../../../../@shared/infrastructure/logger/Logger';
import { Payment, PaymentMethod, ISplitBill } from '../../domain/Payment';
import { Refund } from '../../domain/Refund';
import { Order, IOrderItem, IPromotionBreakdown, IDiscountBreakdown } from '../../../ordering/domain/Order';
import { roundToDenomination, TotalRoundingMode } from '../../../tax/domain/RoundingEngine';
import { ReceiptRenderResult } from '../../../template/application/services/ReceiptRenderService';
import { ModifierValidationService, ModifierSelection } from '../../../catalog/application/services/ModifierValidationService';
import type { PaymentServiceDeps } from './PaymentServiceDeps';

export interface PaymentItemInput {
  productId: string;
  productName?: string;
  categoryId?: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
  pricingMode?: 'inclusive' | 'exclusive';
  isFreeItem?: boolean;
  modifiers?: ModifierSelection[];
}

type PaymentMethodTotals = { total: number; count: number };
type PaymentMethodRow = { method: string } & PaymentMethodTotals;
type PaymentSummaryBucket = {
  totalAmount: number;
  totalTransactions: number;
  methods: Record<string, PaymentMethodTotals>;
};
type OutletPaymentSummaryBucket = PaymentSummaryBucket & { outletId: string | null };
type TenantPaymentSummaryBucket = PaymentSummaryBucket & {
  tenantId: string;
  outlets: Record<string, OutletPaymentSummaryBucket>;
};

function toPaymentMethodRows(methods: Record<string, PaymentMethodTotals>): PaymentMethodRow[] {
  return Object.entries(methods).map(([method, totals]) => ({ method, ...totals }));
}

export class PaymentService {
  constructor(private readonly deps: PaymentServiceDeps) {}

  private async assertOpenShift(tenantId: string, cashierId: string, outletId?: string | null, providedShiftId?: string | null): Promise<{ shiftId: string; outletId: string | null }> {
    if (!this.deps.shiftRepository) return { shiftId: providedShiftId ?? '', outletId: null };
    const shift = outletId
      ? await this.deps.shiftRepository.findOpenShift(tenantId, cashierId, outletId)
      : await this.deps.shiftRepository.findOpenShift(tenantId, cashierId);
    if (!shift) {
      throw new ValidationError('Buka shift terlebih dahulu sebelum bertransaksi');
    }
    const shiftData = shift.serialize();
    return { shiftId: shiftData.id, outletId: shiftData.outletId ?? null };
  }

  private async resolveCashierName(cashierId: string, tenantId: string, fallback?: string): Promise<string> {
    if (this.deps.userRepository) {
      try {
        const user = await this.deps.userRepository.findByIdAndTenant(cashierId, tenantId);
        const name = user?.serialize().displayName;
        if (name) return name;
      } catch {
        // fall through to fallback
      }
    }
    return fallback ?? '';
  }

  private async getRoundingConfig(tenantId: string): Promise<{ enabled: boolean; mode: TotalRoundingMode; denomination: number }> {
    if (!this.deps.tenantRepository) return { enabled: false, mode: 'nearest', denomination: 0 };
    const tenant = await this.deps.tenantRepository.findById(tenantId);
    const cfg = tenant?.serialize().config;
    if (!cfg?.roundingEnabled || !cfg.roundingDenomination) return { enabled: false, mode: 'nearest', denomination: 0 };
    return { enabled: true, mode: (cfg.roundingMode || 'nearest') as TotalRoundingMode, denomination: cfg.roundingDenomination };
  }

  private async resolveModifierPrices(
    tenantId: string,
    items: PaymentItemInput[],
  ): Promise<PaymentItemInput[]> {
    if (!this.deps.productRepository || !this.deps.modifierRepository) return items;
    const validator = new ModifierValidationService(this.deps.modifierRepository);
    const productCache = new Map<string, any>();
    const resolvedItems: PaymentItemInput[] = [];

    const groupIdOf = (g: any): string => {
      if (!g) return '';
      if (typeof g.id === 'object' && g.id && typeof g.id.toValue === 'function') return g.id.toValue();
      if (typeof g.serialize === 'function') { const d = g.serialize(); return d.id || ''; }
      return g.id || g._id || '';
    };

    for (const item of items) {
      if (!item.modifiers || item.modifiers.length === 0) {
        resolvedItems.push(item);
        continue;
      }
      let product = productCache.get(item.productId);
      if (!product) {
        product = await this.deps.productRepository.findById(item.productId);
        if (!product) {
          resolvedItems.push(item);
          continue;
        }
        productCache.set(item.productId, product);
      }
      const productData = product.serialize();
      const applicableGroupIds = new Set<string>(productData.modifierGroupIds || []);
      try {
        const productGroups = await this.deps.modifierRepository.findByProduct(item.productId);
        for (const g of productGroups) {
          const gid = groupIdOf(g);
          if (gid) applicableGroupIds.add(gid);
        }
      } catch { /* best-effort */ }
      if (this.deps.categoryRepository && productData.categoryId) {
        try {
          const category = await this.deps.categoryRepository.findById(productData.categoryId);
          const familyId = category?.serialize().familyId;
          if (familyId) {
            const familyGroups = await this.deps.modifierRepository.findByFamily(familyId);
            for (const g of familyGroups) {
              const gid = groupIdOf(g);
              if (gid) applicableGroupIds.add(gid);
            }
          }
        } catch { /* best-effort */ }
      }
      const { resolvedModifiers } = await validator.validateAndResolve(
        tenantId,
        Array.from(applicableGroupIds),
        item.modifiers,
      );
      resolvedItems.push({
        ...item,
        modifiers: resolvedModifiers,
      });
    }
    return resolvedItems;
  }

  private async applyStockDeductions(order: Order, tenantId: string, userId: string): Promise<void> {
    if (!this.deps.inventoryService) return;
    const orderData = order.serialize();
    for (const item of orderData.items) {
      if (item.isFreeItem) continue;
      await this.deps.inventoryService.decrementForSale({
        tenantId,
        productId: item.productId,
        quantity: item.quantity,
        referenceId: orderData.id,
        userId,
      });
    }
  }

  private async applyStockRestore(order: Order, tenantId: string, userId: string): Promise<void> {
    if (!this.deps.inventoryService) return;
    const orderData = order.serialize();
    for (const item of orderData.items) {
      if (item.isFreeItem) continue;
      await this.deps.inventoryService.incrementForReturn({
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
    items: PaymentItemInput[];
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
    outletId?: string | null;
    cashierName?: string;
  }): Promise<{ payment: Payment; order: any; receipt: ReceiptRenderResult | null; pending?: boolean }> {
    const { shiftId, outletId: shiftOutletId } = await this.assertOpenShift(input.tenantId, input.cashierId, input.outletId, input.shiftId);
    const outletId = input.outletId ?? shiftOutletId ?? null;
    const roundMoney = (value: number) => Math.round(value);
    const inputItems = await this.resolveModifierPrices(input.tenantId, input.items);
    const rawSubtotal = inputItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const manualDiscountInput = input.discount ?? 0;
    const manualDiscountValue = input.discountType === 'percentage'
      ? roundMoney(rawSubtotal * (Math.min(manualDiscountInput, 100) / 100))
      : Math.min(manualDiscountInput, rawSubtotal);

    let promoDiscount = 0;
    let promotionBreakdown: IPromotionBreakdown[] = [];
    let discountBreakdownList: IDiscountBreakdown[] = [];

    if (this.deps.discountService) {
      const discountResult = await this.deps.discountService.apply({
        tenantId: input.tenantId,
        items: inputItems.map((item) => ({
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

    const taxResult = await this.deps.taxService.calculate({
      tenantId: input.tenantId,
      items: inputItems.map((item) => ({
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

    const orderItems: IOrderItem[] = inputItems.map((item) => {
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
        variantId: item.variantId ?? null,
        productName: item.productName || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.unitPrice * item.quantity,
        modifiers: item.modifiers || [],
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

    const taxResultAdjustments = taxResult.adjustments ?? [];
    const taxDetails = taxResultAdjustments
      .filter((a: { type: string }) => a.type === 'TAX')
      .map((a: { id: string; name: string; rate?: number; amount: number; base: number; metadata?: { modifier?: string } }) => ({
        ruleId: a.id,
        name: a.name,
        taxType: 'sales_tax',
        rate: a.rate ?? 0,
        amount: a.amount,
        baseAmount: a.base,
        fraction: a.metadata?.modifier && a.metadata.modifier.includes('/') ? a.metadata.modifier : undefined,
      }));
    const scRateAdjustment = taxResultAdjustments.find((a: { type: string }) => a.type === 'CHARGE');

    const cashierName = await this.resolveCashierName(input.cashierId, input.tenantId, input.cashierName);

    const order = Order.create({
      tenantId: input.tenantId,
      outletId,
      items: orderItems,
      subtotal,
      discount,
      discountTotal: discount,
      dppTotal,
      tax,
      taxDetails,
      total,
      roundingAdjustment,
      roundedPayable,
      roundingMethod,
      roundingDenomination: isCash && roundingConfig.enabled ? roundingConfig.denomination : 0,
      serviceCharge: serviceChargeTotal,
      serviceChargeRate: scRateAdjustment?.rate ?? 0,
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
      outletId,
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

    const paymentBreakdownEntry = {
      method: paymentMethod,
      code: refNumber,
      amount: input.amountPaid,
      change: Math.max(0, input.amountPaid - roundedPayable),
      cardLastFour: input.cardLastFour || undefined,
    };

    const isPendingTransfer = paymentMethod === 'transfer';

    if (isPendingTransfer) {
      await this.deps.orderRepository.save(order);
      await this.deps.paymentRepository.save(payment);
      return { payment, order, receipt: null, pending: true };
    }

    payment.complete();

    order.pay([paymentBreakdownEntry], input.cashierId, cashierName);

    await this.deps.orderRepository.save(order);
    await this.deps.paymentRepository.save(payment);

    await this.applyStockDeductions(order, input.tenantId, input.cashierId);

    for (const event of order.domainEvents) {
      this.deps.eventBus.publish(event);
    }
    for (const event of payment.domainEvents) {
      this.deps.eventBus.publish(event);
    }

    const receipt = await this.renderReceipt(order, payment, input.splitIndex, undefined, input.splitBaseOrderNumber);

    void this.autoPrintReceipt(input.tenantId, receipt);

    return { payment, order, receipt, pending: false };
  }

  private async autoPrintReceipt(tenantId: string, receipt: ReceiptRenderResult | null): Promise<void> {
    if (!receipt || !this.deps.printService) return;
    try {
      const tenant = await this.deps.tenantRepository.findById(tenantId);
      if (!tenant) return;
      if (!tenant.serialize().config?.autoPrintReceipt) return;
      await this.deps.printService.printEscPos({ tenantId, purpose: 'receipt', buffer: receipt.thermal });
    } catch {
      // auto-print must never break the transaction
    }
  }

  private async renderReceipt(order: Order, payment: Payment, splitIndex?: number, totalSplits?: number, splitBaseOrderNumber?: string): Promise<ReceiptRenderResult | null> {
    if (!this.deps.receiptRenderService) return null;
    try {
      const tenant = await this.deps.tenantRepository.findById(order.serialize().tenantId);
      if (!tenant) return null;
      return await this.deps.receiptRenderService.render({
        tenantId: order.serialize().tenantId,
        order: order.serialize(),
        payment: payment.serialize(),
        tenant: tenant.serialize(),
        splitIndex,
        totalSplits,
        splitBaseOrderNumber,
        payments: order.serialize().paymentBreakdown,
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
    outletId?: string | null;
  }): Promise<{ payment: Payment; order: Order; receipt: ReceiptRenderResult | null; pending?: boolean }> {
    const { shiftId, outletId: shiftOutletId } = await this.assertOpenShift(input.tenantId, input.cashierId, input.outletId, input.shiftId);
    const order = await this.deps.orderRepository.findById(input.orderId);
    if (!order) throw new NotFoundError('Order not found');

    const orderData = order.serialize();
    if (orderData.tenantId !== input.tenantId) throw new NotFoundError('Order not found');
    if (orderData.paymentStatus === 'completed') throw new ValidationError('Order is already paid');

    const outletId = input.outletId ?? orderData.outletId ?? shiftOutletId ?? null;

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
      outletId,
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

    const isPendingTransfer = input.method === 'transfer';

    if (isPendingTransfer) {
      await this.deps.orderRepository.save(order);
      await this.deps.paymentRepository.save(payment);
      return { payment, order, receipt: null, pending: true };
    }

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

    await this.deps.orderRepository.save(order);
    await this.deps.paymentRepository.save(payment);

    if (wasUnpaid) {
      await this.applyStockDeductions(order, input.tenantId, input.cashierId);
    }

    for (const event of order.domainEvents) {
      this.deps.eventBus.publish(event);
    }
    for (const event of payment.domainEvents) {
      this.deps.eventBus.publish(event);
    }

    const receipt = await this.renderReceipt(order, payment);

    void this.autoPrintReceipt(input.tenantId, receipt);

    return { payment, order, receipt, pending: false };
  }

  async listPendingTransfers(tenantId: string) {
    const payments = await this.deps.paymentRepository.findPending(tenantId);
    const result: Array<{ payment: any; order: any }> = [];
    for (const p of payments) {
      const paymentData = p.serialize();
      let orderInfo = null;
      const order = await this.deps.orderRepository.findById(paymentData.orderId);
      if (order && order.serialize().tenantId === tenantId) {
        const o = order.serialize();
        orderInfo = {
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          total: o.total,
          roundedPayable: o.roundedPayable || o.total,
          cashierName: o.cashierName || '',
        };
      }
      result.push({ payment: paymentData, order: orderInfo });
    }
    return result;
  }

  async confirmTransferPayment(input: {
    tenantId: string;
    paymentId: string;
    cashierId: string;
    cashierName?: string;
  }): Promise<{ payment: Payment; order: Order; receipt: ReceiptRenderResult | null }> {
    const payment = await this.deps.paymentRepository.findById(input.paymentId);
    if (!payment) throw new NotFoundError('Payment not found');
    const paymentData = payment.serialize();
    if (paymentData.tenantId !== input.tenantId) throw new NotFoundError('Payment not found');
    if (paymentData.status !== 'pending') {
      throw new ValidationError('Pembayaran sudah dikonfirmasi atau dibatalkan');
    }

    const order = await this.deps.orderRepository.findById(paymentData.orderId);
    if (!order) throw new NotFoundError('Order not found');
    const orderData = order.serialize();
    if (orderData.tenantId !== input.tenantId) throw new NotFoundError('Order not found');
    if (orderData.paymentStatus === 'completed') {
      throw new ValidationError('Order is already paid');
    }

    payment.complete();

    const wasUnpaid = orderData.paymentBreakdown.length === 0;
    const cashierName = await this.resolveCashierName(input.cashierId, input.tenantId, input.cashierName);
    const breakdownEntry = {
      method: paymentData.method,
      code: paymentData.referenceNumber,
      amount: paymentData.amount,
      change: 0,
      cardLastFour: paymentData.cardLastFour ?? undefined,
    };
    order.pay(
      wasUnpaid ? [breakdownEntry] : [...orderData.paymentBreakdown, breakdownEntry],
      input.cashierId,
      cashierName,
    );

    await this.deps.orderRepository.save(order);
    await this.deps.paymentRepository.save(payment);

    if (wasUnpaid) {
      await this.applyStockDeductions(order, input.tenantId, input.cashierId);
    }

    for (const event of order.domainEvents) {
      this.deps.eventBus.publish(event);
    }
    for (const event of payment.domainEvents) {
      this.deps.eventBus.publish(event);
    }

    const receipt = await this.renderReceipt(order, payment);
    void this.autoPrintReceipt(input.tenantId, receipt);

    return { payment, order, receipt };
  }

  async cancelTransferPayment(input: {
    tenantId: string;
    paymentId: string;
    reason?: string;
  }): Promise<{ payment: Payment; order: Order | null; orderCancelled: boolean }> {
    const payment = await this.deps.paymentRepository.findById(input.paymentId);
    if (!payment) throw new NotFoundError('Payment not found');
    const paymentData = payment.serialize();
    if (paymentData.tenantId !== input.tenantId) throw new NotFoundError('Payment not found');
    if (paymentData.status !== 'pending') {
      throw new ValidationError('Pembayaran sudah dikonfirmasi atau dibatalkan');
    }

    payment.fail(input.reason || 'Dibatalkan oleh kasir');

    const order = await this.deps.orderRepository.findById(paymentData.orderId);
    let orderCancelled = false;
    if (order && order.serialize().tenantId === input.tenantId) {
      const ordData = order.serialize();
      if (ordData.paymentStatus !== 'completed' && !['paid', 'refunded'].includes(ordData.status) && ordData.status !== 'cancelled') {
        order.cancel(input.reason || 'Transfer dibatalkan');
        if (this.deps.inventoryService) {
          for (const item of ordData.items) {
            if (item.isFreeItem) continue;
            try {
              await this.deps.inventoryService.releaseStock({
                tenantId: input.tenantId,
                productId: item.productId,
                quantity: item.quantity,
                referenceId: ordData.id,
                userId: input.tenantId,
              });
            } catch {
              // best-effort
            }
          }
        }
        await this.deps.orderRepository.save(order);
        orderCancelled = true;
      }
    }

    await this.deps.paymentRepository.save(payment);

    for (const event of payment.domainEvents) {
      this.deps.eventBus.publish(event);
    }
    if (orderCancelled) {
      for (const event of order!.domainEvents) {
        this.deps.eventBus.publish(event);
      }
    }

    return { payment, order: order ?? null, orderCancelled };
  }

  async confirmQrisPayment(input: {
    tenantId: string;
    referenceNumber: string;
    amount: number;
    orderId?: string;
    items?: Array<{ productId: string; productName?: string; categoryId?: string; quantity: number; unitPrice: number; pricingMode?: 'inclusive' | 'exclusive'; isFreeItem?: boolean; modifiers?: ModifierSelection[] }>;
    discount?: number;
    discountType?: 'percentage' | 'nominal';
    promoCode?: string;
    cashierId: string;
    cashierName?: string;
    shiftId?: string | null;
    outletId?: string | null;
  }): Promise<{ payment: Payment; order: Order; receipt: ReceiptRenderResult | null }> {
    const { referenceNumber, amount, orderId } = input;
    logger.info({ referenceNumber, amount, orderId, cashierId: input.cashierId, shiftId: input.shiftId }, '[QRIS] confirmQrisPayment started');

    if (!this.deps.qrisGatewayService) {
      logger.error('[QRIS] confirm rejected — gateway service not wired');
      throw new ValidationError('Layanan QRIS Gateway tidak tersedia');
    }
    if (!referenceNumber) {
      throw new ValidationError('Nomor referensi QRIS wajib diisi');
    }

    let order: Order | null = null;
    if (orderId) {
      order = await this.deps.orderRepository.findById(orderId);
      if (!order) throw new NotFoundError('Order not found');
      const orderData = order.serialize();
      if (orderData.tenantId !== input.tenantId) throw new NotFoundError('Order not found');
      if (orderData.paymentStatus === 'completed') {
        logger.warn({ referenceNumber, orderId }, '[QRIS] confirm rejected — order already paid');
        throw new ValidationError('Order is already paid');
      }
      const totalDue = orderData.total - orderData.paymentBreakdown.reduce((s: number, p: { amount: number }) => s + p.amount, 0);
      if (input.amount < totalDue) {
        logger.warn({ referenceNumber, orderId, amount: input.amount, totalDue }, '[QRIS] confirm rejected — insufficient amount');
        throw new ValidationError(`Insufficient amount. Need ${totalDue}, got ${input.amount}`);
      }
    } else if (!input.items || input.items.length === 0) {
      throw new ValidationError('orderId atau items wajib diisi untuk finalisasi QRIS');
    }

    if (typeof this.deps.paymentRepository.findByReferenceNumber === 'function') {
      const existing = await this.deps.paymentRepository.findByReferenceNumber(input.tenantId, referenceNumber);
      if (existing) {
        logger.warn({ referenceNumber, existingOrderId: existing.serialize?.()?.orderId }, '[QRIS] confirm rejected — reference already used');
        throw new ValidationError('Pembayaran QRIS ini sudah dikonfirmasi sebelumnya');
      }
    }

    const status = await this.deps.qrisGatewayService.checkStatus(input.tenantId, referenceNumber);
    logger.info({ referenceNumber, gatewayStatus: status.status, gatewayAmount: status.amount, paidAt: status.paidAt }, '[QRIS] gateway status checked');

    if (status.status === 'expired') {
      logger.warn({ referenceNumber }, '[QRIS] confirm rejected — invoice expired');
      throw new ValidationError('Invoice QRIS sudah kedaluwarsa. Buat QR baru.');
    }
    if (status.status === 'cancelled') {
      logger.warn({ referenceNumber }, '[QRIS] confirm rejected — invoice cancelled');
      throw new ValidationError('Invoice QRIS sudah dibatalkan.');
    }
    if (status.status !== 'paid') {
      logger.warn({ referenceNumber, status: status.status }, '[QRIS] confirm rejected — not yet paid');
      throw new ValidationError(`QRIS belum dibayar (status: ${status.status}). Tunggu konfirmasi pembayaran.`);
    }
    if (status.amount != null && status.amount !== input.amount) {
      logger.warn({ referenceNumber, gatewayAmount: status.amount, expectedAmount: input.amount }, '[QRIS] confirm rejected — amount mismatch');
      throw new ValidationError(`Nominal bayar gateway (${status.amount}) tidak sesuai tagihan (${input.amount})`);
    }

    if (order) {
      logger.info({ referenceNumber, orderId: order.serialize().id, path: 'processByOrderId' }, '[QRIS] finalizing existing order');
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
        outletId: input.outletId,
      });
    }

    logger.info({ referenceNumber, path: 'payCash', itemCount: input.items?.length }, '[QRIS] finalizing new sale via payCash');
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
      outletId: input.outletId,
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
    const payment = await this.deps.paymentRepository.findById(input.paymentId);
    if (!payment) throw new NotFoundError('Payment not found');

    const paymentData = payment.serialize();
    if (paymentData.tenantId !== input.tenantId) throw new NotFoundError('Payment not found');

    if (this.deps.shiftRepository) {
      const shift = paymentData.shiftId
        ? await this.deps.shiftRepository.findById(paymentData.shiftId)
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

    await this.deps.paymentRepository.save(payment);
    await this.deps.refundRepository.save(refund);

    const order = await this.deps.orderRepository.findById(paymentData.orderId);
    if (order && order.serialize().paymentBreakdown.length === 1) {
      await this.applyStockRestore(order, input.tenantId, input.refundedBy);
      order.markRefunded(input.refundedBy, input.refundedByName, input.reason);
      await this.deps.orderRepository.save(order);
    }

    for (const event of payment.domainEvents) {
      this.deps.eventBus.publish(event);
    }
    for (const event of refund.domainEvents) {
      this.deps.eventBus.publish(event);
    }
    if (order) {
      for (const event of order.domainEvents) {
        this.deps.eventBus.publish(event);
      }
    }

    return { refund, payment, order };
  }

  async listRefundable(tenantId: string, dateFrom?: string, dateTo?: string) {
    if (!this.deps.paymentRepository.findRefundable) return [];
    return this.deps.paymentRepository.findRefundable(tenantId, dateFrom, dateTo);
  }

  async payOpenBill(input: {
    tenantId: string;
    orderId: string;
    paymentBreakdown: Array<{ method: string; code: string; amount: number; change: number; cardLastFour?: string }>;
    cashierId: string;
    cashierName: string;
  }): Promise<Order> {
    await this.assertOpenShift(input.tenantId, input.cashierId);
    const order = await this.deps.orderRepository.findById(input.orderId);
    if (!order) throw new NotFoundError('Order not found');

    const orderData = order.serialize();
    if (orderData.tenantId !== input.tenantId) throw new NotFoundError('Order not found');

    const wasUnpaid = orderData.paymentBreakdown.length === 0;

    const cashierName = await this.resolveCashierName(input.cashierId, input.tenantId, input.cashierName);
    order.pay(input.paymentBreakdown, input.cashierId, cashierName);

    await this.deps.orderRepository.save(order);

    if (wasUnpaid) {
      await this.applyStockDeductions(order, input.tenantId, input.cashierId);
    }

    for (const event of order.domainEvents) {
      this.deps.eventBus.publish(event);
    }

    return order;
  }

  async splitBill(input: {
    tenantId: string;
    outletId?: string | null;
    orderId: string;
    splitBills: ISplitBill[];
    cashierId: string;
    shiftId?: string | null;
  }): Promise<{ payments: Payment[]; order: Order; receipts: (ReceiptRenderResult | null)[] }> {
    const { shiftId, outletId: shiftOutletId } = await this.assertOpenShift(input.tenantId, input.cashierId, input.outletId, input.shiftId);
    const order = await this.deps.orderRepository.findById(input.orderId);
    if (!order) throw new NotFoundError('Order not found');

    const orderData = order.serialize();
    if (orderData.tenantId !== input.tenantId) throw new NotFoundError('Order not found');

    const outletId = input.outletId ?? orderData.outletId ?? shiftOutletId ?? null;

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
        outletId,
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
      await this.deps.paymentRepository.save(payment);

      for (const event of payment.domainEvents) {
        this.deps.eventBus.publish(event);
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
    await this.deps.orderRepository.save(order);

    if (wasUnpaid) {
      await this.applyStockDeductions(order, input.tenantId, input.cashierId);
    }

    for (const event of order.domainEvents) {
      this.deps.eventBus.publish(event);
    }

    return { payments, order, receipts };
  }

  async getByOrder(tenantId: string, orderId: string): Promise<Payment | null> {
    return this.deps.paymentRepository.findByOrder(tenantId, orderId);
  }

  async list(tenantId: string): Promise<Payment[]> {
    return this.deps.paymentRepository.findByTenant(tenantId);
  }

  async getPlatformPaymentsSummary(
    tenantIds: string[],
    options?: { dateFrom?: Date; dateTo?: Date },
  ) {
    const payments = await this.deps.paymentRepository.findCompletedByTenantIds(tenantIds, {
      from: options?.dateFrom,
      to: options?.dateTo,
    });

    const totals: PaymentSummaryBucket = {
      totalAmount: 0,
      totalTransactions: 0,
      methods: {} as Record<string, PaymentMethodTotals>,
    };
    const perTenant: Record<string, PaymentSummaryBucket & { tenantId: string }> = {};

    for (const payment of payments) {
      const p = payment.serialize();
      const tenantBucket = (perTenant[p.tenantId] ??= {
        tenantId: p.tenantId,
        totalAmount: 0,
        totalTransactions: 0,
        methods: {} as Record<string, PaymentMethodTotals>,
      });
      const methodBucket = (tenantBucket.methods[p.method] ??= { total: 0, count: 0 });
      const totalMethodBucket = (totals.methods[p.method] ??= { total: 0, count: 0 });

      tenantBucket.totalAmount += p.amount;
      tenantBucket.totalTransactions += 1;
      methodBucket.total += p.amount;
      methodBucket.count += 1;
      totals.totalAmount += p.amount;
      totals.totalTransactions += 1;
      totalMethodBucket.total += p.amount;
      totalMethodBucket.count += 1;
    }

    const tenants = Object.values(perTenant).map((t) => ({
      tenantId: t.tenantId,
      totalAmount: t.totalAmount,
      totalTransactions: t.totalTransactions,
      methods: toPaymentMethodRows(t.methods),
    }));

    return {
      dateFrom: options?.dateFrom ?? null,
      dateTo: options?.dateTo ?? null,
      generatedAt: new Date().toISOString(),
      totals: {
        totalAmount: totals.totalAmount,
        totalTransactions: totals.totalTransactions,
        methods: toPaymentMethodRows(totals.methods),
      },
      tenants,
    };
  }

  /**
   * Tenant → outlet breakdown of completed payments (for the Hub consolidated
   * report). Mirrors the shape used by ShiftService.getPlatformShiftsSummary.
   */
  async getPlatformPaymentsConsolidationByOutlet(
    tenantIds: string[],
    options?: { dateFrom?: Date; dateTo?: Date },
  ) {
    const payments = await this.deps.paymentRepository.findCompletedByTenantIds(tenantIds, {
      from: options?.dateFrom,
      to: options?.dateTo,
    });

    const perTenant: Record<string, TenantPaymentSummaryBucket> = {};
    const totals: PaymentSummaryBucket = {
      totalAmount: 0,
      totalTransactions: 0,
      methods: {} as Record<string, PaymentMethodTotals>,
    };

    for (const payment of payments) {
      const p = payment.serialize();
      const tenantBucket = (perTenant[p.tenantId] ??= {
        tenantId: p.tenantId,
        totalAmount: 0,
        totalTransactions: 0,
        methods: {} as Record<string, PaymentMethodTotals>,
        outlets: {} as Record<string, OutletPaymentSummaryBucket>,
      });
      const outletKey = p.outletId ?? 'default';
      const outletBucket = (tenantBucket.outlets[outletKey] ??= {
        outletId: p.outletId ?? null,
        totalAmount: 0,
        totalTransactions: 0,
        methods: {} as Record<string, PaymentMethodTotals>,
      });

      const inc = (bucket: PaymentSummaryBucket) => {
        bucket.totalAmount += p.amount;
        bucket.totalTransactions += 1;
        const methodBucket = (bucket.methods[p.method] ??= { total: 0, count: 0 });
        methodBucket.total += p.amount;
        methodBucket.count += 1;
      };
      inc(tenantBucket);
      inc(outletBucket);
      inc(totals);
    }

    const tenants = Object.values(perTenant).map((t) => ({
      tenantId: t.tenantId,
      totalAmount: t.totalAmount,
      totalTransactions: t.totalTransactions,
      methods: toPaymentMethodRows(t.methods),
      outlets: Object.values(t.outlets).map((o) => ({
        outletId: o.outletId,
        totalAmount: o.totalAmount,
        totalTransactions: o.totalTransactions,
        methods: toPaymentMethodRows(o.methods),
      })),
    }));

    return {
      dateFrom: options?.dateFrom ?? null,
      dateTo: options?.dateTo ?? null,
      generatedAt: new Date().toISOString(),
      totals: {
        totalAmount: totals.totalAmount,
        totalTransactions: totals.totalTransactions,
        methods: toPaymentMethodRows(totals.methods),
      },
      tenants,
    };
  }
}
