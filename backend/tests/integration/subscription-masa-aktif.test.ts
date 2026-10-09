import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { MongoTenantRepository } from '../../src/core/tenant/infrastructure/persistence/MongoTenantRepository';
import { TenantService } from '../../src/core/tenant/application/services/TenantService';
import { TenantController } from '../../src/core/tenant/interfaces/http/controllers/TenantController';
import { createTenantRoutes } from '../../src/core/tenant/interfaces/http/routes/tenant.routes';
import { MongoSubscriptionRepository } from '../../src/core/billing/infrastructure/persistence/MongoSubscriptionRepository';
import { MongoPlanRepository } from '../../src/core/billing/infrastructure/persistence/MongoPlanRepository';
import { MongoSubscriptionHistoryRepository } from '../../src/core/billing/infrastructure/persistence/MongoSubscriptionHistoryRepository';
import { MongoSubscriptionInvoiceRepository } from '../../src/core/billing/infrastructure/persistence/MongoSubscriptionInvoiceRepository';
import { MongoPaymentAttemptRepository } from '../../src/core/billing/infrastructure/persistence/MongoPaymentAttemptRepository';
import { SubscriptionService } from '../../src/core/billing/application/services/SubscriptionService';
import { SubscriptionBillingService } from '../../src/core/billing/application/services/SubscriptionBillingService';
import { EntitlementService } from '../../src/core/billing/application/services/EntitlementService';
import { SubscriptionController } from '../../src/core/billing/interfaces/http/controllers/SubscriptionController';
import { createMerchantSubscriptionRoutes } from '../../src/core/billing/interfaces/http/routes/subscription.routes';
import { Tenant } from '../../src/core/tenant/domain/Tenant';
import { Subscription } from '../../src/core/billing/domain/Subscription';
import { generateTestToken } from '../helpers/auth';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';
import { TenantSchema } from '../../src/core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { SubscriptionSchema } from '../../src/core/billing/infrastructure/persistence/schemas/SubscriptionSchema';
import { SubscriptionHistorySchema } from '../../src/core/billing/infrastructure/persistence/schemas/SubscriptionHistorySchema';
import { SubscriptionInvoiceSchema } from '../../src/core/billing/infrastructure/persistence/schemas/SubscriptionInvoiceSchema';
import { PaymentAttemptSchema } from '../../src/core/billing/infrastructure/persistence/schemas/PaymentAttemptSchema';
import { PlanSchema } from '../../src/core/billing/infrastructure/persistence/schemas/PlanSchema';

let tenantModel: mongoose.Model<any>;
let subModel: mongoose.Model<any>;
let historyModel: mongoose.Model<any>;
let invoiceModel: mongoose.Model<any>;
let attemptModel: mongoose.Model<any>;
let planModel: mongoose.Model<any>;
let tenantRepository: MongoTenantRepository;
let subscriptionRepository: MongoSubscriptionRepository;
let billingService: SubscriptionBillingService;
let app: express.Express;

const TENANT_ID = 'tenant-masa-aktif-1';

function createTenantDoc(overrides: Record<string, unknown> = {}) {
  return new tenantModel({
    _id: TENANT_ID,
    id: TENANT_ID,
    name: 'Kopi Bali',
    slug: 'kopi-bali',
    domain: null,
    ownerId: 'owner-1',
    planId: 'trial',
    plan: 'trial',
    status: 'active',
    businessType: 'restaurant',
    businessCategory: '',
    address: '',
    phone: '',
    modules: ['pos'],
    databaseName: 'posmono_test',
    config: { timezone: 'Asia/Jakarta', currency: 'IDR', locale: 'id' },
    billingEmail: 'owner@kopibali.id',
    hubId: null,
    subscriptionExpiresAt: new Date('2026-10-01T00:00:00.000Z'),
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    ...overrides,
  });
}

function createSubscriptionDoc(overrides: Record<string, unknown> = {}) {
  return new subModel({
    _id: `sub-${TENANT_ID}`,
    tenantId: TENANT_ID,
    planId: 'plan-trial',
    status: 'active',
    billingCycle: 'monthly',
    currentPeriodStart: new Date('2026-09-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-10-01T00:00:00.000Z'),
    ...overrides,
  });
}

