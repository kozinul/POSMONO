import { OrderItem, OrderSource } from '../domain/ordering';

export interface OrderCreatedEvent {
  orderId: string;
  tenantId: string;
  orderNumber: string;
  items: OrderItem[];
  total: number;
  customerId: string | null;
  cashierId: string;
  source: OrderSource;
  metadata: Record<string, unknown>;
}

export interface OrderConfirmedEvent {
  orderId: string;
  tenantId: string;
  confirmedAt: Date;
}

export interface OrderCancelledEvent {
  orderId: string;
  tenantId: string;
  reason: string;
}

export interface OrderRefundedEvent {
  orderId: string;
  tenantId: string;
  refundAmount: number;
}
