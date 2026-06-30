import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { AuthService } from '../../../application/services/AuthService';
import { loginSchema } from '@posmono/shared';
import { z } from 'zod';
import { ValidationError } from '../../../../../@shared/infrastructure/error/AppError';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1),
  roleId: z.string().min(1),
});

export class AuthController extends BaseController {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async login(req: Request, res: Response): Promise<void> {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input');
    }

    const result = await this.authService.execute({
      email: parsed.data.email,
      password: parsed.data.password,
      tenantId: req.tenantId,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    this.ok(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: {
        id: result.user.id.toValue(),
        email: result.user.emailValue,
        displayName: result.user.displayNameValue,
        role: result.user.roleIdValue,
      },
    });
  }

  async refresh(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new ValidationError('Refresh token is required');
    }

    const result = await this.authService.refresh(refreshToken);

    this.ok(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  }

  async register(req: Request, res: Response): Promise<void> {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const user = await this.authService.register({
      tenantId: req.tenantId,
      ...parsed.data,
    });

    this.created(res, {
      id: user.id.toValue(),
      email: user.emailValue,
      displayName: user.displayNameValue,
      roleId: user.roleIdValue,
    });
  }

  async logout(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    this.noContent(res);
  }

  async me(req: Request, res: Response): Promise<void> {
    const user = await this.authService.getCurrentUser(req.userId, req.tenantId);
    if (!user) {
      throw new ValidationError('User not found');
    }

    this.ok(res, {
      id: user.id.toValue(),
      email: user.emailValue,
      displayName: user.displayNameValue,
      role: user.roleIdValue,
      isActive: user.isActiveUser(),
      lastLoginAt: user.serialize().lastLoginAt,
    });
  }
}
