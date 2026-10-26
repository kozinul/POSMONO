import { describe, it, expect, vi } from 'vitest';
import { KdsService } from '../../src/core/kds/application/services/KdsService';
import { Station } from '../../src/core/kds/domain/Station';
import { StationTicket } from '../../src/core/kds/domain/StationTicket';
import type { Order } from '../../src/core/ordering/domain/Order';

function makeStation(categoryIds: string[], outletId = 'outlet-1'): Station {
  return Station.create({
    tenantId: 'tenant-1',
    outletId,
    name: `Station ${categoryIds.join('-')}`,
    kind: 'kitchen',
    categoryIds,
  });
}

function makeOrder(overrides: Record<string, unknown> = {}): Order {
  return {
    serialize: () => ({
      tenantId: 'tenant-1',
      outletId: 'outlet-1',
      orderNumber: 'ORD-1',
      tableNumber: 'A1',
      source: 'pos',
      items: [
        { productId: 'p-food', productName: 'Nasi Goreng', quantity: 2, unitPrice: 25000, categoryId: 'cat-food', modifiers: [] },
        { productId: 'p-drink', productName: 'Es Teh', quantity: 1, unitPrice: 5000, categoryId: 'cat-drink', modifiers: [] },
        { productId: 'p-other', productName: 'Kerupuk', quantity: 1, unitPrice: 2000, categoryId: null, modifiers: [] },
      ],
      ...overrides,
    }),
  } as unknown as Order;
}

function buildService(options: {
  stations: Station[];
  tickets?: StationTicket[];
  order?: Order | null;
  outletTenantId?: string;
  defaultOutletId?: string | null;
  tenantOutlets?: Array<{ id: string; isActive: boolean }>;
} = { stations: [] }) {
  const tickets = options.tickets ?? [];
  const eventBus = { publish: vi.fn() };
  const stationRepository = {
    findByTenant: vi.fn(async () => options.stations),
    findByIdForTenant: vi.fn(async (id: string, tenantId: string) =>
      options.stations.find((station) => station.serialize().id === id && station.serialize().tenantId === tenantId) ?? null),
    findActiveForOrder: vi.fn(async () => options.stations),
    findByName: vi.fn(async () => null),
    save: vi.fn(async () => undefined),
    delete: vi.fn(async () => true),
  };
  const ticketRepository = {
    findByTenant: vi.fn(async () => tickets),
    findById: vi.fn(async (id: string) => tickets.find((ticket) => ticket.serialize().id === id) ?? null),
    findByOrderAndStation: vi.fn(async (orderId: string, stationId: string) =>
      tickets.find((ticket) => ticket.serialize().orderId === orderId && ticket.serialize().stationId === stationId) ?? null),
    save: vi.fn(async (ticket: StationTicket) => {
      tickets.push(ticket);
    }),
  };
  const orderRepository = { findById: vi.fn(async () => (options.order === undefined ? makeOrder() : options.order)) };
  const tenantOutlets = options.tenantOutlets ?? [{ id: 'outlet-1', isActive: true }];
  const outletRepository = {
    findById: vi.fn(async (id: string) =>
      tenantOutlets.some((outlet) => outlet.id === id)
        ? { serialize: () => ({ id, tenantId: options.outletTenantId ?? 'tenant-1', isActive: true }) }
        : null,
    ),
    findDefault: vi.fn(async () =>
      options.defaultOutletId
        ? { serialize: () => ({ id: options.defaultOutletId, tenantId: 'tenant-1', isActive: true }) }
        : null,
    ),
    findByTenant: vi.fn(async () =>
      tenantOutlets.map((outlet) => ({ serialize: () => ({ ...outlet, tenantId: 'tenant-1' }) })),
    ),
  };
  const service = new KdsService({
    stationRepository: stationRepository as never,
    ticketRepository: ticketRepository as never,
    orderRepository: orderRepository as never,
    outletRepository: outletRepository as never,
    eventBus: eventBus as never,
  });
  return { service, stationRepository, ticketRepository, orderRepository, eventBus, tickets };
}

