import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../../infrastructure/error/AppError';

/** Effective outlet scope for the authenticated user.
 * Empty list = ALL outlets of the tenant (owner/admin semantics, `[]`).
 */
export function scopeOutletIds(req: Request): string[] {
  return req.outletIds ?? [];
}

/** Validates `X-Outlet-Id` ∈ `req.outletIds`.
 *
 * - No header → `req.outletId = null` (server defaults to tenant default outlet).
 * - `req.outletIds = []` (all outlets) → any header accepted; ownership is still
 *   enforced downstream because every repository is tenant-scoped.
 * - Else header must be in the user's outlet list → otherwise Forbidden.
 */
export function resolveOutlet(req: Request, _res: Response, next: NextFunction): void {
  const header = (req.headers['x-outlet-id'] as string | undefined)?.trim();

  const scoped = scopeOutletIds(req);
  if (header && scoped.length > 0 && !scoped.includes(header)) {
    throw new ForbiddenError('Outlet tidak termasuk dalam akses user ini');
  }

  req.outletId = header || null;
  next();
}

export function requireOutlet(req: Request, _res: Response, next: NextFunction): void {
  resolveOutlet(req, _res, next);
  if (!req.outletId) {
    throw new ForbiddenError('Outlet wajib dipilih (X-Outlet-Id)');
  }
}