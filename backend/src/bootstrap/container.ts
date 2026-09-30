import {
  createContainer,
  asClass,
  asValue,
  Lifetime,
} from 'awilix';
import mongoose from 'mongoose';
import { buildModels, registerModels } from './wiring/models';
import { registerPrintingWiring } from './wiring/printing';
import { registerPromotionWiring } from './wiring/promotion';
import { registerUploadWiring } from './wiring/upload';
import { registerIdentityWiring } from './wiring/identity';
import { registerTenantWiring } from './wiring/tenant';
import { registerCatalogWiring } from './wiring/catalog';
import { registerInventoryWiring } from './wiring/inventory';
import { registerPosWiring } from './wiring/pos';
import { registerCustomerWiring } from './wiring/customer';
import { registerSettingsWiring } from './wiring/settings';
import { registerTaxWiring } from './wiring/tax';
import { registerPricingWiring } from './wiring/pricing';
import { registerDiscountWiring } from './wiring/discount';
import { registerReportingWiring } from './wiring/reporting';
import { registerTemplateWiring } from './wiring/template';
import { registerDatabaseWiring } from './wiring/database';
import { EventBus } from '../@shared/infrastructure/eventBus/EventBus';
import { ConnectionManager } from '../@shared/infrastructure/database/ConnectionManager';
import { env } from '../@shared/config/env';
import { MongoOrderRepository } from '../core/ordering/infrastructure/persistence/MongoOrderRepository';
import { CreateOrderService, UpdateOrderService, ReplaceOrderItemsService, VoidOrderService, VoidItemService, PayOrderService, VoidPaymentService, ReopenOrderService, SplitItemService, RemoveItemService, UpdateItemQuantityService, VoidAndRollbackService, TopayService, RefundService, ApplyDiscountService, SetServiceChargeService, HoldOrderService, RecallOrderService, CloseBillService } from '../core/ordering/application/services/OrderService';
import { VoidApprovalService } from '../core/ordering/application/services/VoidApprovalService';
import { OrderController } from '../core/ordering/interfaces/http/controllers/OrderController';
import { MongoPaymentRepository } from '../core/payment/infrastructure/persistence/MongoPaymentRepository';
import { MongoRefundRepository } from '../core/payment/infrastructure/persistence/MongoRefundRepository';
import { PaymentService } from '../core/payment/application/services/PaymentService';
import { QrisGatewayService } from '../core/payment/application/services/QrisGatewayService';
import { MongoQrisInvoiceRepository } from '../core/payment/infrastructure/persistence/MongoQrisInvoiceRepository';
import { PaymentController } from '../core/payment/interfaces/http/controllers/PaymentController';
import { createDiscountRouter } from '../core/discount/api/discount.routes';
import { MongoPaymentMethodRepository } from '../core/payment/infrastructure/persistence/MongoPaymentMethodRepository';
import { PaymentMethodService } from '../core/payment/application/services/PaymentMethodService';
import { PaymentMethodController } from '../core/payment/interfaces/http/controllers/PaymentMethodController';
import { MongoHubRepository } from '../core/hub/infrastructure/persistence/MongoHubRepository';
import { MongoHubMembershipRepository } from '../core/hub/infrastructure/persistence/MongoHubMembershipRepository';
import { MongoHubMemberTenantAccessRepository } from '../core/hub/infrastructure/persistence/MongoHubMemberTenantAccessRepository';
import { HubService } from '../core/hub/application/services/HubService';
import { HubMembershipService } from '../core/hub/application/services/HubMembershipService';
import { HubMemberAccessService } from '../core/hub/application/services/HubMemberAccessService';
import { HubController } from '../core/hub/interfaces/http/controllers/HubController';
import { HubMembershipController } from '../core/hub/interfaces/http/controllers/HubMembershipController';
import { MongoOutletRepository } from '../core/outlet/infrastructure/persistence/MongoOutletRepository';
import { OutletService } from '../core/outlet/application/services/OutletService';
import { OutletController } from '../core/outlet/interfaces/http/controllers/OutletController';
import { PlatformController } from '../core/platform/interfaces/http/controllers/PlatformController';
import { PlatformCleanupService } from '../core/platform/application/services/PlatformCleanupService';
import { ProvisionTenantService } from '../core/platform/application/services/ProvisionTenantService';
import { MongoPlanRepository } from '../core/billing/infrastructure/persistence/MongoPlanRepository';
import { MongoSubscriptionRepository } from '../core/billing/infrastructure/persistence/MongoSubscriptionRepository';
import { PlanService } from '../core/billing/application/services/PlanService';
import { SubscriptionService } from '../core/billing/application/services/SubscriptionService';
import { EntitlementService } from '../core/billing/application/services/EntitlementService';
import { PlanController } from '../core/billing/interfaces/http/controllers/PlanController';
import { SubscriptionController } from '../core/billing/interfaces/http/controllers/SubscriptionController';
import { MongoPlatformAuditLogRepository } from '../core/platform/audit/infrastructure/persistence/MongoPlatformAuditLogRepository';
import { PlatformAuditService } from '../core/platform/audit/application/services/PlatformAuditService';
import { MongoProvisioningRunRepository } from '../core/platform/provisioning/infrastructure/persistence/MongoProvisioningRunRepository';
import { MongoSubscriptionHistoryRepository } from '../core/billing/infrastructure/persistence/MongoSubscriptionHistoryRepository';

