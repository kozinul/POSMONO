import { describe, expect, it } from 'vitest';
import { ReceiptAssembler } from '../ReceiptAssembler';
import { IOrder, IOrderItem, ITaxDetail } from '../../../../ordering/domain/Order';
import { ITenant } from '../../../../tenant/domain/Tenant';
import { OutletRepository } from '../../../../outlet/domain/OutletRepository';

const outletRepository = {
  findById: async () => ({ serialize: () => ({ name: 'Outlet Senopati' }) }),
  findDefault: async () => ({ serialize: () => ({ name: 'Outlet Utama' }) }),
} as unknown as OutletRepository;

function makeItem(partial: Partial<IOrderItem> = {}): IOrderItem {
  return {
    productId: 'prod-1',
    variantId: null,
    productName: 'Nasi Goreng',
    quantity: 1,
    unitPrice: 15000,
    totalPrice: 15000,
    modifiers: [{ groupId: 'g1', groupName: 'Tambahan', optionId: 'o1', optionName: 'Telur', priceAdjustment: 5000 }],
    tax: { rate: 12, amount: 0 },
    ...partial,
  };
}

function makeOrder(partial: Partial<IOrder> = {}): IOrder {
  return {
    id: 'ord-1',
    tenantId: 'tenant-1',
    outletId: 'outlet-1',
    orderNumber: 'ORD-001',
    invoiceNumber: null,
    status: 'completed',
    items: [makeItem()],
    subtotal: 20000,
    discount: 0,
    discountTotal: 0,
    dppTotal: 17857,
    tax: 2143,
    taxDetails: [],
    total: 22143,
    roundingAdjustment: 0,
    roundedPayable: 0,
    roundingMethod: 'none',
    roundingDenomination: 0,
    serviceCharge: 0,
    serviceChargeRate: 0,
    paymentStatus: 'completed',
    paymentBreakdown: [],
    promotions: [],
    discountBreakdown: [],
    customerId: null,
    customerName: null,
    cashierId: 'user-1',
    cashierName: 'Budi',
    tableNumber: null,
    transactionType: 'dine_in',
    notes: '',
    source: 'pos',
    voidedItems: [],
    voidApprovals: [],
    voidedAt: null,
    voidedBy: null,
    voidedByName: null,
    voidReason: null,
    metadata: {},
    createdAt: new Date('2026-08-15T02:30:00.000Z'),
    paidAt: new Date('2026-08-15T02:30:00.000Z'),
    updatedAt: new Date('2026-08-15T02:30:00.000Z'),
    ...partial,
  };
}

function makeTenant(partial: Partial<ITenant['config']> = {}): ITenant {
  const base = {
    id: 'tenant-1',
    name: 'Warung Kopi',
    address: 'Jl. Merdeka No. 1',
    phone: '021-1234567',
    config: {
      timezone: 'Asia/Jakarta',
      locale: 'id-ID',
      taxName: 'PPN',
      receiptFooter: '',
      receiptLogo: '',
      ...partial,
    },
  } as unknown as ITenant;
  return base;
}

const assembler = new ReceiptAssembler(outletRepository);

