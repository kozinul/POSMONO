import mongoose from 'mongoose';

const INDEX_NAME = 'tenantId_1_code_1';

export async function ensurePromotionIndexes(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;

  try {
    const coll = db.collection('promotions');
    const exists = await coll.indexExists(INDEX_NAME).catch(() => false);
    if (exists) {
      await coll.dropIndex(INDEX_NAME).catch(() => {});
    }
    await coll
      .createIndex({ tenantId: 1, code: 1 }, { unique: true, partialFilterExpression: { code: { $type: 'string' } } })
      .catch(() => {});
  } catch {
    // ignore: fresh DB may not have the collection yet; mongoose autoIndex will create indexes
  }
}
