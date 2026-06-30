import { AggregateRoot } from '../../../@shared/domain/AggregateRoot';
import { Identifier } from '../../../@shared/domain/Identifier';

class NotificationId extends Identifier {}

export type NotificationChannel = 'whatsapp' | 'email' | 'push';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'read';

export interface INotification {
  id: string;
  tenantId: string;
  type: string;
  channel: NotificationChannel;
  recipient: string;
  subject: string;
  body: string;
  status: NotificationStatus;
  referenceType: string | null;
  referenceId: string | null;
  sentAt: Date | null;
  readAt: Date | null;
  createdAt: Date;
}

export class Notification extends AggregateRoot<NotificationId> {
  private tenantId: string;
  private type: string;
  private channel: NotificationChannel;
  private recipient: string;
  private subject: string;
  private body: string;
  private status: NotificationStatus;
  private referenceType: string | null;
  private referenceId: string | null;
  private sentAt: Date | null;
  private readAt: Date | null;
  private createdAt: Date;

  private constructor(props: INotification) {
    super(new NotificationId(props.id));
    this.tenantId = props.tenantId;
    this.type = props.type;
    this.channel = props.channel;
    this.recipient = props.recipient;
    this.subject = props.subject;
    this.body = props.body;
    this.status = props.status;
    this.referenceType = props.referenceType;
    this.referenceId = props.referenceId;
    this.sentAt = props.sentAt;
    this.readAt = props.readAt;
    this.createdAt = props.createdAt;
  }

  static create(props: Omit<INotification, 'id' | 'status' | 'sentAt' | 'readAt' | 'createdAt'>): Notification {
    return new Notification({
      ...props,
      id: new NotificationId().toValue(),
      status: 'pending',
      sentAt: null,
      readAt: null,
      createdAt: new Date(),
    });
  }

  static hydrate(props: INotification): Notification {
    return new Notification(props);
  }

  markSent(): void {
    this.status = 'sent';
    this.sentAt = new Date();
  }

  markFailed(): void {
    this.status = 'failed';
  }

  markRead(): void {
    this.status = 'read';
    this.readAt = new Date();
  }

  serialize(): INotification {
    return {
      id: this._id.toValue(),
      tenantId: this.tenantId,
      type: this.type,
      channel: this.channel,
      recipient: this.recipient,
      subject: this.subject,
      body: this.body,
      status: this.status,
      referenceType: this.referenceType,
      referenceId: this.referenceId,
      sentAt: this.sentAt,
      readAt: this.readAt,
      createdAt: this.createdAt,
    };
  }
}
