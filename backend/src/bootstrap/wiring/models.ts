import { asValue, type AwilixContainer } from 'awilix';
import type { Connection } from 'mongoose';
import { migratePlatformHubPermissions } from '../../core/platform/infrastructure/persistence/migratePlatformHubPermissions';
import { CategorySchema } from '../../core/catalog/infrastructure/persistence/schemas/CategorySchema';
import { CustomerSchema } from '../../core/customer/infrastructure/persistence/schemas/CustomerSchema';
import { DailyMetricSchema } from '../../core/reporting/infrastructure/persistence/schemas/DailyMetricSchema';
import { DiscountConfigurationSchema } from '../../core/discount/infrastructure/persistence/schemas/DiscountConfigurationSchema';
import { FamilySchema } from '../../core/catalog/infrastructure/persistence/schemas/FamilySchema';
import { HubMemberTenantAccessSchema } from '../../core/hub/infrastructure/persistence/schemas/HubMemberTenantAccessSchema';
import { HubMembershipSchema } from '../../core/hub/infrastructure/persistence/schemas/HubMembershipSchema';
import { HubSchema } from '../../core/hub/infrastructure/persistence/schemas/HubSchema';
import { MenuTypeSchema } from '../../core/catalog/infrastructure/persistence/schemas/MenuTypeSchema';
import { ModifierSchema } from '../../core/catalog/infrastructure/persistence/schemas/ModifierSchema';
import { OrderSchema } from '../../core/ordering/infrastructure/persistence/schemas/OrderSchema';
import { OutletSchema } from '../../core/outlet/infrastructure/persistence/schemas/OutletSchema';
import { PaymentMethodSchema } from '../../core/payment/infrastructure/persistence/schemas/PaymentMethodSchema';
import { PaymentSchema } from '../../core/payment/infrastructure/persistence/schemas/PaymentSchema';
import { PlanSchema } from '../../core/billing/infrastructure/persistence/schemas/PlanSchema';
import { PlatformAuditLogSchema } from '../../core/platform/audit/infrastructure/persistence/schemas/PlatformAuditLogSchema';
import { PricingProfileSchema } from '../../core/pricing/infrastructure/persistence/schemas/PricingProfileSchema';
import { PrinterSchema } from '../../core/printing/infrastructure/persistence/schemas/PrinterSchema';
import { ProductSchema } from '../../core/catalog/infrastructure/persistence/schemas/ProductSchema';
import { PromoCodeSchema } from '../../core/discount/infrastructure/persistence/schemas/PromoCodeSchema';
import { PromotionSchema } from '../../core/promotion/infrastructure/persistence/schemas/PromotionSchema';
import { ProvisioningRunSchema } from '../../core/platform/provisioning/infrastructure/persistence/schemas/ProvisioningRunSchema';
import { QrisInvoiceSchema } from '../../core/payment/infrastructure/persistence/schemas/QrisInvoiceSchema';
import { RefundSchema } from '../../core/payment/infrastructure/persistence/schemas/RefundSchema';
import { RoleSchema } from '../../core/identity/infrastructure/persistence/schemas/RoleSchema';
import { SessionSchema } from '../../core/identity/infrastructure/persistence/schemas/SessionSchema';
import { SettingSchema } from '../../core/settings/infrastructure/persistence/schemas/SettingSchema';
import { ShiftSchema } from '../../core/pos/infrastructure/persistence/schemas/ShiftSchema';
import { StockMovementSchema } from '../../core/inventory/infrastructure/persistence/schemas/StockMovementSchema';
import { StockSchema } from '../../core/inventory/infrastructure/persistence/schemas/StockSchema';
import { SubscriptionHistorySchema } from '../../core/billing/infrastructure/persistence/schemas/SubscriptionHistorySchema';
import { SubscriptionSchema } from '../../core/billing/infrastructure/persistence/schemas/SubscriptionSchema';
import { TaxConfigurationSchema } from '../../core/tax/infrastructure/persistence/schemas/TaxConfigurationSchema';
import { TemplateSchema } from '../../core/template/infrastructure/persistence/schemas/TemplateSchema';
import { TemplateVersionSchema } from '../../core/template/infrastructure/persistence/schemas/TemplateVersionSchema';
import { TenantSchema } from '../../core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { UserSchema } from '../../core/identity/infrastructure/persistence/schemas/UserSchema';
import { WarehouseSchema } from '../../core/inventory/infrastructure/persistence/schemas/WarehouseSchema';

/**
 * Every Mongoose model of the platform, declared in exactly one place.
 *
 * Debt item T3 (see docs/TECH_DEBT_PLAN.md): the 38 `connection.model(...)`
 * calls used to sit inside `buildContainer()`, which made the wiring file the
 * only place that knew the full inventory of collections, indexes and
 * migrations. The declaration order below is preserved verbatim from the
 * original `buildContainer()` — `syncIndexes()` and the Hub V2 permission
 * migration stay fire-and-forget and in the same position relative to the
 * model they belong to, because moving them changes boot-time behaviour.
 */
