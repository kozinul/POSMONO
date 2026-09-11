import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { TenantSchema } from './core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { UserSchema } from './core/identity/infrastructure/persistence/schemas/UserSchema';
import { RoleSchema } from './core/identity/infrastructure/persistence/schemas/RoleSchema';
import { ProductSchema } from './core/catalog/infrastructure/persistence/schemas/ProductSchema';
import { CategorySchema } from './core/catalog/infrastructure/persistence/schemas/CategorySchema';
import { FamilySchema } from './core/catalog/infrastructure/persistence/schemas/FamilySchema';
import { StockSchema } from './core/inventory/infrastructure/persistence/schemas/StockSchema';
import { PaymentMethodSchema } from './core/payment/infrastructure/persistence/schemas/PaymentMethodSchema';
import { TemplateSchema } from './core/template/infrastructure/persistence/schemas/TemplateSchema';
import { DEFAULT_ROLES, DEFAULT_TEMPLATES, DEFAULT_PAYMENT_METHODS, OWNER_PERMS, MANAGER_PERMS, DEFAULT_PLATFORM_ROLE, PLATFORM_ROLE_PERMS, PLATFORM_TENANT_ID } from './core/platform/defaults';

function id(prefix: string): string {
  return `${prefix}_${uuidv4().replace(/-/g, '').substring(0, 20)}`;
}

const DEV_TENANT_ID = 'dev-tenant';

