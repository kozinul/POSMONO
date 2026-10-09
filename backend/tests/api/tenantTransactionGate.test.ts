import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authenticate } from '../../src/@shared/interfaces/middleware/authenticate';
import {
  createTenantStatusGate,
  type TenantStatusSource,
} from '../../src/core/tenant/interfaces/http/middleware/tenantTransactionGate';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';
import { generateTestToken } from '../helpers/auth';

function tenantDoc(status: string, expired = false) {
  const active = status === 'active' || status === 'trial';
  return {
    isActive: () => active,
    isExpired: () => expired,
    serialize: () => ({ status }),
  };
}

function createApp(repo: TenantStatusSource) {
  const app = express();
  app.use(express.json());
  const gate = createTenantStatusGate(repo);
  app.post('/probe', authenticate, gate, (_req, res) => {
    res.json({ success: true });
  });
  app.get('/probe', authenticate, gate, (_req, res) => {
    res.json({ success: true });
  });
  app.use(errorHandler);
  return app;
}

describe('createTenantStatusGate middleware', () => {
  let repo: { findById: ReturnType<typeof vi.fn> };
  let app: express.Express;
  let token: string;

  beforeEach(() => {
    repo = { findById: vi.fn(async () => tenantDoc('active')) };
    app = createApp(repo as unknown as TenantStatusSource);
    token = generateTestToken({ tenant: 'tenant-gate-1' });
  });

  it('ALLOW: active tenant passes the mutation gate', async () => {
    const res = await request(app).post('/probe').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(repo.findById).toHaveBeenCalledWith('tenant-gate-1');
  });

  it('ALLOW: trial tenant passes the mutation gate', async () => {
    repo.findById.mockResolvedValue(tenantDoc('trial'));

    const res = await request(app).post('/probe').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('ALLOW: a missing tenant document never blocks (platform super admin has no tenants row)', async () => {
    repo.findById.mockResolvedValue(null);

    const res = await request(app).post('/probe').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('ALLOW: safe methods skip the gate entirely so the POS alert can load status', async () => {
    repo.findById.mockResolvedValue(tenantDoc('suspended'));

    const res = await request(app).get('/probe').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('DENY: suspended tenant cannot mutate — 403 with an Indonesian refusal', async () => {
    repo.findById.mockResolvedValue(tenantDoc('suspended'));

    const res = await request(app).post('/probe').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('ditangguhkan');
    expect(res.body.error.message).toContain('transaksi tidak dapat dilakukan');
  });

  it('DENY: frozen tenant is refused with its status label', async () => {
    repo.findById.mockResolvedValue(tenantDoc('frozen'));

    const res = await request(app).post('/probe').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('dibekukan');
  });

  it('DENY: expired period (still active status) is refused before any write', async () => {
    repo.findById.mockResolvedValue(tenantDoc('active', true));

    const res = await request(app).post('/probe').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Masa aktif toko telah berakhir');
  });

  it('DENY: an owner session gets NO grace on transactions (grant is for entry/billing recovery only)', async () => {
    repo.findById.mockResolvedValue(tenantDoc('suspended'));
    const ownerToken = generateTestToken({ tenant: 'tenant-gate-1', role: 'owner', permissions: ['orders:write'] });

    const res = await request(app).post('/probe').set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('ditangguhkan');
  });

  it('propagates a repository failure instead of silently allowing the mutation', async () => {
    const failure = new Error('mongo down');
    repo.findById.mockRejectedValue(failure);
    const gate = createTenantStatusGate(repo as unknown as TenantStatusSource);

    // Invoked directly so the assertion is about `next(err)`, not about the
    // generic 500 the express error handler would render for it.
    const req = { method: 'POST', tenantId: 'tenant-gate-1' } as never;
    const next = vi.fn();
    gate(req, {} as never, next);

    await vi.waitFor(() => expect(next).toHaveBeenCalledWith(failure));
  });
});
