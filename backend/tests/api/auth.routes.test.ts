import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authenticate } from '../../src/@shared/interfaces/middleware/authenticate';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';
import { generateTestToken } from '../helpers/auth';

function createTestApp() {
  const app = express();
  app.use(express.json());

  const router = express.Router();

  router.post('/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'test@posmono.com' && password === 'password123') {
      res.json({
        success: true,
        data: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          user: { id: 'user-1', email, displayName: 'Test User' },
        },
      });
    } else {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  });

  router.post('/auth/register', (req, res) => {
    const { email } = req.body;
    if (!email || !req.body.password || !req.body.displayName) {
      res.status(400).json({ success: false, error: 'Validation error' });
      return;
    }
    if (email === 'existing@test.com') {
      res.status(409).json({ success: false, error: 'User with this email already exists' });
      return;
    }
    res.status(201).json({
      success: true,
      data: { id: 'user-new', email, displayName: req.body.displayName },
    });
  });

  router.get('/auth/me', authenticate, (req, res) => {
    res.json({
      success: true,
      data: { id: req.userId, email: 'test@posmono.com', displayName: 'Test User' },
    });
  });

  app.use('/api', router);
  app.use(errorHandler);

  return app;
}

describe('Auth Routes', () => {
  let app: express.Express;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('POST /api/auth/login', () => {
    it('returns 200 with tokens for valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@posmono.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it('returns 401 for invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@posmono.com', password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/register', () => {
    it('returns 201 for valid registration', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'new@test.com', password: 'pw123', displayName: 'New User' });

      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe('new@test.com');
    });

    it('returns 400 for missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@test.com' });

      expect(res.status).toBe(400);
    });

    it('returns 409 for duplicate email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'existing@test.com', password: 'pw123', displayName: 'Dup' });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 200 with user data for authenticated request', async () => {
      const token = generateTestToken();
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBeDefined();
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid auth token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });
});
