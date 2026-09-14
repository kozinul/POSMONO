import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_PLANS } from './plans';

export async function seedDefaultPlans(planModel: Model<any>): Promise<void> {
  const existing = await planModel.countDocuments();
  if (existing > 0) {
    return;
  }

  for (const plan of DEFAULT_PLANS) {
    await planModel.create({
      _id: `${plan.name.toLowerCase()}-${uuidv4().replace(/-/g, '').substring(0, 12)}`,
      ...plan,
    });
  }
}

export async function upsertDefaultPlans(planModel: Model<any>): Promise<void> {
  for (const plan of DEFAULT_PLANS) {
    await planModel.updateOne(
      { name: plan.name },
      { $setOnInsert: { ...plan } },
      { upsert: true },
    );
  }
}