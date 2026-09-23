import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { Identifier } from '../../../@shared/domain/Identifier';

class SubscriptionHistoryId extends Identifier {}

export type SubscriptionHistoryAction = 'assigned' | 'changed' | 'extended' | 'cancelled';

export interface ISubscriptionHistory {
  id: string;
  tenantId: string;
  subscriptionId: string | null;
  action: SubscriptionHistoryAction;
  planId?: string | null;
  planName?: string | null;
  statusBefore?: string | null;
  statusAfter?: string | null;
  periodStartBefore?: Date | null;
  periodEndBefore?: Date | null;
  periodStartAfter?: Date | null;
  periodEndAfter?: Date | null;
  actorEmail?: string | null;
  reason?: string | null;
  at: Date;
  createdAt: Date;
}

export type SubscriptionHistoryProps = Omit<
  ISubscriptionHistory,
  'id' | 'at' | 'createdAt'
> &
  Partial<Pick<ISubscriptionHistory, 'at'>>;

export class SubscriptionHistory extends AggregateRoot<SubscriptionHistoryId> {
  private tenantId: string;
  private subscriptionId: string | null;
  private action: SubscriptionHistoryAction;
  private planId: string | null;
  private planName: string | null;
  private statusBefore: string | null;
  private statusAfter: string | null;
  private periodStartBefore: Date | null;
  private periodEndBefore: Date | null;
  private periodStartAfter: Date | null;
  private periodEndAfter: Date | null;
  private actorEmail: string | null;
  private reason: string | null;
  private at: Date;
  private createdAt: Date;

  private constructor(props: ISubscriptionHistory) {
    super(new SubscriptionHistoryId(props.id));
    this.tenantId = props.tenantId;
    this.subscriptionId = props.subscriptionId;
    this.action = props.action;
    this.planId = props.planId ?? null;
    this.planName = props.planName ?? null;
    this.statusBefore = props.statusBefore ?? null;
    this.statusAfter = props.statusAfter ?? null;
    this.periodStartBefore = props.periodStartBefore ?? null;
    this.periodEndBefore = props.periodEndBefore ?? null;
    this.periodStartAfter = props.periodStartAfter ?? null;
    this.periodEndAfter = props.periodEndAfter ?? null;
    this.actorEmail = props.actorEmail ?? null;
    this.reason = props.reason ?? null;
    this.at = props.at;
    this.createdAt = props.createdAt;
  }

  static create(props: SubscriptionHistoryProps): SubscriptionHistory {
    return new SubscriptionHistory({
      ...props,
      id: new SubscriptionHistoryId().toValue(),
      at: props.at ?? new Date(),
      createdAt: new Date(),
    });
  }

  static hydrate(props: ISubscriptionHistory): SubscriptionHistory {
    return new SubscriptionHistory(props);
  }

  serialize(): ISubscriptionHistory {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      subscriptionId: this.subscriptionId,
      action: this.action,
      planId: this.planId,
      planName: this.planName,
      statusBefore: this.statusBefore,
      statusAfter: this.statusAfter,
      periodStartBefore: this.periodStartBefore,
      periodEndBefore: this.periodEndBefore,
      periodStartAfter: this.periodStartAfter,
      periodEndAfter: this.periodEndAfter,
      actorEmail: this.actorEmail,
      reason: this.reason,
      at: this.at,
      createdAt: this.createdAt,
    };
  }
}