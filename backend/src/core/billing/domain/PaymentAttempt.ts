import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { Identifier } from '../../../@shared/domain/Identifier';

class PaymentAttemptId extends Identifier {}

export type PaymentAttemptStatus = 'pending' | 'completed' | 'expired' | 'failed';

export interface IPaymentAttemptGateway {
  provider: string | null;
  txId: string | null;
  vaNumber: string | null;
  qrUrl: string | null;
}

export interface IPaymentAttempt {
  id: string;
  tenantId: string;
  invoiceId: string;
  number: string | null;
  amount: number;
  method: string;
  status: PaymentAttemptStatus;
  gateway: IPaymentAttemptGateway | null;
  actorEmail: string | null;
  notes: string | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentAttemptProps = Omit<
  IPaymentAttempt,
  'id' | 'status' | 'startedAt' | 'completedAt' | 'createdAt' | 'updatedAt'
>;

export class PaymentAttempt extends AggregateRoot<PaymentAttemptId> {
  private tenantId: string;
  private invoiceId: string;
  private number: string | null;
  private amount: number;
  private method: string;
  private status: PaymentAttemptStatus;
  private gateway: IPaymentAttemptGateway | null;
  private actorEmail: string | null;
  private notes: string | null;
  private startedAt: Date;
  private completedAt: Date | null;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IPaymentAttempt) {
    super(new PaymentAttemptId(props.id));
    this.tenantId = props.tenantId;
    this.invoiceId = props.invoiceId;
    this.number = props.number;
    this.amount = props.amount;
    this.method = props.method;
    this.status = props.status;
    this.gateway = props.gateway ? { ...props.gateway } : null;
    this.actorEmail = props.actorEmail;
    this.notes = props.notes;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: PaymentAttemptProps): PaymentAttempt {
    const now = new Date();
    return new PaymentAttempt({
      ...props,
      id: new PaymentAttemptId().toValue(),
      status: 'pending',
      startedAt: now,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static hydrate(props: IPaymentAttempt): PaymentAttempt {
    return new PaymentAttempt(props);
  }

  serialize(): IPaymentAttempt {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      invoiceId: this.invoiceId,
      number: this.number,
      amount: this.amount,
      method: this.method,
      status: this.status,
      gateway: this.gateway ? { ...this.gateway } : null,
      actorEmail: this.actorEmail,
      notes: this.notes,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  isTerminal(): boolean {
    return this.status !== 'pending';
  }

  /**
   * One attempt succeeds at most once — a `completed` attempt cannot be moved
   * and a settled invoice refuses further attempts (checked by the service).
   * `complete` returns false on any non-pending attempt so the caller can
   * decide, before writing, whether the attempt is still actionable.
   */
  complete(): boolean {
    if (this.isTerminal()) return false;
    this.status = 'completed';
    this.completedAt = new Date();
    this.updatedAt = new Date();
    return true;
  }

  fail(): boolean {
    if (this.isTerminal()) return false;
    this.status = 'failed';
    this.updatedAt = new Date();
    return true;
  }

  expire(): boolean {
    if (this.isTerminal()) return false;
    this.status = 'expired';
    this.updatedAt = new Date();
    return true;
  }
}