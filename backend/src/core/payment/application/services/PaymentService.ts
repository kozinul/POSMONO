import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';
import { Payment, PaymentMethod } from '../../domain/Payment';
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

  async getByOrder(tenantId: string, orderId: string): Promise<Payment | null> {
    return this.paymentRepository.findByOrder(tenantId, orderId);
  }

  async list(tenantId: string): Promise<Payment[]> {
    return this.paymentRepository.findByTenant(tenantId);
  }
}
