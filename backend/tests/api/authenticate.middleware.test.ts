import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticate } from '../../src/@shared/interfaces/middleware/authenticate';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';
import { generateTestToken, TEST_SECRET } from '../helpers/auth';

function createApp() {
  const app = express();
  app.use(express.json());
  app.get('/probe', authenticate, (req, res) => {
    res.json({ success: true, data: { userId: req.userId } });
  });
  app.use(errorHandler);
  return app;
}

function signToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' });
}

describe('authenticate middleware', () => {
  const app = createApp();

  it('ALLOW: accepts an access token', async () => {
    const res = await request(app)
      .get('/probe')
      .set('Authorization', `Bearer ${generateTestToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBe('user-test-1');
  });

  it('ALLOW: accepts a token without an explicit type (legacy/test tokens)', async () => {
    const token = signToken({ sub: 'user-1', tenant: 't1', role: 'owner' });

    const res = await request(app).get('/probe').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBe('user-1');
  });

  it('ALLOW: accepts an explicitly access-typed token', async () => {
    const token = signToken({ sub: 'user-2', tenant: 't1', role: 'owner', type: 'access' });

    const res = await request(app).get('/probe').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBe('user-2');
  });

  it('DENY: rejects a refresh token used as a bearer token', async () => {
    const token = signToken({
      sub: 'user-1',
      tenant: 't1',
      role: 'owner',
      permissions: ['users:write'],
      type: 'refresh',
    });

    const res = await request(app).get('/probe').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid token type');
  });

  it('DENY: rejects a missing authorization header', async () => {
    const res = await request(app).get('/probe');

    expect(res.status).toBe(401);
  });

  it('DENY: rejects a token signed with the wrong secret', async () => {
    const token = jwt.sign({ sub: 'user-1', tenant: 't1', role: 'owner' }, 'wrong-secret', { expiresIn: '1h' });

    const res = await request(app).get('/probe').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid or expired token');
  });
});
