import { describe, it, expect, vi } from 'vitest';
import { PaymentService } from '../../src/core/payment/application/services/PaymentService';
import { Order } from '../../src/core/ordering/domain/Order';

const TENANT_ID = 'tenant-test-1';
const REF = 'QRIS-ABCDEF123456';

function createPendingOrder(): Order {
  const order = Order.create({
    tenantId: TENANT_ID,
    items: [
      {
        productId: 'p1',
        variantId: null,
        productName: 'Item A',
        quantity: 2,
        unitPrice: 10000,
        totalPrice: 20000,
        modifiers: [],
        tax: { rate: 0, amount: 0 },
        serviceCharge: 0,
        dpp: 20000,
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
    roundingDenomination: 0,
    serviceCharge: 0,
    serviceChargeRate: 0,
    paymentBreakdown: [],
    promotions: [],
    discountBreakdown: [],
    customerId: null,
    customerName: null,
    cashierId: 'cashier-1',
    cashierName: 'Kasir Satu',
    tableNumber: null,
    transactionType: 'dine_in',
    notes: '',
    source: 'pos',
    voidedItems: [],
    voidApprovals: [],
    metadata: {},
  });
  order.confirm();
  return order;
}

function createService(options: { gateway?: any; existingPayment?: any; order?: Order | null; openShift?: any } = {}) {
  const order = options.order !== undefined ? options.order : createPendingOrder();
  const paymentRepository = {
    save: vi.fn(async () => undefined),
    findByReferenceNumber: vi.fn(async () => options.existingPayment ?? null),
  };
  const orderRepository = {
    save: vi.fn(async () => undefined),
    findById: vi.fn(async () => order),
  };
  const tenantRepository = {
    findById: vi.fn(async () => ({ serialize: () => ({ config: {} }) })),
  };
  const taxService = {
    calculate: vi.fn(async () => ({
      subtotal: 20000,
      discount: 0,
      taxBase: 20000,
      taxAmount: 0,
      grandTotal: 20000,
      taxes: [],
      charges: [],
    })),
  };
  const eventBus = { publish: vi.fn() };
  const shiftRepository = {
    findOpenShift: vi.fn(async () => options.openShift === undefined ? { serialize: () => ({ id: 'shift-1' }) } : options.openShift),
  };
  const gateway =
    options.gateway ??
    {
      checkStatus: vi.fn(async () => ({ status: 'paid', paidAt: '2026-08-23T10:00:00Z', amount: 20000 })),
    };

  const service = new PaymentService(
    paymentRepository as any,
    orderRepository as any,
    {} as any,
    tenantRepository as any,
    taxService as any,
    undefined as any,
    eventBus as any,
    undefined as any,
    undefined as any,
    undefined as any,
    shiftRepository as any,
    undefined as any,
    gateway as any,
  );

  return { service, paymentRepository, orderRepository, eventBus, shiftRepository, gateway };
}

const baseInput = {
  tenantId: TENANT_ID,
  cashierId: 'cashier-1',
  referenceNumber: REF,
  amount: 20000,
};

describe('PaymentService.confirmQrisPayment — guards', () => {
  it('throws when QRIS gateway service is not wired', async () => {
    const bare = new PaymentService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    await expect(
      bare.confirmQrisPayment({ ...baseInput, orderId: 'order-1' }),
    ).rejects.toThrow('Layanan QRIS Gateway tidak tersedia');
  });

  it('throws when no open shift (server-side shift enforcement)', async () => {
    const { service } = createService({ openShift: null });
    await expect(
      service.confirmQrisPayment({ ...baseInput, orderId: 'order-1' }),
    ).rejects.toThrow('Buka shift terlebih dahulu');
  });

  it('rejects when reference number was already used for another payment', async () => {
    const { service } = createService({
      existingPayment: { serialize: () => ({ orderId: 'other-order' }) },
    });
    await expect(
      service.confirmQrisPayment({ ...baseInput, orderId: 'order-1' }),
    ).rejects.toThrow('sudah dikonfirmasi sebelumnya');
  });

  it('rejects when order is already paid (double-pay guard)', async () => {
    const paid = createPendingOrder();
    paid.pay([{ method: 'cash', code: 'CASH-1', amount: 20000, change: 0 }], 'c1', 'Kasir');
    const { service } = createService({ order: paid });
    await expect(
      service.confirmQrisPayment({ ...baseInput, orderId: 'order-1' }),
    ).rejects.toThrow('Order is already paid');
  });

  it('rejects when confirm amount is below remaining due', async () => {
    const { service } = createService();
    await expect(
      service.confirmQrisPayment({ ...baseInput, amount: 19000, orderId: 'order-1' }),
    ).rejects.toThrow('Insufficient amount');
  });

  it('rejects when gateway reports pending', async () => {
    const { service } = createService({
      gateway: { checkStatus: vi.fn(async () => ({ status: 'pending', paidAt: null, amount: null })) },
    });
    await expect(
      service.confirmQrisPayment({ ...baseInput, orderId: 'order-1' }),
    ).rejects.toThrow('QRIS belum dibayar');
  });

  it('rejects when gateway invoice expired', async () => {
    const { service } = createService({
      gateway: { checkStatus: vi.fn(async () => ({ status: 'expired', paidAt: null, amount: null })) },
    });
    await expect(
      service.confirmQrisPayment({ ...baseInput, orderId: 'order-1' }),
    ).rejects.toThrow('kedaluwarsa');
  });

  it('rejects when gateway invoice cancelled', async () => {
    const { service } = createService({
      gateway: { checkStatus: vi.fn(async () => ({ status: 'cancelled', paidAt: null, amount: null })) },
    });
    await expect(
      service.confirmQrisPayment({ ...baseInput, orderId: 'order-1' }),
    ).rejects.toThrow('dibatalkan');
  });

  it('rejects when gateway amount does not match tagihan', async () => {
    const { service } = createService({
      gateway: { checkStatus: vi.fn(async () => ({ status: 'paid', paidAt: null, amount: 25000 })) },
    });
    await expect(
      service.confirmQrisPayment({ ...baseInput, orderId: 'order-1' }),
    ).rejects.toThrow('tidak sesuai tagihan');
  });
});

describe('PaymentService.confirmQrisPayment — finalization', () => {
  it('finalizes an existing order via qris with gateway reference number', async () => {
    const { service, paymentRepository, orderRepository, eventBus } = createService();

    const result = await service.confirmQrisPayment({ ...baseInput, orderId: 'order-1' });

    const paymentData = result.payment.serialize();
    expect(paymentData.method).toBe('qris');
    expect(paymentData.referenceNumber).toBe(REF);
    expect(paymentData.status).toBe('completed');

    const orderData = result.order.serialize();
    expect(orderData.paymentStatus).toBe('completed');
    expect(orderData.paymentBreakdown).toHaveLength(1);
    expect(orderData.paymentBreakdown[0].method).toBe('qris');
    expect(orderData.paymentBreakdown[0].code).toBe(REF);

    expect(paymentRepository.save).toHaveBeenCalledTimes(1);
    expect(orderRepository.save).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalled();
  });

  it('creates a new sale from items when no orderId is given', async () => {
    const { service, paymentRepository, orderRepository } = createService();

    const result = await service.confirmQrisPayment({
      ...baseInput,
      items: [{ productId: 'p1', productName: 'Item A', quantity: 2, unitPrice: 10000 }],
    });

    expect(result.order.serialize().paymentStatus).toBe('completed');
    expect(result.order.serialize().paymentBreakdown[0].method).toBe('qris');
    expect(result.payment.serialize().referenceNumber).toBe(REF);
    expect(paymentRepository.save).toHaveBeenCalledTimes(1);
    expect(orderRepository.save).toHaveBeenCalledTimes(1);
  });

  it('records shiftId resolved server-side, not client value', async () => {
    const { service, paymentRepository } = createService();

    await service.confirmQrisPayment({ ...baseInput, orderId: 'order-1', shiftId: 'fake-client-shift' });

    const saved = paymentRepository.save.mock.calls[0][0];
    expect(saved.serialize().shiftId).toBe('shift-1');
  });
});
