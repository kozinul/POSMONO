import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  PlatformAuditLog,
  PlatformAuditAction,
  PlatformAuditLogProps,
} from '../../domain/PlatformAuditLog';
import { MongoPlatformAuditLogRepository, PlatformAuditLogFilter } from '../../infrastructure/persistence/MongoPlatformAuditLogRepository';

export interface AuditRecordPayload {
  action: PlatformAuditAction;
  tenantId?: string | null;
  description: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
}

export class PlatformAuditService {
  constructor(private readonly repository: MongoPlatformAuditLogRepository) {}

  private resolveRequestId(req: Request): string {
    if (req.headers['x-request-id']) {
      return String(req.headers['x-request-id']);
    }
    const res = (req as any).res;
    if (res?.locals?.requestId) {
      return res.locals.requestId;
    }
    const requestId = uuidv4();
    if (res) res.locals.requestId = requestId;
    return requestId;
  }

  async recordFromRequest(req: Request, payload: AuditRecordPayload): Promise<PlatformAuditLog> {
    const log = PlatformAuditLog.create({
      action: payload.action,
      actorId: (req as any).platformUserId ?? 'system',
      actorEmail: (req as any).platformUserEmail ?? 'system',
      actorRole: (req as any).platformUserRoleName ?? '',
      tenantId: payload.tenantId ?? null,
      description: payload.description,
      before: payload.before ?? null,
      after: payload.after ?? null,
      reason: payload.reason ?? null,
      ip: req.ip ?? null,
      requestId: this.resolveRequestId(req),
    });
    await this.repository.save(log);
    return log;
  }

  async record(props: PlatformAuditLogProps): Promise<PlatformAuditLog> {
    const log = PlatformAuditLog.create(props);
    await this.repository.save(log);
    return log;
  }

  async list(filter: PlatformAuditLogFilter): Promise<{
    items: ReturnType<PlatformAuditLog['serialize']>[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(filter.skip && filter.limit ? Math.floor(filter.skip / filter.limit) + 1 : 1, 1);
    const { items, total } = await this.repository.find({
      ...filter,
      skip: filter.skip ?? 0,
      limit: filter.limit ?? 50,
    });
    return {
      items: items.map((log) => log.serialize()),
      total,
      page,
      limit: filter.limit ?? 50,
    };
  }
}