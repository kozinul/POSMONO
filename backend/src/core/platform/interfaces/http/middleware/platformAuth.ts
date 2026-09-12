import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../../../../@shared/config/env';
import { UnauthorizedError, ForbiddenError } from '../../../../../@shared/infrastructure/error/AppError';

export interface PlatformJwtPayload {
  sub: string;
  tenant: 'platform';
  role: string;
  roleName?: string;
  permissions?: string[];
  outletIds?: string[];
}

declare global {
  namespace Express {
    interface Request {
      platformUserId: string;
      platformUserRole: string;
      platformUserRoleName: string;
      platformUserPermissions: string[];
    }
  }
}

export function platformAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as PlatformJwtPayload;
    
    if (decoded.tenant !== 'platform') {
      throw new UnauthorizedError('Invalid token: not a platform session');
    }

    req.platformUserId = decoded.sub;
    req.platformUserRole = decoded.role;
    req.platformUserRoleName = decoded.roleName ?? '';
    req.platformUserPermissions = decoded.permissions ?? [];
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired platform token');
  }
}

export function platformAuthorize(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const userPermissions = req.platformUserPermissions ?? [];
    const hasPermission = requiredPermissions.every((p) => userPermissions.includes(p));
    
    if (!hasPermission) {
      throw new ForbiddenError(`Insufficient permissions: requires ${requiredPermissions.join(', ')}`);
    }
    next();
  };
}