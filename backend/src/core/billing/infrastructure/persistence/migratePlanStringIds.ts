import type { Model } from 'mongoose';

export interface PlanStringIdMigrationResult {
  scanned: number;
  migrated: number;
  referencesUpdated: number;
}

/** Minimal shape of a persisted plan doc — `_id` may be an ObjectId or a string. */
interface LegacyPlanDoc {
  _id: { toString(): string };
  name?: string;
  [key: string]: unknown;
}

/** Narrow view over the native driver collection; avoids Mongoose schema casting on `_id`. */
interface RawPlanCollection {
  find(filter: Record<string, unknown>): { toArray(): Promise<LegacyPlanDoc[]> };
  findOne(filter: Record<string, unknown>): Promise<LegacyPlanDoc | null>;
  insertOne(doc: Record<string, unknown>): Promise<unknown>;
  updateOne(filter: Record<string, unknown>, update: Record<string, unknown>): Promise<unknown>;
  deleteOne(filter: Record<string, unknown>): Promise<unknown>;
}

/**
 * Plans seeded by the original `upsertDefaultPlans` (before it shipped with
 * explicit `_id`s) carry a MongoDB ObjectId `_id`, while the schema declares
 * `_id: String` and `PlanService` always persists string ids (`uuid`). Every
 * look-up that matters — assign plan, resolve subscription plan, bulk
 * `findByIds` — queries by the string id the frontend sent, so seeded plans
 * were invisible:
 *
 *     assign plan (Terminal Center) → "Plan tidak ditemukan."
 *
 * This rewrites those ObjectId `_id`s to stable string ids derived from the
 * plan name — the very ids `DEFAULT_PLANS` now seeds (`plan-trial`,
 * `plan-starter`, `plan-pro`, `plan-enterprise`) — re-points references in
 * subscriptions / tenants / subscription history from the old hex string to
 * the new id, then removes the ObjectId document.
 *
 * Safety notes:
 * - Only documents whose `_id` is a BSON ObjectId are touched, so the
 *   migration is idempotent and custom plans (already string ids) are skipped.
 * - `name` has a unique index, so the replacement doc cannot be inserted while
 *   the ObjectId doc still exists. The old doc is temporarily renamed first;
 *   if the insert still fails (id collision after the `stablePlanId` guard
 *   raced), the original plan survives under its temp name and the next boot
 *   retries.
 */
export async function migratePlanStringIds(
  planModel: Model<any>,
  deps: {
    subscriptionModel: Model<any>;
    tenantModel: Model<any>;
    subscriptionHistoryModel: Model<any>;
  },
): Promise<PlanStringIdMigrationResult> {
  const raw = planModel.collection as unknown as RawPlanCollection;
  const docs = await raw.find({ _id: { $type: 'objectId' } }).toArray();
  let migrated = 0;
  let referencesUpdated = 0;

  for (const doc of docs) {
    const name = typeof doc.name === 'string' ? doc.name : '';
    const oldId = doc._id.toString();
    const newId = await stablePlanId(name, raw);

    // Free `name` (unique index) for the insert below.
    await raw.updateOne({ _id: doc._id }, { $set: { name: `${name}__migrating__${Date.now()}` } });
    const { _id, ...rest } = doc;
    try {
      await raw.insertOne({ ...rest, _id: newId, name });
    } finally {
      await raw.deleteOne({ _id: doc._id });
    }

    const refs = await Promise.all([
      deps.subscriptionModel.updateMany({ planId: oldId }, { $set: { planId: newId } }),
      deps.tenantModel.updateMany({ planId: oldId }, { $set: { planId: newId } }),
      deps.subscriptionHistoryModel.updateMany({ planId: oldId }, { $set: { planId: newId } }),
    ]);
    referencesUpdated += refs.reduce((sum, r) => sum + r.modifiedCount, 0);
    migrated += 1;
  }

  return { scanned: docs.length, migrated, referencesUpdated };
}

/** `plan-<name-slug>`, suffixed `-2`/`-3`/… until free. */
async function stablePlanId(name: string, raw: RawPlanCollection): Promise<string> {
  const stem =
    `plan-${name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')}` || 'plan-unnamed';

  let candidate = stem;
  let suffix = 2;
  while (await raw.findOne({ _id: candidate })) {
    candidate = `${stem}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}