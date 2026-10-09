import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import express, { Express } from 'express';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';
import { generateTestToken } from '../helpers/auth';
import { PERMISSIONS } from '@posmono/shared';
import { PLATFORM_ROLE_PERMS } from '../../src/core/platform/defaults/roles';

import { MongoTenantRepository } from '../../src/core/tenant/infrastructure/persistence/MongoTenantRepository';
import { MongoPlanRepository } from '../../src/core/billing/infrastructure/persistence/MongoPlanRepository';
import { MongoSubscriptionRepository } from '../../src/core/billing/infrastructure/persistence/MongoSubscriptionRepository';
import { MongoSubscriptionHistoryRepository } from '../../src/core/billing/infrastructure/persistence/MongoSubscriptionHistoryRepository';
import { MongoSubscriptionInvoiceRepository } from '../../src/core/billing/infrastructure/persistence/MongoSubscriptionInvoiceRepository';
import { MongoPaymentAttemptRepository } from '../../src/core/billing/infrastructure/persistence/MongoPaymentAttemptRepository';
import { MongoPlatformAuditLogRepository } from '../../src/core/platform/audit/infrastructure/persistence/MongoPlatformAuditLogRepository';

import { TenantSchema } from '../../src/core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { PlanSchema } from '../../src/core/billing/infrastructure/persistence/schemas/PlanSchema';
import { SubscriptionSchema } from '../../src/core/billing/infrastructure/persistence/schemas/SubscriptionSchema';
import { SubscriptionHistorySchema } from '../../src/core/billing/infrastructure/persistence/schemas/SubscriptionHistorySchema';
import { SubscriptionInvoiceSchema } from '../../src/core/billing/infrastructure/persistence/schemas/SubscriptionInvoiceSchema';
import { PaymentAttemptSchema } from '../../src/core/billing/infrastructure/persistence/schemas/PaymentAttemptSchema';
import { PlatformAuditLogSchema } from '../../src/core/platform/audit/infrastructure/persistence/schemas/PlatformAuditLogSchema';

import { SubscriptionService } from '../../src/core/billing/application/services/SubscriptionService';
import { SubscriptionBillingService } from '../../src/core/billing/application/services/SubscriptionBillingService';
import { EntitlementService } from '../../src/core/billing/application/services/EntitlementService';
import { TenantService } from '../../src/core/tenant/application/services/TenantService';
import { PlatformAuditService } from '../../src/core/platform/audit/application/services/PlatformAuditService';

import { SubscriptionController } from '../../src/core/billing/interfaces/http/controllers/SubscriptionController';
import { TenantController } from '../../src/core/tenant/interfaces/http/controllers/TenantController';

import {
  createPlatformSubscriptionRoutes,
  createMerchantSubscriptionRoutes,
} from '../../src/core/billing/interfaces/http/routes/subscription.routes';
import { createTenantRoutes } from '../../src/core/tenant/interfaces/http/routes/tenant.routes';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';

const TENANT_A = 'tenant-member-a';
const TENANT_B = 'tenant-member-b';
const PLAN_ID = 'plan-pro-test';

let tenantModel: mongoose.Model<any>;
let planModel: mongoose.Model<any>;
let subModel: mongoose.Model<any>;
let historyModel: mongoose.Model<any>;
let invoiceModel: mongoose.Model<any>;
let attemptModel: mongoose.Model<any>;
let auditModel: mongoose.Model<any>;

let app: Express;
let platformToken: string;
let ownerTokenA: string;
let managerTokenA: string;
let cashierTokenA: string;
let ownerTokenB: string;

function createTenantDoc(id: string, overrides: Record<string, unknown> = {}) {
  return new tenantModel({
    _id: id,
    id,
    name: `Tenant ${id}`,
    slug: `slug-${id}`,
    domain: null,
    ownerId: `owner-${id}`,
    planId: PLAN_ID,
    plan: PLAN_ID,
    status: 'active',
    businessType: 'retail',
    businessCategory: '',
    address: '',
    phone: '',
    modules: ['pos'],
    databaseName: `db_${id}`,
    config: { timezone: 'Asia/Jakarta', currency: 'IDR', locale: 'id' },
    billingEmail: `billing@${id}.com`,
    hubId: null,
    subscriptionExpiresAt: new Date('2026-11-01T00:00:00.000Z'),
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    ...overrides,
  });
}

