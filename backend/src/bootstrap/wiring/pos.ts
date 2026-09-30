import { asClass, Lifetime } from 'awilix';
import { MongoShiftRepository } from '../../core/pos/infrastructure/persistence/MongoShiftRepository';
import { ShiftService } from '../../core/pos/application/services/ShiftService';
import { ShiftController } from '../../core/pos/interfaces/http/controllers/ShiftController';
import type { WiringContext } from './types';

/**
 * Registers the POS/shift domain: the shift repository, `ShiftService` and the
 * shift controller.
 *
 * Shifts are a server-side projection cache, not the source of truth for money
 * (the `payments` + `orders` collections are), and the partial unique index
 * `one_open_shift_per_cashier_per_outlet` — the race-condition guard — lives in
 * `ShiftModel.syncIndexes()`, not here.
 */
export function registerPosWiring({ container, models }: WiringContext): void {
  container.register({
    shiftRepository: asClass(MongoShiftRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.ShiftModel,
      }),
    }),
    shiftService: asClass(ShiftService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        shiftRepository: container.resolve('shiftRepository'),
        reportAggregation: container.resolve('reportAggregation'),
        orderRepository: container.resolve('orderRepository'),
        userRepository: container.resolve('userRepository'),
      }),
    }),
    shiftController: asClass(ShiftController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        shiftService: container.resolve('shiftService'),
      }),
    }),
  });
}
