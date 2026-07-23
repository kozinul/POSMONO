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
import { FamilySchema } from '../core/catalog/infrastructure/persistence/schemas/FamilySchema';
import { ModifierSchema } from '../core/catalog/infrastructure/persistence/schemas/ModifierSchema';
import { MongoProductRepository } from '../core/catalog/infrastructure/persistence/MongoProductRepository';
import { MongoCategoryRepository } from '../core/catalog/infrastructure/persistence/MongoCategoryRepository';
import { MongoFamilyRepository } from '../core/catalog/infrastructure/persistence/MongoFamilyRepository';
import { MongoModifierRepository } from '../core/catalog/infrastructure/persistence/MongoModifierRepository';
import { ProductService } from '../core/catalog/application/services/ProductService';
import { CategoryService } from '../core/catalog/application/services/CategoryService';
import { FamilyService } from '../core/catalog/application/services/FamilyService';
import { ModifierService } from '../core/catalog/application/services/ModifierService';
import { ProductController } from '../core/catalog/interfaces/http/controllers/ProductController';
import { CategoryController } from '../core/catalog/interfaces/http/controllers/CategoryController';
import { FamilyController } from '../core/catalog/interfaces/http/controllers/FamilyController';
import { ModifierController } from '../core/catalog/interfaces/http/controllers/ModifierController';
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
import { CreateOrderService, UpdateOrderService, VoidOrderService, VoidItemService, PayOrderService, VoidPaymentService, ReopenOrderService, SplitItemService, RemoveItemService, UpdateItemQuantityService, VoidAndRollbackService, TopayService, RefundService, ApplyDiscountService, SetServiceChargeService, HoldOrderService, RecallOrderService } from '../core/ordering/application/services/OrderService';
import { OrderController } from '../core/ordering/interfaces/http/controllers/OrderController';
import { ShiftSchema } from '../core/pos/infrastructure/persistence/schemas/ShiftSchema';
import { MongoShiftRepository } from '../core/pos/infrastructure/persistence/MongoShiftRepository';
import { ShiftService } from '../core/pos/application/services/ShiftService';
import { ShiftController } from '../core/pos/interfaces/http/controllers/ShiftController';
import { PaymentSchema } from '../core/payment/infrastructure/persistence/schemas/PaymentSchema';
import { RefundSchema } from '../core/payment/infrastructure/persistence/schemas/RefundSchema';
import { MongoPaymentRepository } from '../core/payment/infrastructure/persistence/MongoPaymentRepository';
import { MongoRefundRepository } from '../core/payment/infrastructure/persistence/MongoRefundRepository';
import { PaymentService } from '../core/payment/application/services/PaymentService';
import { PaymentController } from '../core/payment/interfaces/http/controllers/PaymentController';
import { ReportService } from '../core/reporting/application/services/ReportService';
import { ReportController } from '../core/reporting/interfaces/http/controllers/ReportController';
import { DailyMetricSchema } from '../core/reporting/infrastructure/persistence/schemas/DailyMetricSchema';
import { MongoDailyMetricRepository } from '../core/reporting/infrastructure/persistence/MongoDailyMetricRepository';
import { ReportAggregation } from '../core/reporting/infrastructure/aggregation/ReportAggregation';
import { TaxConfigurationSchema } from '../core/tax/infrastructure/persistence/schemas/TaxConfigurationSchema';
import { MongoTaxConfigurationRepository } from '../core/tax/infrastructure/persistence/MongoTaxConfigurationRepository';
import { TaxServiceAdapter } from '../core/tax/application/services/TaxServiceAdapter';
import { PricingProfileSchema } from '../core/pricing/infrastructure/persistence/schemas/PricingProfileSchema';
import { MongoPricingProfileRepository } from '../core/pricing/infrastructure/persistence/MongoPricingProfileRepository';
import { DiscountConfigurationSchema } from '../core/discount/infrastructure/persistence/schemas/DiscountConfigurationSchema';
import { PromoCodeSchema } from '../core/discount/infrastructure/persistence/schemas/PromoCodeSchema';
import { MongoDiscountConfigurationRepository } from '../core/discount/infrastructure/persistence/MongoDiscountConfigurationRepository';
import { MongoPromoCodeRepository } from '../core/discount/infrastructure/persistence/MongoPromoCodeRepository';
import { DiscountServiceAdapter } from '../core/discount/application/services/DiscountServiceAdapter';
import { ManageDiscountRuleUseCase } from '../core/discount/application/services/ManageDiscountRuleUseCase';
import { createDiscountRouter } from '../core/discount/api/discount.routes';
import { CustomerSchema } from '../core/customer/infrastructure/persistence/schemas/CustomerSchema';
import { MongoCustomerRepository } from '../core/customer/infrastructure/persistence/MongoCustomerRepository';
import { CustomerService } from '../core/customer/application/services/CustomerService';
import { CustomerController } from '../core/customer/interfaces/http/controllers/CustomerController';
import { SettingSchema } from '../core/settings/infrastructure/persistence/schemas/SettingSchema';
import { MongoSettingRepository } from '../core/settings/infrastructure/persistence/MongoSettingRepository';
import { SettingService } from '../core/settings/application/services/SettingService';
import { SettingController } from '../core/settings/interfaces/http/controllers/SettingController';
import { UploadService } from '../core/upload/application/services/UploadService';
import { UploadController } from '../core/upload/interfaces/http/controllers/UploadController';
import { PromotionSchema } from '../core/promotion/infrastructure/persistence/schemas/PromotionSchema';
import { MongoPromotionRepository } from '../core/promotion/infrastructure/persistence/MongoPromotionRepository';
import { PromotionService } from '../core/promotion/application/services/PromotionService';
import { PromotionController } from '../core/promotion/interfaces/http/controllers/PromotionController';
import { PaymentMethodSchema } from '../core/payment/infrastructure/persistence/schemas/PaymentMethodSchema';
import { MongoPaymentMethodRepository } from '../core/payment/infrastructure/persistence/MongoPaymentMethodRepository';
import { PaymentMethodService } from '../core/payment/application/services/PaymentMethodService';
import { PaymentMethodController } from '../core/payment/interfaces/http/controllers/PaymentMethodController';

