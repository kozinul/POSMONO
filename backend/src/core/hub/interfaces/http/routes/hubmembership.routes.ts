import { Router } from 'express';
import { PERMISSIONS } from '@posmono/shared';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { platformAuthenticate, platformAuthorize } from '../../../../../core/platform/interfaces/http/middleware/platformAuth';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { HubMembershipController } from '../controllers/HubMembershipController';

const { PLATFORM_HUBS_MANAGE } = PERMISSIONS;

export function createHubMembershipRoutes(hubMembershipController: HubMembershipController): Router {
  const router = Router();

  router.post('/', platformAuthenticate, platformAuthorize(PLATFORM_HUBS_MANAGE), asyncHandler(hubMembershipController.add.bind(hubMembershipController)));
  router.get('/hub/:hubId', platformAuthenticate, platformAuthorize(PLATFORM_HUBS_MANAGE), asyncHandler(hubMembershipController.listMembers.bind(hubMembershipController)));
  router.put('/:hubId/:userId', platformAuthenticate, platformAuthorize(PLATFORM_HUBS_MANAGE), asyncHandler(hubMembershipController.updateRole.bind(hubMembershipController)));
  router.delete('/:hubId/:userId', platformAuthenticate, platformAuthorize(PLATFORM_HUBS_MANAGE), asyncHandler(hubMembershipController.remove.bind(hubMembershipController)));

  router.get('/me', authenticate, asyncHandler(hubMembershipController.myMemberships.bind(hubMembershipController)));
  router.get('/me/tenants', authenticate, asyncHandler(hubMembershipController.myAccessibleTenants.bind(hubMembershipController)));

  return router;
}