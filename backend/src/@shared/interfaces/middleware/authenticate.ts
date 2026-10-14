import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../infrastructure/error/AppError';

interface JwtPayload {
  sub: string;
  tenant: string;
  role: string;
  roleName?: string;
  permissions?: string[];
  outletIds?: string[];
  type?: 'access' | 'refresh';
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }

  // Refresh tokens are signed with the same secret and carry the same claims;
  // without this they would be accepted as bearer tokens. Access tokens minted
  // elsewhere (e.g. test helpers) legitimately omit `type`, so only an explicit
  // refresh type is refused.
  if (decoded.type === 'refresh') {
    throw new UnauthorizedError('Invalid token type');
  }

  req.userId = decoded.sub;
  req.tenantId = decoded.tenant;
  req.userRole = decoded.role;
  req.userRoleName = decoded.roleName ?? '';
  req.userPermissions = decoded.permissions ?? [];
  req.outletIds = decoded.outletIds ?? [];
  next();
}
