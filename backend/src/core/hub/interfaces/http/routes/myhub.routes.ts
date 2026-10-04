import { Router } from 'express';
import { PERMISSIONS } from '@posmono/shared';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { resolveOutlet } from '../../../../../@shared/interfaces/middleware/resolveOutlet';
import type { HubMemberAccessService } from '../../../application/services/HubMemberAccessService';
import type { MyHubController } from '../controllers/MyHubController';
import { requireHubPermission } from '../middleware/requireHubPermission';
import {
  requireHubPermissionForOutlet,
  type HubOutletLookup,
  type HubOutletTenantLookup,
} from '../middleware/requireHubPermissionForOutlet';

/**
 * Hub V2 Fase 21 — `/api/hub`, the hub member's own surface.
 *
 * `authenticate`, never `platformAuthenticate`: the audience is a business person
 * who signed in like any other user, and their token carries no hub claim. The
 * permission comes from `requireHubPermission`, which resolves the membership
 * row per request — see that middleware for why `authorize()` cannot do it.
 *
 * Kept apart from `/api/hubs` and `/api/hub-memberships` on purpose: those two
 * are platform-administered (`platformAuthenticate` + `platform.hubs.manage`),
 * and folding the member reads into either file would make the boundary depend on
 * which route matched first — exactly the trap Fase 20 documented for invitations.
 */
export interface MyHubOutletScope {
  outlets: HubOutletLookup;
  tenants: HubOutletTenantLookup;
}

export function createMyHubRoutes(
  controller: MyHubController,
  accessService: HubMemberAccessService,
  outletScope: MyHubOutletScope,
): Router {
  const router = Router();

  // Self-scoped: which hubs am I in, and what may I do there. No `hubId` in the
  // path and no permission — otherwise a member with no hub role could not even
  // discover that they have none.
  router.get('/me/hubs', authenticate, asyncHandler(controller.myHubs.bind(controller)));

  // **Before** the `/:hubId/...` routes below, deliberately. Express matches in
  // registration order, and `/:hubId/overview` would happily swallow
  // `/outlet/overview` as `hubId = 'outlet'` — answering with "Hub with id outlet
  // not found" instead of the outlet view.
  router.get(
    '/outlet/overview',
    authenticate,
    resolveOutlet,
    requireHubPermissionForOutlet(
      accessService,
      outletScope.outlets,
      outletScope.tenants,
      PERMISSIONS.HUB_REPORTS_READ,
    ),
    asyncHandler(controller.outletOverview.bind(controller)),
  );

  router.get(
    '/:hubId',
    authenticate,
    requireHubPermission(accessService, PERMISSIONS.HUB_READ),
    asyncHandler(controller.profile.bind(controller)),
  );
  router.get(
    '/:hubId/tenants',
    authenticate,
    requireHubPermission(accessService, PERMISSIONS.HUB_TENANTS_READ),
    asyncHandler(controller.tenants.bind(controller)),
  );
  router.get(
    '/:hubId/members',
    authenticate,
    requireHubPermission(accessService, PERMISSIONS.HUB_MEMBERS_READ),
    asyncHandler(controller.members.bind(controller)),
  );
  router.get(
    '/:hubId/overview',
    authenticate,
    requireHubPermission(accessService, PERMISSIONS.HUB_REPORTS_READ),
    asyncHandler(controller.overview.bind(controller)),
  );

  return router;
}