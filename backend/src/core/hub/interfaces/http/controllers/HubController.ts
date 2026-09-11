import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { HubService } from '../../../application/services/HubService';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

export class HubController extends BaseController {
  constructor(private readonly hubService: HubService) {
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
    const { name, description } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('Name is required');
    }
    const hub = await this.hubService.create(name.trim(), description);
    this.created(res, hub.serialize());
  }

  async update(req: Request, res: Response): Promise<void> {
    const { name, description, isActive } = req.body;
    const hub = await this.hubService.update(req.params.id, {
      name: name?.trim(),
      description,
      isActive,
    });
    this.ok(res, hub.serialize());
  }

  async delete(req: Request, res: Response): Promise<void> {
    await this.hubService.delete(req.params.id);
    this.noContent(res);
  }

  async assignTenant(req: Request, res: Response): Promise<void> {
    await this.hubService.assignTenant(req.params.hubId, req.params.tenantId);
    this.ok(res, { success: true });
  }

  async unassignTenant(req: Request, res: Response): Promise<void> {
    await this.hubService.unassignTenant(req.params.hubId, req.params.tenantId);
    this.ok(res, { success: true });
  }

  async listTenants(req: Request, res: Response): Promise<void> {
    const tenants = await this.hubService.listTenants(req.params.hubId);
    this.ok(res, tenants.map((t) => t.serialize()));
  }
}
