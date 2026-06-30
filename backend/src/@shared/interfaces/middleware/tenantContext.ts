import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      tenantId: string;
      userId: string;
      userRole: string;
      userPermissions: string[];
      user?: { tenantId: string };
    }
  }
}

export function tenantContext(req: Request, _res: Response, next: NextFunction): void {
  const tenantId =
    req.headers['x-tenant-id'] as string ||
    req.query.tenant as string ||
    req.user?.tenantId ||
    '';

  if (!tenantId && process.env.NODE_ENV === 'development') {
    req.tenantId = 'dev-tenant';
    return next();
  }

  req.tenantId = tenantId;
  next();
}
