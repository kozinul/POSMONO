import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authenticate } from '../../src/@shared/interfaces/middleware/authenticate';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';
import { generateTestToken } from '../helpers/auth';
import { createTaxRoutes } from '../../src/core/tax/api/tax.routes';
import { InMemoryTaxConfigurationRepository } from '../../src/core/tax/infrastructure/persistence/InMemoryTaxConfigurationRepository';

const sharedRepo = new InMemoryTaxConfigurationRepository();

function createTestApp() {
  const app = express();
  app.use(express.json());

  const router = createTaxRoutes(sharedRepo);

  const wrappedRouter = express.Router();
  wrappedRouter.use(authenticate);
  wrappedRouter.use(router);

  app.use('/api/tax', wrappedRouter);
  app.use(errorHandler);

  return app;
}

const app = createTestApp();

function vatRulePayload(overrides?: Record<string, any>) {
  return {
    id: overrides?.id ?? 'rule-vat',
    name: overrides?.name ?? 'Pajak 12%',
    taxType: 'vat',
    priority: 10,
    scope: { type: 'all', entityId: '', entityName: 'Semua' },
    policy: { type: 'rate', value: 12, roundingMode: 'round', precision: 2 },
    modifier: { type: 'fraction', config: { numerator: 11, denominator: 12 } },
    isActive: true,
    effectiveDate: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Tax Routes', () => {
  let token: string;

  beforeAll(async () => {
    token = generateTestToken({ tenant: 'tenant-test-1' });
  });

  beforeEach(async () => {
    // reset state: reinitialize default config
    const existing = await sharedRepo.findByTenantId('tenant-test-1');
    if (existing) {
      const cfg = existing;
      cfg.enable();
      cfg.setPricingMode('exclusive');
      const v = cfg.getActiveVersion();
      v.rules = [];
      await sharedRepo.save(cfg);
    } else {
      await sharedRepo.initializeDefault('tenant-test-1');
    }
  });

  describe('GET /api/tax/configuration', () => {
    it('returns 200 with default config', async () => {
      const res = await request(app)
        .get('/api/tax/configuration')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.tenantId).toBe('tenant-test-1');
      expect(res.body.taxEnabled).toBe(true);
      expect(res.body.pricingMode).toBe('exclusive');
    });
  });

  describe('PUT /api/tax/configuration', () => {
    it('updates configuration', async () => {
      const res = await request(app)
        .put('/api/tax/configuration')
        .set('Authorization', `Bearer ${token}`)
        .send({ pricingMode: 'inclusive', taxEnabled: false });

      expect(res.status).toBe(200);
      expect(res.body.pricingMode).toBe('inclusive');
      expect(res.body.taxEnabled).toBe(false);
    });
  });

  describe('POST /api/tax/rules', () => {
    it('adds a VAT rule', async () => {
      const res = await request(app)
        .post('/api/tax/rules')
        .set('Authorization', `Bearer ${token}`)
        .send(vatRulePayload({ id: 'rule-ppn-1' }));

      expect(res.status).toBe(201);
      const activeVer = res.body.versions.find((v: any) => v.status === 'active');
      expect(activeVer.rules).toHaveLength(1);
      expect(activeVer.rules[0].name).toBe('Pajak 12%');
    });

    it('returns error for invalid rule (negative priority)', async () => {
      const res = await request(app)
        .post('/api/tax/rules')
        .set('Authorization', `Bearer ${token}`)
        .send(vatRulePayload({ id: 'rule-bad', priority: -1 }));

      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/tax/rules/:ruleId', () => {
    it('removes a rule', async () => {
      // add rule first
      await request(app)
        .post('/api/tax/rules')
        .set('Authorization', `Bearer ${token}`)
        .send(vatRulePayload({ id: 'rule-to-delete' }));

      const deleteRes = await request(app)
        .delete('/api/tax/rules/rule-to-delete')
        .set('Authorization', `Bearer ${token}`);

      expect(deleteRes.status).toBe(200);
      const activeVer = deleteRes.body.versions.find((v: any) => v.status === 'active');
      expect(activeVer.rules).toHaveLength(0);
    });
  });

  describe('POST /api/tax/calculate', () => {
    it('returns 200 with tax calculation result', async () => {
      // add a VAT rule
      await request(app)
        .post('/api/tax/rules')
        .set('Authorization', `Bearer ${token}`)
        .send(vatRulePayload({ id: 'calc-vat-1' }));

      const res = await request(app)
        .post('/api/tax/calculate')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tenantId: 'tenant-test-1',
          items: [{ id: 'p1', productId: 'p1', productName: 'Nasi Goreng', categoryId: 'cat-food', quantity: 2, unitPrice: 60000 }],
          discount: 0,
          discountType: 'nominal',
        });

      expect(res.status).toBe(200);
      expect(res.body.subtotal).toBe(120000);
      expect(res.body.totalTax).toBe(13200);
      expect(res.body.grandTotal).toBe(133200);
      expect(res.body.taxBreakdown).toHaveLength(1);
      expect(res.body.taxBreakdown[0].taxType).toBe('vat');
    });

    it('returns 200 with multiple items and discount', async () => {
      await request(app)
        .post('/api/tax/rules')
        .set('Authorization', `Bearer ${token}`)
        .send(vatRulePayload({ id: 'calc-vat-2' }));

      const res = await request(app)
        .post('/api/tax/calculate')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tenantId: 'tenant-test-1',
          items: [
            { id: 'p1', productId: 'p1', productName: 'A', categoryId: 'c1', quantity: 1, unitPrice: 100000 },
            { id: 'p2', productId: 'p2', productName: 'B', categoryId: 'c2', quantity: 2, unitPrice: 25000 },
          ],
          discount: 10,
          discountType: 'percentage',
        });

      expect(res.status).toBe(200);
      expect(res.body.subtotal).toBe(150000);
      expect(res.body.discountAmount).toBe(15000);
      expect(res.body.taxableAmount).toBe(135000);
      const expectedTax = Math.round(135000 * 11 / 12 * 12 / 100 * 100) / 100;
      expect(res.body.totalTax).toBe(expectedTax);
      expect(res.body.grandTotal).toBe(150000 + expectedTax);
    });
  });

  describe('POST /api/tax/validate', () => {
    it('validates a correct rule', async () => {
      const res = await request(app)
        .post('/api/tax/validate')
        .set('Authorization', `Bearer ${token}`)
        .send(vatRulePayload({ id: 'val-valid' }));

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.errors).toEqual([]);
    });

    it('returns errors for invalid rule', async () => {
      const res = await request(app)
        .post('/api/tax/validate')
        .set('Authorization', `Bearer ${token}`)
        .send(vatRulePayload({ name: '', priority: -1 }));

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
      expect(res.body.errors.length).toBeGreaterThan(0);
    });
  });

  describe('authentication', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/tax/configuration');
      expect(res.status).toBe(401);
    });
  });
});
