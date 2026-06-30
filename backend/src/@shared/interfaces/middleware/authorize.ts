import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../../infrastructure/error/AppError';

export function authorize(...permissions: string[]) {
  // TODO: populate req.userPermissions from DB based on JWT role
  return (req: Request, _res: Response, next: NextFunction): void => {
    const userPermissions = req.userPermissions || [];

    const hasAllPermissions = permissions.every((p) => userPermissions.includes(p));

    if (!hasAllPermissions) {
      throw new ForbiddenError('Insufficient permissions');
    }

    next();
  };
}
