import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { HubMembershipController } from '../controllers/HubMembershipController';

/**
 * Hub V2 Fase 17 — "what can I actually reach?" for the signed-in user.
 *
 * Separate from `/api/hub-memberships` because it is authenticate-only (a member
 * reads their own reach), whereas that router is platform-administered. It is the
 * endpoint the frontend uses to explain the tenant switcher instead of guessing
 * from membership rows.
 */
export function createHubContextRoutes(hubMembershipController: HubMembershipController): Router {
  const router = Router();

  router.get('/me', authenticate, asyncHandler(hubMembershipController.myContext.bind(hubMembershipController)));

  return router;
}