beforeAll(async () => {
  await setupTestDb();
  tenantModel = mongoose.model('Tenant', TenantSchema);
  subModel = mongoose.model('Subscription', SubscriptionSchema);
  historyModel = mongoose.model('SubscriptionHistory', SubscriptionHistorySchema);
  invoiceModel = mongoose.model('SubscriptionInvoice', SubscriptionInvoiceSchema);
  attemptModel = mongoose.model('PaymentAttempt', PaymentAttemptSchema);
  planModel = mongoose.model('Plan', PlanSchema);

  tenantRepository = new MongoTenantRepository(tenantModel);
  subscriptionRepository = new MongoSubscriptionRepository(subModel);
  const planRepository = new MongoPlanRepository(planModel);
  const historyRepository = new MongoSubscriptionHistoryRepository(historyModel);
  const invoiceRepository = new MongoSubscriptionInvoiceRepository(invoiceModel);
  const attemptRepository = new MongoPaymentAttemptRepository(attemptModel);

  const subscriptionService = new SubscriptionService(
    subscriptionRepository,
    planRepository,
    tenantRepository,
    historyRepository,
  );
  billingService = new SubscriptionBillingService({
    invoiceRepository,
    paymentAttemptRepository: attemptRepository,
    planRepository,
    subscriptionService,
  });
  const entitlementService = new EntitlementService(subscriptionRepository, planRepository);
  const tenantService = new TenantService(tenantRepository, { publish: vi.fn() } as any);

  const subscriptionController = new SubscriptionController(
    subscriptionService,
    entitlementService,
    undefined,
    billingService,
  );

  app = express();
  app.use(express.json());
  app.use('/api/tenants', createTenantRoutes(new TenantController(tenantService, undefined, subscriptionService)));
  app.use('/api/tenants', createMerchantSubscriptionRoutes(subscriptionController));
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

describe('masa aktif enforcement over HTTP', () => {
  it('DENY: getCurrent lazily suspends an expired tenant, with reason fields returned', async () => {
    await createTenantDoc().save();

    const res = await request(app)
      .get('/api/tenants/current')
      .set('Authorization', `Bearer ${generateTestToken({ tenant: TENANT_ID })}`)
      .expect(200);

    expect(res.body.data.status).toBe('suspended');
    expect(res.body.data.subscriptionExpiresAt).toBe('2026-10-01T00:00:00.000Z');
    expect(res.body.data.daysRemaining).toBe(0);

    const stored = await tenantModel.findById(TENANT_ID).lean();
    expect(stored.status).toBe('suspended');
  });

  it('ALLOW: getCurrent leaves a not-yet-expired tenant untouched and reports days left', async () => {
    await createTenantDoc({ subscriptionExpiresAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000) }).save();

    const before = await tenantModel.findById(TENANT_ID).lean();
    const res = await request(app)
      .get('/api/tenants/current')
      .set('Authorization', `Bearer ${generateTestToken({ tenant: TENANT_ID })}`)
      .expect(200);

    expect(res.body.data.status).toBe('active');
    expect(res.body.data.daysRemaining).toBeGreaterThan(0);
    const after = await tenantModel.findById(TENANT_ID).lean();
    expect(after.status).toBe(before.status);
  });

  it('renew through the billing path creates a pending invoice and settling it syncs tenant and subscription clocks and reactivates', async () => {
    await planModel.create({
      _id: 'plan-trial',
      name: 'Trial Pro',
      basePrice: 199000,
      billingCycle: 'monthly',
      modules: ['pos'],
      limits: {},
      addOns: [],
      isDefault: false,
      isPublic: true,
      sortOrder: 1,
    });
    await createTenantDoc({ status: 'suspended', subscriptionExpiresAt: new Date('2026-10-01T00:00:00.000Z') }).save();
    await createSubscriptionDoc().save();

    const res = await request(app)
      .post('/api/tenants/current/subscription/renew')
      .set('Authorization', `Bearer ${generateTestToken({ tenant: TENANT_ID, permissions: ['settings.billing.read'] })}`)
      .send({ days: 30 })
      .expect(200);

    expect(res.body.data.invoice.status).toBe('pending');
    expect(res.body.data.invoice.referenceType).toBe('renewal');
    expect(res.body.data.invoice.amount).toBe(199000);

    // Before settlement, the tenant is still suspended (invoice-first)
    const beforeSettlement = await tenantModel.findById(TENANT_ID).lean();
    expect(beforeSettlement.status).toBe('suspended');

    // Settle the invoice
    await billingService.recordPaymentAttempt({
      tenantId: TENANT_ID,
      invoiceId: res.body.data.invoice.id,
      amount: 199000,
      method: 'manual',
    });

    const storedTenant = await tenantModel.findById(TENANT_ID).lean();
    const storedSub = await subModel.findOne({ tenantId: TENANT_ID }).lean();
    expect(storedTenant.status).toBe('active');
    expect(storedSub.status).toBe('active');

    // Drift fix: both clocks move together
    const tenantEnd = new Date(storedTenant.subscriptionExpiresAt).getTime();
    const subEnd = new Date(storedSub.currentPeriodEnd).getTime();
    expect(Math.abs(subEnd - tenantEnd)).toBeLessThan(1000);
    expect(tenantEnd).toBeGreaterThan(new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).getTime());

    const historyRows = await historyModel.find({ tenantId: TENANT_ID }).lean();
    expect(historyRows).toHaveLength(1);
    expect(historyRows[0].action).toBe('extended');
  });
});