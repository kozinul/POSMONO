import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { RefundId } from '../../../@shared/domain/Identifier';
import { DomainEvent } from '../../../@shared/domain/DomainEvent';

export type RefundStatus = 'pending' | 'completed' | 'failed';

export interface IRefund {
  id: string;
  tenantId: string;
  paymentId: string;
  orderId: string;
  amount: number;
  reason: string;
  status: RefundStatus;
  refundedBy: string;
  refundedByName: string;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Refund extends AggregateRoot<RefundId> {
  private tenantId: string;
  private paymentId: string;
  private orderId: string;
  private amount: number;
  private reason: string;
  private status: RefundStatus;
  private refundedBy: string;
  private refundedByName: string;
  private refundedAt: Date | null;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: IRefund) {
    super(new RefundId(props.id));
    this.tenantId = props.tenantId;
    this.paymentId = props.paymentId;
    this.orderId = props.orderId;
    this.amount = props.amount;
    this.reason = props.reason;
    this.status = props.status;
    this.refundedBy = props.refundedBy;
    this.refundedByName = props.refundedByName;
    this.refundedAt = props.refundedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<IRefund, 'id' | 'status' | 'refundedAt' | 'createdAt' | 'updatedAt'>): Refund {
    const refund = new Refund({
      ...props,
      id: new RefundId().toValue(),
      status: 'pending',
      refundedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    refund.addDomainEvent(
      new DomainEvent({
        eventName: 'payment.refund.created',
        aggregateId: refund.id.toValue(),
        aggregateType: 'Refund',
        tenantId: refund.tenantId,
        payload: {
          refundId: refund.id.toValue(),
          paymentId: refund.paymentId,
          orderId: refund.orderId,
          amount: refund.amount,
          reason: refund.reason,
        },
      }),
    );

    return refund;
  }

  static hydrate(props: IRefund): Refund {
    return new Refund(props);
  }

  complete(): void {
    this.status = 'completed';
    this.refundedAt = new Date();
    this.updatedAt = new Date();

    this.addDomainEvent(
      new DomainEvent({
        eventName: 'payment.refund.completed',
        aggregateId: this.id.toValue(),
        aggregateType: 'Refund',
        tenantId: this.tenantId,
        payload: {
          refundId: this.id.toValue(),
          paymentId: this.paymentId,
          orderId: this.orderId,
          amount: this.amount,
          refundedAt: this.refundedAt,
        },
      }),
    );
  }

  fail(reason: string): void {
    this.status = 'failed';
    this.updatedAt = new Date();

    this.addDomainEvent(
      new DomainEvent({
        eventName: 'payment.refund.failed',
        aggregateId: this.id.toValue(),
        aggregateType: 'Refund',
        tenantId: this.tenantId,
        payload: {
          refundId: this.id.toValue(),
          paymentId: this.paymentId,
          orderId: this.orderId,
          reason,
        },
      }),
    );
  }

  serialize(): IRefund {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      paymentId: this.paymentId,
      orderId: this.orderId,
      amount: this.amount,
      reason: this.reason,
      status: this.status,
      refundedBy: this.refundedBy,
      refundedByName: this.refundedByName,
      refundedAt: this.refundedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
