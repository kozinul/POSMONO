export interface QrisInvoice {
  tenantId: string;
  referenceNumber: string;
  invid: string | null;
  amount: number;
  trxDate: string;
  createdAt: Date;
}
