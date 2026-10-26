import type { Model } from 'mongoose';
import { KDS_PERMS, KDS_ROLE_NAME } from '../../defaults/roles';

interface TenantRow {
  _id: string;
}

/**
 * Existing tenants were provisioned before the KDS role existed. Seed it at
 * boot so operators can assign it from the Users screen without a manual DB
 * step, and add the KDS permissions to stored Owner/Manager roles (their JWT
 * permissions are snapshotted at login, so they must re-login to see them).
 */
export async function migrateKdsRole(
  RoleModel: Model<any>,
  TenantModel: Model<any>,
): Promise<{ modified: number; created: number }> {
  const owners = await RoleModel.updateMany(
    {
      name: { $in: ['Owner', 'owner', 'Manager', 'manager'] },
      // Guard so a second boot is a true no-op (Mongoose timestamps would
      // otherwise mark every matched role as modified).
      $or: [
        { permissions: { $ne: KDS_PERMS[0] } },
        { permissions: { $ne: KDS_PERMS[1] } },
      ],
    },
    { $addToSet: { permissions: { $each: KDS_PERMS } } },
  );

  const tenants = await TenantModel.find({}, { _id: 1 }).lean<TenantRow[]>();
  let created = 0;
  for (const tenant of tenants) {
    const result = await RoleModel.updateOne(
      { tenantId: tenant._id, name: KDS_ROLE_NAME },
      {
        $setOnInsert: {
          _id: `role_kds_${tenant._id}`,
          tenantId: tenant._id,
          name: KDS_ROLE_NAME,
          description: 'Kitchen/Bar Display only — no dashboard or POS access',
          permissions: KDS_PERMS,
          isSystem: true,
        },
      },
      { upsert: true },
    );
    if (result.upsertedCount > 0) created += 1;
  }

  return { modified: owners.modifiedCount, created };
}
