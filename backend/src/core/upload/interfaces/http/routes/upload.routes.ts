import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { UploadController } from '../controllers/UploadController';

export function createUploadRoutes(uploadController: UploadController): Router {
  const router = Router();

  const upload = uploadController.getMiddleware();

  router.post('/', authenticate, upload.single('file'), asyncHandler(uploadController.upload.bind(uploadController)));
  router.post('/multiple', authenticate, upload.array('files', 10), asyncHandler(uploadController.uploadMultiple.bind(uploadController)));
  router.delete('/', authenticate, asyncHandler(uploadController.delete.bind(uploadController)));

  return router;
}
