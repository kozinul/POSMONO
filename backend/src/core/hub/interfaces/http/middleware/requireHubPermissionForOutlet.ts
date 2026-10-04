import type { RequestHandler } from 'express';
import { AppError, NotFoundError, ValidationError } from '../../../../../@shared/infrastructure/error/AppError';
import type { HubMemberAccessService } from '../../../application/services/HubMemberAccessService';

/**
 * Hub V2 Fase 23 — the guard for `/hub/outlet/*`.
 *
 * The outlet view has no `hubId` and no `outletId` in its path, because
 * `activeOutletId` is the single source of truth for "which outlet am I looking
 * at" (same rule as `/pos`). That makes this middleware the **only** place the
 * hub gets decided, and it is a chain with no shortcuts:
 *
 *   `X-Outlet-Id` → outlet → tenant → tenant.hubId → membership → permission
 *
 * Deriving the hub instead of accepting it is what stops `hubs[0]`: with a path
 * parameter the client picks the hub, so a member of several hubs gets whichever
 * one the frontend guessed. Here the hub is whatever the outlet's tenant actually
 * belongs to, and membership decides whether that is allowed at all.
 *
 * A tenant with no hub (`hubId: null`) has nothing to view here — 404, the same
 * way an unknown hub reads, so "there is no hub behind this outlet" and "that hub
 * does not exist" are not two different answers to probe.
 *
 * Mount it **after** `authenticate` and `resolveOutlet`: it reads `req.userId` and
 * `req.outletId`, both of which those two establish.
 */
export interface HubOutletDocument {
  id: string;
  name: string;
  tenantId: string;
  isActive: boolean;
}

export interface HubOutletTenantDocument {
  hubId: string | null;
  name?: string;
}

export interface HubOutletLookup {
  findById(id: string): Promise<{ serialize(): HubOutletDocument } | null>;
}

export interface HubOutletTenantLookup {
  findById(id: string): Promise<{ serialize(): HubOutletTenantDocument } | null>;
}

/** The outlet behind the request, resolved once so the handler never re-reads it. */
export interface ResolvedHubOutlet {
  id: string;
  name: string;
  tenantId: string;
  tenantName: string | null;
  isActive: boolean;
}

declare global {
  namespace Express {
    interface Request {
      /** Set by `requireHubPermissionForOutlet` for handlers mounted behind it. */
      hubOutlet?: ResolvedHubOutlet;
    }
  }
}

export function requireHubPermissionForOutlet(
  accessService: HubMemberAccessService,
  outlets: HubOutletLookup,
  tenants: HubOutletTenantLookup,
  ...required: string[]
): RequestHandler {
  return (req, res, next) => {
    void resolve(req)
      .then(async (outlet) => {
        const tenant = await tenants.findById(outlet.tenantId);
        if (!tenant) throw new NotFoundError('Tenant', outlet.tenantId);

        const hubId = tenant.serialize().hubId;
        if (!hubId) {
          throw new AppError(
            'NOT_FOUND',
            'Outlet ini belum terhubung ke hub mana pun',
            404,
          );
        }

        // Same assertion the path-based guard uses, so the 404-before-403 order
        // and the role matrix stay defined in exactly one place.
        req.hubAccess = await accessService.assertHubPermission(hubId, req.userId, ...required);
        req.hubOutlet = { ...outlet, tenantName: tenant.serialize().name ?? null };
        next();
      })
      .catch(next);

    async function resolve(request: typeof req): Promise<HubOutletDocument> {
      const outletId = request.outletId;
      if (!outletId) {
        throw new ValidationError('Pilih outlet terlebih dahulu untuk membuka dashboard hub outlet.');
      }
      const outlet = await outlets.findById(outletId);
      if (!outlet) throw new NotFoundError('Outlet', outletId);
      return outlet.serialize();
    }
  };
}
