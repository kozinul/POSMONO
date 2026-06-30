import {
  createContainer,
  asClass,
  asValue,
  Lifetime,
} from 'awilix';
import mongoose from 'mongoose';
import { EventBus } from '../@shared/infrastructure/eventBus/EventBus';
import { ConnectionManager } from '../@shared/infrastructure/database/ConnectionManager';
import { env } from '../@shared/config/env';
import { PasswordService } from '../core/identity/domain/services/PasswordService';
import { TokenService } from '../core/identity/application/services/TokenService';
import { AuthService } from '../core/identity/application/services/AuthService';
import { SessionService } from '../core/identity/application/services/SessionService';
import { AuthController } from '../core/identity/interfaces/http/controllers/AuthController';
import { MongoUserRepository } from '../core/identity/infrastructure/persistence/MongoUserRepository';
import { UserSchema } from '../core/identity/infrastructure/persistence/schemas/UserSchema';
import { RoleSchema } from '../core/identity/infrastructure/persistence/schemas/RoleSchema';
import { SessionSchema } from '../core/identity/infrastructure/persistence/schemas/SessionSchema';
import { TenantSchema } from '../core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { MongoTenantRepository } from '../core/tenant/infrastructure/persistence/MongoTenantRepository';
import { TenantService } from '../core/tenant/application/services/TenantService';
import { TenantController } from '../core/tenant/interfaces/http/controllers/TenantController';
import { ProductSchema } from '../core/catalog/infrastructure/persistence/schemas/ProductSchema';
import { CategorySchema } from '../core/catalog/infrastructure/persistence/schemas/CategorySchema';
import { MongoProductRepository } from '../core/catalog/infrastructure/persistence/MongoProductRepository';
import { MongoCategoryRepository } from '../core/catalog/infrastructure/persistence/MongoCategoryRepository';
import { ProductService } from '../core/catalog/application/services/ProductService';
import { CategoryService } from '../core/catalog/application/services/CategoryService';
import { ProductController } from '../core/catalog/interfaces/http/controllers/ProductController';
import { CategoryController } from '../core/catalog/interfaces/http/controllers/CategoryController';
import { StockSchema } from '../core/inventory/infrastructure/persistence/schemas/StockSchema';
import { StockMovementSchema } from '../core/inventory/infrastructure/persistence/schemas/StockMovementSchema';
import { WarehouseSchema } from '../core/inventory/infrastructure/persistence/schemas/WarehouseSchema';
import { MongoStockRepository } from '../core/inventory/infrastructure/persistence/MongoStockRepository';
import { MongoStockMovementRepository } from '../core/inventory/infrastructure/persistence/MongoStockMovementRepository';
import { MongoWarehouseRepository } from '../core/inventory/infrastructure/persistence/MongoWarehouseRepository';
import { InventoryService } from '../core/inventory/application/services/InventoryService';
import { WarehouseService } from '../core/inventory/application/services/WarehouseService';
import { InventoryController } from '../core/inventory/interfaces/http/controllers/InventoryController';
import { WarehouseController } from '../core/inventory/interfaces/http/controllers/WarehouseController';
import { MongoRoleRepository } from '../core/identity/infrastructure/persistence/MongoRoleRepository';
import { RoleService } from '../core/identity/application/services/RoleService';
import { UserService } from '../core/identity/application/services/UserService';
import { RoleController } from '../core/identity/interfaces/http/controllers/RoleController';
import { UserController } from '../core/identity/interfaces/http/controllers/UserController';
import { PermissionController } from '../core/identity/interfaces/http/controllers/PermissionController';
import { OrderSchema } from '../core/ordering/infrastructure/persistence/schemas/OrderSchema';
import { MongoOrderRepository } from '../core/ordering/infrastructure/persistence/MongoOrderRepository';
import { CreateOrderService } from '../core/ordering/application/services/OrderService';
import { OrderController } from '../core/ordering/interfaces/http/controllers/OrderController';
import { ShiftSchema } from '../core/pos/infrastructure/persistence/schemas/ShiftSchema';
import { MongoShiftRepository } from '../core/pos/infrastructure/persistence/MongoShiftRepository';
import { ShiftService } from '../core/pos/application/services/ShiftService';
import { ShiftController } from '../core/pos/interfaces/http/controllers/ShiftController';
import { PaymentSchema } from '../core/payment/infrastructure/persistence/schemas/PaymentSchema';
import { MongoPaymentRepository } from '../core/payment/infrastructure/persistence/MongoPaymentRepository';
import { PaymentService } from '../core/payment/application/services/PaymentService';
import { PaymentController } from '../core/payment/interfaces/http/controllers/PaymentController';
import { ReportService } from '../core/reporting/application/services/ReportService';
import { ReportController } from '../core/reporting/interfaces/http/controllers/ReportController';

export type DIContainer = ReturnType<typeof buildContainer>;

