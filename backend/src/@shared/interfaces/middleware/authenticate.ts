import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../infrastructure/error/AppError';

interface JwtPayload {
  sub: string;
  tenant: string;
  role: string;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.userId = decoded.sub;
    req.tenantId = decoded.tenant;
    req.userRole = decoded.role;
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
