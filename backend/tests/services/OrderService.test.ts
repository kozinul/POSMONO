import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateOrderService, ReplaceOrderItemsService, HoldOrderService, VoidOrderService, VoidItemService, VoidAndRollbackService } from '../../src/core/ordering/application/services/OrderService';
import { validOrderInput, validPaymentBreakdown } from '../fixtures/ordering.fixtures';

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

describe('ReplaceOrderItemsService', () => {
  function createService() {
    let saved: any = null;
    const orderRepo = {
      save: vi.fn((order: any) => {
        saved = order;
      }),
      findById: vi.fn(() => saved),
    };
    const eventBus = { publish: vi.fn() };
    return { orderRepo, eventBus };
  }

  it('replaces all items on a held order and publishes an updated event', async () => {
    const { orderRepo, eventBus } = createService();
    const createOrderService = new CreateOrderService(orderRepo, eventBus);
    const created = await createOrderService.execute(validOrderInput);

    const holdService = new HoldOrderService(orderRepo, eventBus);
    const held = await holdService.execute({ id: created.id.toValue() });
    expect(held.serialize().status).toBe('held');

    const replaceService = new ReplaceOrderItemsService(orderRepo, eventBus);
    const updated = await replaceService.execute({
      id: created.id.toValue(),
      items: [
        { productId: 'p9', variantId: null, productName: 'Mie Goreng', quantity: 1, unitPrice: 12000, totalPrice: 12000, modifiers: [], tax: { rate: 0, amount: 0 } },
        { productId: 'p10', variantId: null, productName: 'Es Teh', quantity: 2, unitPrice: 5000, totalPrice: 10000, modifiers: [], tax: { rate: 0, amount: 0 } },
      ],
      tableNumber: '5',
    });

    const serialized = updated.serialize();
    expect(serialized.status).toBe('held');
    expect(serialized.items).toHaveLength(2);
    expect(serialized.items[0].productName).toBe('Mie Goreng');
    expect(serialized.subtotal).toBe(22000);
    expect(serialized.total).toBe(22000);
    expect(serialized.tableNumber).toBe('5');

    const updatedEvents = updated.domainEvents.filter((e) => e.eventName === 'ordering.order.updated');
    expect(updatedEvents).toHaveLength(1);
    expect(updatedEvents[0].payload.items).toHaveLength(2);
    expect(updatedEvents[0].payload.total).toBe(22000);
  });

  it('throws when the order is not found', async () => {
    const { orderRepo, eventBus } = createService();
    const replaceService = new ReplaceOrderItemsService(orderRepo, eventBus);
    await expect(
      replaceService.execute({
        id: 'missing',
        items: [],
      }),
    ).rejects.toThrow('Order not found');
  });
});

