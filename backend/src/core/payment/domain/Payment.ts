import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { PaymentId } from '../../../@shared/domain/Identifier';
import { DomainEvent } from '../../../@shared/domain/DomainEvent';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentMethod = 'cash' | 'qris' | 'transfer' | 'card' | 'debit' | 'credit' | 'ewallet';

export interface ISplitBill {
  portion: number;
  amount: number;
  method: PaymentMethod;
  referenceNumber: string;
}

export interface IRefund {
  id: string;
  paymentId: string;
  orderId: string;
  amount: number;
  reason: string;
  status: 'pending' | 'completed' | 'failed';
  refundedBy: string;
  refundedByName: string;
  refundedAt: Date;
  createdAt: Date;
}

export interface IPayment {
  id: string;
  tenantId: string;
  orderId: string;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod;
  referenceNumber: string;
  splitBills: ISplitBill[];
  qrCodeUrl: string | null;
  paymentTransactionId: string | null;
  provider: string | null;
  cardLastFour: string | null;
  metadata: Record<string, unknown>;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Payment extends AggregateRoot<PaymentId> {
  private tenantId: string;
  private orderId: string;
  private amount: number;
  private status: PaymentStatus;
  private method: PaymentMethod;
  private referenceNumber: string;
  private splitBills: ISplitBill[];
  private qrCodeUrl: string | null;
  private paymentTransactionId: string | null;
  private provider: string | null;
  private cardLastFour: string | null;
  private metadata: Record<string, unknown>;
  private paidAt: Date | null;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IPayment) {
    super(new PaymentId(props.id));
    this.tenantId = props.tenantId;
    this.orderId = props.orderId;
    this.amount = props.amount;
    this.status = props.status;
    this.method = props.method;
    this.referenceNumber = props.referenceNumber;
    this.splitBills = [...(props.splitBills ?? [])];
    this.qrCodeUrl = props.qrCodeUrl ?? null;
    this.paymentTransactionId = props.paymentTransactionId ?? null;
    this.provider = props.provider ?? null;
    this.cardLastFour = props.cardLastFour ?? null;
    this.metadata = { ...props.metadata };
    this.paidAt = props.paidAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt ?? props.createdAt;
  }

  static create(props: Omit<IPayment, 'id' | 'createdAt' | 'updatedAt'>): Payment {
    return new Payment({
      ...props,
      id: new PaymentId().toValue(),
      createdAt: new Date(),
      updatedAt: new Date(),
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

  refund(refundedBy: string, refundedByName: string, reason: string): IRefund {
    if (this.status === 'refunded') throw new Error('Payment already refunded');
    if (this.status !== 'completed') throw new Error('Only completed payments can be refunded');

    this.status = 'refunded';
    this.updatedAt = new Date();

    const refund: IRefund = {
      id: `REF-${Date.now().toString(36).toUpperCase()}`,
      paymentId: this.id.toValue(),
      orderId: this.orderId,
      amount: this.amount,
      reason,
      status: 'completed',
      refundedBy,
      refundedByName,
      refundedAt: new Date(),
      createdAt: new Date(),
    };

    this.addDomainEvent(
      new DomainEvent({
        eventName: 'payment.transaction.refunded',
        aggregateId: this.id.toValue(),
        aggregateType: 'Payment',
        tenantId: this.tenantId,
        payload: {
          paymentId: this.id.toValue(),
          orderId: this.orderId,
          amount: this.amount,
          reason,
          refundedBy,
          refundedByName,
        },
      }),
    );

    return refund;
  }

  split(splitBills: ISplitBill[]): void {
    if (this.status === 'completed' || this.status === 'refunded') {
      throw new Error('Cannot split a completed/refunded payment');
    }
    this.splitBills = [...splitBills];
    this.updatedAt = new Date();
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
      splitBills: [...this.splitBills],
      qrCodeUrl: this.qrCodeUrl,
      paymentTransactionId: this.paymentTransactionId,
      provider: this.provider,
      cardLastFour: this.cardLastFour,
      metadata: { ...this.metadata },
      paidAt: this.paidAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
