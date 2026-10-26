import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { PERMISSIONS } from '@posmono/shared';
import { createKdsRoutes } from '../../src/core/kds/interfaces/http/routes/kds.routes';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';
import { generateTestToken } from '../helpers/auth';

const controller = {
  listStations: vi.fn((_req, res) => res.json({ success: true, data: [] })),
  createStation: vi.fn((_req, res) => res.status(201).json({ success: true, data: { id: 'station-1' } })),
  updateStation: vi.fn(),
  deleteStation: vi.fn(),
  listTickets: vi.fn((_req, res) => res.json({ success: true, data: [] })),
  updateTicketStatus: vi.fn((_req, res) => res.json({ success: true, data: { id: 'ticket-1', status: 'in_progress' } })),
};

function appFor(enabled: boolean) {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/kds',
    createKdsRoutes(controller as never, { hasModule: async () => enabled }, (_req, _res, next) => next()),
  );
  app.use(errorHandler);
  return app;
}

const readToken = generateTestToken({ permissions: [PERMISSIONS.KDS_READ] });
const writeToken = generateTestToken({ permissions: [PERMISSIONS.KDS_WRITE] });
const printerToken = generateTestToken({ permissions: ['printers:write'] });
const emptyToken = generateTestToken({ permissions: [] });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('KDS routes — module and role gates', () => {
  it('reports entitlement on the auth-only access probe even without KDS permissions', async () => {
    const res = await request(appFor(true)).get('/api/kds/access').set('Authorization', `Bearer ${emptyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.enabled).toBe(true);
  });

  it('reports enabled:false without leaking a validation error', async () => {
    const res = await request(appFor(false)).get('/api/kds/access').set('Authorization', `Bearer ${emptyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.enabled).toBe(false);
  });

  it('denies the access probe without a token', async () => {
    const res = await request(appFor(true)).get('/api/kds/access');

    expect(res.status).toBe(401);
  });

  it('denies the board without kds:read', async () => {
    const res = await request(appFor(true)).get('/api/kds/stations').set('Authorization', `Bearer ${emptyToken}`);

    expect(res.status).toBe(403);
    expect(controller.listStations).not.toHaveBeenCalled();
  });

  it('allows the board with kds:read', async () => {
    const res = await request(appFor(true)).get('/api/kds/stations').set('Authorization', `Bearer ${readToken}`);

    expect(res.status).toBe(200);
  });

  it('denies ticket status updates with only kds:read', async () => {
    const res = await request(appFor(true))
      .patch('/api/kds/tickets/t1/status')
      .set('Authorization', `Bearer ${readToken}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(403);
    expect(controller.updateTicketStatus).not.toHaveBeenCalled();
  });

  it('allows ticket status updates with kds:write', async () => {
    const res = await request(appFor(true))
      .patch('/api/kds/tickets/t1/status')
      .set('Authorization', `Bearer ${writeToken}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(controller.updateTicketStatus).toHaveBeenCalled();
  });

  it('keeps station mutations behind printers:write', async () => {
    const res = await request(appFor(true))
      .post('/api/kds/stations')
      .set('Authorization', `Bearer ${readToken}`)
      .send({ name: 'Bar' });

    expect(res.status).toBe(403);

    const allowed = await request(appFor(true))
      .post('/api/kds/stations')
      .set('Authorization', `Bearer ${printerToken}`)
      .send({ name: 'Bar' });

    expect(allowed.status).toBe(201);
  });

  it('denies every board route when the KDS module is off, even with the permission', async () => {
    const res = await request(appFor(false))
      .get('/api/kds/tickets')
      .set('Authorization', `Bearer ${readToken}`);

    expect(res.status).toBe(403);
    expect(controller.listTickets).not.toHaveBeenCalled();
  });
});
