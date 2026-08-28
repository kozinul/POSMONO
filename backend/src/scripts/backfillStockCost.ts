import 'dotenv/config';
import mongoose from 'mongoose';
import { StockSchema } from '../core/inventory/infrastructure/persistence/schemas/StockSchema';
import { StockMovementSchema } from '../core/inventory/infrastructure/persistence/schemas/StockMovementSchema';

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('[backfill] MONGO_URI not set. Add it to backend/.env');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log(`[backfill] Connected: ${uri.replace(/\/\/.*@/, '//***@')}`);

  const Stock = mongoose.model('Stock', StockSchema) as mongoose.Model<any>;
  const Movement = mongoose.model('StockMovement', StockMovementSchema) as mongoose.Model<any>;

  const stockRes = await Stock.updateMany(
    { costPrice: { $exists: false } },
    { $set: { costPrice: 0 } },
  );
  console.log(`[backfill] stock_items costPrice=0: ${stockRes.modifiedCount} doc updated.`);

  const movRes = await Movement.updateMany(
    { unitCost: { $exists: false } },
    { $set: { unitCost: 0 } },
  );
  console.log(`[backfill] stock_movements unitCost=0: ${movRes.modifiedCount} doc updated.`);

  await mongoose.disconnect();
  console.log('[backfill] Done.');
}

main().catch((err) => {
  console.error('[backfill] Failed:', err);
  process.exit(1);
});