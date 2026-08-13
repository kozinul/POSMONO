import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentService } from '../../src/core/payment/application/services/PaymentService';
import { ValidationError } from '../../src/@shared/infrastructure/error/AppError';
import { Payment } from '../../src/core/payment/domain/Payment';
import { Order } from '../../src/core/ordering/domain/Order';

const TENANT_ID = 'tenant-test-1';

function createMockRepo() {
  return { save: vi.fn(), findById: vi.fn(), findByOrder: vi.fn(), findByTenant: vi.fn() };
}

function createMockEventBus() {
  return { publish: vi.fn() };
}

function createMockTaxService() {
  return {
    calculate: vi.fn().mockImplementation((input: any) => {
      const subtotal = input.items.reduce((s: number, i: any) => s + i.quantity * i.unitPrice, 0);
      const discountValue = input.discount ?? 0;
      const isPercentage = input.discountType === 'percentage';
      const discountAmount = isPercentage
        ? Math.round(subtotal * Math.min(discountValue, 100) / 100)
        : Math.min(discountValue, subtotal);
      const taxableAmount = subtotal - discountAmount;
      const base = Math.round(taxableAmount * 11 / 12);
      const pajak = Math.round(base * 12 / 100);
      return {
        subtotal,
        adjustments: [],
        discount: discountValue,
        charges: [],
        taxBase: base,
        modifier: { type: 'tax', before: taxableAmount, after: base },
        taxes: [{ name: 'Pajak 12%', type: 'vat', rate: 12, baseAmount: taxableAmount, amount: pajak, compoundOrder: 0 }],
        taxAmount: pajak,
        serviceCharge: 0,
        grandTotal: taxableAmount + pajak,
        pricingMode: 'exclusive',
      };
    }),
  };
}

const validInput = {
  tenantId: TENANT_ID,
  cashierId: 'cashier-1',
  items: [
    { productId: 'p1', quantity: 2, unitPrice: 25000 },
  ],
  amountPaid: 55500,
};

