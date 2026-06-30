import { DomainEvent } from '../../../../@shared/domain/DomainEvent';

export class UserRegistered extends DomainEvent {
  constructor(userId: string, email: string, tenantId: string) {
    super({
      eventName: 'platform.user.registered',
      aggregateId: userId,
      aggregateType: 'User',
      tenantId,
      payload: { userId, email, tenantId },
    });
  }
}

export class UserLoggedIn extends DomainEvent {
  constructor(userId: string, tenantId: string, ip: string) {
    super({
      eventName: 'platform.user.logged_in',
      aggregateId: userId,
      aggregateType: 'User',
      tenantId,
      payload: { userId, tenantId, ip },
    });
  }
}
