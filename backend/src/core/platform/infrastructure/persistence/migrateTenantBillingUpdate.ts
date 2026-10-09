import type { Model } from 'mongoose';
import { PERMISSIONS } from '@posmono/shared';

const { SETTINGS_BILLING_UPDATE } = PERMISSIONS;

export interface TenantBillingUpdateMigrationResult {
  matched: number;
  modified: number;
}

/**
 * Member Area Langganan — the merchant self-pay endpoint is guarded by
 * `settings.billing.update`, but OWNER_PERMS shipped without it, so every
 * "Bayar / Simulasi" button 403'd. Stored Owner roles need the permission
 * appended on boot; Manager intentionally keeps read-only billing.
 *
 * Idempotent and safe to run on every boot: `$addToSet` skips roles that
 * already carry the permission.
 */
export async function migrateTenantBillingUpdate(
  RoleModel: Model<any>,
): Promise<TenantBillingUpdateMigrationResult> {
  const result = await RoleModel.updateMany(
    {
      name: { $in: ['Owner', 'owner'] },
      permissions: { $ne: SETTINGS_BILLING_UPDATE },
    },
    {
      $addToSet: { permissions: SETTINGS_BILLING_UPDATE },
    },
  );

  return { matched: result.matchedCount, modified: result.modifiedCount };
}
