import { DomainEvent } from '../../../../@shared/domain/DomainEvent';

export class TenantCreated extends DomainEvent {
  constructor(tenantId: string, ownerId: string, plan: string) {
    super({
      eventName: 'platform.tenant.created',
      aggregateId: tenantId,
      aggregateType: 'Tenant',
      tenantId,
      payload: { tenantId, ownerId, plan },
    });
  }
}

export class TenantSuspended extends DomainEvent {
  constructor(tenantId: string, reason: string) {
    super({
      eventName: 'platform.tenant.suspended',
      aggregateId: tenantId,
      aggregateType: 'Tenant',
      tenantId,
      payload: { tenantId, reason },
    });
  }
}
