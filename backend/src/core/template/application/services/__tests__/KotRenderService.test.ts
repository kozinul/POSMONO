import { describe, it, expect } from 'vitest';
import { KotRenderService } from '../KotRenderService';
import { IOrder } from '../../../../ordering/domain/Order';
import { ITenant } from '../../../../tenant/domain/Tenant';

const order = {
  id: 'ord_1',
  tenantId: 'dev-tenant',
  orderNumber: 'ORD-001',
  status: 'paid',
  items: [
    {
      productId: 'prd_1',
      variantId: null,
      productName: 'Kopi Hitam',
      quantity: 1,
      unitPrice: 21000,
      totalPrice: 21000,
      modifiers: [
        { groupId: 'grp-1', groupName: 'Custom', optionId: 'opt-large', optionName: 'Ukuran Besar', priceAdjustment: 3000 },
        { groupId: 'grp-1', groupName: 'Custom', optionId: 'opt-sugar', optionName: 'Extra Gula', priceAdjustment: 0 },
      ],
      tax: { rate: 0, amount: 0 },
    },
  ],
  subtotal: 21000,
  discount: 0,
  tax: 0,
  total: 21000,
  roundedPayable: 21000,
  serviceCharge: 0,
  roundingAdjustment: 0,
  paymentBreakdown: [],
  notes: '',
  transactionType: 'dine_in',
  tableNumber: 'A1',
  cashierId: 'usr_1',
  cashierName: 'Kasir',
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
} as unknown as IOrder;

const tenant = {
  id: 'dev-tenant',
  name: 'Toko ABC',
  address: 'Jl. Merdeka 1',
  phone: '08123',
  billingEmail: 'admin@tokoabc.com',
  config: {},
} as unknown as ITenant;

describe('KotRenderService.buildDocumentData', () => {
  const service = new KotRenderService({} as any);

  it('includes item modifiers so kitchen/bar see the customisation', () => {
    const data = service.buildDocumentData({ order, tenant });
    expect(data.items[0].modifiers).toEqual([
      { name: 'Ukuran Besar', price: 3000 },
      { name: 'Extra Gula', price: 0 },
    ]);
    expect(data.items[0].modifierLines).toContain('+ Ukuran Besar +Rp 3.000');
    expect(data.items[0].modifierLines).toContain('+ Extra Gula +Rp 0');
  });

  it('leaves modifierLines empty when an item has no modifiers', () => {
    const plainOrder = {
      ...order,
      items: [{ ...order.items[0], modifiers: [] }],
    } as unknown as IOrder;
    const data = service.buildDocumentData({ order: plainOrder, tenant });
    expect(data.items[0].modifierLines).toBe('');
  });
});
