import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateOrderService } from '../../src/core/ordering/application/services/OrderService';
import { validOrderInput } from '../fixtures/ordering.fixtures';

function createMockRepo() {
  return { save: vi.fn() };
}

function createMockEventBus() {
  return { publish: vi.fn() };
}

describe('CreateOrderService', () => {
  let orderRepo: ReturnType<typeof createMockRepo>;
  let eventBus: ReturnType<typeof createMockEventBus>;
  let service: CreateOrderService;

  beforeEach(() => {
    orderRepo = createMockRepo();
    eventBus = createMockEventBus();
    service = new CreateOrderService(orderRepo, eventBus);
  });

  it('creates an order with correct totals', async () => {
    const order = await service.execute(validOrderInput);

    const serialized = order.serialize();
    expect(serialized.tenantId).toBe('tenant-test-1');
    expect(serialized.status).toBe('draft');
    expect(serialized.paymentStatus).toBe('pending');
    expect(serialized.items).toHaveLength(1);
    expect(serialized.subtotal).toBe(50000);
    expect(serialized.total).toBe(50000);
    expect(serialized.source).toBe('pos');
  });

  it('calculates subtotal from item totalPrice', async () => {
    const input = {
      ...validOrderInput,
      items: [
        { productId: 'p1', productName: 'Item A', quantity: 2, unitPrice: 10000, totalPrice: 20000, variantId: null, modifiers: [], tax: { rate: 0, amount: 0 } },
        { productId: 'p2', productName: 'Item B', quantity: 1, unitPrice: 15000, totalPrice: 15000, variantId: null, modifiers: [], tax: { rate: 0, amount: 0 } },
      ],
    };

    const order = await service.execute(input);
    expect(order.serialize().subtotal).toBe(35000);
    expect(order.serialize().total).toBe(35000);
  });

  it('calculates tax from item tax amounts', async () => {
    const input = {
      ...validOrderInput,
      items: [
        { productId: 'p1', productName: 'Item A', quantity: 1, unitPrice: 10000, totalPrice: 10000, variantId: null, modifiers: [], tax: { rate: 12, amount: 1100 } },
      ],
      subtotal: 10000,
      discount: 0,
      tax: 0,
      total: 0,
    };

    const order = await service.execute(input);
    expect(order.serialize().tax).toBe(1100);
    expect(order.serialize().total).toBe(11100);
  });

  it('saves the order via repository', async () => {
    const order = await service.execute(validOrderInput);
    expect(orderRepo.save).toHaveBeenCalledTimes(1);
    expect(orderRepo.save).toHaveBeenCalledWith(order);
  });

  it('publishes domain events after saving', async () => {
    const order = await service.execute(validOrderInput);
    const events = order.domainEvents;
    expect(eventBus.publish).toHaveBeenCalledTimes(events.length);
    expect(events[0].eventName).toBe('ordering.order.created');
  });

  it('generates an order number', async () => {
    const order = await service.execute(validOrderInput);
    expect(order.serialize().orderNumber).toMatch(/^ORD-/);
  });

  it('generates a unique order ID', async () => {
    const order1 = await service.execute(validOrderInput);
    const order2 = await service.execute(validOrderInput);
    expect(order1.id.toValue()).not.toBe(order2.id.toValue());
  });
});
