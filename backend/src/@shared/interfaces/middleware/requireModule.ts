import { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../infrastructure/error/AppError';

export interface EntitlementSource {
  hasModule(tenantId: string, moduleName: string): Promise<boolean>;
}

/**
 * Feature gate backed by the live entitlement record, not by JWT claims.
 *
 * Plan/add-on changes must take effect without forcing users to re-login, so
 * this deliberately looks the module up per request.
 */
export function requireModule(entitlementService: EntitlementSource, moduleName: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.tenantId) throw new UnauthorizedError('Unauthorized');
      const allowed = await entitlementService.hasModule(req.tenantId, moduleName);
      if (!allowed) {
        throw new ForbiddenError(`Modul ${moduleName} tidak aktif untuk tenant ini.`);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
