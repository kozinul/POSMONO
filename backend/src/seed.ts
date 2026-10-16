import 'dotenv/config';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { TenantSchema } from './core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { UserSchema } from './core/identity/infrastructure/persistence/schemas/UserSchema';
import { RoleSchema } from './core/identity/infrastructure/persistence/schemas/RoleSchema';
import { ProductSchema } from './core/catalog/infrastructure/persistence/schemas/ProductSchema';
import { CategorySchema } from './core/catalog/infrastructure/persistence/schemas/CategorySchema';
import { StockSchema } from './core/inventory/infrastructure/persistence/schemas/StockSchema';
import { PaymentMethodSchema } from './core/payment/infrastructure/persistence/schemas/PaymentMethodSchema';
import { TemplateSchema } from './core/template/infrastructure/persistence/schemas/TemplateSchema';
import { DEFAULT_ROLES, DEFAULT_TEMPLATES, DEFAULT_PAYMENT_METHODS, DEFAULT_PLATFORM_ROLE, PLATFORM_ROLE_PERMS, PLATFORM_TENANT_ID } from './core/platform/defaults';
import { PlanSchema } from './core/billing/infrastructure/persistence/schemas/PlanSchema';
import { upsertDefaultPlans } from './core/billing/defaults/seedPlans';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27018';
const SYSTEM_DB = 'posmono_system';

function id(prefix: string): string {
  return `${prefix}_${uuidv4().replace(/-/g, '').substring(0, 20)}`;
}

/**
 * Appends a database name to a Mongo URI, dropping one that is already there.
 * `MONGO_URI` may or may not carry a database (`mongodb://host:27017` vs
 * `.../posmono`), and the legacy demo seed — unlike the app — still needs its own
 * database. Without the strip, a URI that already has a name becomes invalid
 * (`.../posmono/posmono_system`).
 */
function withDatabase(uri: string, database: string): string {
  const queryIndex = uri.indexOf('?');
  const base = queryIndex === -1 ? uri : uri.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : uri.slice(queryIndex);
  const authorityEnd = base.indexOf('//') + 2;
  const lastSlash = base.lastIndexOf('/');
  const withoutDb = lastSlash > authorityEnd ? base.slice(0, lastSlash) : base;
  return `${withoutDb}/${database}${query}`;
}

interface ProdSeedConfig {
  mongoUri: string;
  tenantName: string;
  tenantSlug: string;
  adminEmail: string;
  adminName: string;
  adminPassword: string;
  platformEmail?: string;
  platformPassword?: string;
}

/**
 * Reads the prod seed env contract documented in `docs/DEPLOYMENT.md` §6.
 * Everything credential-shaped is required (no default password): a prod seed that
 * silently ships `admin123` is worse than one that refuses to run.
 */
function readProdConfig(): ProdSeedConfig {
  const mongoUri = process.env.MONGO_URI?.trim();
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  const missing: string[] = [];
  if (!mongoUri) missing.push('MONGO_URI');
  if (!adminEmail) missing.push('ADMIN_EMAIL');
  if (!adminPassword) missing.push('ADMIN_PASSWORD');
  if (missing.length > 0) {
    console.error(`[seed --prod] env wajib belum di-set: ${missing.join(', ')}`);
    console.error(
      '[seed --prod] contoh: MONGO_URI=mongodb://mongodb:27017/posmono ADMIN_EMAIL=owner@domain.id ADMIN_PASSWORD=<kuat> pnpm seed -- --prod',
    );
    process.exit(1);
  }
  if (adminPassword!.length < 8) {
    console.error('[seed --prod] ADMIN_PASSWORD minimal 8 karakter.');
    process.exit(1);
  }

  return {
    mongoUri: mongoUri!,
    tenantName: process.env.TENANT_NAME?.trim() || 'Tenant Utama',
    tenantSlug: (process.env.TENANT_SLUG?.trim() || 'utama').toLowerCase(),
    adminEmail: adminEmail!,
    adminName: process.env.ADMIN_NAME?.trim() || 'Owner',
    adminPassword: adminPassword!,
    platformEmail: process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase(),
    platformPassword: process.env.PLATFORM_ADMIN_PASSWORD,
  };
}

/**
 * Production bootstrap: first tenant + roles + owner (+ platform admin, plans,
 * payment methods and print templates), idempotent and non-destructive.
 *
 * Deliberately writes to the *app* database (`MONGO_URI` as-is): the app runs a
 * single Mongo database scoped by `tenantId`, so seeding anywhere else leaves a
 * tenant nobody can log into. No demo catalog / demo staff, and no `dropDatabase`.
 */
