import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ForbiddenError } from '../../../../../@shared/infrastructure/error/AppError';
import {
  TENANT_STATUS_LABELS,
  tenantEntryDenial,
  type TenantEntryDenial,
  type TenantEntryRecord,
} from '../../../domain/tenantEntry';

/**
 * Minimal tenant lookup — structural on purpose so the gate unit-tests with a
 * stub and wires with `MongoTenantRepository` directly (same pattern as
 * `OutletStatusSource` in `resolveOutlet`).
 */
export interface TenantStatusSource {
  findById(id: string): Promise<TenantEntryRecord | null>;
}

/** Reads never need this gate: the POS alert page itself lives on GETs. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function refusalMessage(denial: TenantEntryDenial, tenant: TenantEntryRecord | null | undefined): string {
  if (denial === 'suspended') {
    return 'Toko sedang ditangguhkan — transaksi tidak dapat dilakukan. Hubungi pengelola untuk perpanjangan.';
  }
  if (denial === 'expired') {
    return 'Masa aktif toko telah berakhir — hubungi pengelola untuk memperpanjang sebelum bertransaksi.';
  }
  const status = String(tenant?.serialize?.()?.status ?? '');
  const label = TENANT_STATUS_LABELS[status] ?? 'nonaktif';
  return `Toko berstatus ${label} — transaksi tidak dapat dilakukan. Hubungi pengelola.`;
}

/**
 * Blocks POS mutations (orders/shifts/payments) while the tenant is not
 * usable — the server-side half of the POS status alert (2026-10-08), so a
 * suspended/frozen/expired tenant cannot trade even from a client that never
 * renders the alert.
 *
 * - Rule shared with the entry gate via `tenantEntryDenial(tenant, false)`:
 *   NO owner grace here. The entry grace exists so an owner can reach billing
 *   recovery from inside; selling is exactly what a suspension must stop.
 * - Safe methods pass without a lookup — reads stay open so the POS can load
 *   tenant status and render the refusal.
 * - Read-only: no lazy-suspend write. The sweep and `GET /tenants/current`
 *   already own that; refusing with `expired` is enough on this path.
 * - A missing tenant document never blocks (platform super admin has no
 *   `tenants` row) — see `tenantEntryDenial`.
 */
export function createTenantStatusGate(tenantRepository: TenantStatusSource): RequestHandler {
  return function tenantStatusGate(req: Request, _res: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    const tenantId = req.tenantId;
    if (!tenantId) {
      next();
      return;
    }

    tenantRepository
      .findById(tenantId)
      .then((tenant) => {
        const denial = tenantEntryDenial(tenant, false);
        if (denial) {
          next(new ForbiddenError(refusalMessage(denial, tenant)));
          return;
        }
        next();
      })
      .catch(next);
  };
}
