import { UseCase } from '../../../../@shared/application/UseCase';
import { Notification, NotificationChannel } from '../../domain/Notification';

interface SendNotificationInput {
  tenantId: string;
  type: string;
  channel: NotificationChannel;
  recipient: string;
  subject: string;
  body: string;
  referenceType?: string;
  referenceId?: string;
}

export class NotificationService implements UseCase<SendNotificationInput, Notification> {
  constructor(
    private readonly notificationRepository: any,
    private readonly whatsappProvider: any,
  ) {}

  async execute(input: SendNotificationInput): Promise<Notification> {
    const notification = Notification.create({
      tenantId: input.tenantId,
      type: input.type,
      channel: input.channel,
      recipient: input.recipient,
      subject: input.subject,
      body: input.body,
      referenceType: input.referenceType || null,
      referenceId: input.referenceId || null,
    });

    let sent = false;

    if (input.channel === 'whatsapp') {
      sent = await this.whatsappProvider.send({
        to: input.recipient,
        message: input.body,
      });
    }

    if (sent) {
      notification.markSent();
    } else {
      notification.markFailed();
    }

    await this.notificationRepository.save(notification);
    return notification;
  }
}
