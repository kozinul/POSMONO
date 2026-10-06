import { Router } from 'express';
import { PERMISSIONS } from '@posmono/shared';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import type { HubMemberAccessService } from '../../../application/services/HubMemberAccessService';
import type { MyHubAdminController } from '../controllers/MyHubAdminController';
import { requireHubPermission } from '../middleware/requireHubPermission';

const { HUB_MEMBERS_READ, HUB_MEMBERS_MANAGE } = PERMISSIONS;

/**
 * Hub V2 Fase 24 — mutations driven by hub members, not by platform operators.
 *
 * Split from `myhub.routes.ts` on purpose, for the same reason the invitee's
 * routes were split off in Fase 20: two audiences, two permission sources. That
 * file is the read surface (`hub.read`, `hub.tenants.read`, `hub.reports.read`),
 * this one is the write surface (`hub.members.manage`). Folding them together
 * would make the boundary depend on which route matched first.
 *
 * The permission comes from the membership row per request — `hub.*` is absent
 * from every JWT, so `authorize()` cannot be used here. What the permission does
 * *not* cover is the ceiling (`hubRoleRules`): the handler decides how much
 * authority the caller may hand out and to whom.
 */
export function createMyHubAdminRoutes(
  controller: MyHubAdminController,
  accessService: HubMemberAccessService,
): Router {
  const router = Router();
  const guard = (...required: string[]) => [
    authenticate,
    requireHubPermission(accessService, ...required),
  ] as const;

  router.get(
    '/:hubId/members/candidates',
    ...guard(HUB_MEMBERS_READ),
    asyncHandler(controller.candidates.bind(controller)),
  );

  router.post(
    '/:hubId/members',
    ...guard(HUB_MEMBERS_MANAGE),
    asyncHandler(controller.addMember.bind(controller)),
  );
  router.put(
    '/:hubId/members/:userId',
    ...guard(HUB_MEMBERS_MANAGE),
    asyncHandler(controller.updateRole.bind(controller)),
  );
  router.put(
    '/:hubId/members/:userId/status',
    ...guard(HUB_MEMBERS_MANAGE),
    asyncHandler(controller.setMemberStatus.bind(controller)),
  );
  router.delete(
    '/:hubId/members/:userId',
    ...guard(HUB_MEMBERS_MANAGE),
    asyncHandler(controller.removeMember.bind(controller)),
  );

  // Fase 17 grants, now writable from the hub side. Same ceiling as above: a
  // member cannot rewrite their own access, and cannot grant a tenant role above
  // their own hub rank.
  router.get(
    '/:hubId/members/:userId/access',
    ...guard(HUB_MEMBERS_READ),
    asyncHandler(controller.listAccess.bind(controller)),
  );
  router.put(
    '/:hubId/members/:userId/access',
    ...guard(HUB_MEMBERS_MANAGE),
    asyncHandler(controller.replaceAccess.bind(controller)),
  );
  router.delete(
    '/:hubId/members/:userId/access/:tenantId',
    ...guard(HUB_MEMBERS_MANAGE),
    asyncHandler(controller.revokeAccess.bind(controller)),
  );

  router.get(
    '/:hubId/invitations',
    ...guard(HUB_MEMBERS_READ),
    asyncHandler(controller.listInvitations.bind(controller)),
  );
  router.post(
    '/:hubId/invitations',
    ...guard(HUB_MEMBERS_MANAGE),
    asyncHandler(controller.createInvitation.bind(controller)),
  );
  router.delete(
    '/:hubId/invitations/:invitationId',
    ...guard(HUB_MEMBERS_MANAGE),
    asyncHandler(controller.revokeInvitation.bind(controller)),
  );

  return router;
}
