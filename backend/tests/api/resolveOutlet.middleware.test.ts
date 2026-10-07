import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authenticate } from '../../src/@shared/interfaces/middleware/authenticate';
import {
  createResolveOutlet,
  type OutletStatusSource,
} from '../../src/@shared/interfaces/middleware/resolveOutlet';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';
import { generateTestToken } from '../helpers/auth';

const OUTLET_A = 'outlet-a';
const OUTLET_X = 'outlet-x';

function outletDoc(name: string, isActive: boolean) {
  return { serialize: () => ({ name, isActive }) };
}

function createApp(repo: OutletStatusSource) {
  const app = express();
  app.use(express.json());
  app.get(
    '/probe',
    authenticate,
    createResolveOutlet(repo),
    (req, res) => {
      res.json({ success: true, data: { outletId: req.outletId } });
    },
  );
  app.use(errorHandler);
  return app;
}

describe('createResolveOutlet middleware', () => {
  let repo: { findById: ReturnType<typeof vi.fn> };
  let app: express.Express;
  let inScopeToken: string;
  let allOutletsToken: string;

  beforeEach(() => {
    repo = { findById: vi.fn(async () => outletDoc('Outlet A', true)) };
    app = createApp(repo as unknown as OutletStatusSource);
    inScopeToken = generateTestToken({ outletIds: [OUTLET_A] });
    allOutletsToken = generateTestToken({ outletIds: [] });
  });

  it('ALLOW: active outlet inside the user scope is forwarded as req.outletId', async () => {
    const res = await request(app)
      .get('/probe')
      .set('Authorization', `Bearer ${inScopeToken}`)
      .set('X-Outlet-Id', OUTLET_A);

    expect(res.status).toBe(200);
    expect(res.body.data.outletId).toBe(OUTLET_A);
    expect(repo.findById).toHaveBeenCalledWith(OUTLET_A);
  });

  it('ALLOW: no header resolves to null without touching the repository', async () => {
    const res = await request(app)
      .get('/probe')
      .set('Authorization', `Bearer ${inScopeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.outletId).toBeNull();
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('ALLOW: a missing outlet document is not blocking (deletion semantics stay downstream)', async () => {
    repo.findById.mockResolvedValue(null);

    const res = await request(app)
      .get('/probe')
      .set('Authorization', `Bearer ${inScopeToken}`)
      .set('X-Outlet-Id', OUTLET_A);

    expect(res.status).toBe(200);
    expect(res.body.data.outletId).toBe(OUTLET_A);
  });

  it('ALLOW: a user with all outlets (`[]`) may pick any active outlet', async () => {
    const res = await request(app)
      .get('/probe')
      .set('Authorization', `Bearer ${allOutletsToken}`)
      .set('X-Outlet-Id', OUTLET_X);

    expect(res.status).toBe(200);
    expect(res.body.data.outletId).toBe(OUTLET_X);
  });

  it('DENY: header outside the user scope is rejected before any DB lookup', async () => {
    const res = await request(app)
      .get('/probe')
      .set('Authorization', `Bearer ${inScopeToken}`)
      .set('X-Outlet-Id', OUTLET_X);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('Outlet tidak termasuk dalam akses user ini');
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('DENY: inactive outlet is rejected with a message naming the outlet', async () => {
    repo.findById.mockResolvedValue(outletDoc('Outlet Lama', false));

    const res = await request(app)
      .get('/probe')
      .set('Authorization', `Bearer ${inScopeToken}`)
      .set('X-Outlet-Id', OUTLET_A);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Outlet Lama');
    expect(res.body.error.message).toContain('nonaktif');
  });

  it('propagates a repository failure instead of silently passing the header', async () => {
    const failure = new Error('mongo down');
    repo.findById.mockRejectedValue(failure);
    const middleware = createResolveOutlet(repo as unknown as OutletStatusSource);

    // Invoked directly so the assertion is about `next(err)`, not about the
    // generic 500 the express error handler would render for it.
    const req: any = { headers: { 'x-outlet-id': OUTLET_A }, outletIds: [OUTLET_A] };
    const next = vi.fn();
    middleware(req, {} as any, next);

    await vi.waitFor(() => expect(next).toHaveBeenCalledWith(failure));
    expect(req.outletId).toBeUndefined();
  });
});
