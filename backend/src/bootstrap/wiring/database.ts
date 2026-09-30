import { asClass, Lifetime } from 'awilix';
import { DatabaseService } from '../../core/database/application/services/DatabaseService';
import { DatabaseController } from '../../core/database/interfaces/http/controllers/DatabaseController';
import type { WiringContext } from './types';

/**
 * Registers the database maintenance domain: `DatabaseService` (health, index
 * sync, backup/restore style operations) and its controller.
 *
 * It needs raw models rather than repositories because a maintenance job must
 * work even when the repositories above are degraded — hence
 * `models.DailyMetricModel`, which is deliberately not exposed as an `asValue`
 * model (only reporting consumes it).
 */
export function registerDatabaseWiring({ container, models }: WiringContext): void {
  container.register({
    databaseService: asClass(DatabaseService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderModel: models.OrderModel,
        paymentModel: models.PaymentModel,
        refundModel: models.RefundModel,
        dailyMetricModel: models.DailyMetricModel,
        shiftModel: models.ShiftModel,
        shiftRepository: container.resolve('shiftRepository'),
        shiftService: container.resolve('shiftService'),
        reportAggregation: container.resolve('reportAggregation'),
      }),
    }),
    databaseController: asClass(DatabaseController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        databaseService: container.resolve('databaseService'),
      }),
    }),
  });
}
