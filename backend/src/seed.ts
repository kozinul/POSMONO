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

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27018';
const SYSTEM_DB = 'posmono_system';

function id(prefix: string): string {
  return `${prefix}_${uuidv4().replace(/-/g, '').substring(0, 20)}`;
}

async function seed() {
  const systemConn = mongoose.createConnection(`${MONGO_URI}/${SYSTEM_DB}`);

  await systemConn.dropDatabase();

  const Tenant = systemConn.model('Tenant', TenantSchema);
  const User = systemConn.model('User', UserSchema);
  const Role = systemConn.model('Role', RoleSchema);
  const Product = systemConn.model('Product', ProductSchema);
  const Category = systemConn.model('Category', CategorySchema);
  const Stock = systemConn.model('Stock', StockSchema);
  const PaymentMethodModel = systemConn.model('PaymentMethod', PaymentMethodSchema);

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
  await Role.create([
    {
      _id: adminRoleId,
      tenantId,
      name: 'Owner',
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
      _id: managerRoleId,
      tenantId,
      name: 'Manager',
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
      _id: cashierRoleId,
      tenantId,
      name: 'Cashier',
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
  await PaymentMethodModel.create([
    {
      _id: id('pmt'),
      tenantId,
      name: 'Tunai',
      code: 'cash',
      description: 'Pembayaran tunai',
      icon: '💵',
      color: '#4CAF50',
      sortOrder: 1,
      isActive: true,
      requiresReference: false,
      config: {},
    },
    {
      _id: id('pmt'),
      tenantId,
      name: 'QRIS',
      code: 'qris',
      description: 'QRIS / Scan QR',
      icon: '📱',
      color: '#2196F3',
      sortOrder: 2,
      isActive: true,
      requiresReference: true,
      config: {},
    },
    {
      _id: id('pmt'),
      tenantId,
      name: 'Kartu Debit',
      code: 'debit',
      description: 'Kartu debit Visa/Mastercard',
      icon: '💳',
      color: '#FF9800',
      sortOrder: 3,
      isActive: true,
      requiresReference: true,
      config: {},
    },
    {
      _id: id('pmt'),
      tenantId,
      name: 'Kartu Kredit',
      code: 'credit',
      description: 'Kartu kredit Visa/Mastercard',
      icon: '💎',
      color: '#9C27B0',
      sortOrder: 4,
      isActive: true,
      requiresReference: true,
      config: {},
    },
    {
      _id: id('pmt'),
      tenantId,
      name: 'Transfer Bank',
      code: 'transfer',
      description: 'Transfer BCA / Mandiri / BRI / BNI',
      icon: '🏦',
      color: '#607D8B',
      sortOrder: 5,
      isActive: true,
      requiresReference: true,
      config: {},
    },
    {
      _id: id('pmt'),
      tenantId,
      name: 'E-Wallet',
      code: 'ewallet',
      description: 'GoPay / OVO / Dana / ShopeePay',
      icon: '📲',
      color: '#00BCD4',
      sortOrder: 6,
      isActive: true,
      requiresReference: true,
      config: {},
    },
  ]);

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

  console.log('\n✅ Seed complete!');
  console.log(`   Tenant: toko-abc (${tenantId})`);
  console.log(`   Owner: admin@demo.com / admin123`);
  console.log(`   Cashier: cashier@demo.com / admin123`);
  console.log(`   Categories: ${categories.length}`);
  console.log(`   Products: ${products.length}`);
  console.log(`   Payment Methods: 6`);
  console.log(`   Stock items: ${stockEntries.length}`);

  await systemConn.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
