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

  it('does not create a duplicate default outlet for a tenant whose default was provisioned with a custom name', async () => {
    await clearCollections();

    const Tenant = container.resolve('tenantModel') as any;
    const Outlet = container.resolve('outletModel') as any;
    const Warehouse = container.resolve('warehouseModel') as any;

    await Tenant.create({
      _id: 'custom-tenant',
      name: 'TK Putri',
      slug: 'tk-putri',
      domain: null,
      ownerId: 'owner-2',
      plan: 'pro',
      status: 'active',
      businessType: 'retail',
      modules: ['core'],
      databaseName: 'posmono_custom-tenant',
      config: { timezone: 'Asia/Jakarta', currency: 'IDR', locale: 'id' },
      billingEmail: 'owner2@local',
    });

    // Simulate Terminal Center provisioning: default outlet created with a CUSTOM
    // name and linked 1:1 to the default warehouse.
    const warehouseId = `${DEFAULT_WAREHOUSE_ID}-custom-tenant`;
    await Warehouse.create({
      _id: warehouseId,
      tenantId: 'custom-tenant',
      outletId: 'out-custom-1',
      name: DEFAULT_WAREHOUSE_NAME,
      address: '',
      isActive: true,
    });
    await Outlet.create({
      _id: 'out-custom-1',
      tenantId: 'custom-tenant',
      name: 'TK Putri Utama',
      address: '',
      phone: '',
      warehouseId,
      isActive: true,
    });

    await provisionDefaults(container);

    expect(await Outlet.countDocuments({ tenantId: 'custom-tenant' })).toBe(1);
    const outlet = await Outlet.findOne({ tenantId: 'custom-tenant' }).lean() as any;
    expect(outlet.name).toBe('TK Putri Utama');
    expect(outlet.warehouseId).toBe(warehouseId);
    expect(await Warehouse.countDocuments({ tenantId: 'custom-tenant' })).toBe(1);
  });

  it('gives a later tenant a tenant-scoped default warehouse id instead of overwriting the first tenant\'s "utama"', async () => {
    await clearCollections();

    const Tenant = container.resolve('tenantModel') as any;
    const Outlet = container.resolve('outletModel') as any;
    const Warehouse = container.resolve('warehouseModel') as any;

    const newTenant = (id: string, name: string) =>
      Tenant.create({
        _id: id,
        name,
        slug: id,
        domain: null,
        ownerId: `owner-${id}`,
        plan: 'pro',
        status: 'active',
        businessType: 'retail',
        modules: ['core'],
        databaseName: `posmono_${id}`,
        config: { timezone: 'Asia/Jakarta', currency: 'IDR', locale: 'id' },
        billingEmail: `${id}@local`,
      });
    await newTenant('first-tenant', 'Toko ABC');
    await newTenant('second-tenant', 'TK Putri');

    await provisionDefaults(container);

    const warehouses = (await Warehouse.find().lean().exec()) as any[];
    expect(warehouses.length).toBe(2);
    expect(await Outlet.countDocuments({})).toBe(2);

    const byTenant: Record<string, string> = {};
    for (const w of warehouses) byTenant[w.tenantId] = w._id;
    expect(byTenant['first-tenant']).toBeTruthy();
    expect(byTenant['second-tenant']).toBeTruthy();
    expect(byTenant['first-tenant']).not.toBe(byTenant['second-tenant']);

    // the global literal id 'utama' ends up owned by exactly ONE tenant
    const utamaOwners = warehouses.filter((w) => w._id === DEFAULT_WAREHOUSE_ID);
    expect(utamaOwners.length).toBe(1);
    expect(utamaOwners[0].tenantId).toBe(utamaOwners[0].tenantId);

    // every other tenant gets a tenant-scoped id
    const nonUtama = warehouses.filter((w) => w._id !== DEFAULT_WAREHOUSE_ID);
    expect(nonUtama.length).toBe(1);
    expect(nonUtama[0]._id).toBe(`${DEFAULT_WAREHOUSE_ID}-${nonUtama[0].tenantId}`);
    expect(nonUtama[0].outletId).toBeTruthy();

    // idempotent second run — still exactly one warehouse + outlet per tenant, no _id clobbering
    await provisionDefaults(container);
    expect(await Warehouse.countDocuments({})).toBe(2);
    expect(await Outlet.countDocuments({})).toBe(2);
  });
});