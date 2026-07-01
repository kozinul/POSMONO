import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { TenantSchema } from './core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { UserSchema } from './core/identity/infrastructure/persistence/schemas/UserSchema';
import { RoleSchema } from './core/identity/infrastructure/persistence/schemas/RoleSchema';
import { ProductSchema } from './core/catalog/infrastructure/persistence/schemas/ProductSchema';
import { CategorySchema } from './core/catalog/infrastructure/persistence/schemas/CategorySchema';
import { StockSchema } from './core/inventory/infrastructure/persistence/schemas/StockSchema';

function id(prefix: string): string {
  return `${prefix}_${uuidv4().replace(/-/g, '').substring(0, 20)}`;
}

async function seedData() {
  const Tenant = mongoose.model('Tenant', TenantSchema);
  const User = mongoose.model('User', UserSchema);
  const Role = mongoose.model('Role', RoleSchema);
  const Product = mongoose.model('Product', ProductSchema);
  const Category = mongoose.model('Category', CategorySchema);
  const Stock = mongoose.model('Stock', StockSchema);

  await mongoose.connection.dropDatabase();

  const tenantId = 'dev-tenant';
  const adminUserId = id('usr');
  const cashierUserId = id('usr');
  const adminRoleId = id('rol');
  const cashierRoleId = id('rol');
  const managerRoleId = id('rol');

  await Tenant.create({
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
  });

  await Role.create([
    {
      _id: adminRoleId, tenantId, name: 'Owner',
      description: 'Full access to all features',
      permissions: [
        'users:read', 'users:write', 'users:delete',
        'roles:read', 'roles:write',
        'products:read', 'products:write', 'products:delete',
        'orders:read', 'orders:write', 'orders:cancel',
        'payments:read', 'payments:write',
        'inventory:read', 'inventory:write', 'inventory:adjust',
        'reports:read',
        'customers:read', 'customers:write',
        'settings:read', 'settings:write',
        'shifts:read', 'shifts:write',
      ],
      isSystem: true,
    },
    {
      _id: managerRoleId, tenantId, name: 'Manager',
      description: 'Daily operations management',
      permissions: [
        'products:read', 'products:write',
        'orders:read', 'orders:write', 'orders:cancel',
        'payments:read', 'payments:write',
        'inventory:read', 'inventory:write',
        'reports:read',
        'customers:read', 'customers:write',
        'settings:read',
        'shifts:read', 'shifts:write',
      ],
      isSystem: true,
    },
    {
      _id: cashierRoleId, tenantId, name: 'Cashier',
      description: 'Can process POS transactions',
      permissions: [
        'products:read',
        'orders:read', 'orders:write',
        'payments:read', 'payments:write',
        'customers:read', 'customers:write',
        'shifts:read', 'shifts:write',
      ],
      isSystem: true,
    },
  ]);

  const passwordHash = await bcrypt.hash('admin123', 12);

  await User.create([
    {
      _id: adminUserId, tenantId,
      email: 'admin@demo.com', passwordHash,
      displayName: 'Admin Toko', roleId: adminRoleId,
      isActive: true, lastLoginAt: null, preferences: {},
    },
    {
      _id: cashierUserId, tenantId,
      email: 'cashier@demo.com', passwordHash,
      displayName: 'Cashier Demo', roleId: cashierRoleId,
      isActive: true, lastLoginAt: null, preferences: {},
    },
  ]);

  const categories = await Category.create([
    { _id: id('cat'), tenantId, name: 'Minuman', parentId: null, sortOrder: 1, isActive: true },
    { _id: id('cat'), tenantId, name: 'Makanan', parentId: null, sortOrder: 2, isActive: true },
    { _id: id('cat'), tenantId, name: 'Snack', parentId: null, sortOrder: 3, isActive: true },
  ]);

  const categoryMap: Record<string, string> = {};
  const catDocs = await Category.find({ tenantId }).exec();
  catDocs.forEach((c: any) => { categoryMap[c.name.toLowerCase()] = c._id; });

  const products = await Product.create([
    { _id: id('prd'), tenantId, sku: 'KOPI-001', barcode: '', name: 'Kopi Hitam', description: 'Black coffee', categoryId: categoryMap['minuman'], basePrice: 15000, isActive: true },
    { _id: id('prd'), tenantId, sku: 'KOPI-002', barcode: '', name: 'Kopi Susu', description: 'Coffee with milk', categoryId: categoryMap['minuman'], basePrice: 20000, isActive: true },
    { _id: id('prd'), tenantId, sku: 'TEH-001', barcode: '', name: 'Teh Manis', description: 'Sweet tea', categoryId: categoryMap['minuman'], basePrice: 10000, isActive: true },
    { _id: id('prd'), tenantId, sku: 'ROTI-001', barcode: '', name: 'Roti Bakar', description: 'Toast with butter', categoryId: categoryMap['makanan'], basePrice: 12000, isActive: true },
    { _id: id('prd'), tenantId, sku: 'NASI-001', barcode: '', name: 'Nasi Goreng', description: 'Fried rice', categoryId: categoryMap['makanan'], basePrice: 25000, isActive: true },
    { _id: id('prd'), tenantId, sku: 'SNACK-001', barcode: '', name: 'Pisang Goreng', description: 'Fried banana', categoryId: categoryMap['snack'], basePrice: 8000, isActive: true },
    { _id: id('prd'), tenantId, sku: 'SNACK-002', barcode: '', name: 'Kentang Goreng', description: 'French fries', categoryId: categoryMap['snack'], basePrice: 15000, isActive: true },
    { _id: id('prd'), tenantId, sku: 'MINUM-001', barcode: '', name: 'Jus Jeruk', description: 'Orange juice', categoryId: categoryMap['minuman'], basePrice: 18000, isActive: true },
  ]);

  const stockEntries = products.map((p) => ({
    _id: id('stk'), tenantId, productId: p._id,
    variantId: null, warehouseId: 'utama',
    quantity: 50, reservedQuantity: 0, minLevel: 5, maxLevel: 100,
  }));
  await Stock.create(stockEntries);

  return { tenantId, tenantSlug: 'toko-abc' };
}

async function main() {
  process.env.MONGOMS_VERSION = '7.3.4';
  process.env.MONGOMS_DOWNLOAD_URL = 'https://fastdl.mongodb.org/linux/mongodb-linux-aarch64-ubuntu2204-7.3.4.tgz';

  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  process.env.MONGO_URI = uri;

  await mongoose.connect(uri);
  await seedData();
  await mongoose.disconnect();

  const { createServer } = await import('./bootstrap/server');
  const { buildContainer } = await import('./bootstrap/container');
  const { registerEventHandlers } = await import('./bootstrap/eventBus');
  const { logger } = await import('./@shared/infrastructure/logger/Logger');
  const { env } = await import('./@shared/config/env');
  const { validateEnv } = await import('./@shared/config/validateEnv');

  validateEnv();

  const container = buildContainer();

  const eventBus = container.resolve('eventBus');
  registerEventHandlers(eventBus);

  const app = createServer(container);

  app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      'POSMono server started (dev mode with in-memory MongoDB)',
    );
    logger.info('Default credentials:');
    logger.info('  admin@demo.com / admin123  (Owner)');
    logger.info('  cashier@demo.com / admin123 (Cashier)');
    logger.info('Tenant slug: toko-abc');
  });

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

main().catch((err) => {
  console.error('Failed to start dev server:', err);
  process.exit(1);
});
