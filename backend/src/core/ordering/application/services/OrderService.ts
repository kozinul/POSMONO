import { UseCase } from '../../../../@shared/application/UseCase';
import { Order, IOrderItem } from '../../domain/Order';

interface CreateOrderInput {
  tenantId: string;
  items: IOrderItem[];
  customerId: string | null;
  cashierId: string;
  notes?: string;
  source: 'pos' | 'waiter' | 'online';
  metadata?: Record<string, unknown>;
}

export class CreateOrderService implements UseCase<CreateOrderInput, Order> {
  constructor(
    private readonly orderRepository: any,
    private readonly eventBus: any,
  ) {}

  async execute(input: CreateOrderInput): Promise<Order> {
    const subtotal = input.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const tax = input.items.reduce((sum, item) => sum + (item.tax?.amount || 0), 0);

    const order = Order.create({
      tenantId: input.tenantId,
      items: input.items,
      subtotal,
      discount: 0,
      tax,
      total: subtotal + tax,
      customerId: input.customerId,
      cashierId: input.cashierId,
      notes: input.notes || '',
      source: input.source,
      metadata: input.metadata || {},
    });

    await this.orderRepository.save(order);

    for (const event of order.domainEvents) {
      this.eventBus.publish(event);
    }

    return order;
  }
}
