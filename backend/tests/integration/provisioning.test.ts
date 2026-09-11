import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, clearCollections } from '../helpers/db';
import { buildContainer } from '../../src/bootstrap/container';
import { provisionDefaults } from '../../src/bootstrap/provisioning';
import { TenantSchema } from '../../src/core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { OrderSchema } from '../../src/core/ordering/infrastructure/persistence/schemas/OrderSchema';
import { PaymentSchema } from '../../src/core/payment/infrastructure/persistence/schemas/PaymentSchema';
import { ShiftSchema } from '../../src/core/pos/infrastructure/persistence/schemas/ShiftSchema';
import { DEFAULT_OUTLET_NAME, DEFAULT_WAREHOUSE_NAME, DEFAULT_WAREHOUSE_ID } from '../../src/core/outlet/application/services/OutletService';

const TENANT_ID = 'provision-tenant';

describe('provisionDefaults (Fase 5 — boot backfill)', () => {
  let container: ReturnType<typeof buildContainer>;

  beforeAll(async () => {
    await setupTestDb();
    container = buildContainer();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('creates default outlet + default warehouse, links them, and backfills outletId on orders/payments/shifts', async () => {
    await clearCollections();

    const Tenant = container.resolve('tenantModel') as any;
    const Order = container.resolve('orderModel') as any;
    const Payment = container.resolve('paymentModel') as any;
    const Shift = container.resolve('shiftModel') as any;
    const Outlet = container.resolve('outletModel') as any;
    const Warehouse = container.resolve('warehouseModel') as any;

    await Tenant.create({
      _id: TENANT_ID,
      name: 'Provision Tenant',
      slug: 'provision-tenant',
      domain: null,
      ownerId: 'owner-1',
      plan: 'pro',
      status: 'active',
      businessType: 'retail',
      modules: ['core'],
      databaseName: `posmono_${TENANT_ID}`,
      config: { timezone: 'Asia/Jakarta', currency: 'IDR', locale: 'id' },
      billingEmail: 'admin@provision.local',
    });

    const orderId = 'ord-legacy-1';
    await Order.create({
      _id: orderId,
      tenantId: TENANT_ID,
      orderNumber: 'ORD-LEGACY-1',
      subtotal: 10000,
      total: 10000,
      cashierId: 'cashier-1',
    });
    await Payment.create({
      _id: 'pay-legacy-1',
      tenantId: TENANT_ID,
      orderId,
      amount: 10000,
      method: 'cash',
    });
    await Shift.create({
      _id: 'shift-legacy-1',
      tenantId: TENANT_ID,
      registerId: 'register-default',
      cashierId: 'cashier-1',
      openingBalance: 0,
    });

    await provisionDefaults(container);

    const outlet = await Outlet.findOne({ tenantId: TENANT_ID, name: DEFAULT_OUTLET_NAME }).lean();
    expect(outlet).toBeTruthy();
    expect(outlet.warehouseId).toBe(DEFAULT_WAREHOUSE_ID);

    const warehouse = await Warehouse.findOne({ tenantId: TENANT_ID, name: DEFAULT_WAREHOUSE_NAME }).lean();
    expect(warehouse).toBeTruthy();
    expect(warehouse._id).toBe(DEFAULT_WAREHOUSE_ID);
    expect(warehouse.outletId).toBe(outlet._id);

    for (const [label, Model, id] of [
      ['order', Order, orderId],
      ['payment', Payment, 'pay-legacy-1'],
      ['shift', Shift, 'shift-legacy-1'],
    ] as const) {
      const doc = await Model.findById(id).lean();
      expect(doc.outletId, `${label} outletId`).toBe(outlet._id);
    }
  });

  it('is idempotent — second run does not change anything or create extra defaults', async () => {
    const Order = container.resolve('orderModel') as any;
    const Outlet = container.resolve('outletModel') as any;
    const Warehouse = container.resolve('warehouseModel') as any;

    await provisionDefaults(container);

    expect(await Outlet.countDocuments({ tenantId: TENANT_ID })).toBe(1);
    expect(await Warehouse.countDocuments({ tenantId: TENANT_ID })).toBe(1);

    const order = await Order.findById('ord-legacy-1').lean();
    const outlet = await Outlet.findOne({ tenantId: TENANT_ID }).lean();
    expect(order.outletId).toBe(outlet._id);
  });
});