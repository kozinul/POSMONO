import type { Model } from 'mongoose';
import { HUB_STATUSES, type HubStatus } from '../../domain/Hub';
import { HUB_CODE_MAX_LENGTH, normalizeHubCode } from '../../domain/hubCode';

export interface HubIdentityMigrationResult {
  scanned: number;
  codeBackfilled: number;
  statusBackfilled: number;
}

/**
 * Hub V2 Fase 18 — give stored hubs a `code` and a `status`.
 *
 * Hubs created before Fase 18 have only `name`, `description` and `isActive`.
 * Two things make the backfill non-trivial:
 *
 * 1. **Codes can collide.** `code` is derived from `name`, and names are only
 *    unique as typed — "Kopi Group" and "Kopi  Group" both normalise to
 *    `KOPI-GROUP`. A backfill that ignored this would either fail the unique
 *    index or, worse, leave two hubs claiming one code. Collisions get a numeric
 *    suffix, and the losers are recorded so the platform admin can rename them.
 * 2. **A name can normalise to nothing** (emoji/punctuation only), so the code
 *    falls back to the hub id — still unique, still valid, and obviously
 *    provisional so nobody ships it as a brand.
 *
 * Idempotent and safe on every boot: hubs that already have `code` and a valid
 * `status` are left untouched, so re-running it is a no-op.
 */
export async function migrateHubIdentity(HubModel: Model<any>): Promise<HubIdentityMigrationResult> {
  const docs = await HubModel.find({}, { _id: 1, name: 1, code: 1, status: 1, isActive: 1 }).lean().exec();

  const takenCodes = new Set<string>();
  const updates: { filter: Record<string, unknown>; update: Record<string, unknown> }[] = [];
  let codeBackfilled = 0;
  let statusBackfilled = 0;

  for (const doc of docs as Array<{
    _id: string;
    name?: string;
    code?: string | null;
    status?: string | null;
    isActive?: boolean | null;
  }>) {
    const update: Record<string, unknown> = {};

    const storedStatus = doc.status ?? null;
    const status: HubStatus =
      storedStatus && (HUB_STATUSES as readonly string[]).includes(storedStatus)
        ? (storedStatus as HubStatus)
        : doc.isActive === false
          ? 'suspended'
          : 'active';
    if (status !== storedStatus) {
      update.status = status;
      statusBackfilled += 1;
    }

    const storedCode = doc.code ? normalizeHubCode(doc.code) : '';
    if (!storedCode) {
      const code = uniqueCode(normalizeHubCode(doc.name ?? '') || `HUB-${doc._id}`, takenCodes);
      update.code = code;
      takenCodes.add(code);
      codeBackfilled += 1;
    } else {
      takenCodes.add(storedCode);
    }

    if (Object.keys(update).length > 0) {
      updates.push({ filter: { _id: doc._id }, update });
    }
  }

  for (const { filter, update } of updates) {
    await HubModel.updateOne(filter, { $set: update });
  }

  return { scanned: docs.length, codeBackfilled, statusBackfilled };
}

/**
 * A code that is free: the preferred one, else `PREFERRED-2`, `PREFERRED-3`, …
 * The suffix is appended *inside* the length budget so a truncated base still
 * leaves room for it.
 */
function uniqueCode(preferred: string, taken: Set<string>): string {
  if (!taken.has(preferred)) return preferred;

  const stem = preferred.slice(0, HUB_CODE_MAX_LENGTH - 4);
  let suffix = 2;
  let candidate = `${stem}-${suffix}`;
  while (taken.has(candidate)) {
    suffix += 1;
    candidate = `${stem}-${suffix}`;
  }
  return candidate;
}