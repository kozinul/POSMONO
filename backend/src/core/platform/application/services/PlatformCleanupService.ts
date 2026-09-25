import { Connection } from 'mongoose';

const TENANT_SCOPED_COLLECTIONS = [
  'categories',
  'customers',
  'daily_metrics',
  'discount_configurations',
  'families',
  'menu_types',
  'modifiers',
  'orders',
  'outlets',
  'payment_methods',
  'payments',
  'pricingprofiles',
  'printers',
  'products',
  'promo_codes',
  'promotions',
  'qris_invoices',
  'refunds',
  'roles',
  'sessions',
  'settings',
  'shifts',
  'stock_items',
  'stock_movements',
  'subscription_history',
  'subscriptions',
  'taxconfigurations',
  'template_versions',
  'templates',
  'users',
  'warehouses',
];

export interface TenantCleanupResult {
  deleted: Record<string, number>;
  totalDeleted: number;
}

export interface OutletCleanupResult {
  warehouseDeleted: number;
  outletDeleted: number;
  usersUpdated: number;
}

export class PlatformCleanupService {
  constructor(private readonly connection: Connection) {}

  private async existingCollections(): Promise<Set<string>> {
    const db = this.connection.db;
    if (!db) return new Set();
    const cols = await db.listCollections().toArray();
    return new Set(cols.map((c) => c.name));
  }

  async deleteTenantData(tenantId: string): Promise<TenantCleanupResult> {
    const existing = await this.existingCollections();
    const deleted: Record<string, number> = {};
    let totalDeleted = 0;

    const db: any = this.connection.db;
    for (const name of TENANT_SCOPED_COLLECTIONS) {
      if (!existing.has(name)) continue;
      try {
        const res = await db.collection(name).deleteMany({ tenantId });
        const count = res.deletedCount ?? 0;
        deleted[name] = count;
        totalDeleted += count;
      } catch {
        deleted[name] = -1;
      }
    }

    return { deleted, totalDeleted };
  }

  async deleteOutletData(tenantId: string, outletId: string): Promise<OutletCleanupResult> {
    const existing = await this.existingCollections();
    const result: OutletCleanupResult = { warehouseDeleted: 0, outletDeleted: 0, usersUpdated: 0 };
    const db: any = this.connection.db;

    if (existing.has('warehouses')) {
      const res = await db.collection('warehouses').deleteMany({ tenantId, outletId });
      result.warehouseDeleted = res.deletedCount ?? 0;
    }

    if (existing.has('outlets')) {
      const res = await db.collection('outlets').deleteMany({ _id: outletId, tenantId });
      result.outletDeleted = res.deletedCount ?? 0;
    }

    if (existing.has('users')) {
      const res = await db
        .collection('users')
        .updateMany({ tenantId, outletIds: outletId }, { $pull: { outletIds: outletId } });
      result.usersUpdated = res.modifiedCount ?? 0;
    }

    return result;
  }
}