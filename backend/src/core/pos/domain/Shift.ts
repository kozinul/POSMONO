import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { Identifier } from '../../../@shared/domain/Identifier';
import { DomainEvent } from '../../../@shared/domain/DomainEvent';

class ShiftId extends Identifier {}

export interface ICashPickup {
  amount: number;
  reason: string;
  pickedAt: Date;
  pickedBy: string;
}

export interface IPaymentBreakdownEntry {
  method: string;
  code: string;
  amount: number;
}

export interface IShift {
  id: string;
  tenantId: string;
  registerId: string;
  cashierId: string;
  status: 'open' | 'closed';
  openingBalance: number;
  closingBalance: number | null;
  physicalCash: number | null;
  expectedCash: number | null;
  totalCashPickups: number;
  totalSales: number;
  cashSales: number;
  nonCashSales: number;
  totalTransactions: number;
  paymentBreakdown: IPaymentBreakdownEntry[];
  cashPickups: ICashPickup[];
  expectedTotal: number | null;
  actualTotal: number | null;
  openedAt: Date;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Shift extends AggregateRoot<ShiftId> {
  private tenantId: string;
  private registerId: string;
  private cashierId: string;
  private status: 'open' | 'closed';
  private openingBalance: number;
  private closingBalance: number | null;
  private physicalCash: number | null;
  private expectedCash: number | null;
  private totalCashPickups: number;
  private totalSales: number;
  private cashSales: number;
  private nonCashSales: number;
  private totalTransactions: number;
  private paymentBreakdown: IPaymentBreakdownEntry[];
  private cashPickups: ICashPickup[];
  private expectedTotal: number | null;
  private actualTotal: number | null;
  private openedAt: Date;
  private closedAt: Date | null;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IShift) {
    super(new ShiftId(props.id));
    this.tenantId = props.tenantId;
    this.registerId = props.registerId;
    this.cashierId = props.cashierId;
    this.status = props.status;
    this.openingBalance = props.openingBalance;
    this.closingBalance = props.closingBalance;
    this.physicalCash = props.physicalCash;
    this.expectedCash = props.expectedCash;
    this.totalCashPickups = props.totalCashPickups;
    this.totalSales = props.totalSales;
    this.cashSales = props.cashSales;
    this.nonCashSales = props.nonCashSales;
    this.totalTransactions = props.totalTransactions;
    this.paymentBreakdown = [...props.paymentBreakdown];
    this.cashPickups = [...props.cashPickups];
    this.expectedTotal = props.expectedTotal;
    this.actualTotal = props.actualTotal;
    this.openedAt = props.openedAt;
    this.closedAt = props.closedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static open(props: Omit<IShift, 'id' | 'status' | 'closingBalance' | 'physicalCash' | 'expectedCash' | 'totalCashPickups' | 'totalSales' | 'cashSales' | 'nonCashSales' | 'totalTransactions' | 'paymentBreakdown' | 'cashPickups' | 'expectedTotal' | 'actualTotal' | 'closedAt' | 'openedAt' | 'createdAt' | 'updatedAt'>): Shift {
    const shift = new Shift({
      ...props,
      id: new ShiftId().toValue(),
      status: 'open',
      closingBalance: null,
      physicalCash: null,
      expectedCash: null,
      totalCashPickups: 0,
      totalSales: 0,
      cashSales: 0,
      nonCashSales: 0,
      totalTransactions: 0,
      paymentBreakdown: [],
      cashPickups: [],
      expectedTotal: null,
      actualTotal: null,
      openedAt: new Date(),
      closedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
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

  addCashPickup(amount: number, reason: string, pickedBy: string): void {
    if (this.status === 'closed') {
      throw new Error('Shift is already closed');
    }

    const pickup: ICashPickup = {
      amount,
      reason,
      pickedAt: new Date(),
      pickedBy,
    };

    this.cashPickups.push(pickup);
    this.totalCashPickups += amount;
    this.expectedCash = this.openingBalance + this.cashSales - this.totalCashPickups;
    this.updatedAt = new Date();

    this.addDomainEvent(
      new DomainEvent({
        eventName: 'pos.shift.cash_pickup',
        aggregateId: this.id.toValue(),
        aggregateType: 'Shift',
        tenantId: this.tenantId,
        payload: {
          shiftId: this.id.toValue(),
          amount,
          reason,
          pickedBy,
        },
      }),
    );
  }

  updateSales(data: { totalSales: number; cashSales: number; nonCashSales: number; totalTransactions: number; paymentBreakdown: IPaymentBreakdownEntry[] }): void {
    if (this.status === 'closed') {
      throw new Error('Shift is already closed');
    }

    this.totalSales = data.totalSales;
    this.cashSales = data.cashSales;
    this.nonCashSales = data.nonCashSales;
    this.totalTransactions = data.totalTransactions;
    this.paymentBreakdown = [...data.paymentBreakdown];
    this.expectedCash = this.openingBalance + this.cashSales - this.totalCashPickups;
    this.updatedAt = new Date();
  }

  close(physicalCash: number): void {
    if (this.status === 'closed') {
      throw new Error('Shift is already closed');
    }

    this.status = 'closed';
    this.physicalCash = physicalCash;
    this.expectedCash = this.openingBalance + this.cashSales - this.totalCashPickups;
    this.closingBalance = physicalCash;
    this.expectedTotal = this.expectedCash;
    this.actualTotal = physicalCash;
    this.closedAt = new Date();
    this.updatedAt = new Date();

    this.addDomainEvent(
      new DomainEvent({
        eventName: 'pos.shift.closed',
        aggregateId: this.id.toValue(),
        aggregateType: 'Shift',
        tenantId: this.tenantId,
        payload: {
          shiftId: this.id.toValue(),
          physicalCash,
          expectedCash: this.expectedCash,
          difference: physicalCash - (this.expectedCash || 0),
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
      physicalCash: this.physicalCash,
      expectedCash: this.expectedCash,
      totalCashPickups: this.totalCashPickups,
      totalSales: this.totalSales,
      cashSales: this.cashSales,
      nonCashSales: this.nonCashSales,
      totalTransactions: this.totalTransactions,
      paymentBreakdown: [...this.paymentBreakdown],
      cashPickups: [...this.cashPickups],
      expectedTotal: this.expectedTotal,
      actualTotal: this.actualTotal,
      openedAt: this.openedAt,
      closedAt: this.closedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

