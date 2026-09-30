import type { Connection } from 'mongoose';
import type { AwilixContainer } from 'awilix';
import type { EventBus } from '../../@shared/infrastructure/eventBus/EventBus';
import type { Models } from './models';

/**
 * Context handed to every `register<Domain>Wiring` function (debt item T3).
 *
 * `container` is passed explicitly instead of imported so a wiring module never
 * has to know where it sits in the composition root, and so a test can build the
 * same wiring against a test container.
 */
export interface WiringContext {
  container: AwilixContainer;
  models: Models;
  eventBus: EventBus;
  /**
   * Raw mongoose connection. Optional on purpose: almost every wiring needs
   * models, only `platform` needs the connection handle itself (its
   * provisioning-run repository takes `connection`, not a model).
   */
  systemConnection?: Connection;
}