async function seedProd(): Promise<void> {
  const cfg = readProdConfig();

  await mongoose.connect(cfg.mongoUri);

  const Tenant = mongoose.model('Tenant', TenantSchema);
  const User = mongoose.model('User', UserSchema);
  const Role = mongoose.model('Role', RoleSchema);
  const PaymentMethodModel = mongoose.model('PaymentMethod', PaymentMethodSchema);
  const Template = mongoose.model('Template', TemplateSchema);
  const Plan = mongoose.model('Plan', PlanSchema);

  const adminUserId = id('usr');

  const existingTenant = await Tenant.findOne({ slug: cfg.tenantSlug });
  let tenantId: string;
  if (existingTenant) {
    tenantId = String(existingTenant._id);
    console.log(`[seed --prod] tenant '${cfg.tenantSlug}' sudah ada (${tenantId}) — profil dibiarkan`);
  } else {
    tenantId = id('ten');
    await Tenant.create({
      _id: tenantId,
      name: cfg.tenantName,
      slug: cfg.tenantSlug,
      domain: null,
      ownerId: adminUserId,
      status: 'active',
      businessType: 'retail',
      modules: ['core', 'retail'],
      databaseName: `posmono_${tenantId}`,
      config: { timezone: 'Asia/Jakarta', currency: 'IDR', locale: 'id' },
      billingEmail: cfg.adminEmail,
    });
    console.log(`[seed --prod] tenant dibuat: ${cfg.tenantName} (${tenantId})`);
  }

  // Roles are synced (not just inserted) so a re-run after an upgrade refreshes
  // permissions that were added since the tenant was created.
  for (const role of DEFAULT_ROLES) {
    await Role.updateOne(
      { tenantId, name: role.name },
      {
        $set: { description: role.description, permissions: role.permissions, isSystem: role.isSystem },
        $setOnInsert: { _id: id('rol'), tenantId, name: role.name },
      },
      { upsert: true },
    );
  }
  const ownerRole = await Role.findOne({ tenantId, name: 'Owner' }).lean();
  if (!ownerRole) {
    throw new Error('role Owner gagal dibuat');
  }

  // Password only on insert: re-running the seed must not reset a rotated password.
  const adminPasswordHash = await bcrypt.hash(cfg.adminPassword, 12);
  await User.updateOne(
    { tenantId, email: cfg.adminEmail },
    {
      $setOnInsert: {
        _id: adminUserId,
        tenantId,
        email: cfg.adminEmail,
        passwordHash: adminPasswordHash,
        displayName: cfg.adminName,
        lastLoginAt: null,
        preferences: {},
      },
      $set: { roleId: ownerRole._id, isActive: true },
    },
    { upsert: true },
  );

  if (cfg.platformEmail && cfg.platformPassword) {
    const platformRole = await Role.findOneAndUpdate(
      { tenantId: PLATFORM_TENANT_ID, name: DEFAULT_PLATFORM_ROLE.name },
      {
        $set: { description: DEFAULT_PLATFORM_ROLE.description, permissions: PLATFORM_ROLE_PERMS, isSystem: true },
        $setOnInsert: { _id: id('rol'), tenantId: PLATFORM_TENANT_ID, name: DEFAULT_PLATFORM_ROLE.name },
      },
      { upsert: true, new: true },
    );
    const platformPasswordHash = await bcrypt.hash(cfg.platformPassword, 12);
    await User.updateOne(
      { tenantId: PLATFORM_TENANT_ID, email: cfg.platformEmail },
      {
        $setOnInsert: {
          _id: id('usr'),
          tenantId: PLATFORM_TENANT_ID,
          email: cfg.platformEmail,
          passwordHash: platformPasswordHash,
          displayName: 'Platform Super Admin',
          lastLoginAt: null,
          preferences: {},
        },
        $set: { roleId: platformRole!._id, isActive: true },
      },
      { upsert: true },
    );
    console.log(`[seed --prod] platform admin: ${cfg.platformEmail} (header X-Tenant-Id: platform)`);
  } else {
    console.warn('[seed --prod] PLATFORM_ADMIN_EMAIL/PASSWORD tidak di-set — Terminal Center tidak bisa diakses');
  }

  for (const method of DEFAULT_PAYMENT_METHODS) {
    await PaymentMethodModel.updateOne(
      { tenantId, code: method.code },
      {
        $setOnInsert: {
          _id: id('pmt'),
          tenantId,
          name: method.name,
          code: method.code,
          description: method.description,
          icon: method.icon,
          color: method.color,
          sortOrder: method.sortOrder,
          isActive: true,
          requiresReference: method.requiresReference,
          config: method.config,
        },
      },
      { upsert: true },
    );
  }

  const now = new Date().toISOString();
  for (const template of DEFAULT_TEMPLATES) {
    await Template.updateOne(
      { tenantId, name: template.name },
      {
        $setOnInsert: {
          _id: id('tpl'),
          tenantId,
          name: template.name,
          description: template.description,
          schemaVersion: 1,
          documentType: template.documentType,
          paper: template.paper,
          sections: template.sections ?? [],
          metadata: { createdAt: now, updatedAt: now, version: 1, createdBy: 'seed' },
          isActive: true,
          isDefault: template.isDefault ?? false,
        },
      },
      { upsert: true },
    );
  }

  await upsertDefaultPlans(Plan);

  console.log('\n✅ Prod seed selesai (idempotent — aman dijalankan ulang).');
  console.log(`   Tenant : ${cfg.tenantName} (slug: ${cfg.tenantSlug})`);
  console.log(`   Owner  : ${cfg.adminEmail}`);
  console.log('   Login  : /login');
  console.log('   Catatan: Outlet & Warehouse default dibuat otomatis saat server boot.');

  await mongoose.disconnect();
  process.exit(0);
}