describe('VoidOrderService', () => {
  function createService() {
    let saved: any = null;
    const orderRepo = {
      save: vi.fn((order: any) => {
        saved = order;
      }),
      findById: vi.fn(() => saved),
    };
    const eventBus = { publish: vi.fn() };
    const inventoryService = {
      restockForVoid: vi.fn().mockResolvedValue(undefined),
      releaseStock: vi.fn().mockResolvedValue(undefined),
    };
    return { orderRepo, eventBus, inventoryService };
  }

  it('restocks items when voiding a PAID order', async () => {
    const { orderRepo, eventBus, inventoryService } = createService();
    const created = await new CreateOrderService(orderRepo, eventBus).execute(validOrderInput);
    created.pay(validPaymentBreakdown, 'cashier-1', 'Kasir 1');

    const voidService = new VoidOrderService(orderRepo, eventBus, undefined, inventoryService);
    const voided = await voidService.execute({
      id: created.id.toValue(),
      tenantId: 'tenant-test-1',
      voidedBy: 'user-1',
      voidedByName: 'Admin',
      reason: 'Salah input',
    });

    expect(voided.serialize().status).toBe('voided');
    expect(inventoryService.restockForVoid).toHaveBeenCalledTimes(1);
    expect(inventoryService.releaseStock).not.toHaveBeenCalled();
    expect(inventoryService.restockForVoid).toHaveBeenCalledWith({
      tenantId: 'tenant-test-1',
      productId: 'product-1',
      quantity: 2,
      referenceId: created.id.toValue(),
      orderNumber: created.serialize().orderNumber,
      reason: 'Salah input',
      userId: 'user-1',
    });
  });

  it('releases reservation when voiding an UNPAID (open bill) order', async () => {
    const { orderRepo, eventBus, inventoryService } = createService();
    const created = await new CreateOrderService(orderRepo, eventBus).execute(validOrderInput);

    const voidService = new VoidOrderService(orderRepo, eventBus, undefined, inventoryService);
    await voidService.execute({
      id: created.id.toValue(),
      tenantId: 'tenant-test-1',
      voidedBy: 'user-1',
      voidedByName: 'Admin',
      reason: 'Bill ditutup tanpa pembayaran',
    });

    expect(inventoryService.restockForVoid).not.toHaveBeenCalled();
    expect(inventoryService.releaseStock).toHaveBeenCalledTimes(1);
    expect(inventoryService.releaseStock).toHaveBeenCalledWith({
      tenantId: 'tenant-test-1',
      productId: 'product-1',
      quantity: 2,
      referenceId: created.id.toValue(),
      userId: 'user-1',
    });
  });

  it('skips free items when restoring stock', async () => {
    const { orderRepo, eventBus, inventoryService } = createService();
    const created = await new CreateOrderService(orderRepo, eventBus).execute({
      ...validOrderInput,
      items: [{ ...validOrderInput.items[0], isFreeItem: true }],
    });
    created.pay(validPaymentBreakdown, 'cashier-1', 'Kasir 1');

    const voidService = new VoidOrderService(orderRepo, eventBus, undefined, inventoryService);
    await voidService.execute({
      id: created.id.toValue(),
      tenantId: 'tenant-test-1',
      voidedBy: 'user-1',
      voidedByName: 'Admin',
      reason: 'x',
    });

    expect(inventoryService.restockForVoid).not.toHaveBeenCalled();
    expect(inventoryService.releaseStock).not.toHaveBeenCalled();
  });

  it('does not fail when stock restore throws (best-effort)', async () => {
    const { orderRepo, eventBus, inventoryService } = createService();
    inventoryService.restockForVoid.mockRejectedValue(new Error('db down'));
    const created = await new CreateOrderService(orderRepo, eventBus).execute(validOrderInput);
    created.pay(validPaymentBreakdown, 'cashier-1', 'Kasir 1');

    const voidService = new VoidOrderService(orderRepo, eventBus, undefined, inventoryService);
    await expect(
      voidService.execute({
        id: created.id.toValue(),
        tenantId: 'tenant-test-1',
        voidedBy: 'user-1',
        voidedByName: 'Admin',
        reason: 'x',
      }),
    ).resolves.toBeDefined();
  });
});

