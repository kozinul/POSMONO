import { asClass, Lifetime } from 'awilix';
import { MongoOrderRepository } from '../../core/ordering/infrastructure/persistence/MongoOrderRepository';
import {
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
} from '../../core/ordering/application/services/OrderService';
import { VoidApprovalService } from '../../core/ordering/application/services/VoidApprovalService';
import { OrderController } from '../../core/ordering/interfaces/http/controllers/OrderController';
import type { WiringContext } from './types';

/**
 * Registers the ordering domain: the order repository, the 19 single-purpose
 * use cases that live in `OrderService.ts`, `VoidApprovalService` (manager PIN)
 * and `OrderController`.
 *
 * Two facts worth knowing before touching this file:
 *
 * 1. The use cases are one class per intent on purpose. They exist so
 *    `OrderController` takes a typed `OrderUseCases` bag instead of 19
 *    positional arguments — the T2 debt fix. Keep them separate; merging two
 *    intents back into one service re-creates the constructor that used to
 *    silently mis-route a dependency.
 * 2. `orderController` resolves `paymentRepository` while `paymentService`
 *    resolves `orderRepository`: the two domains point at each other. That is
 *    safe only because every cross-domain dependency is resolved lazily inside
 *    `injector`, so neither wiring has to be registered before the other. Do
 *    not "fix" this by hoisting an eager reference.
 */
export function registerOrderingWiring({ container, models }: WiringContext): void {
  container.register({
    orderRepository: asClass(MongoOrderRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.OrderModel,
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
  });
}
