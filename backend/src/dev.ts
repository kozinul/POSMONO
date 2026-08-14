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

  const roleDocs = [
    {
      _id: adminRoleId, name: 'Owner',
      description: 'Full access to all features',
      permissions: [
        'users:read', 'users:write', 'users:delete',
        'roles:read', 'roles:write',
        'products:read', 'products:write', 'products:delete',
        'orders:read', 'orders:write', 'orders:cancel',
        'order:void', 'payment:void',
        'payments:read', 'payments:write',
        'inventory:read', 'inventory:write', 'inventory:adjust',
        'reports:read',
        'customers:read', 'customers:write',
        'settings:read', 'settings:write',
        'shifts:read', 'shifts:write',
        'printers:read', 'printers:write',
      ],
      isSystem: true,
    },
    {
      _id: managerRoleId, name: 'Manager',
      description: 'Daily operations management',
      permissions: [
        'products:read', 'products:write',
        'orders:read', 'orders:write', 'orders:cancel',
        'order:void', 'payment:void',
        'payments:read', 'payments:write',
        'inventory:read', 'inventory:write',
        'reports:read',
        'customers:read', 'customers:write',
        'settings:read',
        'shifts:read', 'shifts:write',
        'printers:read', 'printers:write',
      ],
      isSystem: true,
    },
    {
      _id: cashierRoleId, name: 'Cashier',
      description: 'Can process POS transactions',
      permissions: [
        'products:read',
        'orders:read', 'orders:write',
        'payments:read',
        'customers:read', 'customers:write',
        'shifts:read', 'shifts:write',
      ],
      isSystem: true,
    },
  ];

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

  await PaymentMethodModel.create([
    {
      _id: id('pmt'), tenantId,
      name: 'Tunai', code: 'cash',
      description: 'Pembayaran tunai',
      icon: '💵', color: '#4CAF50',
      sortOrder: 1, isActive: true, requiresReference: false, config: {},
    },
    {
      _id: id('pmt'), tenantId,
      name: 'QRIS', code: 'qris',
      description: 'QRIS / Scan QR',
      icon: '📱', color: '#2196F3',
      sortOrder: 2, isActive: true, requiresReference: true, config: {},
    },
    {
      _id: id('pmt'), tenantId,
      name: 'Kartu Debit', code: 'debit',
      description: 'Kartu debit Visa/Mastercard',
      icon: '💳', color: '#FF9800',
      sortOrder: 3, isActive: true, requiresReference: true, config: {},
    },
    {
      _id: id('pmt'), tenantId,
      name: 'Kartu Kredit', code: 'credit',
      description: 'Kartu kredit Visa/Mastercard',
      icon: '💎', color: '#9C27B0',
      sortOrder: 4, isActive: true, requiresReference: true, config: {},
    },
    {
      _id: id('pmt'), tenantId,
      name: 'Transfer Bank', code: 'transfer',
      description: 'Transfer BCA / Mandiri / BRI / BNI',
      icon: '🏦', color: '#607D8B',
      sortOrder: 5, isActive: true, requiresReference: true, config: {},
    },
    {
      _id: id('pmt'), tenantId,
      name: 'E-Wallet', code: 'ewallet',
      description: 'GoPay / OVO / Dana / ShopeePay',
      icon: '📲', color: '#00BCD4',
      sortOrder: 6, isActive: true, requiresReference: true, config: {},
    },
  ]);

  const receiptSections = [
    { id: 'sec-header', type: 'header', enabled: true, order: 1, nodes: [
      { id: 'r1', type: 'image', field: 'store.logo', maxHeight: 12, style: { font: { align: 'center' } }, visibility: { operator: 'AND', rules: [{ field: 'store.logo', operator: 'exists' }] } },
      { id: 'r2', type: 'field', field: 'store.name', style: { font: { size: 14, weight: 'bold', align: 'center' } } },
      { id: 'r3', type: 'text', text: 'Pesanan {{ order.documentNumber }}', style: { font: { align: 'center' } } },
      { id: 'r4', type: 'text', text: '{{ order.date }} {{ order.time }}', style: { font: { align: 'center' } } },
      { id: 'r4b', type: 'text', text: 'Kasir: {{ order.cashier }}', style: { font: { align: 'center' } } },
      { id: 'r5', type: 'divider', style: {} },
    ]},
    { id: 'sec-items', type: 'items', enabled: true, order: 2, nodes: [
      { id: 'r6', type: 'repeater', dataSource: 'items', template: [
        { id: 'r7', type: 'text', text: '{{ item.qty }}x {{ item.name }} ... Rp {{ item.totalPrice | number(0) }}', style: { font: { size: 10 } } },
      ]},
    ]},
    { id: 'sec-promo', type: 'summary', enabled: true, order: 3, nodes: [
      { id: 'r8', type: 'repeater', dataSource: 'promotions', template: [
        { id: 'r9', type: 'text', text: '{{ item.name }} ({{ item.code }})', style: { font: { size: 10 } } },
      ], visibility: { operator: 'AND', rules: [{ field: 'summary.orderDiscount', operator: 'greater_than', value: 0 }] } },
      { id: 'r10', type: 'text', text: 'Total Diskon  -Rp {{ summary.orderDiscount | number(0) }}', style: { font: { size: 10 } }, visibility: { operator: 'AND', rules: [{ field: 'summary.orderDiscount', operator: 'greater_than', value: 0 }] } },
    ]},
    { id: 'sec-summary', type: 'summary', enabled: true, order: 4, nodes: [
      { id: 'r11', type: 'divider', style: {} },
      { id: 'r12', type: 'text', text: 'Subtotal  Rp {{ summary.subtotal | number(0) }}', style: {} },
      { id: 'r13', type: 'text', text: 'Service Charge  Rp {{ summary.serviceCharge | number(0) }}', style: {}, visibility: { operator: 'AND', rules: [{ field: 'summary.serviceCharge', operator: 'greater_than', value: 0 }] } },
      { id: 'r14', type: 'text', text: 'Tax  Rp {{ summary.tax | number(0) }}', style: {}, visibility: { operator: 'AND', rules: [{ field: 'summary.tax', operator: 'greater_than', value: 0 }] } },
      { id: 'r15', type: 'text', text: 'Pembulatan  Rp {{ summary.rounding | number(0) }}', style: {}, visibility: { operator: 'AND', rules: [{ field: 'summary.rounding', operator: 'not_equals', value: 0 }] } },
      { id: 'r16', type: 'divider', style: {} },
      { id: 'r17', type: 'text', text: 'TOTAL  Rp {{ summary.grandTotal | number(0) }}', style: { font: { size: 12, weight: 'bold' } } },
      { id: 'r18', type: 'text', text: 'Tunai  Rp {{ payments.0.paidAmount | number(0) }}', style: {} },
      { id: 'r19', type: 'text', text: 'Kembalian  Rp {{ payments.0.change | number(0) }}', style: {} },
    ]},
    { id: 'sec-footer', type: 'footer', enabled: true, order: 5, nodes: [
      { id: 'r20', type: 'divider', style: {} },
      { id: 'r21', type: 'text', text: 'Terima kasih telah berbelanja', style: { font: { align: 'center' } } },
    ]},
  ];

  const kotSections = [
    { id: 'sec-header', type: 'header', enabled: true, order: 1, nodes: [
      { id: 'n1', type: 'field', field: 'store.name', style: { font: { size: 14, weight: 'bold', align: 'center' } } },
      { id: 'n2', type: 'divider', style: {} },
    ]},
    { id: 'sec-order', type: 'order_info', enabled: true, order: 2, nodes: [
      { id: 'n3', type: 'text', text: 'KOT #{{ order.referenceNumber }}', style: { font: { size: 12, weight: 'bold' } } },
      { id: 'n4', type: 'field', field: 'order.table', label: 'Table', style: {} },
    ]},
    { id: 'sec-items', type: 'items', enabled: true, order: 3, nodes: [
      { id: 'n5', type: 'repeater', dataSource: 'items', template: [
        { id: 'n6', type: 'text', text: '{{ item.qty }}x {{ item.name }}', style: { font: { size: 10 } } },
      ]},
    ]},
    { id: 'sec-footer', type: 'footer', enabled: true, order: 4, nodes: [
      { id: 'n7', type: 'divider', style: {} },
      { id: 'n8', type: 'text', text: '{{ order.date }} {{ order.time }}', style: { font: { align: 'center' } } },
    ]},
  ];

  const invoiceSections = [
    { id: 'sec-header', type: 'header', enabled: true, order: 1, nodes: [
      { id: 'n1', type: 'field', field: 'store.name', style: { font: { size: 18, weight: 'bold', align: 'center' } } },
      { id: 'n2', type: 'field', field: 'store.address', style: { font: { align: 'center' } } },
      { id: 'n3', type: 'field', field: 'store.phone', style: { font: { align: 'center' } } },
      { id: 'n4', type: 'divider', style: {} },
    ]},
    { id: 'sec-invoice', type: 'order_info', enabled: true, order: 2, nodes: [
      { id: 'n5', type: 'field', field: 'order.documentNumber', label: 'Invoice', style: { font: { size: 12, weight: 'bold' } } },
      { id: 'n6', type: 'text', text: 'Date: {{ order.date }}', style: {} },
      { id: 'n7', type: 'field', field: 'customer.name', label: 'Customer', style: {} },
    ]},
    { id: 'sec-items', type: 'items', enabled: true, order: 3, nodes: [
      { id: 'n8', type: 'table', dataSource: 'items', columns: [
        { field: 'name', header: 'Item', align: 'left' },
        { field: 'qty', header: 'Qty', align: 'right' },
        { field: 'unitPrice', header: 'Price', align: 'right', format: 'number(0)' },
        { field: 'totalPrice', header: 'Total', align: 'right', format: 'number(0)' },
      ]},
    ]},
    { id: 'sec-summary', type: 'summary', enabled: true, order: 4, nodes: [
      { id: 'n9', type: 'field', field: 'summary.subtotal', label: 'Subtotal', format: 'number(0)', style: {} },
      { id: 'n10', type: 'field', field: 'summary.tax', label: 'Tax', format: 'number(0)', style: {} },
      { id: 'n11', type: 'divider', style: {} },
      { id: 'n12', type: 'field', field: 'summary.grandTotal', label: 'Grand Total', format: 'number(0)', style: { font: { size: 14, weight: 'bold' } } },
    ]},
    { id: 'sec-footer', type: 'footer', enabled: true, order: 5, nodes: [
      { id: 'n13', type: 'divider', style: {} },
      { id: 'n14', type: 'text', text: 'Thank you for your business!', style: { font: { align: 'center' } } },
    ]},
  ];

  await Template.create([
    {
      _id: id('tpl'),
      tenantId,
      name: 'Struk Kasir Default',
      description: 'Struk kasir default (mirror tampilan print receipt POS)',
      schemaVersion: 1,
      documentType: 'receipt',
      paper: { type: 'thermal80', width: 80, height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } },
      sections: receiptSections,
      metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1, createdBy: 'system' },
      isActive: true,
      isDefault: true,
    },
    {
      _id: id('tpl'),
      tenantId,
      name: 'Standard Receipt 58mm',
      description: 'Standard thermal receipt for 58mm paper (2-inch)',
      schemaVersion: 1,
      documentType: 'receipt',
      paper: { type: 'thermal58', width: 58, height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } },
      sections: [],
      metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1, createdBy: 'system' },
      isActive: true,
      isDefault: false,
    },
    {
      _id: id('tpl'),
      tenantId,
      name: 'Standard Receipt 80mm',
      description: 'Standard thermal receipt for 80mm paper (3-inch)',
      schemaVersion: 1,
      documentType: 'receipt',
      paper: { type: 'thermal80', width: 80, height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } },
      sections: [],
      metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1, createdBy: 'system' },
      isActive: true,
      isDefault: false,
    },
    {
      _id: id('tpl'),
      tenantId,
      name: 'Standard KOT 80mm',
      description: 'Kitchen Order Ticket for 80mm thermal paper',
      schemaVersion: 1,
      documentType: 'kot',
      paper: { type: 'thermal80', width: 80, height: 'auto', margin: { top: 2, right: 3, bottom: 2, left: 3 } },
      sections: kotSections,
      metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1, createdBy: 'system' },
      isActive: true,
    },
    {
      _id: id('tpl'),
      tenantId,
      name: 'Standard Invoice A4',
      description: 'Standard A4 invoice with line items table',
      schemaVersion: 1,
      documentType: 'invoice',
      paper: { type: 'a4-portrait', width: 210, height: 297, margin: { top: 15, right: 15, bottom: 15, left: 15 } },
      sections: invoiceSections,
      metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1, createdBy: 'system' },
      isActive: true,
    },
  ]);

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
  const OWNER_PERMS = [
    'users:read', 'users:write', 'users:delete',
    'roles:read', 'roles:write',
    'products:read', 'products:write', 'products:delete',
    'orders:read', 'orders:write', 'orders:cancel',
    'order:void', 'payment:void',
    'payments:read', 'payments:write',
    'inventory:read', 'inventory:write', 'inventory:adjust',
    'reports:read',
    'customers:read', 'customers:write',
    'settings:read', 'settings:write',
    'shifts:read', 'shifts:write',
    'printers:read', 'printers:write',
  ];
  const MANAGER_PERMS = [
    'products:read', 'products:write',
    'orders:read', 'orders:write', 'orders:cancel',
    'order:void', 'payment:void',
    'payments:read', 'payments:write',
    'inventory:read', 'inventory:write',
    'reports:read',
    'customers:read', 'customers:write',
    'settings:read',
    'shifts:read', 'shifts:write',
    'printers:read', 'printers:write',
  ];
  await RoleSync.updateOne({ tenantId: DEV_TENANT_ID, name: 'Owner' }, { $set: { permissions: OWNER_PERMS, isSystem: true } });
  await RoleSync.updateOne({ tenantId: DEV_TENANT_ID, name: 'Manager' }, { $set: { permissions: MANAGER_PERMS, isSystem: true } });

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
