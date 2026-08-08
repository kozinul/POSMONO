import 'dotenv/config';
import mongoose from 'mongoose';
import { OrderSchema } from '../core/ordering/infrastructure/persistence/schemas/OrderSchema';
import { UserSchema } from '../core/identity/infrastructure/persistence/schemas/UserSchema';

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('[backfill] MONGO_URI not set. Add it to backend/.env');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log(`[backfill] Connected: ${uri.replace(/\/\/.*@/, '//***@')}`);

  const Order = mongoose.model('Order', OrderSchema);
  const User = mongoose.model('User', UserSchema);

  const docs = await Order.find({
    cashierName: { $in: ['', null] },
    cashierId: { $exists: true, $ne: null },
  })
    .select({ _id: 1, cashierId: 1 })
    .lean()
    .exec();

  console.log(`[backfill] Found ${docs.length} orders with empty cashierName.`);

  if (docs.length === 0) {
    await mongoose.disconnect();
    console.log('[backfill] Done, nothing to update.');
    return;
  }

  const ids = [...new Set(docs.map((d: any) => String(d.cashierId)))];
  const users = await User.find({ _id: { $in: ids } }).select({ _id: 1, displayName: 1 }).lean().exec();

  const nameById: Record<string, string> = {};
  for (const u of users as any[]) {
    nameById[String(u._id)] = u.displayName;
  }

  const ops = docs
    .filter((d: any) => nameById[String(d.cashierId)])
    .map((d: any) => ({
      updateOne: {
        filter: { _id: d._id },
        update: { $set: { cashierName: nameById[String(d.cashierId)] } },
      },
    }));

  if (ops.length === 0) {
    console.log('[backfill] No matching users found for existing cashierIds.');
  } else {
    const res = await Order.bulkWrite(ops);
    console.log(`[backfill] Updated ${res.modifiedCount} orders.`);
  }

  await mongoose.disconnect();
  console.log('[backfill] Done.');
}

main().catch((err) => {
  console.error('[backfill] Failed:', err);
  process.exit(1);
});
