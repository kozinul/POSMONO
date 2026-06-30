import { Request, Response } from 'express';
import { BaseController } from '../../../../../@shared/interfaces/BaseController';
import { PERMISSIONS } from '@posmono/shared';

export class PermissionController extends BaseController {
  async list(_req: Request, res: Response): Promise<void> {
    const permissions = Object.entries(PERMISSIONS).map(([key, code]) => ({
      key,
      code,
      module: code.split('.')[0],
    }));
    this.ok(res, permissions);
  }
}
