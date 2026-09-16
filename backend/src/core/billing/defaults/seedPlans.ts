import { Model } from 'mongoose';
import { DEFAULT_PLANS } from './plans';

export async function upsertDefaultPlans(planModel: Model<any>): Promise<void> {
  for (const plan of DEFAULT_PLANS) {
    await planModel.updateOne(
      { name: plan.name },
      { $setOnInsert: { ...plan } },
      { upsert: true },
    );
  }
}