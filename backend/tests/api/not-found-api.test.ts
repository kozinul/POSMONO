import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { notFoundApiHandler } from '../../src/@shared/interfaces/middleware/notFoundApi';

/**
 * Mirrors the ordering in `bootstrap/server.ts`: API routes, then the JSON 404 for
 * `/api/*`, then the SPA fallback.
 */
function createTestApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/known', (_req, res) => {
    res.json({ success: true, data: { ok: true } });
  });

  app.use('/api', notFoundApiHandler());

  app.get('*', (_req, res) => {
    res.type('html').send('<!doctype html><html><body>spa</body></html>');
  });

  return app;
}

describe('notFoundApiHandler', () => {
  it('answers an unknown GET /api/* as a JSON 404 instead of the SPA shell', async () => {
    const res = await request(createTestApp()).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.type).toBe('application/json');
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain('/api/does-not-exist');
    expect(res.text).not.toContain('<html>');
  });

  it('answers unknown non-GET /api/* methods as JSON too', async () => {
    const res = await request(createTestApp()).post('/api/does-not-exist').send({});

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('does not swallow nested paths that no route registered', async () => {
    const res = await request(createTestApp()).get('/api/known/extra');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('leaves registered API routes untouched', async () => {
    const res = await request(createTestApp()).get('/api/known');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { ok: true } });
  });

  it('keeps the SPA fallback working for non-API paths', async () => {
    const spa = await request(createTestApp()).get('/reports/dashboard');

    expect(spa.status).toBe(200);
    expect(spa.type).toBe('text/html');
    expect(spa.text).toContain('spa');
  });

  it('reports the offending method and echoes the request id', async () => {
    const res = await request(createTestApp())
      .delete('/api/orders/123')
      .set('x-request-id', 'req-abc');

    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain('DELETE');
    expect(res.body.meta.requestId).toBe('req-abc');
  });
});
