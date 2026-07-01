import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';
import { Payment, PaymentMethod } from '../../domain/Payment';
import { Order, IOrderItem } from '../../../ordering/domain/Order';
import { calculateDiscount, calculateTotal } from '@posmono/shared';

export class PaymentService {
  constructor(
    private readonly paymentRepository: any,
    private readonly orderRepository: any,
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
    const isPercentage = input.discountType === 'percentage';
    const subtotal = input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const discountAmount = calculateDiscount(subtotal, discountValue, isPercentage);
    const tax = Math.round(subtotal * 0.1);
    const total = calculateTotal(subtotal, tax, discountAmount);

    const orderItems: IOrderItem[] = input.items.map((item) => ({
      productId: item.productId,
      variantId: null,
      productName: '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.unitPrice * item.quantity,
      modifiers: [],
      tax: { rate: 0.1, amount: Math.round(item.unitPrice * item.quantity * 0.1) },
    }));

    const order = Order.create({
      tenantId: input.tenantId,
      items: orderItems,
      subtotal,
      discount: discountAmount,
      tax,
      total,
      customerId: null,
      cashierId: input.cashierId,
      notes: '',
      source: 'pos',
      metadata: { discountType: input.discountType, discountValue },
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
      metadata: { cashierId: input.cashierId, discountAmount },
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
