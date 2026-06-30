import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentService } from '../../src/core/payment/application/services/PaymentService';
import { Order } from '../../src/core/ordering/domain/Order';
import { NotFoundError, ValidationError } from '../../src/@shared/infrastructure/error/AppError';

const TENANT_ID = 'tenant-test-1';

function createOrder() {
  return Order.create({
    tenantId: TENANT_ID,
    items: [{ productId: 'p1', productName: 'Nasi Goreng', quantity: 2, unitPrice: 25000, totalPrice: 50000, variantId: null, modifiers: [], tax: { rate: 0, amount: 0 } }],
    subtotal: 50000,
    discount: 0,
    tax: 0,
    total: 50000,
    customerId: null,
    cashierId: 'cashier-1',
    notes: '',
    source: 'pos',
    metadata: {},
  });
}

function createMockRepo() {
  return { save: vi.fn(), findById: vi.fn(), findByOrder: vi.fn(), findByTenant: vi.fn() };
}

function createMockEventBus() {
  return { publish: vi.fn() };
}

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
    it('completes payment for a valid order', async () => {
      const order = createOrder();
      orderRepo.findById.mockResolvedValue(order);

      const result = await service.payCash({
        tenantId: TENANT_ID,
        orderId: order.id.toValue(),
        amount: 50000,
        cashierId: 'cashier-1',
      });

      expect(result.payment.serialize().status).toBe('completed');
      expect(result.order.serialize().status).toBe('paid');
      expect(result.order.serialize().paymentStatus).toBe('completed');
      expect(paymentRepo.save).toHaveBeenCalledTimes(1);
      expect(orderRepo.save).toHaveBeenCalledTimes(1);
    });

    it('generates a reference number starting with CASH-', async () => {
      const order = createOrder();
      orderRepo.findById.mockResolvedValue(order);

      const result = await service.payCash({
        tenantId: TENANT_ID,
        orderId: order.id.toValue(),
        amount: 50000,
        cashierId: 'cashier-1',
      });

      expect(result.payment.serialize().referenceNumber).toMatch(/^CASH-/);
    });

    it('publishes both payment and order domain events', async () => {
      const order = createOrder();
      orderRepo.findById.mockResolvedValue(order);

      await service.payCash({
        tenantId: TENANT_ID,
        orderId: order.id.toValue(),
        amount: 50000,
        cashierId: 'cashier-1',
      });

      const paymentEvents = eventBus.publish.mock.calls.filter(
        (call: any) => call[0].eventName === 'payment.transaction.completed',
      );
      expect(paymentEvents).toHaveLength(1);
    });

    it('calculates change when amount exceeds total', async () => {
      const order = createOrder();
      orderRepo.findById.mockResolvedValue(order);

      const result = await service.payCash({
        tenantId: TENANT_ID,
        orderId: order.id.toValue(),
        amount: 100000,
        cashierId: 'cashier-1',
      });

      const change = result.payment.serialize().amount - result.order.serialize().total;
      expect(change).toBe(50000);
    });

    it('throws NotFoundError when order does not exist', async () => {
      orderRepo.findById.mockResolvedValue(null);

      await expect(
        service.payCash({ tenantId: TENANT_ID, orderId: 'nonexistent', amount: 50000, cashierId: 'cashier-1' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError for cross-tenant order access', async () => {
      const order = createOrder();
      orderRepo.findById.mockResolvedValue(order);

      await expect(
        service.payCash({ tenantId: 'other-tenant', orderId: order.id.toValue(), amount: 50000, cashierId: 'cashier-1' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError when order is already paid', async () => {
      const order = createOrder();
      order.markPaid();
      orderRepo.findById.mockResolvedValue(order);

      await expect(
        service.payCash({ tenantId: TENANT_ID, orderId: order.id.toValue(), amount: 50000, cashierId: 'cashier-1' }),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when order is cancelled', async () => {
      const order = createOrder();
      order.cancel('test');
      orderRepo.findById.mockResolvedValue(order);

      await expect(
        service.payCash({ tenantId: TENANT_ID, orderId: order.id.toValue(), amount: 50000, cashierId: 'cashier-1' }),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when amount is insufficient', async () => {
      const order = createOrder();
      orderRepo.findById.mockResolvedValue(order);

      await expect(
        service.payCash({ tenantId: TENANT_ID, orderId: order.id.toValue(), amount: 100, cashierId: 'cashier-1' }),
      ).rejects.toThrow(ValidationError);
    });

    it('throws PaymentNotFound when orderId is from other tenant', async () => {
      const order = createOrder();
      orderRepo.findById.mockResolvedValue(order);

      await expect(
        service.payCash({ tenantId: 'wrong-tenant', orderId: order.id.toValue(), amount: 50000, cashierId: 'cashier-1' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('preserves payment metadata with cashierId', async () => {
      const order = createOrder();
      orderRepo.findById.mockResolvedValue(order);
      const cashierId = 'cashier-abc-123';

      const result = await service.payCash({
        tenantId: TENANT_ID,
        orderId: order.id.toValue(),
        amount: 50000,
        cashierId,
      });

      expect(result.payment.serialize().metadata).toEqual({ cashierId });
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
