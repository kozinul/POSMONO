import type { Model } from 'mongoose';
import { PERMISSIONS } from '@posmono/shared';

const { PLATFORM_HUBS_MANAGE } = PERMISSIONS;

/** Permission string that the platform super-admin used to carry before Hub V2 Fase 16. */
export const LEGACY_PLATFORM_HUB_PERMISSION = 'hub:manage';

export interface HubPermissionMigrationResult {
  matched: number;
  modified: number;
}

/**
 * Hub V2 Fase 16 — rename the platform hub permission in stored `Role` documents.
 *
 * `hub:manage` mixed a platform-level capability (Terminal Center) with the
 * `hub.*` namespace that Fase 16 reserved for hub-side admin (ADR D1 tahap 2).
 * Renaming it in code alone is not enough: permissions are persisted in the
 * `roles` collection, so every role that still carries the legacy string would
 * silently lose hub access — and platform super admins would get 403 on
 * `/api/hubs` until they re-login (permissions are embedded in the JWT).
 *
 * Idempotent and safe to run on every boot: it only touches roles that actually
 * contain the legacy string, keeps any other permission untouched, and adds the
 * new permission without duplicates. Custom roles that intentionally held
 * `hub:manage` are migrated too — in practice only the platform role used it.
 */
export async function migratePlatformHubPermissions(
  RoleModel: Model<any>,
): Promise<HubPermissionMigrationResult> {
  // `$pull` and `$addToSet` cannot target the same field in one update
  // (Mongo rejects it with code 40 "would create a conflict"), so the array is
  // rewritten through an aggregation pipeline: drop the legacy entry, then union
  // the new one — `$setUnion` also collapses the case where both are present.
  const result = await RoleModel.updateMany(
    { permissions: LEGACY_PLATFORM_HUB_PERMISSION },
    [
      {
        $set: {
          permissions: {
            $setUnion: [
              {
                $filter: {
                  input: { $ifNull: ['$permissions', []] },
                  cond: { $ne: ['$$this', LEGACY_PLATFORM_HUB_PERMISSION] },
                },
              },
              [PLATFORM_HUBS_MANAGE],
            ],
          },
        },
      },
    ],
  );

  return { matched: result.matchedCount, modified: result.modifiedCount };
}
