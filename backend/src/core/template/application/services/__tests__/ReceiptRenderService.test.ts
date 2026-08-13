import { describe, it, expect, vi } from 'vitest';
import { ReceiptRenderService } from '../ReceiptRenderService';
import { TemplateService } from '../TemplateService';
import { IOrder } from '../../../../ordering/domain/Order';
import { IPayment } from '../../../../payment/domain/Payment';
import { ITenant } from '../../../../tenant/domain/Tenant';

const order = {
  id: 'ord_1',
  tenantId: 'dev-tenant',
  orderNumber: 'ORD-001',
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
    },
  ],
  subtotal: 20000,
  discount: 0,
  discountTotal: 0,
  dppTotal: 20000,
  tax: 0,
  taxDetails: [],
  total: 20000,
  roundingAdjustment: 0,
  roundedPayable: 20000,
  roundingMethod: 'none',
  serviceCharge: 0,
  serviceChargeRate: 0,
  paymentStatus: 'paid',
  paymentBreakdown: [],
  promotions: [],
  discountBreakdown: [],
  customerId: null,
  customerName: null,
  cashierId: 'usr_1',
  cashierName: 'Kasir',
  tableNumber: null,
  transactionType: 'dine_in',
  notes: '',
  source: 'pos',
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
} as unknown as IOrder;

const payment = {
  id: 'pay_1',
  tenantId: 'dev-tenant',
  orderId: 'ord_1',
  amount: 50000,
  status: 'completed',
  method: 'cash',
  referenceNumber: 'REF-001',
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
  config: {
    timezone: 'Asia/Jakarta',
    currency: 'IDR',
    locale: 'id',
    taxRate: 0,
    taxName: '',
    ppnEnabled: false,
    ppnRate: 0,
    serviceChargeEnabled: false,
    serviceChargeRate: 0,
    serviceChargeName: '',
    discountMaxPercent: 100,
    discountMaxNominal: 0,
    receiptFooter: 'Terima kasih',
    receiptLogo: 'https://cdn.example.com/logo.png',
  },
} as unknown as ITenant;

describe('ReceiptRenderService.buildDocumentData', () => {
  const service = new ReceiptRenderService({} as TemplateService);

  it('maps tenant config receiptLogo into store.logo', () => {
    const data = service.buildDocumentData({ order, payment, tenant });
    expect(data.store.logo).toBe('https://cdn.example.com/logo.png');
    expect(data.store.name).toBe('Toko ABC');
  });

  it('falls back to empty logo when config is missing', () => {
    const noConfigTenant = {
      ...tenant,
      config: { ...tenant.config, receiptLogo: undefined },
    } as unknown as ITenant;
    const data = service.buildDocumentData({ order, payment, tenant: noConfigTenant });
    expect(data.store.logo).toBe('');
  });

  it('computes cash change from payment amount minus order total', () => {
    const data = service.buildDocumentData({ order, payment, tenant });
    expect(data.payments[0].change).toBe(30000);
  });

  it('sets change to 0 for non-cash payments', () => {
    const cardPayment = {
      ...payment,
      method: 'card',
      amount: 20000,
    } as unknown as IPayment;
    const data = service.buildDocumentData({ order, payment: cardPayment, tenant });
    expect(data.payments[0].change).toBe(0);
  });

  it('computes cash change against rounded payable when order is rounded', () => {
    const roundedOrder = {
      ...order,
      total: 36630,
      roundedPayable: 37000,
      roundingAdjustment: 370,
    } as unknown as IOrder;
    const exactPayment = {
      ...payment,
      amount: 37000,
    } as unknown as IPayment;
    const data = service.buildDocumentData({ order: roundedOrder, payment: exactPayment, tenant });
    expect(data.payments[0].change).toBe(0);
  });

  it('falls back to order total when order has no rounding', () => {
    const noRounding = {
      ...order,
      total: 36630,
      roundedPayable: 0,
      roundingAdjustment: 0,
    } as unknown as IOrder;
    const data = service.buildDocumentData({ order: noRounding, payment, tenant });
    expect(data.payments[0].change).toBe(13370);
  });
});
