import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentService } from '../../src/core/payment/application/services/PaymentService';
import { ValidationError } from '../../src/@shared/infrastructure/error/AppError';

const TENANT_ID = 'tenant-test-1';

function createMockRepo() {
  return { save: vi.fn(), findById: vi.fn(), findByOrder: vi.fn(), findByTenant: vi.fn() };
}

function createMockEventBus() {
  return { publish: vi.fn() };
}

const validInput = {
  tenantId: TENANT_ID,
  cashierId: 'cashier-1',
  items: [
    { productId: 'p1', quantity: 2, unitPrice: 25000 },
  ],
  amountPaid: 55000,
};

describe('PaymentService', () => {
  let paymentRepo: ReturnType<typeof createMockRepo>;
  let orderRepo: ReturnType<typeof createMockRepo>;
  let eventBus: ReturnType<typeof createMockEventBus>;
  let service: PaymentService;

  beforeEach(() => {
    paymentRepo = createMockRepo();
    orderRepo = createMockRepo();
    eventBus = createMockEventBus();
    service = new PaymentService(paymentRepo, orderRepo, eventBus);
  });

  describe('payCash', () => {
    it('completes payment and creates order', async () => {
      const result = await service.payCash(validInput);

      const orderData = result.order.serialize();
      expect(orderData.status).toBe('paid');
      expect(orderData.paymentStatus).toBe('completed');
      expect(orderData.subtotal).toBe(50000);
      expect(orderData.tax).toBe(5000);
      expect(orderData.total).toBe(55000);
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
      expect(change).toBe(45000);
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
      expect(orderData.total).toBe(50000);
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
      expect(orderData.total).toBe(50000);
    });

    it('throws ValidationError when amount is insufficient', async () => {
      await expect(
        service.payCash({ ...validInput, amountPaid: 100 }),
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
});
