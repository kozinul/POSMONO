import { asClass, Lifetime } from 'awilix';
import { MongoProductRepository } from '../../core/catalog/infrastructure/persistence/MongoProductRepository';
import { MongoCategoryRepository } from '../../core/catalog/infrastructure/persistence/MongoCategoryRepository';
import { MongoFamilyRepository } from '../../core/catalog/infrastructure/persistence/MongoFamilyRepository';
import { MongoModifierRepository } from '../../core/catalog/infrastructure/persistence/MongoModifierRepository';
import { MongoMenuTypeRepository } from '../../core/catalog/infrastructure/persistence/MongoMenuTypeRepository';
import { ProductService } from '../../core/catalog/application/services/ProductService';
import { CategoryService } from '../../core/catalog/application/services/CategoryService';
import { FamilyService } from '../../core/catalog/application/services/FamilyService';
import { ModifierService } from '../../core/catalog/application/services/ModifierService';
import { MenuTypeService } from '../../core/catalog/application/services/MenuTypeService';
import { ProductController } from '../../core/catalog/interfaces/http/controllers/ProductController';
import { CategoryController } from '../../core/catalog/interfaces/http/controllers/CategoryController';
import { FamilyController } from '../../core/catalog/interfaces/http/controllers/FamilyController';
import { ModifierController } from '../../core/catalog/interfaces/http/controllers/ModifierController';
import { MenuTypeController } from '../../core/catalog/interfaces/http/controllers/MenuTypeController';
import type { WiringContext } from './types';

/**
 * Registers the catalog domain: products, categories, families, modifiers and
 * menu types.
 *
 * `modifierService` resolves `productRepository`/`categoryRepository` for
 * family-by-category modifier groups, and `productService` resolves inventory
 * for stock-aware availability — both cross-domain reads happen lazily inside
 * `injector`.
 */
export function registerCatalogWiring({ container, models }: WiringContext): void {
  container.register({
    productRepository: asClass(MongoProductRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.ProductModel,
      }),
    }),
    categoryRepository: asClass(MongoCategoryRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.CategoryModel,
      }),
    }),
    familyRepository: asClass(MongoFamilyRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.FamilyModel,
      }),
    }),
    modifierRepository: asClass(MongoModifierRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.ModifierModel,
      }),
    }),
    menuTypeRepository: asClass(MongoMenuTypeRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.MenuTypeModel,
      }),
    }),
    productService: asClass(ProductService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        productRepository: container.resolve('productRepository'),
        eventBus: container.resolve('eventBus'),
      }),
    }),
    categoryService: asClass(CategoryService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        categoryRepository: container.resolve('categoryRepository'),
      }),
    }),
    familyService: asClass(FamilyService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        familyRepository: container.resolve('familyRepository'),
      }),
    }),
    modifierService: asClass(ModifierService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        modifierRepository: container.resolve('modifierRepository'),
        productRepository: container.resolve('productRepository'),
      }),
    }),
    menuTypeService: asClass(MenuTypeService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        menuTypeRepository: container.resolve('menuTypeRepository'),
        familyRepository: container.resolve('familyRepository'),
      }),
    }),
    productController: asClass(ProductController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        productService: container.resolve('productService'),
      }),
    }),
    categoryController: asClass(CategoryController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        categoryService: container.resolve('categoryService'),
      }),
    }),
    familyController: asClass(FamilyController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        familyService: container.resolve('familyService'),
      }),
    }),
    modifierController: asClass(ModifierController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        modifierService: container.resolve('modifierService'),
      }),
    }),
    menuTypeController: asClass(MenuTypeController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        menuTypeService: container.resolve('menuTypeService'),
      }),
    }),
  });
}
