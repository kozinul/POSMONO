import type {
  CreateOrderService,
  UpdateOrderService,
  ReplaceOrderItemsService,
  VoidOrderService,
  VoidItemService,
  PayOrderService,
  VoidPaymentService,
  ReopenOrderService,
  SplitItemService,
  RemoveItemService,
  UpdateItemQuantityService,
  VoidAndRollbackService,
  TopayService,
  RefundService,
  ApplyDiscountService,
  SetServiceChargeService,
  HoldOrderService,
  RecallOrderService,
  CloseBillService,
} from '../../../application/services/OrderService';
import type { MongoOrderRepository } from '../../../infrastructure/persistence/MongoOrderRepository';
import type { MongoPaymentRepository } from '../../../../payment/infrastructure/persistence/MongoPaymentRepository';
import type { MongoTenantRepository } from '../../../../tenant/infrastructure/persistence/MongoTenantRepository';
import type { InvoiceRenderService } from '../../../../template/application/services/InvoiceRenderService';

/**
 * The 19 order use cases the HTTP layer calls. Grouped in its own interface
 * only for readability — {@link OrderControllerDeps} extends it, so handlers
 * keep reading `this.deps.createOrderService.execute(...)` and no call site
 * gains an extra hop.
 */
export interface OrderUseCases {
  createOrderService: Pick<CreateOrderService, 'execute'>;
  updateOrderService: Pick<UpdateOrderService, 'execute'>;
  replaceOrderItemsService: Pick<ReplaceOrderItemsService, 'execute'>;
  voidOrderService: Pick<VoidOrderService, 'execute'>;
  voidItemService: Pick<VoidItemService, 'execute'>;
  payOrderService: Pick<PayOrderService, 'execute'>;
  voidPaymentService: Pick<VoidPaymentService, 'execute'>;
  reopenOrderService: Pick<ReopenOrderService, 'execute'>;
  splitItemService: Pick<SplitItemService, 'execute'>;
  removeItemService: Pick<RemoveItemService, 'execute'>;
  updateItemQuantityService: Pick<UpdateItemQuantityService, 'execute'>;
  voidAndRollbackService: Pick<VoidAndRollbackService, 'execute'>;
  topayService: Pick<TopayService, 'execute'>;
  refundService: Pick<RefundService, 'execute'>;
  applyDiscountService: Pick<ApplyDiscountService, 'execute'>;
  setServiceChargeService: Pick<SetServiceChargeService, 'execute'>;
  holdOrderService: Pick<HoldOrderService, 'execute'>;
  recallOrderService: Pick<RecallOrderService, 'execute'>;
  closeBillService: Pick<CloseBillService, 'execute'>;
}

/**
 * Dependency map for {@link OrderController} (debt item T2).
 *
 * The constructor used to take 23 positional parameters — 19 use cases plus 4
 * infrastructure dependencies. Nothing protected the order of the arguments:
 * the same class of bug that shifted `taxService` into the wrong slot in
 * `PaymentService` (HTTP 500, see AGENTS.md § E2E) had already made the test
 * harness pass shifted arguments to this controller, documented in AGENTS.md.
 *
 * Each slot is a named `Pick<>` of the concrete implementation, so the real
 * signatures are enforced by `tsc` with no `any` and no new port interfaces
 * to keep in sync. The four repository/service slots are the only ones the
 * controller reaches past its use cases: list/get an order, read the tenant
 * (invoice header), read that order's payments, and render the A4 invoice.
 */
export interface OrderControllerDeps extends OrderUseCases {
  orderRepository: Pick<MongoOrderRepository, 'findByTenant' | 'findById'>;
  paymentRepository: Pick<MongoPaymentRepository, 'findByOrderId'>;
  tenantRepository: Pick<MongoTenantRepository, 'findById'>;
  invoiceRenderService: Pick<InvoiceRenderService, 'render'>;
}