export type DIContainer = ReturnType<typeof buildContainer>;

export function buildContainer() {
  const container = createContainer({ injectionMode: 'CLASSIC' });

  const systemConnection = mongoose.connection;

  const models = buildModels(systemConnection);
  // Stage 1 of debt item T3: models live in `wiring/models.ts` now. The
  // destructuring below only exists so the wiring block can be moved domain by
  // domain afterwards (stages 2-4); the later stages consume `models.X` directly
  // and this list disappears.
  const {
  UserModel,
  RoleModel,
  SessionModel,
  TenantModel,
  ProductModel,
  CategoryModel,
  FamilyModel,
  ModifierModel,
  StockModel,
  StockMovementModel,
  WarehouseModel,
  OrderModel,
  ShiftModel,
  PaymentModel,
  RefundModel,
  QrisInvoiceModel,
  TaxConfigurationModel,
  PricingProfileModel,
  DailyMetricModel,
  CustomerModel,
  SettingModel,
  PromotionModel,
  PaymentMethodModel,
  MenuTypeModel,
  TemplateModel,
  TemplateVersionModel,
  PrinterModel,
  HubModel,
  HubMembershipModel,
  HubMemberTenantAccessModel,
  OutletModel,
  PlanModel,
  SubscriptionModel,
  PlatformAuditLogModel,
  ProvisioningRunModel,
  SubscriptionHistoryModel,
  } = models;

  const eventBus = new EventBus();

  container.register({
    eventBus: asValue(eventBus),
    connectionManager: asClass(ConnectionManager, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        mongoUri: env.MONGO_URI,
      }),
    }),
  });

  registerModels(container, models);

  // Debt item T3 stage 2: three small domains proved the per-domain wiring
  // pattern before the commerce-heavy ones (stage 4) were moved.
  registerPrintingWiring({ container, models, eventBus });
  registerPromotionWiring({ container, models, eventBus });
  registerUploadWiring({ container, models, eventBus });
  registerIdentityWiring({ container, models, eventBus });
  registerTenantWiring({ container, models, eventBus });
  registerCatalogWiring({ container, models, eventBus });
  registerInventoryWiring({ container, models, eventBus });
  registerPosWiring({ container, models, eventBus });
  registerCustomerWiring({ container, models, eventBus });
  registerSettingsWiring({ container, models, eventBus });
  registerTaxWiring({ container, models, eventBus });
  registerPricingWiring({ container, models, eventBus });
  registerDiscountWiring({ container, models, eventBus });
  registerReportingWiring({ container, models, eventBus });
  registerTemplateWiring({ container, models, eventBus });
  registerDatabaseWiring({ container, models, eventBus });

  container.register({
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
        userRepository: container.resolve('userRepository'),
        shiftRepository: container.resolve('shiftRepository'),
        productRepository: container.resolve('productRepository'),
        modifierRepository: container.resolve('modifierRepository'),
      }),
    }),
    updateOrderService: asClass(UpdateOrderService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
      }),
    }),
    voidApprovalService: asClass(VoidApprovalService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        userRepository: container.resolve('userRepository'),
        roleRepository: container.resolve('roleRepository'),
        passwordService: container.resolve('passwordService'),
      }),
    }),
    voidOrderService: asClass(VoidOrderService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
        voidApprovalService: container.resolve('voidApprovalService'),
        inventoryService: container.resolve('inventoryService'),
      }),
    }),
    voidItemService: asClass(VoidItemService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
        voidApprovalService: container.resolve('voidApprovalService'),
        inventoryService: container.resolve('inventoryService'),
      }),
    }),
    payOrderService: asClass(PayOrderService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
        userRepository: container.resolve('userRepository'),
      }),
    }),
    voidPaymentService: asClass(VoidPaymentService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
        voidApprovalService: container.resolve('voidApprovalService'),
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
        voidApprovalService: container.resolve('voidApprovalService'),
        inventoryService: container.resolve('inventoryService'),
      }),
    }),
    topayService: asClass(TopayService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
        userRepository: container.resolve('userRepository'),
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
        inventoryService: container.resolve('inventoryService'),
      }),
    }),
    recallOrderService: asClass(RecallOrderService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
        inventoryService: container.resolve('inventoryService'),
      }),
    }),
    replaceOrderItemsService: asClass(ReplaceOrderItemsService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
      }),
    }),
    closeBillService: asClass(CloseBillService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        orderRepository: container.resolve('orderRepository'),
        eventBus: container.resolve('eventBus'),
        inventoryService: container.resolve('inventoryService'),
      }),
    }),
    orderController: asClass(OrderController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        deps: {
          createOrderService: container.resolve('createOrderService'),
          updateOrderService: container.resolve('updateOrderService'),
          replaceOrderItemsService: container.resolve('replaceOrderItemsService'),
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
          closeBillService: container.resolve('closeBillService'),
          orderRepository: container.resolve('orderRepository'),
          paymentRepository: container.resolve('paymentRepository'),
          tenantRepository: container.resolve('tenantRepository'),
          invoiceRenderService: container.resolve('invoiceRenderService'),
        },
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
        deps: {
          paymentRepository: container.resolve('paymentRepository'),
          orderRepository: container.resolve('orderRepository'),
          refundRepository: container.resolve('refundRepository'),
          tenantRepository: container.resolve('tenantRepository'),
          taxService: container.resolve('taxService'),
          discountService: container.resolve('discountService'),
          eventBus: container.resolve('eventBus'),
          receiptRenderService: container.resolve('receiptRenderService'),
          inventoryService: container.resolve('inventoryService'),
          userRepository: container.resolve('userRepository'),
          shiftRepository: container.resolve('shiftRepository'),
          printService: container.resolve('printService'),
          qrisGatewayService: container.resolve('qrisGatewayService'),
          productRepository: container.resolve('productRepository'),
          modifierRepository: container.resolve('modifierRepository'),
          categoryRepository: container.resolve('categoryRepository'),
        },
      }),
    }),
    paymentController: asClass(PaymentController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        paymentService: container.resolve('paymentService'),
        qrisGatewayService: container.resolve('qrisGatewayService'),
      }),
    }),
    qrisInvoiceRepository: asClass(MongoQrisInvoiceRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: QrisInvoiceModel,
      }),
    }),
    qrisGatewayService: asClass(QrisGatewayService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        tenantRepository: container.resolve('tenantRepository'),
        qrisInvoiceRepository: container.resolve('qrisInvoiceRepository'),
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
    hubRepository: asClass(MongoHubRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: HubModel,
      }),
    }),
    hubService: asClass(HubService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        hubRepository: container.resolve('hubRepository'),
        tenantRepository: container.resolve('tenantRepository'),
      }),
    }),
    hubController: asClass(HubController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        hubService: container.resolve('hubService'),
        auditService: container.resolve('platformAuditService'),
      }),
    }),
    hubMembershipRepository: asClass(MongoHubMembershipRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: HubMembershipModel,
      }),
    }),
    hubMembershipService: asClass(HubMembershipService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        deps: {
          hubMembershipRepository: container.resolve('hubMembershipRepository'),
          hubRepository: container.resolve('hubRepository'),
          tenantRepository: container.resolve('tenantRepository'),
          userRepository: container.resolve('userRepository'),
          accessService: container.resolve('hubMemberAccessService'),
        },
      }),
    }),
    hubMemberTenantAccessRepository: asClass(MongoHubMemberTenantAccessRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: HubMemberTenantAccessModel,
      }),
    }),
    hubMemberAccessService: asClass(HubMemberAccessService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        deps: {
          accessRepository: container.resolve('hubMemberTenantAccessRepository'),
          hubMembershipRepository: container.resolve('hubMembershipRepository'),
          hubRepository: container.resolve('hubRepository'),
          tenantRepository: container.resolve('tenantRepository'),
          outletRepository: container.resolve('outletRepository'),
        },
      }),
    }),
    hubMembershipController: asClass(HubMembershipController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        hubMembershipService: container.resolve('hubMembershipService'),
        auditService: container.resolve('platformAuditService'),
        hubMemberAccessService: container.resolve('hubMemberAccessService'),
      }),
    }),
    outletRepository: asClass(MongoOutletRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: OutletModel,
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
    provisionTenantService: asClass(ProvisionTenantService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        deps: {
          tenantRepository: container.resolve('tenantRepository'),
          userRepository: container.resolve('userRepository'),
          roleRepository: container.resolve('roleRepository'),
          hubRepository: container.resolve('hubRepository'),
          outletService: container.resolve('outletService'),
          templateService: container.resolve('templateService'),
          provisioningRunRepository: container.resolve('provisioningRunRepository'),
        },
      }),
    }),
    platformCleanupService: asClass(PlatformCleanupService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({ connection: systemConnection }),
    }),
    platformController: asClass(PlatformController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        deps: {
          hubService: container.resolve('hubService'),
          tenantService: container.resolve('tenantService'),
          outletService: container.resolve('outletService'),
          shiftService: container.resolve('shiftService'),
          paymentService: container.resolve('paymentService'),
          tenantRepository: container.resolve('tenantRepository'),
          hubRepository: container.resolve('hubRepository'),
          provisionTenantService: container.resolve('provisionTenantService'),
          auditService: container.resolve('platformAuditService'),
          subscriptionService: container.resolve('subscriptionService'),
          provisioningRunRepository: container.resolve('provisioningRunRepository'),
          userRepository: container.resolve('userRepository'),
          roleRepository: container.resolve('roleRepository'),
          warehouseRepository: container.resolve('warehouseRepository'),
          userService: container.resolve('userService'),
          cleanupService: container.resolve('platformCleanupService'),
          hubMembershipService: container.resolve('hubMembershipService'),
        },
      }),
    }),
    platformAuditLogRepository: asClass(MongoPlatformAuditLogRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({ model: PlatformAuditLogModel }),
    }),
    platformAuditService: asClass(PlatformAuditService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        repository: container.resolve('platformAuditLogRepository'),
      }),
    }),
    provisioningRunRepository: asClass(MongoProvisioningRunRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({ model: ProvisioningRunModel }),
    }),
    planRepository: asClass(MongoPlanRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({ model: PlanModel }),
    }),
    subscriptionRepository: asClass(MongoSubscriptionRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({ model: SubscriptionModel }),
    }),
    planService: asClass(PlanService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        planRepository: container.resolve('planRepository'),
      }),
    }),
    subscriptionService: asClass(SubscriptionService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        subscriptionRepository: container.resolve('subscriptionRepository'),
        planRepository: container.resolve('planRepository'),
        tenantRepository: container.resolve('tenantRepository'),
        historyRepository: container.resolve('subscriptionHistoryRepository'),
      }),
    }),
    subscriptionHistoryRepository: asClass(MongoSubscriptionHistoryRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({ model: SubscriptionHistoryModel }),
    }),
    entitlementService: asClass(EntitlementService, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        subscriptionRepository: container.resolve('subscriptionRepository'),
        planRepository: container.resolve('planRepository'),
        tenantRepository: container.resolve('tenantRepository'),
      }),
    }),
    planController: asClass(PlanController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        planService: container.resolve('planService'),
      }),
    }),
    subscriptionController: asClass(SubscriptionController, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        subscriptionService: container.resolve('subscriptionService'),
        entitlementService: container.resolve('entitlementService'),
        auditService: container.resolve('platformAuditService'),
      }),
    }),
  });

  return container;
}
