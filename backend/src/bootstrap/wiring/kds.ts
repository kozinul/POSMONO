import { asClass, Lifetime } from 'awilix';
import { MongoStationRepository } from '../../core/kds/infrastructure/persistence/MongoStationRepository';
import { MongoStationTicketRepository } from '../../core/kds/infrastructure/persistence/MongoStationTicketRepository';
import { KdsService } from '../../core/kds/application/services/KdsService';
import { KdsController } from '../../core/kds/interfaces/http/controllers/KdsController';
import type { WiringContext } from './types';

/**
 * KDS station + ticket wiring. Both repositories resolve lazily because the
 * ordering event handler and the HTTP layer are two independent entry points.
 */
export function registerKdsWiring({ container, models, eventBus }: WiringContext): void {
  container.register({
    stationRepository: asClass(MongoStationRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({ model: models.StationModel }),
    }),
    stationTicketRepository: asClass(MongoStationTicketRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({ model: models.StationTicketModel }),
    }),
    kdsService: asClass(KdsService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        deps: {
          stationRepository: container.resolve('stationRepository'),
          ticketRepository: container.resolve('stationTicketRepository'),
          orderRepository: container.resolve('orderRepository'),
          outletRepository: container.resolve('outletRepository'),
          eventBus,
        },
      }),
    }),
    kdsController: asClass(KdsController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        kdsService: container.resolve('kdsService'),
      }),
    }),
  });
}
