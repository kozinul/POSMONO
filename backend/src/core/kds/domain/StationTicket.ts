import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { Identifier } from '../../../@shared/domain/Identifier';

class StationTicketId extends Identifier {}

export type StationTicketStatus = 'pending' | 'in_progress' | 'ready' | 'cancelled';

export interface StationTicketItem {
  orderItemIndex: number;
  productId: string;
  productName: string;
  quantity: number;
  notes?: string;
  modifiers: Array<{
    groupId: string;
    groupName: string;
    optionId: string;
    optionName: string;
  }>;
}

export interface IStationTicket {
  id: string;
  tenantId: string;
  outletId: string | null;
  stationId: string;
  orderId: string;
  orderNumber: string;
  tableNumber: string | null;
  source: string;
  items: StationTicketItem[];
  status: StationTicketStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  preparedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type StationTicketProps = Omit<
  IStationTicket,
  'id' | 'status' | 'startedAt' | 'completedAt' | 'preparedBy' | 'createdAt' | 'updatedAt'
>;

export class StationTicket extends AggregateRoot<StationTicketId> {
  private tenantId: string;
  private outletId: string | null;
  private stationId: string;
  private orderId: string;
  private orderNumber: string;
  private tableNumber: string | null;
  private source: string;
  private items: StationTicketItem[];
  private status: StationTicketStatus;
  private startedAt: Date | null;
  private completedAt: Date | null;
  private preparedBy: string | null;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IStationTicket) {
    super(new StationTicketId(props.id));
    this.tenantId = props.tenantId;
    this.outletId = props.outletId;
    this.stationId = props.stationId;
    this.orderId = props.orderId;
    this.orderNumber = props.orderNumber;
    this.tableNumber = props.tableNumber;
    this.source = props.source;
    this.items = props.items.map((item) => ({ ...item, modifiers: item.modifiers.map((m) => ({ ...m })) }));
    this.status = props.status;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    this.preparedBy = props.preparedBy;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: StationTicketProps): StationTicket {
    return new StationTicket({
      ...props,
      id: new StationTicketId().toValue(),
      status: 'pending',
      startedAt: null,
      completedAt: null,
      preparedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static hydrate(props: IStationTicket): StationTicket {
    return new StationTicket(props);
  }

  start(preparedBy: string | null = null): void {
    if (this.status !== 'pending') return;
    this.status = 'in_progress';
    this.startedAt = new Date();
    this.preparedBy = preparedBy;
    this.updatedAt = new Date();
  }

  markReady(preparedBy: string | null = null): void {
    if (this.status === 'cancelled') return;
    if (this.status === 'pending') this.startedAt = new Date();
    this.status = 'ready';
    this.completedAt = new Date();
    if (preparedBy) this.preparedBy = preparedBy;
    this.updatedAt = new Date();
  }

  recall(): void {
    if (this.status === 'cancelled') return;
    this.status = 'in_progress';
    this.completedAt = null;
    this.updatedAt = new Date();
  }

  cancel(): void {
    this.status = 'cancelled';
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  serialize(): IStationTicket {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      outletId: this.outletId,
      stationId: this.stationId,
      orderId: this.orderId,
      orderNumber: this.orderNumber,
      tableNumber: this.tableNumber,
      source: this.source,
      items: this.items.map((item) => ({ ...item, modifiers: item.modifiers.map((m) => ({ ...m })) })),
      status: this.status,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      preparedBy: this.preparedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