describe('PaymentService', () => {
  let paymentRepo: ReturnType<typeof createMockRepo>;
  let orderRepo: ReturnType<typeof createMockRepo>;
  let taxService: ReturnType<typeof createMockTaxService>;
  let eventBus: ReturnType<typeof createMockEventBus>;
  let service: PaymentService;

  beforeEach(() => {
    paymentRepo = createMockRepo();
    orderRepo = createMockRepo();
    taxService = createMockTaxService();
    eventBus = createMockEventBus();
    service = new PaymentService(paymentRepo, orderRepo, null as any, null as any, taxService as any, null as any, eventBus);
  });

  describe('payCash', () => {
    it('completes payment and creates order', async () => {
      const result = await service.payCash(validInput);

      const orderData = result.order.serialize();
      expect(orderData.status).toBe('paid');
      expect(orderData.paymentStatus).toBe('completed');
      expect(orderData.subtotal).toBe(50000);
      expect(orderData.tax).toBe(5500);
      expect(orderData.total).toBe(55500);
      expect(orderData.discount).toBe(0);

      expect(result.payment.serialize().status).toBe('completed');
      expect(result.payment.serialize().orderId).toBe(orderData.id);
      expect(paymentRepo.save).toHaveBeenCalledTimes(1);
      expect(orderRepo.save).toHaveBeenCalledTimes(1);
    });

    it('generates a reference number starting with CASH-', async () => {
      const result = await service.payCash(validInput);
      expect(result.payment.serialize().referenceNumber).toMatch(/^CASH-/);
    });

    it('publishes both payment and order domain events', async () => {
      await service.payCash(validInput);

      const paymentEvents = eventBus.publish.mock.calls.filter(
        (call: any) => call[0].eventName === 'payment.transaction.completed',
      );
      expect(paymentEvents).toHaveLength(1);

      const orderEvents = eventBus.publish.mock.calls.filter(
        (call: any) => call[0].eventName === 'ordering.order.created',
      );
      expect(orderEvents).toHaveLength(1);
    });

    it('calculates change when amount exceeds total', async () => {
      const result = await service.payCash({
        ...validInput,
        amountPaid: 100000,
      });

      const change = result.payment.serialize().amount - result.order.serialize().total;
      expect(change).toBe(44500);
    });

    it('applies nominal discount', async () => {
      const result = await service.payCash({
        ...validInput,
        discount: 5000,
        discountType: 'nominal',
      });

      const orderData = result.order.serialize();
      expect(orderData.subtotal).toBe(50000);
      expect(orderData.discount).toBe(5000);
      expect(orderData.total).toBe(49950);
    });

    it('applies percentage discount', async () => {
      const result = await service.payCash({
        ...validInput,
        discount: 10,
        discountType: 'percentage',
      });

      const orderData = result.order.serialize();
      expect(orderData.subtotal).toBe(50000);
      expect(orderData.discount).toBe(5000);
      expect(orderData.total).toBe(49950);
    });

    it('throws ValidationError when amount is insufficient', async () => {
      await expect(
        service.payCash({ ...validInput, amountPaid: 10000 }),
      ).rejects.toThrow(ValidationError);
    });

    it('preserves payment metadata with cashierId', async () => {
      const result = await service.payCash(validInput);
      expect(result.payment.serialize().metadata).toHaveProperty('cashierId', 'cashier-1');
    });
  });

  describe('getByOrder', () => {
    it('returns payment for given order', async () => {
      paymentRepo.findByOrder.mockResolvedValue({ id: 'pay-1' });
      const result = await service.getByOrder(TENANT_ID, 'order-1');
      expect(paymentRepo.findByOrder).toHaveBeenCalledWith(TENANT_ID, 'order-1');
      expect(result).toEqual({ id: 'pay-1' });
    });
  });

  describe('list', () => {
    it('returns all payments for tenant', async () => {
      paymentRepo.findByTenant.mockResolvedValue([{ id: 'pay-1' }]);
      const result = await service.list(TENANT_ID);
      expect(paymentRepo.findByTenant).toHaveBeenCalledWith(TENANT_ID);
      expect(result).toHaveLength(1);
    });
  });

  describe('refund', () => {
    const reason = 'Salah input kasir';

    function createPaidPayment(shiftId: string | null): Payment {
      return Payment.hydrate({
        id: 'pay-refund-1',
        tenantId: TENANT_ID,
        orderId: 'order-1',
        amount: 55500,
        status: 'completed',
        method: 'cash',
        shiftId,
        referenceNumber: '',
        splitBills: [],
        qrCodeUrl: null,
        paymentTransactionId: null,
        provider: null,
        cardLastFour: null,
        metadata: {},
        paidAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
    }

    function createPaidOrder(): Order {
      return Order.hydrate({
        id: 'order-1',
        tenantId: TENANT_ID,
        orderNumber: 'ORD-001',
        status: 'paid',
        items: [],
        subtotal: 50000,
        discount: 0,
        discountTotal: 0,
        dppTotal: 50000,
        tax: 5500,
        taxDetails: [],
        total: 55500,
        roundingAdjustment: 0,
        roundedPayable: 55500,
        roundingMethod: 'nearest',
        roundingDenomination: 0,
        serviceCharge: 0,
        serviceChargeRate: 0,
        paymentStatus: 'completed',
        paymentBreakdown: [{ method: 'cash', code: 'cash', amount: 55500, change: 0 }],
        promotions: [],
        discountBreakdown: [],
        customerId: null,
        customerName: null,
        cashierId: 'cashier-1',
        cashierName: 'Kasir',
        tableNumber: null,
        transactionType: 'dine-in',
        notes: '',
        source: 'pos',
        voidedItems: [],
        voidApprovals: [],
        voidedAt: null,
        voidedBy: null,
        voidedByName: null,
        voidReason: null,
        metadata: {},
        createdAt: new Date(),
        paidAt: new Date(),
        updatedAt: new Date(),
      } as never);
    }

    function createShiftRepoMock(status: 'open' | 'closed' | null) {
      return {
        findById: vi.fn().mockResolvedValue(
          status === null ? null : { serialize: () => ({ id: 'shift-1', status }) },
        ),
      };
    }

    function withShiftRepo(shiftRepo: unknown, refundRepo: { save: ReturnType<typeof vi.fn> }) {
      return new PaymentService(
        paymentRepo,
        orderRepo,
        refundRepo as never,
        null as never,
        taxService as never,
        null as never,
        eventBus,
        undefined,
        undefined,
        undefined,
        shiftRepo as never,
      );
    }

    it('rejects refund when payment not found', async () => {
      paymentRepo.findById.mockResolvedValue(null);
      await expect(
        service.refund({ tenantId: TENANT_ID, paymentId: 'nope', reason, refundedBy: 'u1', refundedByName: 'Owner' }),
      ).rejects.toThrow('Payment not found');
    });

    it('rejects refund when payment has no shiftId', async () => {
      paymentRepo.findById.mockResolvedValue(createPaidPayment(null));
      const svc = withShiftRepo(createShiftRepoMock('closed'), { save: vi.fn() });
      await expect(
        svc.refund({ tenantId: TENANT_ID, paymentId: 'pay-refund-1', reason, refundedBy: 'u1', refundedByName: 'Owner' }),
      ).rejects.toThrow('Transaksi tidak tercatat pada shift, tidak dapat direfund.');
    });

    it('rejects refund while shift is still open', async () => {
      paymentRepo.findById.mockResolvedValue(createPaidPayment('shift-1'));
      const svc = withShiftRepo(createShiftRepoMock('open'), { save: vi.fn() });
      await expect(
        svc.refund({ tenantId: TENANT_ID, paymentId: 'pay-refund-1', reason, refundedBy: 'u1', refundedByName: 'Owner' }),
      ).rejects.toThrow('Shift masih berjalan. Gunakan void untuk membatalkan transaksi.');
    });

    it('refunds payment from closed shift and marks order refunded', async () => {
      paymentRepo.findById.mockResolvedValue(createPaidPayment('shift-1'));
      orderRepo.findById.mockResolvedValue(createPaidOrder());
      const refundRepo = { save: vi.fn() };
      const svc = withShiftRepo(createShiftRepoMock('closed'), refundRepo);

      const result = await svc.refund({
        tenantId: TENANT_ID,
        paymentId: 'pay-refund-1',
        reason,
        refundedBy: 'u1',
        refundedByName: 'Owner',
      });

      expect(result.payment.serialize().status).toBe('refunded');
      expect(result.order?.serialize().status).toBe('refunded');
      expect(result.order?.serialize().voidReason).toBe(reason);
      expect(result.order?.serialize().voidedByName).toBe('Owner');
      expect(refundRepo.save).toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalled();
    });

    it('refunds without shift validation when shiftRepository not provided (legacy)', async () => {
      paymentRepo.findById.mockResolvedValue(createPaidPayment('shift-1'));
      orderRepo.findById.mockResolvedValue(null);
      const refundRepo = { save: vi.fn() };
      const svc = new PaymentService(
        paymentRepo,
        orderRepo,
        refundRepo as never,
        null as never,
        taxService as never,
        null as never,
        eventBus,
      );

      const result = await svc.refund({
        tenantId: TENANT_ID,
        paymentId: 'pay-refund-1',
        reason,
        refundedBy: 'u1',
        refundedByName: 'Owner',
      });

      expect(result.payment.serialize().status).toBe('refunded');
      expect(result.order).toBeNull();
      expect(refundRepo.save).toHaveBeenCalled();
    });
  });

  describe('listRefundable', () => {
    it('returns empty array when repository does not support findRefundable', async () => {
      const result = await service.listRefundable(TENANT_ID);
      expect(result).toEqual([]);
    });

    it('delegates to repository findRefundable', async () => {
      paymentRepo.findRefundable = vi.fn().mockResolvedValue([{ paymentId: 'pay-1' }]);
      const result = await service.listRefundable(TENANT_ID, '2026-08-01', '2026-08-13');
      expect(paymentRepo.findRefundable).toHaveBeenCalledWith(TENANT_ID, '2026-08-01', '2026-08-13');
      expect(result).toHaveLength(1);
    });
  });
});
