export interface TenantCreatedEvent {
  tenantId: string;
  ownerId: string;
  plan: string;
}

export interface TenantSuspendedEvent {
  tenantId: string;
  reason: string;
}

export interface TenantActivatedEvent {
  tenantId: string;
}

export interface TenantConfigUpdatedEvent {
  tenantId: string;
  config: Record<string, unknown>;
}
