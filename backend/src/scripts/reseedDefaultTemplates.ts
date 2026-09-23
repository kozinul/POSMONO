import 'dotenv/config';
import mongoose from 'mongoose';
import { TemplateSchema } from '../core/template/infrastructure/persistence/schemas/TemplateSchema';
import { DocumentSection, PaperPreset } from '../core/document-engine/types';
import { DEFAULT_TEMPLATES } from '../core/platform/defaults/templates';

function receiptSectionsFor(name: string): { sections: DocumentSection[]; paper: PaperPreset; description: string } {
  const def = DEFAULT_TEMPLATES.find((t) => t.name === name);
  const main = DEFAULT_TEMPLATES[0];
  return {
    sections: def?.sections ?? main.sections ?? [],
    paper: def?.paper ?? main.paper,
    description: def?.description ?? '',
  };
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('[reseed-templates] MONGO_URI not set. Add it to backend/.env');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log(`[reseed-templates] Connected: ${uri.replace(/\/\/.*@/, '//***@')}`);

  const Template = mongoose.model('Template', TemplateSchema) as mongoose.Model<any>;

  const KNOWN_DEFAULT_NAMES = DEFAULT_TEMPLATES.map((t) => t.name);

  const allTemplates = await Template.find({ documentType: { $in: ['receipt', 'kot'] } })
    .select({ tenantId: 1, name: 1, documentType: 1 })
    .lean()
    .exec();

  const tenantIds = [...new Set((allTemplates as any[]).map((t) => t.tenantId))];
  console.log(`[reseed-templates] Default document templates found across ${tenantIds.length} tenant(s).`);

  // Templates with legacy/canonical default names are ours; safe to repair in place.
  const repairNames = [...KNOWN_DEFAULT_NAMES, 'Standard Receipt 80mm'];

  const ops: any[] = [];
  for (const tenantId of tenantIds) {
    const tenantTemplates = (allTemplates as any[]).filter((t) => t.tenantId === tenantId);
    const byName = new Map(tenantTemplates.map((t) => [t.name, t]));

    const touched = new Set<string>();
    for (const name of repairNames) {
      const existing = byName.get(name);
      if (!existing) continue;
      const { sections, paper, description } = receiptSectionsFor(
        DEFAULT_TEMPLATES.some((t) => t.name === name) ? name : 'Struk Kasir Default',
      );
      ops.push({
        updateOne: {
          filter: { _id: existing._id },
          update: { $set: { sections, paper, description } },
        },
      });
      touched.add(name);
    }

    const receiptTemplates = tenantTemplates.filter((t) => t.documentType === 'receipt');
    const needsReceiptDefault = !receiptTemplates.some((t) => t.isDefault);
    const hasMain = byName.has('Struk Kasir Default');
    if (!hasMain) {
      const { sections, paper, description } = receiptSectionsFor('Struk Kasir Default');
      const id = `${tenantId}_${Date.now()}${Math.random().toString(16).slice(2, 6)}_struk-default`;
      ops.push({
        insertOne: {
          document: {
            _id: id,
            tenantId,
            name: 'Struk Kasir Default',
            description,
            schemaVersion: 1,
            documentType: 'receipt',
            paper,
            sections,
            metadata: {},
            isActive: true,
            isDefault: needsReceiptDefault || receiptTemplates.length === 0,
          },
        },
      });
      touched.add('Struk Kasir Default');
    }
    void touched;
  }

  if (ops.length === 0) {
    console.log('[reseed-templates] Nothing to do.');
  } else {
    const res = await Template.bulkWrite(ops, { ordered: false });
    console.log(
      `[reseed-templates] Upserted default document templates: ${res.modifiedCount} modified, ${res.upsertedCount} inserted.`,
    );
  }

  await mongoose.disconnect();
  console.log('[reseed-templates] Done.');
}

main().catch((err) => {
  console.error('[reseed-templates] Failed:', err);
  process.exit(1);
});