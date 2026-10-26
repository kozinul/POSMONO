import { RequestHandler, Router } from 'express';
import { PERMISSIONS } from '@posmono/shared';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { authorize } from '../../../../../@shared/interfaces/middleware/authorize';
import { requireModule, EntitlementSource } from '../../../../../@shared/interfaces/middleware/requireModule';
import { resolveOutlet } from '../../../../../@shared/interfaces/middleware/resolveOutlet';
import { UnauthorizedError } from '../../../../../@shared/infrastructure/error/AppError';
import { KdsController } from '../controllers/KdsController';

export function createKdsRoutes(
  kdsController: KdsController,
  entitlementService: EntitlementSource,
  outletMw: RequestHandler = resolveOutlet,
): Router {
  const router = Router();
  const moduleGate = requireModule(entitlementService, 'kds');
  const baseGuards = [authenticate, moduleGate, outletMw];
  const boardGuards = [...baseGuards, authorize(PERMISSIONS.KDS_READ)];
  const ticketWriteGuards = [...baseGuards, authorize(PERMISSIONS.KDS_WRITE)];
  const stationWriteGuards = [...baseGuards, authorize('printers:write')];

  // Lightweight entitlement probe for the KDS-only role. Uses `authenticate`
  // only: `/tenants/current/entitlement` requires a billing permission that a
  // station role must not have.
  router.get(
    '/access',
    authenticate,
    asyncHandler(async (req, res) => {
      if (!req.tenantId) throw new UnauthorizedError('Unauthorized');
      const enabled = await entitlementService.hasModule(req.tenantId, 'kds');
      res.status(200).json({ success: true, data: { enabled } });
    }),
  );

  router.get('/stations', ...boardGuards, asyncHandler(kdsController.listStations.bind(kdsController)));
  router.post('/stations', ...stationWriteGuards, asyncHandler(kdsController.createStation.bind(kdsController)));
  router.put('/stations/:id', ...stationWriteGuards, asyncHandler(kdsController.updateStation.bind(kdsController)));
  router.delete('/stations/:id', ...stationWriteGuards, asyncHandler(kdsController.deleteStation.bind(kdsController)));

  router.get('/tickets', ...boardGuards, asyncHandler(kdsController.listTickets.bind(kdsController)));
  router.patch('/tickets/:id/status', ...ticketWriteGuards, asyncHandler(kdsController.updateTicketStatus.bind(kdsController)));

  return router;
}
