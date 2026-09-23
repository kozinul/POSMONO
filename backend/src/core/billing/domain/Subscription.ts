import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { SubscriptionId } from '../../../@shared/domain/Identifier';

export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'expired' | 'trial';

export interface ISubscription {
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: 'monthly' | 'annual' | 'custom';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  startedAt: Date | null;
  trialEndsAt: Date | null;
  autoRenew: boolean;
  assignedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Subscription extends AggregateRoot<SubscriptionId> {
  private tenantId: string;
  private planId: string;
  private status: SubscriptionStatus;
  private billingCycle: 'monthly' | 'annual' | 'custom';
  private currentPeriodStart: Date;
  private currentPeriodEnd: Date;
  private startedAt: Date | null;
  private trialEndsAt: Date | null;
  private autoRenew: boolean;
  private assignedAt: Date | null;
  private cancelledAt: Date | null;
  private cancellationReason: string | null;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(props: ISubscription) {
    super(new SubscriptionId(props.id));
    this.tenantId = props.tenantId;
    this.planId = props.planId;
    this.status = props.status;
    this.billingCycle = props.billingCycle;
    this.currentPeriodStart = props.currentPeriodStart;
    this.currentPeriodEnd = props.currentPeriodEnd;
    this.startedAt = props.startedAt;
    this.trialEndsAt = props.trialEndsAt;
    this.autoRenew = props.autoRenew;
    this.assignedAt = props.assignedAt;
    this.cancelledAt = props.cancelledAt;
    this.cancellationReason = props.cancellationReason;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(
    props: Omit<ISubscription, 'id' | 'createdAt' | 'updatedAt' | 'cancelledAt' | 'startedAt' | 'trialEndsAt' | 'autoRenew' | 'assignedAt' | 'cancellationReason'>,
  ): Subscription {
    const now = new Date();
    return new Subscription({
      ...props,
      id: new SubscriptionId().toValue(),
      startedAt: now,
      trialEndsAt: null,
      autoRenew: false,
      assignedAt: now,
      cancelledAt: null,
      cancellationReason: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static hydrate(props: ISubscription): Subscription {
    return new Subscription(props);
  }

  serialize(): ISubscription {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      planId: this.planId,
      status: this.status,
      billingCycle: this.billingCycle,
      currentPeriodStart: this.currentPeriodStart,
      currentPeriodEnd: this.currentPeriodEnd,
      startedAt: this.startedAt,
      trialEndsAt: this.trialEndsAt,
      autoRenew: this.autoRenew,
      assignedAt: this.assignedAt,
      cancelledAt: this.cancelledAt,
      cancellationReason: this.cancellationReason,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  isActive(): boolean {
    return (this.status === 'active' || this.status === 'trial') && this.currentPeriodEnd > new Date();
  }

  renew(newPeriodEnd: Date): void {
    this.currentPeriodStart = new Date();
    this.currentPeriodEnd = newPeriodEnd;
    this.status = 'active';
    this.updatedAt = new Date();
  }

  changePlan(newPlanId: string, billingCycle: 'monthly' | 'annual' | 'custom', newPeriodEnd: Date): void {
    this.planId = newPlanId;
    this.billingCycle = billingCycle;
    this.currentPeriodStart = new Date();
    this.currentPeriodEnd = newPeriodEnd;
    this.status = 'active';
    this.updatedAt = new Date();
  }

  extend(days: number): void {
    const base = this.currentPeriodEnd > new Date() ? this.currentPeriodEnd : new Date();
    this.currentPeriodEnd = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    this.updatedAt = new Date();
  }

  cancel(reason?: string): void {
    this.status = 'cancelled';
    this.cancelledAt = new Date();
    this.cancellationReason = reason ?? null;
    this.updatedAt = new Date();
  }

  expire(): void {
    this.status = 'expired';
    this.updatedAt = new Date();
  }
}