describe('VoidItemService', () => {
  function createService() {
    let saved: any = null;
    const orderRepo = {
      save: vi.fn((order: any) => {
        saved = order;
      }),
      findById: vi.fn(() => saved),
    };
    const eventBus = { publish: vi.fn() };
    const inventoryService = {
      restockForVoid: vi.fn().mockResolvedValue(undefined),
      releaseStock: vi.fn().mockResolvedValue(undefined),
    };
    return { orderRepo, eventBus, inventoryService };
  }

  it('restores the voided quantity of a PAID item', async () => {
    const { orderRepo, eventBus, inventoryService } = createService();
    const created = await new CreateOrderService(orderRepo, eventBus).execute({
      ...validOrderInput,
      items: [{ ...validOrderInput.items[0], quantity: 3, totalPrice: 75000 }],
    });
    created.pay(validPaymentBreakdown, 'cashier-1', 'Kasir 1');

    const voidService = new VoidItemService(orderRepo, eventBus, undefined, inventoryService);
    await voidService.execute({
      id: created.id.toValue(),
      tenantId: 'tenant-test-1',
      itemIndex: 0,
      quantity: 2,
      reason: 'Pesanan salah',
      voidedBy: 'user-1',
      voidedByName: 'Admin',
    });

    expect(inventoryService.restockForVoid).toHaveBeenCalledTimes(1);
    expect(inventoryService.releaseStock).not.toHaveBeenCalled();
    expect(inventoryService.restockForVoid).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-test-1',
        productId: 'product-1',
        quantity: 2,
        reason: 'Pesanan salah',
        userId: 'user-1',
      }),
    );
  });

  it('releases reservation when voiding an item on an UNPAID (open bill) order', async () => {
    const { orderRepo, eventBus, inventoryService } = createService();
    const created = await new CreateOrderService(orderRepo, eventBus).execute(validOrderInput);

    const voidService = new VoidItemService(orderRepo, eventBus, undefined, inventoryService);
    await voidService.execute({
      id: created.id.toValue(),
      tenantId: 'tenant-test-1',
      itemIndex: 0,
      reason: 'Item tidak jadi',
      voidedBy: 'user-1',
      voidedByName: 'Admin',
    });

    expect(inventoryService.restockForVoid).not.toHaveBeenCalled();
    expect(inventoryService.releaseStock).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'product-1',
        quantity: 2,
        userId: 'user-1',
      }),
    );
  });

  it('restores full quantity when no partial quantity given', async () => {
    const { orderRepo, eventBus, inventoryService } = createService();
    const created = await new CreateOrderService(orderRepo, eventBus).execute(validOrderInput);
    created.pay(validPaymentBreakdown, 'cashier-1', 'Kasir 1');

    const voidService = new VoidItemService(orderRepo, eventBus, undefined, inventoryService);
    await voidService.execute({
      id: created.id.toValue(),
      tenantId: 'tenant-test-1',
      itemIndex: 0,
      reason: 'x',
      voidedBy: 'user-1',
      voidedByName: 'Admin',
    });

    expect(inventoryService.restockForVoid).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 2 }),
    );
  });

  it('skips restock for free items', async () => {
    const { orderRepo, eventBus, inventoryService } = createService();
    const created = await new CreateOrderService(orderRepo, eventBus).execute({
      ...validOrderInput,
      items: [{ ...validOrderInput.items[0], isFreeItem: true }],
    });
    created.pay(validPaymentBreakdown, 'cashier-1', 'Kasir 1');

    const voidService = new VoidItemService(orderRepo, eventBus, undefined, inventoryService);
    await voidService.execute({
      id: created.id.toValue(),
      tenantId: 'tenant-test-1',
      itemIndex: 0,
      reason: 'x',
      voidedBy: 'user-1',
      voidedByName: 'Admin',
    });

    expect(inventoryService.restockForVoid).not.toHaveBeenCalled();
    expect(inventoryService.releaseStock).not.toHaveBeenCalled();
  });
});

describe('VoidAndRollbackService', () => {
  function createService() {
    let saved: any = null;
    const orderRepo = {
      save: vi.fn((order: any) => {
        saved = order;
      }),
      findById: vi.fn(() => saved),
    };
    const eventBus = { publish: vi.fn() };
    const inventoryService = {
      restockForVoid: vi.fn().mockResolvedValue(undefined),
      releaseStock: vi.fn().mockResolvedValue(undefined),
    };
    return { orderRepo, eventBus, inventoryService };
  }

  it('restocks PAID items and rolls back payment when voiding', async () => {
    const { orderRepo, eventBus, inventoryService } = createService();
    const created = await new CreateOrderService(orderRepo, eventBus).execute(validOrderInput);
    created.pay(validPaymentBreakdown, 'cashier-1', 'Kasir 1');

    const voidService = new VoidAndRollbackService(orderRepo, eventBus, undefined, inventoryService);
    const voided = await voidService.execute({
      id: created.id.toValue(),
      tenantId: 'tenant-test-1',
      reason: 'Rollback',
      voidedBy: 'user-1',
      voidedByName: 'Admin',
    });

    expect(voided.serialize().status).toBe('voided');
    expect(inventoryService.restockForVoid).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'product-1',
        quantity: 2,
        reason: 'Rollback',
      }),
    );
    expect(inventoryService.releaseStock).not.toHaveBeenCalled();
  });

  it('releases reservation when rolling back an UNPAID (open bill) order', async () => {
    const { orderRepo, eventBus, inventoryService } = createService();
    const created = await new CreateOrderService(orderRepo, eventBus).execute(validOrderInput);

    const voidService = new VoidAndRollbackService(orderRepo, eventBus, undefined, inventoryService);
    await voidService.execute({
      id: created.id.toValue(),
      tenantId: 'tenant-test-1',
      reason: 'Rollback',
      voidedBy: 'user-1',
      voidedByName: 'Admin',
    });

    expect(inventoryService.restockForVoid).not.toHaveBeenCalled();
    expect(inventoryService.releaseStock).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'product-1',
        quantity: 2,
      }),
    );
  });
});