function createSubDoc(tenantId: string, overrides: Record<string, unknown> = {}) {
  return new subModel({
    _id: `sub-${tenantId}`,
    tenantId,
    planId: PLAN_ID,
    status: 'active',
    billingCycle: 'monthly',
    currentPeriodStart: new Date('2026-10-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-11-01T00:00:00.000Z'),
    ...overrides,
  });
}

beforeAll(async () => {
  await setupTestDb();
  tenantModel = mongoose.model('Tenant', TenantSchema);
  planModel = mongoose.model('Plan', PlanSchema);
  subModel = mongoose.model('Subscription', SubscriptionSchema);
  historyModel = mongoose.model('SubscriptionHistory', SubscriptionHistorySchema);
  invoiceModel = mongoose.model('SubscriptionInvoice', SubscriptionInvoiceSchema);
  attemptModel = mongoose.model('PaymentAttempt', PaymentAttemptSchema);
  auditModel = mongoose.model('PlatformAuditLog', PlatformAuditLogSchema);

  const tenantRepo = new MongoTenantRepository(tenantModel);
  const planRepo = new MongoPlanRepository(planModel);
  const subRepo = new MongoSubscriptionRepository(subModel);
  const historyRepo = new MongoSubscriptionHistoryRepository(historyModel);
  const invoiceRepo = new MongoSubscriptionInvoiceRepository(invoiceModel);
  const attemptRepo = new MongoPaymentAttemptRepository(attemptModel);
  const auditRepo = new MongoPlatformAuditLogRepository(auditModel);

  const subService = new SubscriptionService(subRepo, planRepo, tenantRepo, historyRepo);
  const billingService = new SubscriptionBillingService({
    invoiceRepository: invoiceRepo,
    paymentAttemptRepository: attemptRepo,
    planRepository: planRepo,
    subscriptionService: subService,
  });
  const entitlementService = new EntitlementService(subRepo, planRepo);
  const auditService = new PlatformAuditService(auditRepo);
  const tenantService = new TenantService(tenantRepo, { publish: vi.fn() } as any);

  const subController = new SubscriptionController(
    subService,
    entitlementService,
    auditService,
    billingService,
  );
  const tenantController = new TenantController(tenantService, undefined, subService);

  app = express();
  app.use(express.json());
  app.use('/api/tenants', createTenantRoutes(tenantController));
  app.use('/api/tenants', createMerchantSubscriptionRoutes(subController));
  app.use('/api/platform', createPlatformSubscriptionRoutes(subController));
  app.use(errorHandler);

  platformToken = generateTestToken({
    sub: 'plat-admin-1',
    tenant: 'platform',
    role: 'platform_admin',
    permissions: [...PLATFORM_ROLE_PERMS],
  });

  ownerTokenA = generateTestToken({
    sub: 'user-owner-a',
    tenant: TENANT_A,
    role: 'owner',
    permissions: [
      'users:read',
      'settings:read',
      PERMISSIONS.SETTINGS_BILLING_READ,
      PERMISSIONS.SETTINGS_BILLING_UPDATE,
    ],
  });

  managerTokenA = generateTestToken({
    sub: 'user-mgr-a',
    tenant: TENANT_A,
    role: 'manager',
    permissions: ['products:read', 'orders:read', PERMISSIONS.SETTINGS_BILLING_READ],
  });

  cashierTokenA = generateTestToken({
    sub: 'user-cashier-a',
    tenant: TENANT_A,
    role: 'cashier',
    permissions: ['orders:read', 'products:read'],
  });

  ownerTokenB = generateTestToken({
    sub: 'user-owner-b',
    tenant: TENANT_B,
    role: 'owner',
    permissions: ['users:read', 'settings:read', PERMISSIONS.SETTINGS_BILLING_READ],
  });
}, 60000);

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
  await planModel.create({
    _id: PLAN_ID,
    name: 'Pro',
    basePrice: 199000,
    billingCycle: 'monthly',
    modules: ['pos', 'reports', 'inventory'],
    limits: { maxUsers: 10, maxProducts: 500, maxCategories: 50, maxOutlets: 2 },
    addOns: [],
    isDefault: false,
    isPublic: true,
    sortOrder: 2,
  });
});

