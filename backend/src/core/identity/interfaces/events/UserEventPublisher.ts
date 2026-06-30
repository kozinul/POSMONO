import { EventBus } from '../../../../@shared/infrastructure/eventBus/EventBus';
import { DomainEvent } from '../../../../@shared/domain/DomainEvent';

export class UserEventPublisher {
  constructor(private readonly eventBus: EventBus) {}

  publishUserRegistered(userId: string, email: string, tenantId: string): void {
    this.eventBus.publish(
      new DomainEvent({
        eventName: 'platform.user.registered',
        aggregateId: userId,
        aggregateType: 'User',
        tenantId,
        payload: { userId, email, tenantId },
      }),
    );
  }
}
