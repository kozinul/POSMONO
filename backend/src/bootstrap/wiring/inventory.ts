import { asClass, Lifetime } from 'awilix';
import { MongoStockRepository } from '../../core/inventory/infrastructure/persistence/MongoStockRepository';
import { MongoStockMovementRepository } from '../../core/inventory/infrastructure/persistence/MongoStockMovementRepository';
import { MongoWarehouseRepository } from '../../core/inventory/infrastructure/persistence/MongoWarehouseRepository';
import { InventoryService } from '../../core/inventory/application/services/InventoryService';
import { WarehouseService } from '../../core/inventory/application/services/WarehouseService';
import { InventoryController } from '../../core/inventory/interfaces/http/controllers/InventoryController';
import { WarehouseController } from '../../core/inventory/interfaces/http/controllers/WarehouseController';
import type { WiringContext } from './types';

/**
 * Registers the inventory domain: stock per warehouse, stock movements (the
 * source of truth behind the Laba Rugi COGS figure) and the warehouse itself.
 *
 * `inventoryService` is also the void/restock path — `restockForVoid` and
 * `releaseStock` are what keep physical stock honest after a void or a closed
 * bill, so this wiring is load-bearing for money correctness, not just stock
 * screens.
 */
export function registerInventoryWiring({ container, models }: WiringContext): void {
  container.register({
    stockRepository: asClass(MongoStockRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.StockModel,
      }),
    }),
    stockMovementRepository: asClass(MongoStockMovementRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.StockMovementModel,
      }),
    }),
    warehouseRepository: asClass(MongoWarehouseRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.WarehouseModel,
      }),
    }),
    inventoryService: asClass(InventoryService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        stockRepository: container.resolve('stockRepository'),
        stockMovementRepository: container.resolve('stockMovementRepository'),
        warehouseRepository: container.resolve('warehouseRepository'),
        eventBus: container.resolve('eventBus'),
      }),
    }),
    warehouseService: asClass(WarehouseService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        warehouseRepository: container.resolve('warehouseRepository'),
      }),
    }),
    inventoryController: asClass(InventoryController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        inventoryService: container.resolve('inventoryService'),
      }),
    }),
    warehouseController: asClass(WarehouseController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        warehouseService: container.resolve('warehouseService'),
      }),
    }),
  });
}
