import { ConflictError, NotFoundError, ValidationError } from '../../../../@shared/infrastructure/error/AppError';
import { DomainEvent } from '../../../../@shared/domain/DomainEvent';
import type { EventBus } from '../../../../@shared/infrastructure/eventBus/EventBus';
import { Station, StationKind } from '../../domain/Station';
import { StationTicket, StationTicketItem, StationTicketStatus } from '../../domain/StationTicket';
import { MongoStationRepository } from '../../infrastructure/persistence/MongoStationRepository';
import { MongoStationTicketRepository } from '../../infrastructure/persistence/MongoStationTicketRepository';
import type { Order } from '../../../ordering/domain/Order';

export interface KdsServiceDeps {
  stationRepository: MongoStationRepository;
  ticketRepository: MongoStationTicketRepository;
  orderRepository: Pick<import('../../../ordering/infrastructure/persistence/MongoOrderRepository').MongoOrderRepository, 'findById'>;
  outletRepository: Pick<
    import('../../../outlet/infrastructure/persistence/MongoOutletRepository').MongoOutletRepository,
    'findById' | 'findDefault' | 'findByTenant'
  >;
  eventBus?: EventBus;
}

interface StationInput {
  outletId?: string;
  name: string;
  kind: StationKind;
  printerId?: string | null;
  autoPrint?: boolean;
  timerWarnMinutes?: number;
  categoryIds?: string[];
  isActive?: boolean;
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;
}

export class KdsService {
  constructor(private readonly deps: KdsServiceDeps) {}

  async listStations(tenantId: string, outletId?: string | null): Promise<Station[]> {
    return this.deps.stationRepository.findByTenant(tenantId, outletId);
  }

  async createStation(tenantId: string, input: StationInput): Promise<Station> {
    this.assertStationInput(input);
    const outletId = await this.resolveOutletId(tenantId, input.outletId);
    const existing = await this.deps.stationRepository.findByName(tenantId, outletId, input.name);
    if (existing) throw new ConflictError(`Station "${input.name}" sudah ada di outlet ini.`);

    const station = Station.create({
      tenantId,
      outletId,
      name: input.name.trim(),
      kind: input.kind,
      printerId: input.printerId ?? null,
      autoPrint: input.autoPrint ?? false,
      timerWarnMinutes: input.timerWarnMinutes ?? 10,
      categoryIds: [...new Set(input.categoryIds ?? [])],
      isActive: input.isActive ?? true,
    });
    await this.deps.stationRepository.save(station);
    return station;
  }

  async updateStation(tenantId: string, id: string, input: Partial<StationInput>): Promise<Station> {
    const station = await this.deps.stationRepository.findByIdForTenant(id, tenantId);
    if (!station) throw new NotFoundError('Station tidak ditemukan.');
    if (input.name && input.name.trim() !== station.serialize().name) {
      const existing = await this.deps.stationRepository.findByName(
        tenantId,
        station.serialize().outletId,
        input.name.trim(),
      );
      if (existing && existing.id.toValue() !== id) {
        throw new ConflictError(`Station "${input.name}" sudah ada di outlet ini.`);
      }
    }
    station.update({
      name: input.name?.trim(),
      kind: input.kind,
      printerId: input.printerId,
      autoPrint: input.autoPrint,
      timerWarnMinutes: input.timerWarnMinutes,
      categoryIds: input.categoryIds,
      isActive: input.isActive,
    });
    await this.deps.stationRepository.save(station);
    return station;
  }

  async deleteStation(tenantId: string, id: string): Promise<void> {
    const deleted = await this.deps.stationRepository.delete(id, tenantId);
    if (!deleted) throw new NotFoundError('Station tidak ditemukan.');
  }

  async listTickets(
    tenantId: string,
    filter: { outletId?: string | null; stationId?: string; includeReady?: boolean },
  ): Promise<StationTicket[]> {
    return this.deps.ticketRepository.findByTenant(tenantId, filter);
  }

  async updateTicketStatus(
    tenantId: string,
    ticketId: string,
    status: StationTicketStatus,
    preparedBy?: string | null,
  ): Promise<StationTicket> {
    if (!['pending', 'in_progress', 'ready', 'cancelled'].includes(status)) {
      throw new ValidationError('Status tiket tidak valid.');
    }
    const ticket = await this.deps.ticketRepository.findById(ticketId, tenantId);
    if (!ticket) throw new NotFoundError('Tiket tidak ditemukan.');

    if (status === 'in_progress') {
      if (ticket.serialize().status === 'ready') ticket.recall();
      else ticket.start(preparedBy ?? null);
    } else if (status === 'ready') {
      ticket.markReady(preparedBy ?? null);
    } else if (status === 'cancelled') {
      ticket.cancel();
    } else {
      throw new ValidationError('Tiket baru tidak bisa dikembalikan ke status menunggu.');
    }

    await this.deps.ticketRepository.save(ticket);
    this.publishTicketEvent(ticket, 'kds.ticket.updated');
    return ticket;
  }

