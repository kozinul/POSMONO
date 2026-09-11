import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { OutletService } from '../../../application/services/OutletService';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

export class OutletController extends BaseController {
  constructor(private readonly outletService: OutletService) {
    super();
  }

  async list(req: Request, res: Response): Promise<void> {
    const outlets = await this.outletService.list(req.tenantId);
    this.ok(res, outlets.map((o) => o.serialize()));
  }

  async getById(req: Request, res: Response): Promise<void> {
    const outlet = await this.outletService.getById(req.tenantId, req.params.id);
    this.ok(res, outlet.serialize());
  }

  async create(req: Request, res: Response): Promise<void> {
    const { name, address, phone } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('Name is required');
    }
    const outlet = await this.outletService.create(req.tenantId, {
      name: name.trim(),
      address,
      phone,
    });
    this.created(res, outlet.serialize());
  }

  async update(req: Request, res: Response): Promise<void> {
    const { name, address, phone, isActive } = req.body;
    const outlet = await this.outletService.update(req.tenantId, req.params.id, {
      name: name?.trim(),
      address,
      phone,
      isActive,
    });
    this.ok(res, outlet.serialize());
  }

  async delete(req: Request, res: Response): Promise<void> {
    await this.outletService.delete(req.tenantId, req.params.id);
    this.noContent(res);
  }
}
