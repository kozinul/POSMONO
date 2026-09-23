import 'dotenv/config';
import mongoose from 'mongoose';
import { TemplateSchema } from '../core/template/infrastructure/persistence/schemas/TemplateSchema';
import { injectModifierNodes } from '../core/template/application/modifierNodeInjector';

const DOC_TYPES = ['receipt', 'kot'];

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('[inject-modifier-node] MONGO_URI not set. Add it to backend/.env');
    process.exit(1);
  }
  const dryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';

  await mongoose.connect(uri);
  console.log(`[inject-modifier-node] Connected: ${uri.replace(/\/\/.*@/, '//***@')}`);
  if (dryRun) console.log('[inject-modifier-node] DRY RUN — no writes will be performed.');

  const Template = mongoose.model('Template', TemplateSchema) as mongoose.Model<any>;

  const templates = await Template.find({ documentType: { $in: DOC_TYPES } })
    .select({ tenantId: 1, name: 1, documentType: 1, sections: 1 })
    .lean()
    .exec();

  console.log(`[inject-modifier-node] Scanned ${templates.length} receipt/kot template(s).`);

  const ops: any[] = [];
  let skippedNoItems = 0;
  for (const t of templates as any[]) {
    const { sections, injected, itemRepeaters } = injectModifierNodes(t.sections);
    if (itemRepeaters === 0) {
      skippedNoItems += 1;
      console.log(`[inject-modifier-node]   ! "${t.name}" (${t.documentType}) has no items repeater — skipped`);
      continue;
    }
    if (injected === 0) {
      console.log(`[inject-modifier-node]   = "${t.name}" (${t.documentType}) already has a modifier line`);
      continue;
    }
    console.log(`[inject-modifier-node]   + "${t.name}" (${t.documentType}) → ${injected} item repeater(s) updated`);
    ops.push({
      updateOne: {
        filter: { _id: t._id },
        update: { $set: { sections } },
      },
    });
  }

  if (dryRun) {
    console.log(`[inject-modifier-node] DRY RUN complete. ${ops.length} template(s) would be updated, ${skippedNoItems} skipped.`);
    await mongoose.disconnect();
    return;
  }

  if (ops.length === 0) {
    console.log('[inject-modifier-node] Nothing to do.');
  } else {
    const res = await Template.bulkWrite(ops, { ordered: false });
    console.log(`[inject-modifier-node] Updated ${res.modifiedCount} template(s); ${skippedNoItems} skipped.`);
  }

  await mongoose.disconnect();
  console.log('[inject-modifier-node] Done.');
}

main().catch((err) => {
  console.error('[inject-modifier-node] Failed:', err);
  process.exit(1);
});
