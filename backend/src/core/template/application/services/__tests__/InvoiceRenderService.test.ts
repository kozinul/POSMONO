import { describe, it, expect } from 'vitest';
import { InvoiceRenderService } from '../InvoiceRenderService';
import { TemplateService } from '../TemplateService';
import { IOrder } from '../../../../ordering/domain/Order';
import { IPayment } from '../../../../payment/domain/Payment';
import { ITenant } from '../../../../tenant/domain/Tenant';

const order = {
  id: 'ord_1',
  tenantId: 'dev-tenant',
  orderNumber: 'ORD-001',
  invoiceNumber: null,
  status: 'completed',
  items: [
    {
      productId: 'prd_1',
      variantId: null,
      productName: 'Kopi',
      quantity: 2,
      unitPrice: 10000,
      totalPrice: 20000,
      modifiers: [],
      tax: { rate: 0, amount: 0 },
      isFreeItem: false,
    },
    {
      productId: 'prd_2',
      variantId: null,
      productName: 'Teh',
      quantity: 1,
      unitPrice: 5000,
      totalPrice: 0,
      modifiers: [],
      tax: { rate: 0, amount: 0 },
      isFreeItem: true,
    },
  ],
  subtotal: 25000,
  discount: 5000,
  discountTotal: 5000,
  dppTotal: 20000,
  tax: 2000,
  taxDetails: [],
  total: 27000,
  roundingAdjustment: 0,
  roundedPayable: 27000,
  roundingMethod: 'none',
  serviceCharge: 1000,
  serviceChargeRate: 0,
  paymentStatus: 'paid',
  paymentBreakdown: [],
  promotions: [],
  discountBreakdown: [],
  customerId: 'cst_1',
  customerName: 'Budi',
  cashierId: 'usr_1',
  cashierName: 'Kasir',
  tableNumber: 'T5',
  transactionType: 'dine_in',
  notes: '',
  source: 'pos',
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
} as unknown as IOrder;

const payment = {
  id: 'pay_1',
  tenantId: 'dev-tenant',
  orderId: 'ord_1',
  amount: 27000,
  status: 'completed',
  method: 'cash',
  referenceNumber: 'CASH-123',
  splitBills: [],
  qrCodeUrl: null,
  paymentTransactionId: null,
  provider: null,
  cardLastFour: null,
  metadata: {},
  paidAt: new Date('2026-01-02T03:04:05.000Z'),
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
  updatedAt: new Date('2026-01-02T03:04:05.000Z'),
} as unknown as IPayment;

const tenant = {
  id: 'dev-tenant',
  name: 'Toko ABC',
  address: 'Jl. Merdeka 1',
  phone: '08123',
  billingEmail: 'admin@tokoabc.com',
  config: {},
} as unknown as ITenant;

describe('InvoiceRenderService.buildDocumentData', () => {
  const service = new InvoiceRenderService({} as TemplateService);

  it('maps store + customer + order fields into document data', () => {
    const data = service.buildDocumentData({ order, payment, tenant });
    expect(data.store.name).toBe('Toko ABC');
    expect(data.store.address).toBe('Jl. Merdeka 1');
    expect(data.store.phone).toBe('08123');
    expect(data.store.email).toBe('admin@tokoabc.com');
    expect(data.customer.name).toBe('Budi');
    expect(data.order.table).toBe('T5');
    expect(data.order.cashier).toBe('Kasir');
    expect(data.order.type).toBe('dine_in');
    expect(data.order.date).toBe('2026-01-02');
    expect(data.order.time).toMatch(/^\d{2}:\d{2}$/);
  });

  it('computes subtotal as total minus discount and grandTotal from rounded payable', () => {
    const data = service.buildDocumentData({ order, payment, tenant });
    expect(data.summary.subtotal).toBe(20000);
    expect(data.summary.orderDiscount).toBe(5000);
    expect(data.summary.serviceCharge).toBe(1000);
    expect(data.summary.tax).toBe(2000);
    expect(data.summary.grandTotal).toBe(27000);
  });

  it('uses roundedPayable for grandTotal when denominasi pembulatan aktif', () => {
    const rounded = {
      ...order,
      total: 36630,
      roundedPayable: 37000,
      roundingAdjustment: 370,
    } as unknown as IOrder;
    const data = service.buildDocumentData({ order: rounded, payment, tenant });
    expect(data.summary.grandTotal).toBe(37000);
    expect(data.summary.rounding).toBe(370);
  });

  it('falls back to order.total when no rounded payable', () => {
    const noRounding = {
      ...order,
      total: 36630,
      roundedPayable: 0,
      roundingAdjustment: 0,
    } as unknown as IOrder;
    const data = service.buildDocumentData({ order: noRounding, payment, tenant });
    expect(data.summary.grandTotal).toBe(36630);
  });

  it('maps items incl. free item flag', () => {
    const data = service.buildDocumentData({ order, payment, tenant });
    expect(data.items).toHaveLength(2);
    expect(data.items[0]).toMatchObject({ name: 'Kopi', qty: 2, unitPrice: 10000, totalPrice: 20000, isFreeItem: false });
    expect(data.items[1].isFreeItem).toBe(true);
  });

  it('uses invoiceNumber or falls back to INV-{orderNumber}', () => {
    const withInv = {
      ...order,
      invoiceNumber: 'INV-2026-001',
    } as unknown as IOrder;
    expect(service.buildDocumentData({ order: withInv, payment, tenant }).order.documentNumber).toBe('INV-2026-001');
    expect(service.buildDocumentData({ order, payment, tenant }).order.documentNumber).toBe('INV-001');
  });

  it('includes payment method + amount as first payment', () => {
    const data = service.buildDocumentData({ order, payment, tenant });
    expect(data.payments).toEqual([{ method: 'cash', paidAmount: 27000, change: 0 }]);
    expect(data.order.referenceNumber).toBe('CASH-123');
  });

  it('leaves payments empty when no payment is given', () => {
    const data = service.buildDocumentData({ order, payment: null, tenant });
    expect(data.payments).toEqual([]);
    expect(data.order.referenceNumber).toBe('');
  });

  it('appends split suffix to document number', () => {
    const data = service.buildDocumentData({ order, payment, tenant, splitIndex: 2, splitBaseOrderNumber: 'ORD-001' });
    expect(data.order.documentNumber).toBe('INV-001/2');
  });
});