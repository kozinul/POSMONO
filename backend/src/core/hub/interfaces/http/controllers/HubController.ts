import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { HubService } from '../../../application/services/HubService';
import { PlatformAuditService } from '../../../../../core/platform/audit/application/services/PlatformAuditService';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

export class HubController extends BaseController {
  constructor(
    private readonly hubService: HubService,
    private readonly auditService?: PlatformAuditService,
  ) {
    super();
  }

  async list(_req: Request, res: Response): Promise<void> {
    const hubs = await this.hubService.listAll();
    this.ok(res, hubs.map((h) => h.serialize()));
  }

  async getById(req: Request, res: Response): Promise<void> {
    const hub = await this.hubService.getById(req.params.id);
    this.ok(res, hub.serialize());
  }

  async create(req: Request, res: Response): Promise<void> {
    const { name, description, code } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('Name is required');
    }
    if (code !== undefined && typeof code !== 'string') {
      throw new ValidationError('Code must be a string');
    }
    const hub = await this.hubService.create({ name: name.trim(), description, code });
    const data = hub.serialize();
    await this.audit(req, {
      action: 'HUB_CREATED',
      description: `Hub "${name.trim()}" dibuat`,
      after: { hubId: data.id, hubName: data.name, code: data.code },
    });
    this.created(res, data);
  }

  async update(req: Request, res: Response): Promise<void> {
    const { name, description, code, status, ownerUserId } = req.body;
    if (name !== undefined && typeof name !== 'string') {
      throw new ValidationError('Name must be a string');
    }
    if (code !== undefined && typeof code !== 'string') {
      throw new ValidationError('Code must be a string');
    }
    if (ownerUserId !== undefined && ownerUserId !== null && typeof ownerUserId !== 'string') {
      throw new ValidationError('ownerUserId must be a string or null');
    }

    const before = await this.hubService.getById(req.params.id);
    const beforeData = before.serialize();
    const hub = await this.hubService.update(req.params.id, {
      name: name?.trim(),
      description,
      code,
      status,
      ownerUserId,
    });
    const after = hub.serialize();
    await this.audit(req, {
      action: 'HUB_UPDATED',
      description: `Hub "${beforeData.name}" diperbarui`,
      before: {
        name: beforeData.name,
        code: beforeData.code,
        status: beforeData.status,
        ownerUserId: beforeData.ownerUserId,
      },
      after: { name: after.name, code: after.code, status: after.status, ownerUserId: after.ownerUserId },
    });
    this.ok(res, after);
  }

  async delete(req: Request, res: Response): Promise<void> {
    const before = await this.hubService.getById(req.params.id);
    await this.hubService.delete(req.params.id);
    await this.audit(req, {
      action: 'HUB_DELETED',
      description: `Hub "${before.serialize().name}" dihapus`,
      before: { hubId: before.serialize().id, hubName: before.serialize().name },
    });
    this.noContent(res);
  }

  async assignTenant(req: Request, res: Response): Promise<void> {
    const hub = await this.hubService.getById(req.params.hubId);
    await this.hubService.assignTenant(req.params.hubId, req.params.tenantId);
    await this.audit(req, {
      action: 'TENANT_ASSIGNED_TO_HUB',
      tenantId: req.params.tenantId,
      description: `Tenant ditambahkan ke hub "${hub.serialize().name}"`,
      after: { hubId: req.params.hubId, tenantId: req.params.tenantId },
    });
    this.ok(res, { success: true });
  }

  async unassignTenant(req: Request, res: Response): Promise<void> {
    const hub = await this.hubService.getById(req.params.hubId);
    await this.hubService.unassignTenant(req.params.hubId, req.params.tenantId);
    await this.audit(req, {
      action: 'TENANT_REMOVED_FROM_HUB',
      tenantId: req.params.tenantId,
      description: `Tenant dihapus dari hub "${hub.serialize().name}"`,
      after: { hubId: req.params.hubId, tenantId: req.params.tenantId },
    });
    this.ok(res, { success: true });
  }

  async listTenants(req: Request, res: Response): Promise<void> {
    const tenants = await this.hubService.listTenants(req.params.hubId);
    this.ok(res, tenants.map((t) => t.serialize()));
  }

  private async audit(
    req: Request,
    payload: {
      action: any;
      tenantId?: string | null;
      description: string;
      before?: Record<string, unknown> | null;
      after?: Record<string, unknown> | null;
      reason?: string | null;
    },
  ): Promise<void> {
    if (!this.auditService) return;
    try {
      await this.auditService.recordFromRequest(req, {
        action: payload.action,
        tenantId: payload.tenantId ?? null,
        description: payload.description,
        before: payload.before ?? null,
        after: payload.after ?? null,
        reason: payload.reason ?? null,
      });
    } catch {
      // Audit recording must never break the primary operation.
    }
  }
}
