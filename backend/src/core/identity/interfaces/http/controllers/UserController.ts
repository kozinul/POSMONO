import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { UserService } from '../../../application/services/UserService';
import { z } from 'zod';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

const updateSchema = z.object({
  displayName: z.string().min(1).optional(),
  roleId: z.string().optional(),
  password: z.string().min(6).optional(),
  isActive: z.boolean().optional(),
});

export class UserController extends BaseController {
  constructor(private readonly userService: UserService) {
    super();
  }

  async list(req: Request, res: Response): Promise<void> {
    const users = await this.userService.list(req.tenantId);
    this.ok(res, users.map((u) => {
      const s = u.serialize();
      return {
        id: s.id,
        email: s.email,
        displayName: s.displayName,
        roleId: s.roleId,
        isActive: s.isActive,
        lastLoginAt: s.lastLoginAt,
        createdAt: s.createdAt,
      };
    }));
  }

  async getById(req: Request, res: Response): Promise<void> {
    const user = await this.userService.getById(req.tenantId, req.params.id);
    const s = user.serialize();
    this.ok(res, {
      id: s.id,
      email: s.email,
      displayName: s.displayName,
      roleId: s.roleId,
      isActive: s.isActive,
      lastLoginAt: s.lastLoginAt,
      createdAt: s.createdAt,
    });
  }

  async update(req: Request, res: Response): Promise<void> {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const user = await this.userService.update(req.tenantId, req.params.id, parsed.data);
    const s = user.serialize();
    this.ok(res, {
      id: s.id,
      email: s.email,
      displayName: s.displayName,
      roleId: s.roleId,
      isActive: s.isActive,
    });
  }

  async deactivate(req: Request, res: Response): Promise<void> {
    const user = await this.userService.deactivate(req.tenantId, req.params.id);
    this.ok(res, { id: user.id.toValue(), isActive: false });
  }

  async activate(req: Request, res: Response): Promise<void> {
    const user = await this.userService.activate(req.tenantId, req.params.id);
    this.ok(res, { id: user.id.toValue(), isActive: true });
  }
}