export type DIContainer = ReturnType<typeof buildContainer>;

export function buildContainer() {
  const container = createContainer({ injectionMode: 'CLASSIC' });

  const systemConnection = mongoose.connection;

  const UserModel = systemConnection.model('User', UserSchema);
  const RoleModel = systemConnection.model('Role', RoleSchema);
  const SessionModel = systemConnection.model('Session', SessionSchema);
  const TenantModel = systemConnection.model('Tenant', TenantSchema);
  const ProductModel = systemConnection.model('Product', ProductSchema);
  const CategoryModel = systemConnection.model('Category', CategorySchema);
  const FamilyModel = systemConnection.model('Family', FamilySchema);
  const ModifierModel = systemConnection.model('Modifier', ModifierSchema);
  const StockModel = systemConnection.model('Stock', StockSchema);
  const StockMovementModel = systemConnection.model('StockMovement', StockMovementSchema);
  const WarehouseModel = systemConnection.model('Warehouse', WarehouseSchema);
  const OrderModel = systemConnection.model('Order', OrderSchema);
  const ShiftModel = systemConnection.model('Shift', ShiftSchema);
  const PaymentModel = systemConnection.model('Payment', PaymentSchema);
  const RefundModel = systemConnection.model('Refund', RefundSchema);
  const TaxConfigurationModel = systemConnection.model('TaxConfiguration', TaxConfigurationSchema);
  const PricingProfileModel = systemConnection.model('PricingProfile', PricingProfileSchema);
  const DiscountConfigurationModel = systemConnection.model('DiscountConfiguration', DiscountConfigurationSchema);
  const PromoCodeModel = systemConnection.model('PromoCode', PromoCodeSchema);
  const DailyMetricModel = systemConnection.model('DailyMetric', DailyMetricSchema);
  const CustomerModel = systemConnection.model('Customer', CustomerSchema);
  const SettingModel = systemConnection.model('Setting', SettingSchema);
  const PromotionModel = systemConnection.model('Promotion', PromotionSchema);
  const PaymentMethodModel = systemConnection.model('PaymentMethod', PaymentMethodSchema);

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
    familyModel: asValue(FamilyModel),
    modifierModel: asValue(ModifierModel),
    stockModel: asValue(StockModel),
    stockMovementModel: asValue(StockMovementModel),
    warehouseModel: asValue(WarehouseModel),
    orderModel: asValue(OrderModel),
    shiftModel: asValue(ShiftModel),
    paymentModel: asValue(PaymentModel),
    refundModel: asValue(RefundModel),
    taxConfigurationModel: asValue(TaxConfigurationModel),
    pricingProfileModel: asValue(PricingProfileModel),
    customerModel: asValue(CustomerModel),
    settingModel: asValue(SettingModel),
    promotionModel: asValue(PromotionModel),
    paymentMethodModel: asValue(PaymentMethodModel),
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
  });

  const authService = new AuthService(
    container.resolve('userRepository'),
    container.resolve('tokenService'),
    container.resolve('passwordService'),
    container.resolve('sessionService'),
  );

  container.register({
    authService: asValue(authService),
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
    familyRepository: asClass(MongoFamilyRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: FamilyModel,
      }),
    }),
    modifierRepository: asClass(MongoModifierRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: ModifierModel,
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
    updateOrderService: asClass(UpdateOrderService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
      }),
    }),
    voidOrderService: asClass(VoidOrderService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
      }),
    }),
    voidItemService: asClass(VoidItemService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
      }),
    }),
    payOrderService: asClass(PayOrderService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
      }),
    }),
    voidPaymentService: asClass(VoidPaymentService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
      }),
    }),
    reopenOrderService: asClass(ReopenOrderService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
      }),
    }),
    splitItemService: asClass(SplitItemService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
        createOrderService: container.resolve('createOrderService'),
      }),
    }),
    removeItemService: asClass(RemoveItemService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
      }),
    }),
    updateItemQuantityService: asClass(UpdateItemQuantityService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
      }),
    }),
    voidAndRollbackService: asClass(VoidAndRollbackService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
      }),
    }),
    topayService: asClass(TopayService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
      }),
    }),
    refundService: asClass(RefundService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
      }),
    }),
    applyDiscountService: asClass(ApplyDiscountService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
      }),
    }),
    setServiceChargeService: asClass(SetServiceChargeService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
      }),
    }),
    holdOrderService: asClass(HoldOrderService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
      }),
    }),
    recallOrderService: asClass(RecallOrderService, {
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
        updateOrderService: container.resolve('updateOrderService'),
        voidOrderService: container.resolve('voidOrderService'),
        voidItemService: container.resolve('voidItemService'),
        payOrderService: container.resolve('payOrderService'),
        voidPaymentService: container.resolve('voidPaymentService'),
        reopenOrderService: container.resolve('reopenOrderService'),
        splitItemService: container.resolve('splitItemService'),
        removeItemService: container.resolve('removeItemService'),
        updateItemQuantityService: container.resolve('updateItemQuantityService'),
        voidAndRollbackService: container.resolve('voidAndRollbackService'),
        topayService: container.resolve('topayService'),
        refundService: container.resolve('refundService'),
        applyDiscountService: container.resolve('applyDiscountService'),
        setServiceChargeService: container.resolve('setServiceChargeService'),
        holdOrderService: container.resolve('holdOrderService'),
        recallOrderService: container.resolve('recallOrderService'),
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
    refundRepository: asClass(MongoRefundRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: RefundModel,
      }),
    }),
    paymentService: asClass(PaymentService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        paymentRepository: container.resolve('paymentRepository'),
        orderRepository: container.resolve('orderRepository'),
        refundRepository: container.resolve('refundRepository'),
        tenantRepository: container.resolve('tenantRepository'),
        taxService: container.resolve('taxService'),
        discountService: container.resolve('discountService'),
        eventBus: container.resolve('eventBus'),
      }),
    }),
    paymentController: asClass(PaymentController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        paymentService: container.resolve('paymentService'),
      }),
    }),
    paymentMethodRepository: asClass(MongoPaymentMethodRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: PaymentMethodModel,
      }),
    }),
    paymentMethodService: asClass(PaymentMethodService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        paymentMethodRepository: container.resolve('paymentMethodRepository'),
      }),
    }),
    paymentMethodController: asClass(PaymentMethodController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        paymentMethodService: container.resolve('paymentMethodService'),
      }),
    }),
    taxConfigurationRepository: asClass(MongoTaxConfigurationRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: TaxConfigurationModel,
      }),
    }),
    pricingProfileRepository: asClass(MongoPricingProfileRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: PricingProfileModel,
      }),
    }),
    discountConfigurationRepository: asClass(MongoDiscountConfigurationRepository, {
      lifetime: Lifetime.SINGLETON,
    }),
    promoCodeRepository: asClass(MongoPromoCodeRepository, {
      lifetime: Lifetime.SINGLETON,
    }),
    discountService: asClass(DiscountServiceAdapter, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        configRepo: container.resolve('discountConfigurationRepository'),
        promoCodeRepo: container.resolve('promoCodeRepository'),
      }),
    }),
    manageDiscountRuleUseCase: asClass(ManageDiscountRuleUseCase, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        repo: container.resolve('discountConfigurationRepository'),
      }),
    }),
    taxService: asClass(TaxServiceAdapter, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        repo: container.resolve('taxConfigurationRepository'),
        pricingProfileRepo: container.resolve('pricingProfileRepository'),
      }),
    }),
    dailyMetricRepository: asClass(MongoDailyMetricRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: DailyMetricModel,
      }),
    }),
    reportAggregation: asClass(ReportAggregation, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderModel: OrderModel,
        shiftModel: ShiftModel,
        productModel: ProductModel,
      }),
    }),
    reportService: asClass(ReportService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        shiftRepository: container.resolve('shiftRepository'),
        dailyMetricRepository: container.resolve('dailyMetricRepository'),
        reportAggregation: container.resolve('reportAggregation'),
      }),
    }),
    reportController: asClass(ReportController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        reportService: container.resolve('reportService'),
      }),
    }),
    customerRepository: asClass(MongoCustomerRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: CustomerModel,
      }),
    }),
    customerService: asClass(CustomerService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        customerRepository: container.resolve('customerRepository'),
      }),
    }),
    customerController: asClass(CustomerController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        customerService: container.resolve('customerService'),
      }),
    }),
    settingRepository: asClass(MongoSettingRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: SettingModel,
      }),
    }),
    settingService: asClass(SettingService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        settingRepository: container.resolve('settingRepository'),
      }),
    }),
    settingController: asClass(SettingController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        settingService: container.resolve('settingService'),
      }),
    }),
    uploadService: asClass(UploadService, {
      lifetime: Lifetime.SINGLETON,
    }),
    uploadController: asClass(UploadController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        uploadService: container.resolve('uploadService'),
      }),
    }),
    promotionRepository: asClass(MongoPromotionRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: PromotionModel,
      }),
    }),
    promotionService: asClass(PromotionService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        promotionRepository: container.resolve('promotionRepository'),
      }),
    }),
    promotionController: asClass(PromotionController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        promotionService: container.resolve('promotionService'),
      }),
    }),
  });

  return container;
}
