import { AggregateRoot } from '../../../../@shared/domain/AggregateRoot';
import { Identifier } from '../../../../@shared/domain/Identifier';

class AuditLogId extends Identifier {}

export const PLATFORM_AUDIT_ACTIONS = [
  'TENANT_CREATED',
  'TENANT_UPDATED',
  'TENANT_STATUS_CHANGED',
  'TENANT_FROZEN',
  'TENANT_SUSPENDED',
  'TENANT_DEACTIVATED',
  'SUBSCRIPTION_EXTENDED',
  'PLAN_ASSIGNED',
  'PLAN_CHANGED',
  'PLAN_CANCELLED',
  'OUTLET_CREATED',
  'OUTLET_UPDATED',
  'HUB_CREATED',
  'HUB_UPDATED',
  'HUB_DELETED',
  'TENANT_ASSIGNED_TO_HUB',
  'TENANT_REMOVED_FROM_HUB',
  'MEMBER_ADDED',
  'MEMBER_ROLE_CHANGED',
  'MEMBER_REMOVED',
  // Hub V2 Fase 17 — per-tenant access grants. Access changes are the
  // security-relevant ones, so they get their own audit actions rather than
  // being folded into MEMBER_ROLE_CHANGED.
  'MEMBER_ACCESS_GRANTED',
  'MEMBER_ACCESS_UPDATED',
  'MEMBER_ACCESS_REVOKED',
] as const;

export type PlatformAuditAction = (typeof PLATFORM_AUDIT_ACTIONS)[number];

export interface IPlatformAuditLog {
  id: string;
  action: PlatformAuditAction;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  tenantId?: string | null;
  description: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  ip?: string | null;
  requestId?: string | null;
  occurredAt: Date;
  createdAt: Date;
}

export type PlatformAuditLogProps = Omit<
  IPlatformAuditLog,
  'id' | 'occurredAt' | 'createdAt'
> &
  Partial<Pick<IPlatformAuditLog, 'occurredAt'>>;

export class PlatformAuditLog extends AggregateRoot<AuditLogId> {
  private action: PlatformAuditAction;
  private actorId: string;
  private actorEmail: string;
  private actorRole: string;
  private tenantId: string | null;
  private description: string;
  private before: Record<string, unknown> | null;
  private after: Record<string, unknown> | null;
  private reason: string | null;
  private ip: string | null;
  private requestId: string | null;
  private occurredAt: Date;
  private createdAt: Date;

  private constructor(props: IPlatformAuditLog) {
    super(new AuditLogId(props.id));
    this.action = props.action;
    this.actorId = props.actorId;
    this.actorEmail = props.actorEmail;
    this.actorRole = props.actorRole;
    this.tenantId = props.tenantId ?? null;
    this.description = props.description;
    this.before = props.before ?? null;
    this.after = props.after ?? null;
    this.reason = props.reason ?? null;
    this.ip = props.ip ?? null;
    this.requestId = props.requestId ?? null;
    this.occurredAt = props.occurredAt;
    this.createdAt = props.createdAt;
  }

  static create(props: PlatformAuditLogProps): PlatformAuditLog {
    return new PlatformAuditLog({
      ...props,
      id: new AuditLogId().toValue(),
      occurredAt: props.occurredAt ?? new Date(),
      createdAt: new Date(),
    });
  }

  static hydrate(props: IPlatformAuditLog): PlatformAuditLog {
    return new PlatformAuditLog(props);
  }

  serialize(): IPlatformAuditLog {
    return {
      id: this._id.toValue(),
      action: this.action,
      actorId: this.actorId,
      actorEmail: this.actorEmail,
      actorRole: this.actorRole,
      tenantId: this.tenantId,
      description: this.description,
      before: this.before,
      after: this.after,
      reason: this.reason,
      ip: this.ip,
      requestId: this.requestId,
      occurredAt: this.occurredAt,
      createdAt: this.createdAt,
    };
  }
}