async function seedDemo() {
  console.warn(
    `[seed] Mode demo legacy: menulis ke database '${SYSTEM_DB}' (bukan database aplikasi) dan MENGHAPUS isinya. ` +
      'Untuk produksi pakai: pnpm seed -- --prod',
  );

  const systemConn = mongoose.createConnection(withDatabase(MONGO_URI, SYSTEM_DB));

  await systemConn.dropDatabase();

  const Tenant = systemConn.model('Tenant', TenantSchema);
  const User = systemConn.model('User', UserSchema);
  const Role = systemConn.model('Role', RoleSchema);
  const Product = systemConn.model('Product', ProductSchema);
  const Category = systemConn.model('Category', CategorySchema);
  const Stock = systemConn.model('Stock', StockSchema);
  const PaymentMethodModel = systemConn.model('PaymentMethod', PaymentMethodSchema);
  const Template = systemConn.model('Template', TemplateSchema);

  const tenantId = id('ten');
  const adminUserId = id('usr');
  const cashierUserId = id('usr');
  const adminRoleId = id('rol');
  const cashierRoleId = id('rol');

  console.log('Seeding tenant...');
  await Tenant.create({
    _id: tenantId,
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

  const managerRoleId = id('rol');

  console.log('Seeding roles...');
  await Role.create(
    DEFAULT_ROLES.map((r) => ({
      _id: r.name === 'Owner' ? adminRoleId : r.name === 'Manager' ? managerRoleId : cashierRoleId,
      tenantId,
      name: r.name,
      description: r.description,
      permissions: r.permissions,
      isSystem: r.isSystem,
    })),
  );

  const platformRoleId = id('rol');
  await Role.create({
    _id: platformRoleId,
    tenantId: PLATFORM_TENANT_ID,
    name: DEFAULT_PLATFORM_ROLE.name,
    description: DEFAULT_PLATFORM_ROLE.description,
    permissions: DEFAULT_PLATFORM_ROLE.permissions,
    isSystem: true,
  });

  const passwordHash = await bcrypt.hash('admin123', 12);
  const managerPinHash = await bcrypt.hash('1234', 12);
  const managerUserId = id('usr');

  console.log('Seeding users...');
  await User.create([
    {
      _id: adminUserId,
      tenantId,
      email: 'admin@demo.com',
      passwordHash,
      displayName: 'Admin Toko',
      roleId: adminRoleId,
      isActive: true,
      lastLoginAt: null,
      preferences: {},
    },
    {
      _id: managerUserId,
      tenantId,
      email: 'manager@demo.com',
      passwordHash,
      displayName: 'Manager Demo',
      roleId: managerRoleId,
      pin: managerPinHash,
      isActive: true,
      lastLoginAt: null,
      preferences: {},
    },
    {
      _id: cashierUserId,
      tenantId,
      email: 'cashier@demo.com',
      passwordHash,
      displayName: 'Cashier Demo',
      roleId: cashierRoleId,
      isActive: true,
      lastLoginAt: null,
      preferences: {},
    },
    {
      _id: id('usr'),
      tenantId: PLATFORM_TENANT_ID,
      email: 'platform@demo.com',
      passwordHash,
      displayName: 'Platform Super Admin',
      roleId: platformRoleId,
      isActive: true,
      lastLoginAt: null,
      preferences: {},
    },
  ]);

  console.log('Seeding categories...');
  const categories = await Category.create([
    { _id: id('cat'), tenantId, name: 'Minuman', parentId: null, sortOrder: 1, isActive: true },
    { _id: id('cat'), tenantId, name: 'Makanan', parentId: null, sortOrder: 2, isActive: true },
    { _id: id('cat'), tenantId, name: 'Snack', parentId: null, sortOrder: 3, isActive: true },
  ]);

  const categoryMap: Record<string, string> = {};
  const catDocs = await Category.find({ tenantId }).exec();
  catDocs.forEach((c: any) => { categoryMap[c.name.toLowerCase()] = c._id; });

  console.log('Seeding products...');
  const products = await Product.create([
    { _id: id('prd'), tenantId, sku: 'KOPI-001', barcode: '8992760100015', name: 'Kopi Hitam', description: 'Black coffee', categoryId: categoryMap['minuman'], basePrice: 15000, isActive: true },
    { _id: id('prd'), tenantId, sku: 'KOPI-002', barcode: '8992760100022', name: 'Kopi Susu', description: 'Coffee with milk', categoryId: categoryMap['minuman'], basePrice: 20000, isActive: true },
    { _id: id('prd'), tenantId, sku: 'TEH-001', barcode: '8992760100039', name: 'Teh Manis', description: 'Sweet tea', categoryId: categoryMap['minuman'], basePrice: 10000, isActive: true },
    { _id: id('prd'), tenantId, sku: 'ROTI-001', barcode: '8992760100046', name: 'Roti Bakar', description: 'Toast with butter', categoryId: categoryMap['makanan'], basePrice: 12000, isActive: true },
    { _id: id('prd'), tenantId, sku: 'NASI-001', barcode: '8992760100053', name: 'Nasi Goreng', description: 'Fried rice', categoryId: categoryMap['makanan'], basePrice: 25000, isActive: true },
    { _id: id('prd'), tenantId, sku: 'SNACK-001', barcode: '8992760100060', name: 'Pisang Goreng', description: 'Fried banana', categoryId: categoryMap['snack'], basePrice: 8000, isActive: true },
    { _id: id('prd'), tenantId, sku: 'SNACK-002', barcode: '8992760100077', name: 'Kentang Goreng', description: 'French fries', categoryId: categoryMap['snack'], basePrice: 15000, isActive: true },
    { _id: id('prd'), tenantId, sku: 'MINUM-001', barcode: '8992760100084', name: 'Jus Jeruk', description: 'Orange juice', categoryId: categoryMap['minuman'], basePrice: 18000, isActive: true },
  ]);

  console.log('Seeding payment methods...');
  await PaymentMethodModel.create(
    DEFAULT_PAYMENT_METHODS.map((m) => ({
      _id: id('pmt'),
      tenantId,
      name: m.name,
      code: m.code,
      description: m.description,
      icon: m.icon,
      color: m.color,
      sortOrder: m.sortOrder,
      isActive: true,
      requiresReference: m.requiresReference,
      config: m.config,
    })),
  );

  console.log('Seeding stock...');
  const stockEntries = products.map((p) => ({
    _id: id('stk'),
    tenantId,
    productId: p._id,
    variantId: null,
    warehouseId: 'utama',
    quantity: 50,
    reservedQuantity: 0,
    minLevel: 5,
    maxLevel: 100,
  }));
  await Stock.create(stockEntries);

  console.log('Seeding plans...');
  const Plan = systemConn.model('Plan', PlanSchema);
  await upsertDefaultPlans(Plan);

  console.log('Seeding templates...');
  await Template.create(
    DEFAULT_TEMPLATES.map((t) => ({
      _id: id('tpl'),
      tenantId,
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

  console.log('\n✅ Seed complete!');
  console.log(`   Tenant: toko-abc (${tenantId})`);
  console.log(`   Owner: admin@demo.com / admin123`);
  console.log(`   Cashier: cashier@demo.com / admin123`);
  console.log(`   Platform: platform@demo.com / admin123 (X-Tenant-Id: ${PLATFORM_TENANT_ID})`);
  console.log(`   Categories: ${categories.length}`);
  console.log(`   Products: ${products.length}`);
  console.log(`   Payment Methods: 6`);
  console.log(`   Templates: 5`);
  console.log(`   Stock items: ${stockEntries.length}`);
  console.log(`   Stock items: ${stockEntries.length}`);

  await systemConn.close();
  process.exit(0);
}

const runSeed = process.argv.includes('--prod') ? seedProd : seedDemo;

runSeed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
