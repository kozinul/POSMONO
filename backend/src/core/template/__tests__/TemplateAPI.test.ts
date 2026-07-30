import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import mongoose, { Model } from 'mongoose';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearCollections } from '../../../../tests/helpers/db';
import { TemplateSchema } from '../infrastructure/persistence/schemas/TemplateSchema';
import { MongoTemplateRepository } from '../infrastructure/persistence/MongoTemplateRepository';
import { TemplateService } from '../application/services/TemplateService';
import { TemplateController } from '../interfaces/http/controllers/TemplateController';
import { Router } from 'express';
import { asyncHandler } from '../../../@shared/interfaces/middleware/asyncHandler';
import { errorHandler } from '../../../@shared/interfaces/middleware/errorHandler';
import { Request, Response, NextFunction } from 'express';

function testAuth(req: Request, _res: Response, next: NextFunction): void {
  (req as any).tenantId = 'template-test-tenant';
  (req as any).userId = 'test-user';
  next();
}

function createTestRoutes(controller: TemplateController): Router {
  const router = Router();
  router.get('/', testAuth, asyncHandler(controller.list.bind(controller)));
  router.get('/:id', testAuth, asyncHandler(controller.getById.bind(controller)));
  router.post('/', testAuth, asyncHandler(controller.create.bind(controller)));
  router.put('/:id', testAuth, asyncHandler(controller.update.bind(controller)));
  router.post('/:id/publish', testAuth, asyncHandler(controller.publish.bind(controller)));
  router.post('/:id/duplicate', testAuth, asyncHandler(controller.duplicate.bind(controller)));
  router.delete('/:id', testAuth, asyncHandler(controller.delete.bind(controller)));
  return router;
}

describe('Template API', () => {
  let app: express.Express;

  beforeAll(async () => {
    await setupTestDb();

    const model: Model<any> = mongoose.model('Template', TemplateSchema);
    const repo = new MongoTemplateRepository(model);
    const service = new TemplateService(repo);
    const controller = new TemplateController(service);

    app = express();
    app.use(express.json());
    app.use('/api/templates', createTestRoutes(controller));
    app.use(errorHandler);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  const validTemplate = {
    name: 'Standard Receipt 58mm',
    description: 'Standard thermal receipt',
    documentType: 'receipt',
    paper: { type: 'thermal58', width: 58, height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } },
  };

  describe('POST /api/templates', () => {
    it('creates a template', async () => {
      const res = await request(app)
        .post('/api/templates')
        .send(validTemplate);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Standard Receipt 58mm');
      expect(res.body.data.documentType).toBe('receipt');
      expect(res.body.data.tenantId).toBe('template-test-tenant');
    });

    it('validates required fields', async () => {
      const res = await request(app)
        .post('/api/templates')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/templates', () => {
    it('lists templates', async () => {
      await request(app)
        .post('/api/templates')
        .send(validTemplate);

      const res = await request(app)
        .get('/api/templates');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/templates/:id', () => {
    it('returns a template by id', async () => {
      const createRes = await request(app)
        .post('/api/templates')
        .send(validTemplate);

      const id = createRes.body.data.id;
      const res = await request(app)
        .get(`/api/templates/${id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(id);
    });

    it('returns 404 for non-existent template', async () => {
      const res = await request(app)
        .get('/api/templates/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/templates/:id', () => {
    it('updates a template', async () => {
      const createRes = await request(app)
        .post('/api/templates')
        .send(validTemplate);

      const id = createRes.body.data.id;
      const res = await request(app)
        .put(`/api/templates/${id}`)
        .send({ name: 'Updated Receipt' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Receipt');
    });
  });

  describe('POST /api/templates/:id/publish', () => {
    it('publishes a template', async () => {
      const createRes = await request(app)
        .post('/api/templates')
        .send(validTemplate);

      const id = createRes.body.data.id;
      const res = await request(app)
        .post(`/api/templates/${id}/publish`);

      expect(res.status).toBe(200);
      expect(res.body.data.metadata.publishedAt).toBeDefined();
    });
  });

  describe('POST /api/templates/:id/duplicate', () => {
    it('duplicates a template', async () => {
      const createRes = await request(app)
        .post('/api/templates')
        .send(validTemplate);

      const id = createRes.body.data.id;
      const res = await request(app)
        .post(`/api/templates/${id}/duplicate`);

      expect(res.status).toBe(201);
      expect(res.body.data.name).toContain('(Copy)');
    });
  });

  describe('DELETE /api/templates/:id', () => {
    it('deletes a template', async () => {
      const createRes = await request(app)
        .post('/api/templates')
        .send(validTemplate);

      const id = createRes.body.data.id;
      const res = await request(app)
        .delete(`/api/templates/${id}`);

      expect(res.status).toBe(204);
    });
  });
});
