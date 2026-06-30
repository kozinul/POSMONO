import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';
import { Payment, PaymentMethod } from '../../domain/Payment';

export class PaymentService {
  constructor(
    private readonly paymentRepository: any,
    private readonly orderRepository: any,
    private readonly eventBus: any,
  ) {}

  async payCash(input: { tenantId: string; orderId: string; amount: number; cashierId: string }): Promise<{ payment: Payment; order: any }> {
    const order = await this.orderRepository.findById(input.orderId);
    if (!order || order.serialize().tenantId !== input.tenantId) {
      throw new NotFoundError('Order', input.orderId);
    }

    const orderData = order.serialize();
    if (orderData.status === 'paid') {
      throw new ValidationError('Order is already paid');
    }
    if (orderData.status === 'cancelled') {
      throw new ValidationError('Cannot pay a cancelled order');
    }

    if (input.amount < orderData.total) {
      throw new ValidationError(`Insufficient amount. Need ${orderData.total}, got ${input.amount}`);
    }

    const payment = Payment.create({
      tenantId: input.tenantId,
      orderId: input.orderId,
      amount: input.amount,
      status: 'pending',
      method: 'cash' as PaymentMethod,
      referenceNumber: `CASH-${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`,
      metadata: { cashierId: input.cashierId },
      paidAt: null,
    });

    payment.complete();
    await this.paymentRepository.save(payment);

    order.markPaid();
    await this.orderRepository.save(order);

    for (const event of payment.domainEvents) {
      this.eventBus.publish(event);
    }
    for (const event of order.domainEvents) {
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
