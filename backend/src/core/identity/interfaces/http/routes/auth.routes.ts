import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { AuthController } from '../controllers/AuthController';

export function createAuthRoutes(authController: AuthController): Router {
  const router = Router();

  router.post('/login', asyncHandler(authController.login.bind(authController)));
  router.post('/register', authenticate, asyncHandler(authController.register.bind(authController)));
  router.post('/refresh', asyncHandler(authController.refresh.bind(authController)));
  router.post('/logout', asyncHandler(authController.logout.bind(authController)));
  router.get('/me', authenticate, asyncHandler(authController.me.bind(authController)));

  return router;
}
