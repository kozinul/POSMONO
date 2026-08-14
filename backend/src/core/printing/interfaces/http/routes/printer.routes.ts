import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { authorize } from '../../../../../@shared/interfaces/middleware/authorize';
import { PrinterController } from '../controllers/PrinterController';

export function createPrinterRoutes(printerController: PrinterController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(printerController.list.bind(printerController)));
  router.get('/:id', authenticate, asyncHandler(printerController.getById.bind(printerController)));
  router.post('/', authenticate, authorize('printers:write'), asyncHandler(printerController.create.bind(printerController)));
  router.put('/:id', authenticate, authorize('printers:write'), asyncHandler(printerController.update.bind(printerController)));
  router.delete('/:id', authenticate, authorize('printers:write'), asyncHandler(printerController.delete.bind(printerController)));
  router.post('/:id/test', authenticate, authorize('printers:write'), asyncHandler(printerController.test.bind(printerController)));

  return router;
}

export function createPrintRoutes(printerController: PrinterController): Router {
  const router = Router();

  router.post('/receipt', authenticate, asyncHandler(printerController.printReceipt.bind(printerController)));
  router.post('/kot/:orderId', authenticate, asyncHandler(printerController.printKot.bind(printerController)));

  return router;
}
