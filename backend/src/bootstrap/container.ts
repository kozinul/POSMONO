import { createContainer, asClass, asValue, Lifetime } from 'awilix';
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
import { registerHubWiring } from './wiring/hub';
import { registerOutletWiring } from './wiring/outlet';
import { registerPlatformWiring } from './wiring/platform';
import { registerBillingWiring } from './wiring/billing';
import { registerOrderingWiring } from './wiring/ordering';
import { registerPaymentWiring } from './wiring/payment';
import { EventBus } from '../@shared/infrastructure/eventBus/EventBus';
import { ConnectionManager } from '../@shared/infrastructure/database/ConnectionManager';
import { env } from '../@shared/config/env';
import { CreateOrderService, UpdateOrderService, ReplaceOrderItemsService, VoidOrderService, VoidItemService, PayOrderService, VoidPaymentService, ReopenOrderService, SplitItemService, RemoveItemService, UpdateItemQuantityService, VoidAndRollbackService, TopayService, RefundService, ApplyDiscountService, SetServiceChargeService, HoldOrderService, RecallOrderService, CloseBillService } from '../core/ordering/application/services/OrderService';

export type DIContainer = ReturnType<typeof buildContainer>;

export function buildContainer() {
  const container = createContainer({ injectionMode: 'CLASSIC' });

  const systemConnection = mongoose.connection;

  const models = buildModels(systemConnection);
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

  // One call per domain (debt item T3). The order below is documentary, not
  // load-bearing: every cross-domain dependency is resolved lazily inside
  // `injector`, which is what lets `ordering` and `payment` depend on each
  // other. `platform` is the only wiring that also needs `systemConnection`.
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
  registerHubWiring({ container, models, eventBus });
  registerOutletWiring({ container, models, eventBus });
  registerPlatformWiring({ container, models, eventBus, systemConnection });
  registerBillingWiring({ container, models, eventBus });
  registerOrderingWiring({ container, models, eventBus });
  registerPaymentWiring({ container, models, eventBus });

  return container;
}
