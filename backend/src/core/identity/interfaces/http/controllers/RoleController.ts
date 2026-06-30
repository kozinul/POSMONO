import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { RoleService } from '../../../application/services/RoleService';
import { z } from 'zod';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

export class RoleController extends BaseController {
  constructor(private readonly roleService: RoleService) {
    super();
  }

  async list(req: Request, res: Response): Promise<void> {
    const roles = await this.roleService.list(req.tenantId);
    this.ok(res, roles.map((r) => r.serialize()));
  }

  async getById(req: Request, res: Response): Promise<void> {
    const role = await this.roleService.getById(req.tenantId, req.params.id);
    this.ok(res, role.serialize());
  }

  async create(req: Request, res: Response): Promise<void> {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const role = await this.roleService.create({
      tenantId: req.tenantId,
      ...parsed.data,
    });

    this.created(res, role.serialize());
  }

  async update(req: Request, res: Response): Promise<void> {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const role = await this.roleService.update(req.tenantId, req.params.id, parsed.data);
    this.ok(res, role.serialize());
  }

  async delete(req: Request, res: Response): Promise<void> {
    await this.roleService.delete(req.tenantId, req.params.id);
    this.noContent(res);
  }
}