export function buildModels(connection: Connection) {
  const UserModel = connection.model('User', UserSchema);
  const RoleModel = connection.model('Role', RoleSchema);
  // Hub V2 Fase 16: `hub:manage` → `platform.hubs.manage` in stored roles, so a
  // deployed platform super-admin keeps hub access without a manual DB step.
  migratePlatformHubPermissions(RoleModel).catch(() => {});
  const SessionModel = connection.model('Session', SessionSchema);
  const TenantModel = connection.model('Tenant', TenantSchema);
  const ProductModel = connection.model('Product', ProductSchema);
  const CategoryModel = connection.model('Category', CategorySchema);
  const FamilyModel = connection.model('Family', FamilySchema);
  const ModifierModel = connection.model('Modifier', ModifierSchema);
  const StockModel = connection.model('Stock', StockSchema);
  const StockMovementModel = connection.model('StockMovement', StockMovementSchema);
  const WarehouseModel = connection.model('Warehouse', WarehouseSchema);
  const OrderModel = connection.model('Order', OrderSchema);
  const ShiftModel = connection.model('Shift', ShiftSchema);
  const PaymentModel = connection.model('Payment', PaymentSchema);
  const RefundModel = connection.model('Refund', RefundSchema);
  const QrisInvoiceModel = connection.model('QrisInvoice', QrisInvoiceSchema);
  const TaxConfigurationModel = connection.model('TaxConfiguration', TaxConfigurationSchema);
  const PricingProfileModel = connection.model('PricingProfile', PricingProfileSchema);
  const DiscountConfigurationModel = connection.model('DiscountConfiguration', DiscountConfigurationSchema);
  const PromoCodeModel = connection.model('PromoCode', PromoCodeSchema);
  const DailyMetricModel = connection.model('DailyMetric', DailyMetricSchema);
  const CustomerModel = connection.model('Customer', CustomerSchema);
  const SettingModel = connection.model('Setting', SettingSchema);
  const PromotionModel = connection.model('Promotion', PromotionSchema);
  PromotionModel.syncIndexes().catch(() => {});
  ShiftModel.syncIndexes().catch(() => {});
  const PaymentMethodModel = connection.model('PaymentMethod', PaymentMethodSchema);
  const MenuTypeModel = connection.model('MenuType', MenuTypeSchema);
  const TemplateModel = connection.model('Template', TemplateSchema);
  const TemplateVersionModel = connection.model('TemplateVersion', TemplateVersionSchema);
  const PrinterModel = connection.model('Printer', PrinterSchema);
  PrinterModel.syncIndexes().catch(() => {});
  const HubModel = connection.model('Hub', HubSchema);
  const HubMembershipModel = connection.model('HubMembership', HubMembershipSchema);
  HubMembershipModel.syncIndexes().catch(() => {});
  const HubMemberTenantAccessModel = connection.model(
    'HubMemberTenantAccess',
    HubMemberTenantAccessSchema,
  );
  HubMemberTenantAccessModel.syncIndexes().catch(() => {});
  const OutletModel = connection.model('Outlet', OutletSchema);
  OutletModel.syncIndexes().catch(() => {});
  const PlanModel = connection.model('Plan', PlanSchema);
  PlanModel.syncIndexes().catch(() => {});
  const SubscriptionModel = connection.model('Subscription', SubscriptionSchema);
  const PlatformAuditLogModel = connection.model('PlatformAuditLog', PlatformAuditLogSchema);
  const ProvisioningRunModel = connection.model('ProvisioningRun', ProvisioningRunSchema);
  const SubscriptionHistoryModel = connection.model('SubscriptionHistory', SubscriptionHistorySchema);
  SubscriptionModel.syncIndexes().catch(() => {});

  return {
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
    DiscountConfigurationModel,
    PromoCodeModel,
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
  };
}

export type Models = ReturnType<typeof buildModels>;

/**
 * Registers the models themselves as `asValue` entries so services and
 * repositories can `container.resolve('paymentModel')` in tests as well as in
 * production. Same 31 keys as before the move.
 */
export function registerModels(container: AwilixContainer, models: Models): void {
  container.register({
    userModel: asValue(models.UserModel),
    roleModel: asValue(models.RoleModel),
    sessionModel: asValue(models.SessionModel),
    tenantModel: asValue(models.TenantModel),
    productModel: asValue(models.ProductModel),
    categoryModel: asValue(models.CategoryModel),
    familyModel: asValue(models.FamilyModel),
    modifierModel: asValue(models.ModifierModel),
    stockModel: asValue(models.StockModel),
    stockMovementModel: asValue(models.StockMovementModel),
    warehouseModel: asValue(models.WarehouseModel),
    orderModel: asValue(models.OrderModel),
    shiftModel: asValue(models.ShiftModel),
    paymentModel: asValue(models.PaymentModel),
    refundModel: asValue(models.RefundModel),
    taxConfigurationModel: asValue(models.TaxConfigurationModel),
    pricingProfileModel: asValue(models.PricingProfileModel),
    customerModel: asValue(models.CustomerModel),
    settingModel: asValue(models.SettingModel),
    promotionModel: asValue(models.PromotionModel),
    paymentMethodModel: asValue(models.PaymentMethodModel),
    menuTypeModel: asValue(models.MenuTypeModel),
    templateModel: asValue(models.TemplateModel),
    templateVersionModel: asValue(models.TemplateVersionModel),
    printerModel: asValue(models.PrinterModel),
    hubModel: asValue(models.HubModel),
    hubMembershipModel: asValue(models.HubMembershipModel),
    hubMemberTenantAccessModel: asValue(models.HubMemberTenantAccessModel),
    outletModel: asValue(models.OutletModel),
    planModel: asValue(models.PlanModel),
    subscriptionModel: asValue(models.SubscriptionModel),
  });
}
