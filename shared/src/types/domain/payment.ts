export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentMethod = 'cash' | 'qris' | 'transfer' | 'card';
export type TransactionType = 'sale' | 'refund' | 'fee';

export interface Payment {
  id: string;
  tenantId: string;
  orderId: string;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod;
  referenceNumber: string;
  metadata: {
    midtransTransactionId?: string;
    qrCodeUrl?: string;
  };
  paidAt: Date | null;
  createdAt: Date;
}

export interface Transaction {
  id: string;
  tenantId: string;
  paymentId: string;
  type: TransactionType;
  amount: number;
  provider: string;
  providerTransactionId: string;
  status: string;
  rawResponse: Record<string, unknown>;
  createdAt: Date;
}

export interface Refund {
  id: string;
  tenantId: string;
  orderId: string;
  paymentId: string;
  amount: number;
  reason: string;
  status: 'pending' | 'processed' | 'failed';
  processedAt: Date | null;
  createdAt: Date;
}
