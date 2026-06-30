import { PaymentMethod } from '../domain/payment';

export interface PaymentCompletedEvent {
  transactionId: string;
  orderId: string;
  tenantId: string;
  amount: number;
  method: PaymentMethod;
  paidAt: Date;
}

export interface PaymentFailedEvent {
  transactionId: string;
  orderId: string;
  tenantId: string;
  reason: string;
}

export interface RefundProcessedEvent {
  transactionId: string;
  orderId: string;
  tenantId: string;
  refundAmount: number;
}