describe('ReceiptAssembler', () => {
  it('builds store/order header with outlet lookup', async () => {
    const vm = await assembler.build({ order: makeOrder(), tenant: makeTenant() });
    expect(vm.store.name).toBe('Warung Kopi');
    expect(vm.store.outlet).toBe('Outlet Senopati');
    expect(vm.store.address).toBe('Jl. Merdeka No. 1');
    expect(vm.order.cashier).toBe('Budi');
  });

  it('formats date/time in tenant timezone', async () => {
    const vm = await assembler.build({
      order: makeOrder({ createdAt: new Date('2026-08-15T17:30:00.000Z') }),
      tenant: makeTenant({ timezone: 'Asia/Makassar' }),
    });
    expect(vm.order.date).toBe('16/08/2026');
    expect(vm.order.time).toBe('01:30');
  });

  it('builds line items with modifiers and free flag', async () => {
    const vm = await assembler.build({
      order: makeOrder({
        items: [
          makeItem({ productName: 'Nasi Goreng', quantity: 2, totalPrice: 30000, modifiers: [{ groupId: 'g1', groupName: 'Tambahan', optionId: 'o1', optionName: 'Telur', priceAdjustment: 5000 }] }),
          makeItem({ productId: 'prod-2', productName: 'Es Teh', quantity: 1, totalPrice: 0, isFreeItem: true, modifiers: [] }),
        ],
      }),
      tenant: makeTenant(),
    });
    expect(vm.items[0].modifierLines).toContain('+ Telur +Rp 5.000');
    expect(vm.items[1].isFreeItem).toBe(true);
  });

  it('renders zero-price modifiers without GRATIS text', async () => {
    const vm = await assembler.build({
      order: makeOrder({
        items: [
          makeItem({ productName: 'Nasi Goreng', quantity: 1, totalPrice: 15000, modifiers: [{ groupId: 'g1', groupName: 'Tambahan', optionId: 'o1', optionName: 'Telur', priceAdjustment: 5000 }, { groupId: 'g2', groupName: 'Saus', optionId: 'o2', optionName: 'Saos', priceAdjustment: 0 }] }),
        ],
      }),
      tenant: makeTenant(),
    });
    expect(vm.items[0].modifierLines).toContain('+ Telur +Rp 5.000');
    expect(vm.items[0].modifierLines).toContain('+ Saos +Rp 0');
    expect(vm.items[0].modifierLines).not.toContain('GRATIS');
  });

  it('computes change only from cash payments', async () => {
    const order = makeOrder({ total: 22143, roundedPayable: 0, invoiceNumber: 'INV-ORD-001' });
    const vm = await assembler.build({
      order,
      tenant: makeTenant(),
      payments: [
        { method: 'qris', code: 'QRIS-ABC123', amount: 22143, change: 0 },
        { method: 'cash', code: '', amount: 25000, change: 1857 },
      ],
    });
    expect(vm.payments[0].methodLabel).toBe('QRIS');
    expect(vm.payments[0].referenceLine).toBe('Ref: QRIS-ABC123');
    expect(vm.order.referenceNumber).toBe('INV-ORD-001');
    expect(vm.payments[1].methodLabel).toBe('Tunai');
    expect(vm.summary.change).toBeGreaterThan(0);
  });

  it('does not emit reference line for cash-only payments', async () => {
    const vm = await assembler.build({
      order: makeOrder({ roundedPayable: 22143 }),
      tenant: makeTenant(),
      payments: [{ method: 'cash', code: 'CASH-0001', amount: 25000, change: 2857 }],
    });
    expect(vm.payments[0].referenceLine).toBeUndefined();
    expect(vm.order.referenceNumber).toBeUndefined();
    expect(vm.summary.change).toBe(2857);
  });

  it('labels Nilai Lain tax with DPP fraction', async () => {
    const taxes: ITaxDetail[] = [
      { ruleId: 'tax-1', name: 'Uang Muka', taxType: 'sales_tax', rate: 12, amount: 2143, baseAmount: 17857, fraction: '11/12' },
    ];
    const vm = await assembler.build({ order: makeOrder({ taxDetails: taxes }), tenant: makeTenant() });
    expect(vm.summary.taxes[0].label).toBe('Uang Muka 12% (DPP 11/12)');
    expect(vm.summary.dppLabel).toBe('DPP Uang Muka (11/12)');
  });

  it('uses default footer with outlet name when receiptFooter empty', async () => {
    const vm = await assembler.build({ order: makeOrder(), tenant: makeTenant() });
    expect(vm.footer).toBe('Terima kasih telah berbelanja di Outlet Senopati');
  });

  it('returns empty payments/change when no payment data provided', async () => {
    const vm = await assembler.build({ order: makeOrder({ paidAt: null }), tenant: makeTenant() });
    expect(vm.payments).toEqual([]);
    expect(vm.summary.change).toBe(0);
    expect(vm.summary.grandTotal).toBe(22143);
  });

  it('uses roundedPayable as grand total when present', async () => {
    const vm = await assembler.build({
      order: makeOrder({ roundedPayable: 22200 }),
      tenant: makeTenant(),
      payments: [{ method: 'cash', code: '', amount: 25000, change: 2800 }],
    });
    expect(vm.summary.grandTotal).toBe(22200);
  });
});