import type { DIContainer } from './container';
import { logger } from '../@shared/infrastructure/logger/Logger';

/**
 * Hub/Outlet provisioning on boot (Fase 5).
 *
 * For every tenant:
 *   1. Ensure a default Outlet ("Outlet Utama") linked 1:1 to the default
 *      Warehouse ("Warehouse Utama", id 'utama' — the legacy literal fallback).
 *   2. Backfill `outletId` on orders / payments / shifts that predate outlets
 *      (null or missing field) → assign them to the default outlet.
 *
 * Idempotent: re-running only touches documents that still lack `outletId`.
 */
export async function provisionDefaults(container: DIContainer): Promise<void> {
  try {
    const tenantRepository = container.resolve('tenantRepository');
    const outletService = container.resolve('outletService');
    const orderModel = container.resolve('orderModel');
    const paymentModel = container.resolve('paymentModel');
    const shiftModel = container.resolve('shiftModel');

    const tenants = await tenantRepository.findAll();

    for (const tenant of tenants) {
      const tenantId = tenant.serialize().id;
      const outlet = await outletService.ensureDefault(tenantId);
      const outletId = outlet.serialize().id;

      const filter = { tenantId, outletId: null };

      const res = await Promise.all([
        orderModel.updateMany(filter, { $set: { outletId } }),
        paymentModel.updateMany(filter, { $set: { outletId } }),
        shiftModel.updateMany(filter, { $set: { outletId } }),
      ]);

      const backfilled = res.reduce((sum, r) => sum + (r.modifiedCount ?? 0), 0);
      logger.info(
        { tenantId, outletId, backfilled },
        '[provisioning] default outlet ensured + outletId backfilled',
      );
    }

    logger.info({ tenants: tenants.length }, '[provisioning] done');
  } catch (err) {
    logger.warn({ err }, '[provisioning] failed — continuing without outlet provisioning');
  }
}