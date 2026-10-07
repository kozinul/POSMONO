import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { Identifier } from '../../../@shared/domain/Identifier';

class SubscriptionInvoiceId extends Identifier {}

export type SubscriptionInvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

/**
 * Why an invoice was issued. `renewal` is the invoice-first merchant renew
 * (and future wallet/auto-renewal) path: settling one EXTENDS the
 * subscription. `plan_assigned`/`plan_changed`/`extended` come from platform
 * admin actions where the money was already collected offline — settling only
 * marks the invoice paid, it never re-extends.
 */
export type SubscriptionInvoiceReferenceType =
  | 'plan_assigned'
  | 'plan_changed'
  | 'renewal'
  | 'extended';

export interface IInvoiceLineItem {
  description: string;
  amount: number;
  quantity: number;
  total: number;
}

export interface ISubscriptionInvoice {
  id: string;
  tenantId: string;
  subscriptionId: string | null;
  number: string;
  status: SubscriptionInvoiceStatus;
  amount: number;
  currency: 'IDR';
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  paidAt: Date | null;
  lineItems: IInvoiceLineItem[];
  referenceType: SubscriptionInvoiceReferenceType;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionInvoiceProps = Omit<
  ISubscriptionInvoice,
  'id' | 'status' | 'paidAt' | 'createdAt' | 'updatedAt'
>;

export class SubscriptionInvoice extends AggregateRoot<SubscriptionInvoiceId> {
  private tenantId: string;
  private subscriptionId: string | null;
  private number: string;
  private status: SubscriptionInvoiceStatus;
  private amount: number;
  private currency: 'IDR';
  private periodStart: Date;
  private periodEnd: Date;
  private dueDate: Date;
  private paidAt: Date | null;
  private lineItems: IInvoiceLineItem[];
  private referenceType: SubscriptionInvoiceReferenceType;
  private notes: string | null;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: ISubscriptionInvoice) {
    super(new SubscriptionInvoiceId(props.id));
    this.tenantId = props.tenantId;
    this.subscriptionId = props.subscriptionId;
    this.number = props.number;
    this.status = props.status;
    this.amount = props.amount;
    this.currency = props.currency;
    this.periodStart = props.periodStart;
    this.periodEnd = props.periodEnd;
    this.dueDate = props.dueDate;
    this.paidAt = props.paidAt;
    this.lineItems = props.lineItems.map((l) => ({ ...l }));
    this.referenceType = props.referenceType;
    this.notes = props.notes;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: SubscriptionInvoiceProps): SubscriptionInvoice {
    const now = new Date();
    return new SubscriptionInvoice({
      ...props,
      id: new SubscriptionInvoiceId().toValue(),
      status: 'pending',
      paidAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static hydrate(props: ISubscriptionInvoice): SubscriptionInvoice {
    return new SubscriptionInvoice(props);
  }

  serialize(): ISubscriptionInvoice {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      subscriptionId: this.subscriptionId,
      number: this.number,
      status: this.status,
      amount: this.amount,
      currency: this.currency,
      periodStart: this.periodStart,
      periodEnd: this.periodEnd,
      dueDate: this.dueDate,
      paidAt: this.paidAt,
      lineItems: this.lineItems.map((l) => ({ ...l })),
      referenceType: this.referenceType,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * `overdue` is derived at read time (like `Tenant.isExpired`): a pending
   * invoice whose due date is in the past reads as overdue, but the stored
   * status stays `pending` until an attempt settles it. No sweep needed.
   */
  isOverdue(now: Date = new Date()): boolean {
    return this.status === 'pending' && this.dueDate.getTime() < now.getTime();
  }

  /** Read status including the derived `overdue` state. */
  effectiveStatus(now: Date = new Date()): SubscriptionInvoiceStatus {
    return this.isOverdue(now) ? 'overdue' : this.status;
  }

  isSettled(): boolean {
    return this.status === 'paid' || this.status === 'cancelled';
  }

  markPaid(): void {
    if (this.isSettled()) return;
    this.status = 'paid';
    this.paidAt = new Date();
    this.updatedAt = new Date();
  }

  cancel(): void {
    if (this.isSettled()) return;
    this.status = 'cancelled';
    this.updatedAt = new Date();
  }
}