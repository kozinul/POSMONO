import { Model, Document } from 'mongoose';
import { StationTicket, IStationTicket } from '../../domain/StationTicket';

interface TicketItemDoc {
  orderItemIndex: number;
  productId: string;
  productName: string;
  quantity: number;
  notes?: string;
  modifiers?: Array<{
    groupId: string;
    groupName: string;
    optionId: string;
    optionName: string;
  }>;
}

interface StationTicketDoc extends Document<string> {
  _id: string;
  tenantId: string;
  outletId: string | null;
  stationId: string;
  orderId: string;
  orderNumber: string;
  tableNumber: string | null;
  source: string;
  items?: TicketItemDoc[];
  status: IStationTicket['status'];
  startedAt: Date | null;
  completedAt: Date | null;
  preparedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoStationTicketRepository {
  constructor(private readonly model: Model<any>) {}

  toDomain(doc: StationTicketDoc): StationTicket {
    const data = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    return StationTicket.hydrate({
      id: data._id,
      tenantId: data.tenantId,
      outletId: data.outletId ?? null,
      stationId: data.stationId,
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      tableNumber: data.tableNumber ?? null,
      source: data.source ?? 'pos',
      items: (data.items ?? []).map((item: TicketItemDoc) => ({
        orderItemIndex: item.orderItemIndex,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        notes: item.notes ?? '',
        modifiers: (item.modifiers ?? []).map((modifier) => ({ ...modifier })),
      })),
      status: data.status,
      startedAt: data.startedAt ?? null,
      completedAt: data.completedAt ?? null,
      preparedBy: data.preparedBy ?? null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  toPersistence(ticket: StationTicket): Record<string, unknown> {
    const data = ticket.serialize();
    return {
      _id: data.id,
      tenantId: data.tenantId,
      outletId: data.outletId,
      stationId: data.stationId,
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      tableNumber: data.tableNumber,
      source: data.source,
      items: data.items,
      status: data.status,
      startedAt: data.startedAt,
      completedAt: data.completedAt,
      preparedBy: data.preparedBy,
    };
  }

  async save(ticket: StationTicket): Promise<void> {
    await this.model.findOneAndUpdate({ _id: ticket.id.toValue() }, this.toPersistence(ticket), {
      upsert: true,
      new: true,
    });
    ticket.clearEvents();
  }

  async findById(id: string, tenantId: string): Promise<StationTicket | null> {
    const doc = await this.model.findOne({ _id: id, tenantId }).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findByOrderAndStation(orderId: string, stationId: string, tenantId: string): Promise<StationTicket | null> {
    const doc = await this.model.findOne({ orderId, stationId, tenantId }).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findByTenant(
    tenantId: string,
    filter: { outletId?: string | null; stationId?: string; includeReady?: boolean },
  ): Promise<StationTicket[]> {
    const query: Record<string, unknown> = { tenantId };
    if (filter.outletId) query.outletId = filter.outletId;
    if (filter.stationId) query.stationId = filter.stationId;
    query.status = filter.includeReady ? { $ne: 'cancelled' } : { $in: ['pending', 'in_progress'] };
    const docs = await this.model.find(query).sort({ createdAt: 1 }).exec();
    return docs.map((doc: StationTicketDoc) => this.toDomain(doc));
  }
}
