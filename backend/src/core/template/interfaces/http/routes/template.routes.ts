import { Router } from 'express';
import { asyncHandler } from '../../../../../@shared/interfaces/middleware/asyncHandler';
import { authenticate } from '../../../../../@shared/interfaces/middleware/authenticate';
import { TemplateController } from '../controllers/TemplateController';

export function createTemplateRoutes(templateController: TemplateController): Router {
  const router = Router();

  router.get('/', authenticate, asyncHandler(templateController.list.bind(templateController)));
  router.get('/:id', authenticate, asyncHandler(templateController.getById.bind(templateController)));
  router.post('/', authenticate, asyncHandler(templateController.create.bind(templateController)));
  router.put('/:id', authenticate, asyncHandler(templateController.update.bind(templateController)));
  router.post('/:id/publish', authenticate, asyncHandler(templateController.publish.bind(templateController)));
  router.post('/:id/duplicate', authenticate, asyncHandler(templateController.duplicate.bind(templateController)));
  router.delete('/:id', authenticate, asyncHandler(templateController.delete.bind(templateController)));
  router.post('/:id/export', authenticate, asyncHandler(templateController.exportTemplate.bind(templateController)));
  router.get('/:id/versions', authenticate, asyncHandler(templateController.listVersions.bind(templateController)));
  router.post('/:id/rollback/:versionId', authenticate, asyncHandler(templateController.rollback.bind(templateController)));
  router.post('/import', authenticate, asyncHandler(templateController.importTemplate.bind(templateController)));

  // Render endpoints
  router.post('/render', authenticate, asyncHandler(templateController.render.bind(templateController)));
  router.post('/render/preview', authenticate, asyncHandler(templateController.renderPreview.bind(templateController)));
  router.post('/validate', authenticate, asyncHandler(templateController.validate.bind(templateController)));

  return router;
}
