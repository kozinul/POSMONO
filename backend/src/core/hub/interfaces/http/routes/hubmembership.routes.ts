import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { platformAuthenticate, platformAuthorize } from '../../../../../core/platform/interfaces/http/middleware/platformAuth';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { HubMembershipController } from '../controllers/HubMembershipController';

export function createHubMembershipRoutes(hubMembershipController: HubMembershipController): Router {
  const router = Router();

  router.post('/', platformAuthenticate, platformAuthorize('hub:manage'), asyncHandler(hubMembershipController.add.bind(hubMembershipController)));
  router.get('/hub/:hubId', platformAuthenticate, platformAuthorize('hub:manage'), asyncHandler(hubMembershipController.listMembers.bind(hubMembershipController)));
  router.put('/:hubId/:userId', platformAuthenticate, platformAuthorize('hub:manage'), asyncHandler(hubMembershipController.updateRole.bind(hubMembershipController)));
  router.delete('/:hubId/:userId', platformAuthenticate, platformAuthorize('hub:manage'), asyncHandler(hubMembershipController.remove.bind(hubMembershipController)));

  router.get('/me', authenticate, asyncHandler(hubMembershipController.myMemberships.bind(hubMembershipController)));
  router.get('/me/tenants', authenticate, asyncHandler(hubMembershipController.myAccessibleTenants.bind(hubMembershipController)));

  return router;
}