export function buildContainer() {
  const container = createContainer();

  const systemConnection = mongoose.createConnection(env.MONGO_URI);

  const UserModel = systemConnection.model('User', UserSchema);
  const RoleModel = systemConnection.model('Role', RoleSchema);
  const SessionModel = systemConnection.model('Session', SessionSchema);
  const TenantModel = systemConnection.model('Tenant', TenantSchema);
  const ProductModel = systemConnection.model('Product', ProductSchema);
  const CategoryModel = systemConnection.model('Category', CategorySchema);
  const StockModel = systemConnection.model('Stock', StockSchema);
  const StockMovementModel = systemConnection.model('StockMovement', StockMovementSchema);
  const WarehouseModel = systemConnection.model('Warehouse', WarehouseSchema);
  const OrderModel = systemConnection.model('Order', OrderSchema);
  const ShiftModel = systemConnection.model('Shift', ShiftSchema);
  const PaymentModel = systemConnection.model('Payment', PaymentSchema);

  const eventBus = new EventBus();

  container.register({
    eventBus: asValue(eventBus),
    connectionManager: asClass(ConnectionManager, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        mongoUri: env.MONGO_URI,
      }),
    }),
    userModel: asValue(UserModel),
    roleModel: asValue(RoleModel),
    sessionModel: asValue(SessionModel),
    tenantModel: asValue(TenantModel),
    productModel: asValue(ProductModel),
    categoryModel: asValue(CategoryModel),
    stockModel: asValue(StockModel),
    stockMovementModel: asValue(StockMovementModel),
    warehouseModel: asValue(WarehouseModel),
    orderModel: asValue(OrderModel),
    shiftModel: asValue(ShiftModel),
    paymentModel: asValue(PaymentModel),
    userRepository: asClass(MongoUserRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: UserModel,
      }),
    }),
    tenantRepository: asClass(MongoTenantRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: TenantModel,
      }),
    }),
    passwordService: asClass(PasswordService, {
      lifetime: Lifetime.SINGLETON,
    }),
    tokenService: asClass(TokenService, {
      lifetime: Lifetime.SINGLETON,
    }),
    sessionService: asClass(SessionService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: SessionModel,
      }),
    }),
    tenantService: asClass(TenantService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        tenantRepository: container.resolve('tenantRepository'),
      }),
    }),
    authService: asClass(AuthService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        userRepository: container.resolve('userRepository'),
        tokenService: container.resolve('tokenService'),
        passwordService: container.resolve('passwordService'),
        sessionService: container.resolve('sessionService'),
      }),
    }),
    roleRepository: asClass(MongoRoleRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: RoleModel,
      }),
    }),
    roleService: asClass(RoleService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        roleRepository: container.resolve('roleRepository'),
      }),
    }),
    userService: asClass(UserService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        userRepository: container.resolve('userRepository'),
        passwordService: container.resolve('passwordService'),
      }),
    }),
    authController: asClass(AuthController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        authService: container.resolve('authService'),
      }),
    }),
    roleController: asClass(RoleController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        roleService: container.resolve('roleService'),
      }),
    }),
    userController: asClass(UserController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        userService: container.resolve('userService'),
      }),
    }),
    permissionController: asClass(PermissionController, {
      lifetime: Lifetime.SINGLETON,
    }),
    tenantController: asClass(TenantController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        tenantService: container.resolve('tenantService'),
      }),
    }),
    productRepository: asClass(MongoProductRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: ProductModel,
      }),
    }),
    categoryRepository: asClass(MongoCategoryRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: CategoryModel,
      }),
    }),
    productService: asClass(ProductService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        productRepository: container.resolve('productRepository'),
      }),
    }),
    categoryService: asClass(CategoryService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        categoryRepository: container.resolve('categoryRepository'),
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
    stockRepository: asClass(MongoStockRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: StockModel,
      }),
    }),
    stockMovementRepository: asClass(MongoStockMovementRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: StockMovementModel,
      }),
    }),
    warehouseRepository: asClass(MongoWarehouseRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: WarehouseModel,
      }),
    }),
    inventoryService: asClass(InventoryService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        stockRepository: container.resolve('stockRepository'),
        stockMovementRepository: container.resolve('stockMovementRepository'),
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
    orderRepository: asClass(MongoOrderRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: OrderModel,
      }),
    }),
    createOrderService: asClass(CreateOrderService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
      }),
    }),
    orderController: asClass(OrderController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        createOrderService: container.resolve('createOrderService'),
        orderRepository: container.resolve('orderRepository'),
      }),
    }),
    shiftRepository: asClass(MongoShiftRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: ShiftModel,
      }),
    }),
    shiftService: asClass(ShiftService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        shiftRepository: container.resolve('shiftRepository'),
      }),
    }),
    shiftController: asClass(ShiftController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        shiftService: container.resolve('shiftService'),
      }),
    }),
    paymentRepository: asClass(MongoPaymentRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: PaymentModel,
      }),
    }),
    paymentService: asClass(PaymentService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        paymentRepository: container.resolve('paymentRepository'),
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
      }),
    }),
    paymentController: asClass(PaymentController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        paymentService: container.resolve('paymentService'),
      }),
    }),
    reportService: asClass(ReportService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        shiftRepository: container.resolve('shiftRepository'),
        paymentService: container.resolve('paymentService'),
      }),
    }),
    reportController: asClass(ReportController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        reportService: container.resolve('reportService'),
      }),
    }),
  });

  return container;
}
