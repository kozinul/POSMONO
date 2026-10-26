
/**
 * Built-in plans seeded before the `kds` module existed never received the
 * module (Pro/Enterprise) or the `addon-kds` add-on (Starter). `upsertDefaultPlans`
 * only inserts, so without this pass an existing dev/prod database keeps a KDS
 * feature that no plan can grant.
 *
 * Only the built-in plans are touched, and only by adding entries — custom plans
 * and custom add-ons stay untouched. Idempotent.
 */
interface PlanMigrationModel {
  updateMany(filter: object, update: object): Promise<unknown>;
  updateOne(filter: object, update: object): Promise<unknown>;
}

export async function migratePlanKds(planModel: PlanMigrationModel): Promise<void> {
  await planModel.updateMany(
    { _id: { $in: ['plan-pro', 'plan-enterprise'] } },
    { $addToSet: { modules: 'kds' } },
  );
  await planModel.updateOne(
    { _id: 'plan-starter' },
    {
      $addToSet: {
        addOns: {
          id: 'addon-kds',
          name: 'Kitchen Display (KDS)',
          description: 'Layar dapur/bar untuk tiket pesanan',
          price: 99000,
          type: 'module',
          value: 'kds',
        },
      },
    },
  );
}
