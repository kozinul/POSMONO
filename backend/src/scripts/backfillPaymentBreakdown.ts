import 'dotenv/config';
import mongoose from 'mongoose';
import { OrderSchema } from '../core/ordering/infrastructure/persistence/schemas/OrderSchema';
import { PaymentSchema } from '../core/payment/infrastructure/persistence/schemas/PaymentSchema';

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('[backfill] MONGO_URI not set. Add it to backend/.env');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log(`[backfill] Connected: ${uri.replace(/\/\/.*@/, '//***@')}`);

  const Order = mongoose.model('Order', OrderSchema) as mongoose.Model<any>;
  const Payment = mongoose.model('Payment', PaymentSchema) as mongoose.Model<any>;

  const docs = await Order.find({
    status: { $in: ['paid', 'completed'] },
    $or: [{ paymentBreakdown: { $exists: false } }, { paymentBreakdown: { $size: 0 } }],
  })
    .select({ _id: 1, roundedPayable: 1, total: 1, roundingAdjustment: 1 })
    .lean()
    .exec();

  console.log(`[backfill] Found ${docs.length} paid orders with empty paymentBreakdown.`);

  if (docs.length === 0) {
    await mongoose.disconnect();
    console.log('[backfill] Done, nothing to update.');
    return;
  }

  const ids = docs.map((d: any) => String(d._id));
  const payments = await Payment.find({ orderId: { $in: ids }, status: 'completed' })
    .select({ orderId: 1, method: 1, amount: 1, referenceNumber: 1, cardLastFour: 1 })
    .lean()
    .exec();

  const byOrder = new Map<string, any[]>();
  for (const p of payments as any[]) {
    const key = String(p.orderId);
    const arr = byOrder.get(key) ?? [];
    arr.push(p);
    byOrder.set(key, arr);
  }

  const ops = [];
  for (const d of docs as any[]) {
    const orderId = String(d._id);
    const entries = byOrder.get(orderId) ?? [];
    if (entries.length === 0) continue;

    const payable = d.roundedPayable ?? (d.total + (d.roundingAdjustment ?? 0));
    const breakdown = entries.map((p: any) => ({
      method: p.method,
      code: p.referenceNumber || `${p.method.toUpperCase()}-${orderId}`,
      amount: p.amount,
      change: p.method === 'cash' ? Math.max(0, p.amount - payable) : 0,
      cardLastFour: p.cardLastFour || undefined,
    }));

    ops.push({
      updateOne: {
        filter: { _id: d._id },
        update: { $set: { paymentBreakdown: breakdown } },
      },
    });
  }

  if (ops.length === 0) {
    console.log('[backfill] No completed payments found for the candidate orders.');
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
