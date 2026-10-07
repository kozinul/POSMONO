import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ForbiddenError } from '../../infrastructure/error/AppError';

/** Effective outlet scope for the authenticated user.
 * Empty list = ALL outlets of the tenant (owner/admin semantics, `[]`).
 */
function scopeOutletIds(req: Request): string[] {
  return req.outletIds ?? [];
}

function readHeader(req: Request): string | undefined {
  return (req.headers['x-outlet-id'] as string | undefined)?.trim();
}

/**
 * Minimal shape of the outlet lookup — kept structural so the middleware can
 * be unit-tested with a stub and wired with `MongoOutletRepository` directly.
 */
export interface OutletStatusSource {
  findById(id: string): Promise<{ serialize(): { name: string; isActive: boolean } } | null>;
}

/** Validates `X-Outlet-Id` ∈ `req.outletIds`.
 *
 * - No header → `req.outletId = null` (server defaults to tenant default outlet).
 * - `req.outletIds = []` (all outlets) → any header accepted; ownership is still
 *   enforced downstream because every repository is tenant-scoped.
 * - Else header must be in the user's outlet list → otherwise Forbidden.
 */
export function resolveOutlet(req: Request, _res: Response, next: NextFunction): void {
  const header = readHeader(req);

  const scoped = scopeOutletIds(req);
  if (header && scoped.length > 0 && !scoped.includes(header)) {
    throw new ForbiddenError('Outlet tidak termasuk dalam akses user ini');
  }

  req.outletId = header || null;
  next();
}

/**
 * `resolveOutlet` + an outlet-status gate (2026-10-06). The scope check alone
 * accepts an `activeOutletId` that was deactivated *after* it was selected —
 * it lives in localStorage, so the cashier keeps sending it and every POS
 * mutation silently operates on an inactive outlet. This rejects the header
 * with a specific reason instead.
 *
 * Order matters: the scope check (cheap, sync) still answers first, so a
 * header outside the user's outlets never triggers a DB lookup. A missing
 * outlet document is NOT blocking — deletion semantics stay with the
 * downstream handlers, exactly as before.
 */
export function createResolveOutlet(outletRepository: OutletStatusSource): RequestHandler {
  return function resolveOutletChecked(req: Request, res: Response, next: NextFunction): void {
    const header = readHeader(req);
    const scoped = scopeOutletIds(req);

    if (header && scoped.length > 0 && !scoped.includes(header)) {
      next(new ForbiddenError('Outlet tidak termasuk dalam akses user ini'));
      return;
    }

    if (!header) {
      req.outletId = null;
      next();
      return;
    }

    outletRepository
      .findById(header)
      .then((outlet) => {
        const data = outlet?.serialize();
        if (data && !data.isActive) {
          next(new ForbiddenError(`Outlet "${data.name}" sedang nonaktif — pilih outlet lain.`));
          return;
        }
        req.outletId = header;
        next();
      })
      .catch(next);
  };
}
