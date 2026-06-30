export interface Invoice {
  id: string;
  tenantId: string;
  subscriptionId: string;
  number: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  dueDate: Date;
  paidAt: Date | null;
  lineItems: InvoiceLineItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceLineItem {
  description: string;
  amount: number;
  quantity: number;
  total: number;
}