async function seedData() {
  const Tenant = mongoose.model('Tenant', TenantSchema);
  const User = mongoose.model('User', UserSchema);
  const Role = mongoose.model('Role', RoleSchema);
  const Product = mongoose.model('Product', ProductSchema);
  const Category = mongoose.model('Category', CategorySchema);
  const Family = mongoose.model('Family', FamilySchema);
  const Stock = mongoose.model('Stock', StockSchema);
  const PaymentMethodModel = mongoose.model('PaymentMethod', PaymentMethodSchema);
  const Template = mongoose.model('Template', TemplateSchema);

  const existingTenant = await Tenant.findOne({ _id: DEV_TENANT_ID }).lean();
  if (existingTenant) {
    console.log('[DEV] Data already exists, skipping seed. Use --seed to force re-seed.');
    return;
  }

  console.log('[DEV] Seeding initial data...');

  const tenantId = DEV_TENANT_ID;
  const adminUserId = id('usr');
  const cashierUserId = id('usr');
  const adminRoleId = id('rol');
  const cashierRoleId = id('rol');
  const managerRoleId = id('rol');

  await Tenant.updateOne(
    { _id: 'dev-tenant' },
    {
      $setOnInsert: {
        _id: 'dev-tenant',
        name: 'Toko ABC Retail',
        slug: 'toko-abc',
        domain: null,
        ownerId: adminUserId,
        plan: 'pro',
        status: 'active',
        businessType: 'retail',
        modules: ['core', 'retail'],
        databaseName: `posmono_${tenantId}`,
        config: { timezone: 'Asia/Jakarta', currency: 'IDR', locale: 'id' },
        billingEmail: 'admin@tokoabc.com',
      },
    },
    { upsert: true },
  );

  const roleDocs = DEFAULT_ROLES.map((r) => ({
    _id: r.name === 'Owner' ? adminRoleId : r.name === 'Manager' ? managerRoleId : cashierRoleId,
    name: r.name,
    description: r.description,
    permissions: r.permissions,
    isSystem: r.isSystem,
  }));

  await Role.bulkWrite(
    roleDocs.map((r) => ({
      updateOne: {
        filter: { tenantId, name: r.name },
        update: {
          $setOnInsert: { _id: r._id, tenantId, description: r.description, isSystem: r.isSystem },
          $set: { permissions: r.permissions },
        },
        upsert: true,
      },
    })),
  );

  const passwordHash = await bcrypt.hash('admin123', 12);
  const managerPinHash = await bcrypt.hash('1234', 12);
  const managerUserId = id('usr');

  await User.bulkWrite([
    {
      updateOne: {
        filter: { tenantId, email: 'admin@demo.com' },
        update: { $setOnInsert: { _id: adminUserId, tenantId, email: 'admin@demo.com', passwordHash, displayName: 'Admin Toko', roleId: adminRoleId, isActive: true, lastLoginAt: null, preferences: {} } },
        upsert: true,
      },
    },
    {
      updateOne: {
        filter: { tenantId, email: 'manager@demo.com' },
        update: { $setOnInsert: { _id: managerUserId, tenantId, email: 'manager@demo.com', passwordHash, pin: managerPinHash, displayName: 'Manager Demo', roleId: managerRoleId, isActive: true, lastLoginAt: null, preferences: {} } },
        upsert: true,
      },
    },
    {
      updateOne: {
        filter: { tenantId, email: 'cashier@demo.com' },
        update: { $setOnInsert: { _id: cashierUserId, tenantId, email: 'cashier@demo.com', passwordHash, displayName: 'Cashier Demo', roleId: cashierRoleId, isActive: true, lastLoginAt: null, preferences: {} } },
        upsert: true,
      },
    },
  ]);

  const families = await Family.create([
    { _id: id('fam'), tenantId, name: 'Food', description: 'Makanan', menuType: 'food', sortOrder: 1, isActive: true },
    { _id: id('fam'), tenantId, name: 'Beverage', description: 'Minuman', menuType: 'beverage', sortOrder: 2, isActive: true },
  ]);

  const familyMap: Record<string, string> = {};
  const famDocs = await Family.find({ tenantId }).exec();
  famDocs.forEach((f: any) => { familyMap[f.name.toLowerCase()] = f._id; });

  const categories = await Category.create([
    { _id: id('cat'), tenantId, name: 'Makanan Utama', familyId: familyMap['food'], parentId: null, sortOrder: 1, isActive: true },
    { _id: id('cat'), tenantId, name: 'Snack', familyId: familyMap['food'], parentId: null, sortOrder: 2, isActive: true },
    { _id: id('cat'), tenantId, name: 'Kopi', familyId: familyMap['beverage'], parentId: null, sortOrder: 1, isActive: true },
    { _id: id('cat'), tenantId, name: 'Non-Kopi', familyId: familyMap['beverage'], parentId: null, sortOrder: 2, isActive: true },
  ]);

  const categoryMap: Record<string, string> = {};
  const catDocs = await Category.find({ tenantId }).exec();
  catDocs.forEach((c: any) => { categoryMap[c.name.toLowerCase()] = c._id; });

  const products = await Product.create([
    { _id: id('prd'), tenantId, sku: 'KOPI-001', barcode: '', name: 'Kopi Hitam', description: 'Black coffee', categoryId: categoryMap['kopi'], basePrice: 15000, isActive: true },
    { _id: id('prd'), tenantId, sku: 'KOPI-002', barcode: '', name: 'Kopi Susu', description: 'Coffee with milk', categoryId: categoryMap['kopi'], basePrice: 20000, isActive: true },
    { _id: id('prd'), tenantId, sku: 'TEH-001', barcode: '', name: 'Teh Manis', description: 'Sweet tea', categoryId: categoryMap['non-kopi'], basePrice: 10000, isActive: true },
    { _id: id('prd'), tenantId, sku: 'ROTI-001', barcode: '', name: 'Roti Bakar', description: 'Toast with butter', categoryId: categoryMap['snack'], basePrice: 12000, isActive: true },
    { _id: id('prd'), tenantId, sku: 'NASI-001', barcode: '', name: 'Nasi Goreng', description: 'Fried rice', categoryId: categoryMap['makanan utama'], basePrice: 25000, isActive: true },
    { _id: id('prd'), tenantId, sku: 'SNACK-001', barcode: '', name: 'Pisang Goreng', description: 'Fried banana', categoryId: categoryMap['snack'], basePrice: 8000, isActive: true },
    { _id: id('prd'), tenantId, sku: 'SNACK-002', barcode: '', name: 'Kentang Goreng', description: 'French fries', categoryId: categoryMap['snack'], basePrice: 15000, isActive: true },
    { _id: id('prd'), tenantId, sku: 'MINUM-001', barcode: '', name: 'Jus Jeruk', description: 'Orange juice', categoryId: categoryMap['non-kopi'], basePrice: 18000, isActive: true },
  ]);

  const stockEntries = products.map((p) => ({
    _id: id('stk'), tenantId, productId: p._id,
    variantId: null, warehouseId: 'utama',
    quantity: 50, reservedQuantity: 0, minLevel: 5, maxLevel: 100,
  }));
  await Stock.create(stockEntries);

  await PaymentMethodModel.create(
    DEFAULT_PAYMENT_METHODS.map((m) => ({
      _id: id('pmt'), tenantId,
      name: m.name, code: m.code,
      description: m.description,
      icon: m.icon, color: m.color,
      sortOrder: m.sortOrder, isActive: true, requiresReference: m.requiresReference, config: m.config,
    })),
  );

  console.log('Seeding templates...');
  await Template.create(
    DEFAULT_TEMPLATES.map((t) => ({
      _id: id('tpl'), tenantId,
      name: t.name,
      description: t.description,
      schemaVersion: 1,
      documentType: t.documentType,
      paper: t.paper,
      sections: t.sections ?? [],
      metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1, createdBy: 'system' },
      isActive: true,
      isDefault: t.isDefault ?? false,
    })),
  );

  console.log('[DEV] Seed complete.');
}