  /**
   * Fan an order out to every station that owns at least one of its categories.
   *
   * Ticket creation is deliberately idempotent: the order confirmation event can
   * be retried, and a station must never receive the same order twice.
   */
  async createTicketsForOrder(tenantId: string, orderId: string): Promise<StationTicket[]> {
    const order = await this.deps.orderRepository.findById(orderId);
    if (!order) return [];
    const orderData = order.serialize();
    if (orderData.tenantId !== tenantId) return [];

    const stations = await this.deps.stationRepository.findActiveForOrder(tenantId, orderData.outletId ?? null);
    if (stations.length === 0) return [];

    const grouped = this.groupItemsByStation(order, stations);
    const tickets: StationTicket[] = [];
    for (const [stationId, items] of grouped.entries()) {
      const existing = await this.deps.ticketRepository.findByOrderAndStation(orderId, stationId, tenantId);
      if (existing) continue;
      const station = stations.find((candidate) => candidate.id.toValue() === stationId);
      if (!station) continue;

      const ticket = StationTicket.create({
        tenantId,
        outletId: orderData.outletId ?? null,
        stationId,
        orderId,
        orderNumber: orderData.orderNumber,
        tableNumber: orderData.tableNumber ?? null,
        source: orderData.source,
        items,
      });

      try {
        await this.deps.ticketRepository.save(ticket);
        tickets.push(ticket);
        this.publishTicketEvent(ticket, 'kds.ticket.created');
      } catch (error) {
        if (!isDuplicateKey(error)) throw error;
        // Lost a race with another delivery of the same order event. The
        // existing ticket is the winner; the caller can fetch it.
      }
    }
    return tickets;
  }

  private groupItemsByStation(order: Order, stations: Station[]) {
    const grouped = new Map<string, StationTicketItem[]>();
    const serialized = order.serialize();
    serialized.items.forEach((item, orderItemIndex) => {
      if (!item.categoryId) return;
      const station = stations.find((candidate) => candidate.serialize().categoryIds.includes(item.categoryId as string));
      if (!station) return;
      const stationId = station.id.toValue();
      const items = grouped.get(stationId) ?? [];
      items.push({
        orderItemIndex,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        notes: '',
        modifiers: (item.modifiers ?? []).map((modifier) => ({
          groupId: modifier.groupId,
          groupName: modifier.groupName,
          optionId: modifier.optionId,
          optionName: modifier.optionName,
        })),
      });
      grouped.set(stationId, items);
    });
    return grouped;
  }

  /**
   * The outlet header is optional (a single-outlet owner never picks one), so a
   * missing outlet must fall back to the tenant default instead of asking the
   * UI for something it may not have. An explicit outlet is still validated
   * against the tenant - that is the ownership boundary.
   */
  private async resolveOutletId(tenantId: string, requestedOutletId?: string): Promise<string> {
    if (requestedOutletId) {
      const outlet = await this.deps.outletRepository.findById(requestedOutletId);
      if (!outlet || outlet.serialize().tenantId !== tenantId) {
        throw new ValidationError('Outlet tidak ditemukan untuk tenant ini.');
      }
      return requestedOutletId;
    }

    const preferred = await this.deps.outletRepository.findDefault(tenantId);
    if (preferred) return preferred.serialize().id;

    const outlets = await this.deps.outletRepository.findByTenant(tenantId);
    const fallback = outlets.find((outlet) => outlet.serialize().isActive) ?? outlets[0];
    if (!fallback) throw new ValidationError('Tenant belum memiliki outlet.');
    return fallback.serialize().id;
  }

  private assertStationInput(input: StationInput): void {
    if (!input.name?.trim()) throw new ValidationError('Nama station wajib diisi.');
    if (!['bar', 'kitchen'].includes(input.kind)) throw new ValidationError('Jenis station tidak valid.');
  }

  private publishTicketEvent(ticket: StationTicket, eventName: string): void {
    const data = ticket.serialize();
    this.deps.eventBus?.publish(new DomainEvent({
      eventName,
      aggregateId: data.id,
      aggregateType: 'StationTicket',
      tenantId: data.tenantId,
      payload: { ticketId: data.id, orderId: data.orderId, stationId: data.stationId, status: data.status },
    }));
  }
}
