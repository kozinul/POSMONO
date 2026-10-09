import type { Model } from 'mongoose';
import { PERMISSIONS } from '@posmono/shared';

const { SETTINGS_BILLING_READ } = PERMISSIONS;

export interface TenantBillingPermissionMigrationResult {
  matched: number;
  modified: number;
}

/**
 * Member Area Langganan — ensure tenant Owner and Manager roles have
 * `settings.billing.read` in stored `Role` documents.
 *
 * Idempotent and safe to run on every boot: uses `$addToSet` to append
 * `settings.billing.read` to roles whose name is Owner or Manager.
 */
export async function migrateTenantBillingRead(
  RoleModel: Model<any>,
): Promise<TenantBillingPermissionMigrationResult> {
  const result = await RoleModel.updateMany(
    {
      name: { $in: ['Owner', 'Manager', 'owner', 'manager'] },
      permissions: { $ne: SETTINGS_BILLING_READ },
    },
    {
      $addToSet: { permissions: SETTINGS_BILLING_READ },
    },
  );

  return { matched: result.matchedCount, modified: result.modifiedCount };
}
