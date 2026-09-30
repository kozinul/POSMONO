import { asClass, Lifetime } from 'awilix';
import { MongoOutletRepository } from '../../core/outlet/infrastructure/persistence/MongoOutletRepository';
import { OutletService } from '../../core/outlet/application/services/OutletService';
import { OutletController } from '../../core/outlet/interfaces/http/controllers/OutletController';
import type { WiringContext } from './types';

/**
 * Registers the outlet domain: outlets plus their 1:1 warehouse link.
 *
 * Outlet creation is platform-only (Fase 12) — the tenant side is read/update
 * only — which is why `outletService` is wired without any permission concerns
 * here: RBAC lives in the route layer.
 */
export function registerOutletWiring({ container, models }: WiringContext): void {
  container.register({
    outletRepository: asClass(MongoOutletRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.OutletModel,
      }),
    }),
    outletService: asClass(OutletService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        outletRepository: container.resolve('outletRepository'),
        warehouseRepository: container.resolve('warehouseRepository'),
      }),
    }),
    outletController: asClass(OutletController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        outletService: container.resolve('outletService'),
      }),
    }),
  });
}
