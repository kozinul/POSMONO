import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { HubInvitationController } from '../controllers/HubInvitationController';

/**
 * Hub V2 Fase 20 — the invitee's own invitation.
 *
 * `authenticate`, not `platformAuthenticate`: the person redeeming a link is an
 * ordinary signed-in user, not a platform admin. The token in the path is the
 * credential, and the service additionally requires the signed-in address to
 * match the invited one — so holding a leaked link is not enough.
 *
 * Kept out of `/api/hubs/:hubId/invitations` on purpose: that router is
 * platform-administered, and mixing the two audiences in one file would make the
 * permission boundary a matter of which route matched first.
 */
export function createHubInvitationRoutes(hubInvitationController: HubInvitationController): Router {
  const router = Router();

  router.get(
    '/:token',
    authenticate,
    asyncHandler(hubInvitationController.preview.bind(hubInvitationController)),
  );
  router.post(
    '/:token/accept',
    authenticate,
    asyncHandler(hubInvitationController.accept.bind(hubInvitationController)),
  );

  return router;
}