import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { PaymentId } from '../../../@shared/domain/Identifier';
import { DomainEvent } from '../../../@shared/domain/DomainEvent';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentMethod = 'cash' | 'qris' | 'transfer' | 'card';

export interface IPayment {
  id: string;
  tenantId: string;
  orderId: string;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod;
  referenceNumber: string;
  metadata: Record<string, unknown>;
  paidAt: Date | null;
  createdAt: Date;
}

export class Payment extends AggregateRoot<PaymentId> {
  private tenantId: string;
  private orderId: string;
  private amount: number;
  private status: PaymentStatus;
  private method: PaymentMethod;
  private referenceNumber: string;
  private metadata: Record<string, unknown>;
  private paidAt: Date | null;
  private createdAt: Date;

  private constructor(props: IPayment) {
    super(new PaymentId(props.id));
    this.tenantId = props.tenantId;
    this.orderId = props.orderId;
    this.amount = props.amount;
    this.status = props.status;
    this.method = props.method;
    this.referenceNumber = props.referenceNumber;
    this.metadata = { ...props.metadata };
    this.paidAt = props.paidAt;
    this.createdAt = props.createdAt;
  }

  static create(props: Omit<IPayment, 'id' | 'createdAt'>): Payment {
    return new Payment({
      ...props,
      id: new PaymentId().toValue(),
      createdAt: new Date(),
    });
  }

  static hydrate(props: IPayment): Payment {
    return new Payment(props);
  }

  complete(): void {
    this.status = 'completed';
    this.paidAt = new Date();

    this.addDomainEvent(
      new DomainEvent({
        eventName: 'payment.transaction.completed',
        aggregateId: this.id.toValue(),
        aggregateType: 'Payment',
        tenantId: this.tenantId,
        payload: {
          transactionId: this.id.toValue(),
          orderId: this.orderId,
          amount: this.amount,
          method: this.method,
          paidAt: this.paidAt,
        },
      }),
    );
  }

  fail(reason: string): void {
    this.status = 'failed';

    this.addDomainEvent(
      new DomainEvent({
        eventName: 'payment.transaction.failed',
        aggregateId: this.id.toValue(),
        aggregateType: 'Payment',
        tenantId: this.tenantId,
        payload: { transactionId: this.id.toValue(), orderId: this.orderId, reason },
      }),
    );
  }

  serialize(): IPayment {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      orderId: this.orderId,
      amount: this.amount,
      status: this.status,
      method: this.method,
      referenceNumber: this.referenceNumber,
      metadata: { ...this.metadata },
      paidAt: this.paidAt,
      createdAt: this.createdAt,
    };
  }
}
