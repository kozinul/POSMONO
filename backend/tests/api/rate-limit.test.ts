import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import {
  createAuthRateLimiter,
  AUTH_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_WINDOW_MS,
} from '../../src/@shared/interfaces/middleware/rateLimit';

const LIMIT = 3;

/**
 * Mirrors the mounting in `bootstrap/routes.ts`: the limiter covers the credential
 * endpoints and nothing else.
 */
function createTestApp(): Express {
  const app = express();
  app.set('trust proxy', 1);

  const authLimiter = createAuthRateLimiter({ limit: LIMIT, windowMs: 60_000 });

  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/hub-login', authLimiter);
  app.use('/api/auth/refresh', authLimiter);

  app.post('/api/auth/login', (_req, res) => {
    res.json({ success: true });
  });
  app.post('/api/auth/refresh', (_req, res) => {
    res.json({ success: true });
  });
  app.get('/api/auth/me', (_req, res) => {
    res.json({ success: true });
  });
  app.get('/api/orders', (_req, res) => {
    res.json({ success: true });
  });

  return app;
}

describe('createAuthRateLimiter', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
  });

  it('allows requests up to the limit', async () => {
    for (let i = 0; i < LIMIT; i += 1) {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(200);
    }
  });

  it('answers 429 with the API envelope once the limit is exceeded', async () => {
    for (let i = 0; i < LIMIT; i += 1) {
      await request(app).post('/api/auth/login').send({});
    }

    const res = await request(app).post('/api/auth/login').send({});

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.body.error.message).toMatch(/Terlalu banyak percobaan/);
  });

  it('exposes the standard RateLimit headers', async () => {
    const first = await request(app).post('/api/auth/login').send({});
    const last = await request(app).post('/api/auth/login').send({});

    expect(first.headers['ratelimit-policy']).toBe(`${LIMIT};w=60`);
    expect(first.headers['ratelimit']).toContain('remaining=2');
    expect(last.headers['ratelimit']).toContain('remaining=1');
  });

  it('buckets each client IP separately', async () => {
    for (let i = 0; i < LIMIT; i += 1) {
      await request(app).post('/api/auth/login').set('X-Forwarded-For', '10.0.0.1').send({});
    }

    const blocked = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '10.0.0.1')
      .send({});
    const otherClient = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '10.0.0.2')
      .send({});

    expect(blocked.status).toBe(429);
    expect(otherClient.status).toBe(200);
  });

  it('covers the refresh endpoint with the same bucket', async () => {
    for (let i = 0; i < LIMIT; i += 1) {
      await request(app).post('/api/auth/refresh').send({});
    }

    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(429);
  });

  it('leaves non-credential endpoints unlimited', async () => {
    for (let i = 0; i < LIMIT; i += 1) {
      await request(app).post('/api/auth/login').send({});
    }

    // Same IP, but neither a credential endpoint nor a POS polling route may be throttled.
    const me = await request(app).get('/api/auth/me');
    const orders = await request(app).get('/api/orders');

    expect(me.status).toBe(200);
    expect(orders.status).toBe(200);
  });

  it('defaults to a 15 minute window and 30 attempts', () => {
    expect(AUTH_RATE_LIMIT_WINDOW_MS).toBe(15 * 60_000);
    expect(AUTH_RATE_LIMIT_MAX).toBe(30);
  });
});
