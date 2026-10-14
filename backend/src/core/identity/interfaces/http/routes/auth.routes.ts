import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { authorize } from '../../../../../@shared/interfaces/middleware/authorize';
import { AuthController } from '../controllers/AuthController';

export function createAuthRoutes(authController: AuthController): Router {
  const router = Router();

  router.post('/login', asyncHandler(authController.login.bind(authController)));
  router.post('/hub-login', asyncHandler(authController.hubLogin.bind(authController)));
  // Admin-only: mirrors POST /api/users. Registering a user picks a roleId, so
  // an unguarded endpoint lets a cashier create an Owner account.
  router.post('/register', authenticate, authorize('users:write'), asyncHandler(authController.register.bind(authController)));
  router.post('/refresh', asyncHandler(authController.refresh.bind(authController)));
  router.post('/logout', asyncHandler(authController.logout.bind(authController)));
  router.get('/me', authenticate, asyncHandler(authController.me.bind(authController)));
  router.get('/accessible-tenants', authenticate, asyncHandler(authController.accessibleTenants.bind(authController)));
  router.post('/switch-tenant', authenticate, asyncHandler(authController.switchTenant.bind(authController)));

  return router;
}