async function main() {
  const forceSeed = process.argv.includes('--seed');
  const customUri = process.env.MONGO_URI;
  const isCustomMongo = customUri && !customUri.includes('localhost:27017/posmono');

  let uri: string;
  let mongod: any = null;

  if (isCustomMongo) {
    // Use real MongoDB from .env
    uri = customUri!;
    console.log(`[DEV] Connecting to real MongoDB: ${uri.replace(/\/\/.*@/, '//***@')}`);
    try {
      await mongoose.connect(uri);
      console.log('[DEV] Connected to real MongoDB.');
    } catch (err: any) {
      console.error(`[DEV] Failed to connect to ${uri}: ${err.message}`);
      console.log('[DEV] Falling back to in-memory MongoDB...');
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      process.env.MONGOMS_VERSION = '7.3.4';
      process.env.MONGOMS_DOWNLOAD_URL = 'https://fastdl.mongodb.org/linux/mongodb-linux-aarch64-ubuntu2204-7.3.4.tgz';
      mongod = await MongoMemoryServer.create();
      uri = mongod.getUri();
      await mongoose.connect(uri);
      console.log('[DEV] Connected to in-memory MongoDB.');
    }
  } else {
    // Use in-memory MongoDB
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    process.env.MONGOMS_VERSION = '7.3.4';
    process.env.MONGOMS_DOWNLOAD_URL = 'https://fastdl.mongodb.org/linux/mongodb-linux-aarch64-ubuntu2204-7.3.4.tgz';
    mongod = await MongoMemoryServer.create();
    uri = mongod.getUri();
    console.log('[DEV] Using in-memory MongoDB.');
    await mongoose.connect(uri);
  }

  if (forceSeed) {
    const collections = await mongoose.connection.db?.listCollections().toArray() ?? [];
    for (const col of collections) {
      try {
        await mongoose.connection.db?.dropCollection(col.name);
      } catch {
        // ignore system collections
      }
    }
    console.log('[DEV] Cleared all collections for re-seed.');
  }

  const { ensurePromotionIndexes } = await import('./core/promotion/infrastructure/persistence/ensurePromotionIndexes');
  await ensurePromotionIndexes();

  // Always keep system role permissions in sync (idempotent) — fixes roles that
  // predate a permission being added and would otherwise only set on $setOnInsert.
  const RoleSync = mongoose.model('Role', RoleSchema);
  await RoleSync.updateOne({ tenantId: DEV_TENANT_ID, name: 'Owner' }, { $set: { permissions: OWNER_PERMS, isSystem: true } });
  await RoleSync.updateOne({ tenantId: DEV_TENANT_ID, name: 'Manager' }, { $set: { permissions: MANAGER_PERMS, isSystem: true } });

  // Platform / Terminal Center super-admin (tenant 'platform', not a real tenant).
  const platformPasswordHash = await bcrypt.hash('admin123', 12);
  const platformRole = await RoleSync.findOneAndUpdate(
    { tenantId: PLATFORM_TENANT_ID, name: DEFAULT_PLATFORM_ROLE.name },
    { $setOnInsert: { _id: id('rol'), tenantId: PLATFORM_TENANT_ID, description: DEFAULT_PLATFORM_ROLE.description }, $set: { permissions: PLATFORM_ROLE_PERMS, isSystem: true } },
    { upsert: true, new: true },
  ).lean();
  const UserSync = mongoose.model('User', UserSchema);
  await UserSync.updateOne(
    { tenantId: PLATFORM_TENANT_ID, email: 'platform@demo.com' },
    {
      $setOnInsert: {
        _id: id('usr'),
        tenantId: PLATFORM_TENANT_ID,
        email: 'platform@demo.com',
        passwordHash: platformPasswordHash,
        displayName: 'Platform Super Admin',
        roleId: platformRole._id,
        isActive: true,
        lastLoginAt: null,
        preferences: {},
      },
    },
    { upsert: true },
  );

  await seedData();

  process.env.MONGO_URI = uri;

  const { createServer } = await import('./bootstrap/server');
  const { buildContainer } = await import('./bootstrap/container');
  const { registerEventHandlers } = await import('./bootstrap/eventBus');
  const { initSocketServer } = await import('./bootstrap/socket');
  const { logger } = await import('./@shared/infrastructure/logger/Logger');
  const { env } = await import('./@shared/config/env');
  const { validateEnv } = await import('./@shared/config/validateEnv');
  const http = await import('http');

  validateEnv();

  const container = buildContainer();

  const eventBus = container.resolve('eventBus');
  registerEventHandlers(eventBus, container);

  const { provisionDefaults } = await import('./bootstrap/provisioning');
  await provisionDefaults(container);

  const app = createServer(container);
  const httpServer = http.createServer(app);

  initSocketServer(httpServer);

  const dbMode = mongod ? 'in-memory' : 'persistent';
  httpServer.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, db: dbMode },
      'POSMono dev server started',
    );
    logger.info('Default credentials:');
    logger.info('  admin@demo.com / admin123  (Owner)');
    logger.info('  cashier@demo.com / admin123 (Cashier)');
    logger.info('  platform@demo.com / admin123 (Platform, X-Tenant-Id: platform)');
    logger.info('Tenant slug: toko-abc');
  });

  if (mongod) {
    process.on('SIGINT', async () => {
      logger.info('Shutting down...');
      await mongod.stop();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      logger.info('Shutting down...');
      await mongod.stop();
      process.exit(0);
    });
  }
}

main().catch((err) => {
  console.error('Failed to start dev server:', err);
  process.exit(1);
});