describe('Member Area Langganan — Integration HTTP', () => {
  it('ALLOW: Owner & Manager can read subscription endpoints, Cashier gets 403', async () => {
    await createTenantDoc(TENANT_A).save();
    await createSubDoc(TENANT_A).save();

    // Owner -> 200
    await request(app)
      .get('/api/tenants/current/subscription/invoices')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200);

    await request(app)
      .get('/api/tenants/current/subscription/payments')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200);

    await request(app)
      .get('/api/tenants/current/subscription/history')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200);

    await request(app)
      .get('/api/tenants/current/entitlement')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200);

    await request(app)
      .get('/api/tenants/current/subscription')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200);

    // Manager -> 200
    await request(app)
      .get('/api/tenants/current/subscription/invoices')
      .set('Authorization', `Bearer ${managerTokenA}`)
      .expect(200);

    // Cashier without settings.billing.read -> 403
    await request(app)
      .get('/api/tenants/current/subscription/invoices')
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .expect(403);

    await request(app)
      .get('/api/tenants/current/subscription/payments')
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .expect(403);

    await request(app)
      .get('/api/tenants/current/subscription/history')
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .expect(403);

    await request(app)
      .get('/api/tenants/current/entitlement')
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .expect(403);

    await request(app)
      .get('/api/tenants/current/subscription')
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .expect(403);

    await request(app)
      .post('/api/tenants/current/subscription/renew')
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .send({ days: 30 })
      .expect(403);
  });

  it('renew is invoice-first: merchant creates pending invoice; subscription expiry remains unchanged until payment', async () => {
    await createTenantDoc(TENANT_A).save();
    await createSubDoc(TENANT_A).save();

    const renewRes = await request(app)
      .post('/api/tenants/current/subscription/renew')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ days: 30 })
      .expect(200);

    const invoice = renewRes.body.data.invoice;
    expect(invoice).toBeDefined();
    expect(invoice.status).toBe('pending');
    expect(invoice.referenceType).toBe('renewal');
    expect(invoice.amount).toBe(199000);
    expect(invoice.number).toMatch(/^SUB-\d{4}-001$/);

    // Invariant: subscription expiry has NOT changed yet (invoice-first)
    const subDoc = await subModel.findOne({ tenantId: TENANT_A }).lean();
    expect(new Date(subDoc.currentPeriodEnd).toISOString()).toBe('2026-11-01T00:00:00.000Z');

    // Merchant can see the invoice in the list
    const listRes = await request(app)
      .get('/api/tenants/current/subscription/invoices')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200);

    expect(listRes.body.data.items).toHaveLength(1);
    expect(listRes.body.data.items[0].id).toBe(invoice.id);
    expect(listRes.body.data.totals.outstanding).toBe(199000);
    expect(listRes.body.data.totals.paid).toBe(0);

    // Payments list is empty before settlement
    const payListRes = await request(app)
      .get('/api/tenants/current/subscription/payments')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200);

    expect(payListRes.body.data.items).toHaveLength(0);

    // Platform admin records payment
    const payRes = await request(app)
      .post(`/api/platform/tenants/${TENANT_A}/subscription/invoices/${invoice.id}/pay`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        amount: 199000,
        method: 'transfer',
        referenceNumber: 'BCA-987654',
        notes: 'Transfer via BCA',
      })
      .expect(200);

    expect(payRes.body.data.invoice.status).toBe('paid');
    expect(payRes.body.data.attempt.status).toBe('completed');
    expect(payRes.body.data.attempt.method).toBe('transfer');

    // Subscription IS now extended!
    const updatedSub = await subModel.findOne({ tenantId: TENANT_A }).lean();
    const updatedEnd = new Date(updatedSub.currentPeriodEnd).getTime();
    expect(updatedEnd).toBeGreaterThan(new Date('2026-11-01T00:00:00.000Z').getTime());

    // Merchant sees completed payment attempt
    const afterPayListRes = await request(app)
      .get('/api/tenants/current/subscription/payments')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200);

    expect(afterPayListRes.body.data.items).toHaveLength(1);
    expect(afterPayListRes.body.data.items[0].method).toBe('transfer');

    // Outstanding total is now 0 and paid total is 199000
    const afterInvoiceList = await request(app)
      .get('/api/tenants/current/subscription/invoices')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200);

    expect(afterInvoiceList.body.data.totals.outstanding).toBe(0);
    expect(afterInvoiceList.body.data.totals.paid).toBe(199000);

    // Audit log recorded
    const auditLogs = await auditModel.find({ tenantId: TENANT_A }).lean();
    expect(auditLogs.some((l) => l.action === 'SUBSCRIPTION_INVOICE_PAID')).toBe(true);
  });

  it('merchant pay endpoint: Owner (settings.billing.update) pays own invoice, Manager is denied', async () => {
    await createTenantDoc(TENANT_A).save();
    await createSubDoc(TENANT_A).save();

    const renewRes = await request(app)
      .post('/api/tenants/current/subscription/renew')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ days: 30 })
      .expect(200);

    const invoiceId = renewRes.body.data.invoice.id;

    // DENY: Manager holds settings.billing.read but not settings.billing.update
    await request(app)
      .post(`/api/tenants/current/subscription/invoices/${invoiceId}/pay`)
      .set('Authorization', `Bearer ${managerTokenA}`)
      .send({ amount: 199000, method: 'transfer' })
      .expect(403);

    // DENY: Cashier has neither billing permission
    await request(app)
      .post(`/api/tenants/current/subscription/invoices/${invoiceId}/pay`)
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .send({ amount: 199000, method: 'transfer' })
      .expect(403);

    // Denied attempts must not have touched the invoice
    const stillPending = await invoiceModel.findOne({ _id: invoiceId }).lean();
    expect(stillPending.status).toBe('pending');

    // ALLOW: Owner with settings.billing.update settles it
    const payRes = await request(app)
      .post(`/api/tenants/current/subscription/invoices/${invoiceId}/pay`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ amount: 199000, method: 'transfer', referenceNumber: 'OWNER-TRF-1' })
      .expect(200);

    expect(payRes.body.data.invoice.status).toBe('paid');
    expect(payRes.body.data.attempt.status).toBe('completed');

    // Missing body -> 400 (validation, not authorization)
    await request(app)
      .post(`/api/tenants/current/subscription/invoices/${invoiceId}/pay`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({})
      .expect(400);
  });

  it('cancel invoice marks it cancelled, and paying a cancelled invoice is denied', async () => {
    await createTenantDoc(TENANT_A).save();
    await createSubDoc(TENANT_A).save();

    const renewRes = await request(app)
      .post('/api/tenants/current/subscription/renew')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ days: 30 })
      .expect(200);

    const invoiceId = renewRes.body.data.invoice.id;

    // Platform admin cancels invoice
    const cancelRes = await request(app)
      .post(`/api/platform/tenants/${TENANT_A}/subscription/invoices/${invoiceId}/cancel`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reason: 'Dibatalkan atas permintaan tenant' })
      .expect(200);

    expect(cancelRes.body.data.invoice.status).toBe('cancelled');

    // Attempting to pay cancelled invoice throws 400 ValidationError
    await request(app)
      .post(`/api/platform/tenants/${TENANT_A}/subscription/invoices/${invoiceId}/pay`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ amount: 199000, method: 'manual' })
      .expect(400);

    // Audit log recorded for cancellation
    const auditLogs = await auditModel.find({ tenantId: TENANT_A, action: 'SUBSCRIPTION_INVOICE_CANCELLED' }).lean();
    expect(auditLogs).toHaveLength(1);
  });

  it('tenant isolation: tenant B cannot see or pay tenant A invoices', async () => {
    await createTenantDoc(TENANT_A).save();
    await createSubDoc(TENANT_A).save();
    await createTenantDoc(TENANT_B).save();
    await createSubDoc(TENANT_B).save();

    const renewRes = await request(app)
      .post('/api/tenants/current/subscription/renew')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ days: 30 })
      .expect(200);

    const invoiceIdA = renewRes.body.data.invoice.id;

    // Tenant B lists invoices -> empty
    const listResB = await request(app)
      .get('/api/tenants/current/subscription/invoices')
      .set('Authorization', `Bearer ${ownerTokenB}`)
      .expect(200);

    expect(listResB.body.data.items).toHaveLength(0);

    // Platform endpoint with tenant B ID for invoice A -> 404
    await request(app)
      .post(`/api/platform/tenants/${TENANT_B}/subscription/invoices/${invoiceIdA}/pay`)
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ amount: 199000, method: 'manual' })
      .expect(404);
  });

  it('platform RBAC: platform endpoints require platform token and reject tenant tokens', async () => {
    await createTenantDoc(TENANT_A).save();

    // 401 without token
    await request(app)
      .get(`/api/platform/tenants/${TENANT_A}/subscription/invoices`)
      .expect(401);

    // 401 with tenant token
    await request(app)
      .get(`/api/platform/tenants/${TENANT_A}/subscription/invoices`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(401);
  });
});