describe('KdsService', () => {
  it('routes items to the station owning their category and skips unassigned items', async () => {
    const food = makeStation(['cat-food']);
    const drink = makeStation(['cat-drink']);
    const { service, tickets } = buildService({ stations: [food, drink] });

    const created = await service.createTicketsForOrder('tenant-1', 'order-1');

    expect(created).toHaveLength(2);
    const foodTicket = tickets.find((t) => t.serialize().stationId === food.serialize().id)!.serialize();
    const drinkTicket = tickets.find((t) => t.serialize().stationId === drink.serialize().id)!.serialize();
    expect(foodTicket.items.map((item) => item.productName)).toEqual(['Nasi Goreng']);
    expect(drinkTicket.items.map((item) => item.productName)).toEqual(['Es Teh']);
    expect(foodTicket).toMatchObject({ orderNumber: 'ORD-1', tableNumber: 'A1', status: 'pending' });
  });

  it('does not create a duplicate ticket when the confirmation event is retried', async () => {
    const station = makeStation(['cat-food']);
    const { service, ticketRepository } = buildService({ stations: [station] });

    await service.createTicketsForOrder('tenant-1', 'order-1');
    const second = await service.createTicketsForOrder('tenant-1', 'order-1');

    expect(second).toHaveLength(0);
    expect(ticketRepository.save).toHaveBeenCalledTimes(1);
  });

  it('creates no tickets when the order has no matching or categorized items', async () => {
    const station = makeStation(['cat-food']);
    const order = makeOrder({
      items: [{ productId: 'p-other', productName: 'Kerupuk', quantity: 1, unitPrice: 2000, categoryId: null, modifiers: [] }],
    });
    const { service, ticketRepository } = buildService({ stations: [station], order });

    const created = await service.createTicketsForOrder('tenant-1', 'order-1');

    expect(created).toHaveLength(0);
    expect(ticketRepository.save).not.toHaveBeenCalled();
  });

  it('ignores an order owned by another tenant', async () => {
    const station = makeStation(['cat-food']);
    const order = makeOrder({ tenantId: 'tenant-2' });
    const { service, ticketRepository } = buildService({ stations: [station], order });

    const created = await service.createTicketsForOrder('tenant-1', 'order-1');

    expect(created).toHaveLength(0);
    expect(ticketRepository.save).not.toHaveBeenCalled();
  });

  it('walks pending → in_progress → ready and recalls a ready ticket', async () => {
    const station = makeStation(['cat-food']);
    const { service, tickets } = buildService({ stations: [station] });
    const [ticket] = await service.createTicketsForOrder('tenant-1', 'order-1');
    const ticketId = ticket.serialize().id;

    const started = await service.updateTicketStatus('tenant-1', ticketId, 'in_progress', 'user-1');
    expect(started.serialize()).toMatchObject({ status: 'in_progress', preparedBy: 'user-1' });
    const ready = await service.updateTicketStatus('tenant-1', ticketId, 'ready', 'user-1');
    expect(ready.serialize().status).toBe('ready');
    const recalled = await service.updateTicketStatus('tenant-1', ticketId, 'in_progress');
    expect(recalled.serialize().status).toBe('in_progress');
    expect(new Set(tickets.map((item) => item.serialize().id)).size).toBe(1);
  });

  it('rejects moving a pending ticket back to pending', async () => {
    const station = makeStation(['cat-food']);
    const { service } = buildService({ stations: [station] });
    const [ticket] = await service.createTicketsForOrder('tenant-1', 'order-1');

    await expect(service.updateTicketStatus('tenant-1', ticket.serialize().id, 'pending')).rejects.toThrow(
      'Tiket baru tidak bisa dikembalikan ke status menunggu.',
    );
  });

  it('rejects station creation for an outlet owned by another tenant', async () => {
    const { service, stationRepository } = buildService({ stations: [], outletTenantId: 'tenant-2' });

    await expect(
      service.createStation('tenant-1', { outletId: 'outlet-1', name: 'Dapur', kind: 'kitchen' }),
    ).rejects.toThrow('Outlet tidak ditemukan untuk tenant ini.');
    expect(stationRepository.save).not.toHaveBeenCalled();
  });

  it('falls back to the default outlet when the request has no outlet header', async () => {
    const { service, stationRepository } = buildService({ stations: [], defaultOutletId: 'outlet-default' });

    const station = await service.createStation('tenant-1', { name: 'Dapur', kind: 'kitchen' });

    expect(station.serialize().outletId).toBe('outlet-default');
    expect(stationRepository.save).toHaveBeenCalledTimes(1);
  });

  it('falls back to the first active outlet when no default outlet exists', async () => {
    const { service } = buildService({
      stations: [],
      tenantOutlets: [
        { id: 'outlet-closed', isActive: false },
        { id: 'outlet-active', isActive: true },
      ],
    });

    const station = await service.createStation('tenant-1', { name: 'Bar', kind: 'bar' });

    expect(station.serialize().outletId).toBe('outlet-active');
  });

  it('rejects station creation when the tenant has no outlet at all', async () => {
    const { service } = buildService({ stations: [], tenantOutlets: [] });

    await expect(
      service.createStation('tenant-1', { name: 'Dapur', kind: 'kitchen' }),
    ).rejects.toThrow('Tenant belum memiliki outlet.');
  });

  it('rejects station creation without a name', async () => {
    const { service } = buildService({ stations: [] });

    await expect(
      service.createStation('tenant-1', { outletId: 'outlet-1', name: '  ', kind: 'kitchen' }),
    ).rejects.toThrow('Nama station wajib diisi.');
  });
});
