import type { EventBus } from '../../../../@shared/infrastructure/eventBus/EventBus';
import type { DiscountServiceAdapter } from '../../../discount/application/services/DiscountServiceAdapter';
import type { TaxServiceAdapter } from '../../../tax/application/services/TaxServiceAdapter';
import type { InventoryService } from '../../../inventory/application/services/InventoryService';
import type { PrintService } from '../../../printing/application/services/PrintService';
import type { ReceiptRenderService } from '../../../template/application/services/ReceiptRenderService';
import type { MongoCategoryRepository } from '../../../catalog/infrastructure/persistence/MongoCategoryRepository';
import type { MongoModifierRepository } from '../../../catalog/infrastructure/persistence/MongoModifierRepository';
import type { MongoProductRepository } from '../../../catalog/infrastructure/persistence/MongoProductRepository';
import type { MongoUserRepository } from '../../../identity/infrastructure/persistence/MongoUserRepository';
import type { MongoOrderRepository } from '../../../ordering/infrastructure/persistence/MongoOrderRepository';
import type { MongoShiftRepository } from '../../../pos/infrastructure/persistence/MongoShiftRepository';
import type { MongoTenantRepository } from '../../../tenant/infrastructure/persistence/MongoTenantRepository';
import type { MongoPaymentRepository } from '../../infrastructure/persistence/MongoPaymentRepository';
import type { MongoRefundRepository } from '../../infrastructure/persistence/MongoRefundRepository';
import type { QrisGatewayService } from './QrisGatewayService';

/**
 * Dependency map for {@link PaymentService}.
 *
 * T0's sibling refactor (T1): the constructor used to take 16 positional
 * `any` slots, so nothing protected the order of the arguments. The bug class
 * is not theoretical — a growing constructor already shifted `taxService` into
 * the `tenantRepository` slot and produced HTTP 500 in production
 * (`taxResult.charges.reduce is not a function`, see AGENTS.md § E2E).
 *
 * Each slot below is a named `Pick<>` of the concrete implementation: only the
 * members this service actually calls, with the real signatures. The concrete
 * class is assignable to its `Pick<>` structurally, so a signature change in a
 * repository or adapter breaks the container wiring at compile time instead of
 * at runtime. No `any`, so no name typos survive `tsc`.
 *
 * The seven optional slots stay optional: several call paths only need them
 * (QRIS gateway, hardware printing, shift enforcement, modifier resolution)
 * and the tests construct the service without them.
 */
export interface PaymentServiceDeps {
  paymentRepository: Pick<
    MongoPaymentRepository,
    | 'save'
    | 'findById'
    | 'findByOrder'
    | 'findByReferenceNumber'
    | 'findByTenant'
    | 'findCompletedByTenantIds'
    | 'findPending'
    | 'findRefundable'
  >;
  orderRepository: Pick<MongoOrderRepository, 'save' | 'findById'>;
  refundRepository: Pick<MongoRefundRepository, 'save'>;
  tenantRepository: Pick<MongoTenantRepository, 'findById'>;
  taxService: Pick<TaxServiceAdapter, 'calculate'>;
  discountService: Pick<DiscountServiceAdapter, 'apply'>;
  eventBus: Pick<EventBus, 'publish'>;
  receiptRenderService?: Pick<ReceiptRenderService, 'render'>;
  inventoryService?: Pick<InventoryService, 'decrementForSale' | 'incrementForReturn' | 'releaseStock'>;
  userRepository?: Pick<MongoUserRepository, 'findByIdAndTenant'>;
  shiftRepository?: Pick<MongoShiftRepository, 'findById' | 'findOpenShift'>;
  printService?: Pick<PrintService, 'printEscPos'>;
  qrisGatewayService?: Pick<QrisGatewayService, 'checkStatus'>;
  productRepository?: Pick<MongoProductRepository, 'findById'>;
  modifierRepository?: Pick<MongoModifierRepository, 'findByProduct' | 'findByFamily'>;
  categoryRepository?: Pick<MongoCategoryRepository, 'findById'>;
}
