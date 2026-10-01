import type { EventBus } from '../../../../@shared/infrastructure/eventBus/EventBus';
import type { MongoOrderRepository } from '../../infrastructure/persistence/MongoOrderRepository';
import type { MongoUserRepository } from '../../../identity/infrastructure/persistence/MongoUserRepository';
import type { MongoShiftRepository } from '../../../pos/infrastructure/persistence/MongoShiftRepository';
import type { MongoProductRepository } from '../../../catalog/infrastructure/persistence/MongoProductRepository';
import type { MongoModifierRepository } from '../../../catalog/infrastructure/persistence/MongoModifierRepository';
import type { InventoryService } from '../../../inventory/application/services/InventoryService';

export type OrderRepositoryDep = Pick<MongoOrderRepository, 'save' | 'findById'>;
export type EventBusDep = Pick<EventBus, 'publish'>;
export type UserRepositoryDep = Pick<MongoUserRepository, 'findByIdAndTenant'>;
export type ShiftRepositoryDep = Pick<MongoShiftRepository, 'findOpenShift'>;
export type ProductRepositoryDep = Pick<MongoProductRepository, 'findById'>;
export type ModifierRepositoryDep = Pick<MongoModifierRepository, 'findByIds' | 'findByProduct' | 'findByFamily'>;
export type InventoryServiceDep = Pick<
  InventoryService,
  'restockForVoid' | 'releaseStock' | 'reserveStock'
>;
