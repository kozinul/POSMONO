import express, { Express } from 'express';
import mongoose, { Model } from 'mongoose';
import { createOrderRoutes } from '../../src/core/ordering/interfaces/http/routes/order.routes';
import { createPaymentRoutes } from '../../src/core/payment/interfaces/http/routes/payment.routes';
import { createShiftRoutes } from '../../src/core/pos/interfaces/http/routes/shift.routes';
import { OrderSchema } from '../../src/core/ordering/infrastructure/persistence/schemas/OrderSchema';
import { PaymentSchema } from '../../src/core/payment/infrastructure/persistence/schemas/PaymentSchema';
import { ShiftSchema } from '../../src/core/pos/infrastructure/persistence/schemas/ShiftSchema';
import { MongoOrderRepository } from '../../src/core/ordering/infrastructure/persistence/MongoOrderRepository';
import { MongoPaymentRepository } from '../../src/core/payment/infrastructure/persistence/MongoPaymentRepository';
import { MongoShiftRepository } from '../../src/core/pos/infrastructure/persistence/MongoShiftRepository';
import { CreateOrderService } from '../../src/core/ordering/application/services/OrderService';
import { PaymentService } from '../../src/core/payment/application/services/PaymentService';
import { ShiftService } from '../../src/core/pos/application/services/ShiftService';
import { OrderController } from '../../src/core/ordering/interfaces/http/controllers/OrderController';
import { PaymentController } from '../../src/core/payment/interfaces/http/controllers/PaymentController';
import { ShiftController } from '../../src/core/pos/interfaces/http/controllers/ShiftController';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';
import { authenticate } from '../../src/@shared/interfaces/middleware/authenticate';
import { generateTestToken } from './auth';

export interface IntegrationTestContext {
  app: Express;
  orderRepo: MongoOrderRepository;
  paymentRepo: MongoPaymentRepository;
  shiftRepo: MongoShiftRepository;
  orderModel: Model<any>;
  paymentModel: Model<any>;
  shiftModel: Model<any>;
  token: string;
  tenantId: string;
  userId: string;
}

export async function buildIntegrationApp(): Promise<IntegrationTestContext> {
  const tenantId = 'integration-tenant';
  const userId = 'integration-user';
  const token = generateTestToken({ sub: userId, tenant: tenantId });

  const eventBus = { publish: () => {} };

  const orderModel = mongoose.model('Order', OrderSchema);
  const paymentModel = mongoose.model('Payment', PaymentSchema);
  const shiftModel = mongoose.model('Shift', ShiftSchema);

  const orderRepo = new MongoOrderRepository(orderModel);
  const paymentRepo = new MongoPaymentRepository(paymentModel);
  const shiftRepo = new MongoShiftRepository(shiftModel);

  const createOrderService = new CreateOrderService(orderRepo, eventBus);
  const paymentService = new PaymentService(paymentRepo, orderRepo, eventBus);
  const shiftService = new ShiftService(shiftRepo);

  const orderController = new OrderController(createOrderService, orderRepo);
  const paymentController = new PaymentController(paymentService);
  const shiftController = new ShiftController(shiftService);

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/orders', createOrderRoutes(orderController));
  app.use('/api/payments', createPaymentRoutes(paymentController));
  app.use('/api/shifts', createShiftRoutes(shiftController));
  app.use(errorHandler);

  return { app, orderRepo, paymentRepo, shiftRepo, orderModel, paymentModel, shiftModel, token, tenantId, userId };
}
