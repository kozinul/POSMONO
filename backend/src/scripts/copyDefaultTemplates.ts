import 'dotenv/config';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { TemplateSchema } from '../core/template/infrastructure/persistence/schemas/TemplateSchema';
import { TenantSchema } from '../core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { UserSchema } from '../core/identity/infrastructure/persistence/schemas/UserSchema';
import { DEFAULT_TEMPLATES } from '../core/platform/defaults/templates';

/**
 * Copy DEFAULT_TEMPLATES onto existing tenants that don't have them yet.
 *
 * Usage:
 *   pnpm copy:templates                     # every tenant lacking defaults
 *   pnpm copy:templates -- --tenant=<id>    # one tenant by id
 *   pnpm copy:templates -- --owner=<email>  # tenant of the given owner email
 *   pnpm copy:templates -- --dry-run        # report only, no writes
 *
 * Only templates whose (tenantId, name) are missing get inserted; existing
 * templates are left untouched. isDefault is set from the default definition
 * (and cleared from other same-documentType templates, matching TemplateService).
 */
async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('[copy-templates] MONGO_URI not set. Add it to backend/.env');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const tenantArg = args.find((a) => a.startsWith('--tenant='))?.split('=')[1];
  const ownerArg = args.find((a) => a.startsWith('--owner='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');

  await mongoose.connect(uri);
  console.log(`[copy-templates] Connected: ${uri.replace(/\/\/.*@/, '//***@')}`);

  const Template = mongoose.model('Template', TemplateSchema) as mongoose.Model<any>;
  const Tenant = mongoose.model('Tenant', TenantSchema) as mongoose.Model<any>;
  const UserModel = mongoose.model('User', UserSchema) as mongoose.Model<any>;

  let tenantIds: string[] = [];
  if (tenantArg) {
    tenantIds = [tenantArg];
  } else if (ownerArg) {
    const owner = (await UserModel.findOne({ email: ownerArg.trim().toLowerCase() }).lean().exec()) as
      | { tenantId?: string }
      | null;
    if (!owner || !owner.tenantId) {
      console.error(`[copy-templates] No user found with email "${ownerArg}" (or user has no tenantId)`);
      await mongoose.disconnect();
      process.exit(1);
    }
    tenantIds = [owner.tenantId];
    console.log(`[copy-templates] Owner "${ownerArg}" → tenantId ${owner.tenantId}`);
  } else {
    const tenants = await Tenant.find().select({ _id: 1 }).lean().exec();
    tenantIds = (tenants as any[]).map((t) => t._id as string);
  }

  if (tenantIds.length === 0) {
    console.log('[copy-templates] No tenants to process.');
    await mongoose.disconnect();
    return;
  }

  const existingDocs = (await Template.find({ tenantId: { $in: tenantIds } })
    .select({ tenantId: 1, name: 1, documentType: 1, isDefault: 1 })
    .lean()
    .exec()) as any[];

  const byTenantName = new Map<string, Set<string>>();
  for (const doc of existingDocs) {
    const set = byTenantName.get(doc.tenantId) ?? new Set<string>();
    set.add(doc.name);
    byTenantName.set(doc.tenantId, set);
  }

  const ops: any[] = [];
  let insertCount = 0;

  for (const tenantId of tenantIds) {
    const existingNames = byTenantName.get(tenantId) ?? new Set<string>();
    for (const def of DEFAULT_TEMPLATES) {
      if (existingNames.has(def.name)) continue;

      // Keep single default per documentType (clear others of same type).
      if (def.isDefault) {
        const sameType = existingDocs.find(
          (d) => d.tenantId === tenantId && d.documentType === def.documentType && d.isDefault,
        );
        if (sameType) ops.push({ updateOne: { filter: { _id: sameType._id }, update: { $set: { isDefault: false } } } });
      }

      ops.push({
        insertOne: {
          document: {
            _id: `${tenantId}_${uuidv4().slice(0, 8)}_${def.documentType}-${Math.random().toString(16).slice(2, 6)}`,
            tenantId,
            name: def.name,
            description: def.description,
            schemaVersion: 1,
            documentType: def.documentType,
            paper: def.paper,
            sections: def.sections ?? [],
            metadata: {
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              version: 1,
              createdBy: 'copy-templates',
            },
            isActive: true,
            isDefault: def.isDefault ?? false,
          },
        },
      });
      insertCount += 1;
    }
  }

  if (insertCount === 0) {
    console.log(`[copy-templates] Nothing to do for ${tenantIds.length} tenant(s) — defaults already present.`);
  } else if (dryRun) {
    console.log(`[copy-templates] DRY-RUN: would insert ${insertCount} template(s) across ${tenantIds.length} tenant(s).`);
  } else {
    const res = await Template.bulkWrite(ops, { ordered: false });
    console.log(`[copy-templates] Inserted ${res.insertedCount} template(s) across ${tenantIds.length} tenant(s).`);
  }

  await mongoose.disconnect();
  console.log('[copy-templates] Done.');
}

main().catch((err) => {
  console.error('[copy-templates] Failed:', err);
  process.exit(1);
});