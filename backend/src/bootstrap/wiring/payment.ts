import { asClass, Lifetime } from 'awilix';
import { MongoPaymentRepository } from '../../core/payment/infrastructure/persistence/MongoPaymentRepository';
import { MongoRefundRepository } from '../../core/payment/infrastructure/persistence/MongoRefundRepository';
import { MongoQrisInvoiceRepository } from '../../core/payment/infrastructure/persistence/MongoQrisInvoiceRepository';
import { MongoPaymentMethodRepository } from '../../core/payment/infrastructure/persistence/MongoPaymentMethodRepository';
import { PaymentService } from '../../core/payment/application/services/PaymentService';
import { QrisGatewayService } from '../../core/payment/application/services/QrisGatewayService';
import { PaymentMethodService } from '../../core/payment/application/services/PaymentMethodService';
import { PaymentController } from '../../core/payment/interfaces/http/controllers/PaymentController';
import { PaymentMethodController } from '../../core/payment/interfaces/http/controllers/PaymentMethodController';
import type { WiringContext } from './types';

/**
 * Registers the payment domain: payment/refund/QRIS-invoice/payment-method
 * repositories, `PaymentService` (the T1 named-deps object), the QRIS gateway,
 * and the payment/payment-method controllers.
 *
 * `paymentService` is the widest consumer in the platform: it drives the money
 * loop, so its deps cover tax, discount, receipt rendering, inventory (the void
 * restock path), shift enforcement (`assertOpenShift` — the server is the
 * authority on the open shift, never the client's `shiftId`) and QRIS.
 *
 * It resolves `orderRepository`, which is registered by the ordering wiring, so
 * the two wirings are mutually dependent; awilix resolves lazily inside
 * `injector`, so registration order is irrelevant. Keep it that way.
 */
export function registerPaymentWiring({ container, models }: WiringContext): void {
  container.register({
    paymentRepository: asClass(MongoPaymentRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.PaymentModel,
      }),
    }),
    refundRepository: asClass(MongoRefundRepository, {
      lifetime: Lifetime.SINGLETON,
      injector: () => ({
        model: models.RefundModel,
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
        model: models.QrisInvoiceModel,
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
        model: models.PaymentMethodModel,
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
  });
}
