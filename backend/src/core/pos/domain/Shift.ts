import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { Identifier } from '../../../@shared/domain/Identifier';
import { DomainEvent } from '../../../@shared/domain/DomainEvent';

class ShiftId extends Identifier {}

export interface IShift {
  id: string;
  tenantId: string;
  registerId: string;
  cashierId: string;
  status: 'open' | 'closed';
  openingBalance: number;
  closingBalance: number | null;
  expectedTotal: number | null;
  actualTotal: number | null;
  openedAt: Date;
  closedAt: Date | null;
}

export class Shift extends AggregateRoot<ShiftId> {
  private tenantId: string;
  private registerId: string;
  private cashierId: string;
  private status: 'open' | 'closed';
  private openingBalance: number;
  private closingBalance: number | null;
  private expectedTotal: number | null;
  private actualTotal: number | null;
  private openedAt: Date;
  private closedAt: Date | null;

  private constructor(props: IShift) {
    super(new ShiftId(props.id));
    this.tenantId = props.tenantId;
    this.registerId = props.registerId;
    this.cashierId = props.cashierId;
    this.status = props.status;
    this.openingBalance = props.openingBalance;
    this.closingBalance = props.closingBalance;
    this.expectedTotal = props.expectedTotal;
    this.actualTotal = props.actualTotal;
    this.openedAt = props.openedAt;
    this.closedAt = props.closedAt;
  }

  static open(props: Omit<IShift, 'id' | 'status' | 'closingBalance' | 'expectedTotal' | 'actualTotal' | 'closedAt' | 'openedAt'>): Shift {
    const shift = new Shift({
      ...props,
      id: new ShiftId().toValue(),
      status: 'open',
      closingBalance: null,
      expectedTotal: null,
      actualTotal: null,
      openedAt: new Date(),
      closedAt: null,
    });

    shift.addDomainEvent(
      new DomainEvent({
        eventName: 'pos.shift.opened',
        aggregateId: shift.id.toValue(),
        aggregateType: 'Shift',
        tenantId: shift.tenantId,
        payload: {
          shiftId: shift.id.toValue(),
          registerId: shift.registerId,
          cashierId: shift.cashierId,
        },
      }),
    );

    return shift;
  }

  static hydrate(props: IShift): Shift {
    return new Shift(props);
  }

  close(expectedTotal: number, actualTotal: number): void {
    this.status = 'closed';
    this.closingBalance = actualTotal;
    this.expectedTotal = expectedTotal;
    this.actualTotal = actualTotal;
    this.closedAt = new Date();

    this.addDomainEvent(
      new DomainEvent({
        eventName: 'pos.shift.closed',
        aggregateId: this.id.toValue(),
        aggregateType: 'Shift',
        tenantId: this.tenantId,
        payload: {
          shiftId: this.id.toValue(),
          expectedTotal,
          actualTotal,
        },
      }),
    );
  }

  serialize(): IShift {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      registerId: this.registerId,
      cashierId: this.cashierId,
      status: this.status,
      openingBalance: this.openingBalance,
      closingBalance: this.closingBalance,
      expectedTotal: this.expectedTotal,
      actualTotal: this.actualTotal,
      openedAt: this.openedAt,
      closedAt: this.closedAt,
    };
  }
}
