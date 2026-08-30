import express, { Express } from 'express';
import mongoose, { Model } from 'mongoose';
import { createOrderRoutes } from '../../src/core/ordering/interfaces/http/routes/order.routes';
import { createPaymentRoutes } from '../../src/core/payment/interfaces/http/routes/payment.routes';
import { createShiftRoutes } from '../../src/core/pos/interfaces/http/routes/shift.routes';
import { createProductRoutes } from '../../src/core/catalog/interfaces/http/routes/product.routes';
import { createInventoryRoutes } from '../../src/core/inventory/interfaces/http/routes/inventory.routes';
import { OrderSchema } from '../../src/core/ordering/infrastructure/persistence/schemas/OrderSchema';
import { PaymentSchema } from '../../src/core/payment/infrastructure/persistence/schemas/PaymentSchema';
import { ShiftSchema } from '../../src/core/pos/infrastructure/persistence/schemas/ShiftSchema';
import { ProductSchema } from '../../src/core/catalog/infrastructure/persistence/schemas/ProductSchema';
import { StockSchema } from '../../src/core/inventory/infrastructure/persistence/schemas/StockSchema';
import { StockMovementSchema } from '../../src/core/inventory/infrastructure/persistence/schemas/StockMovementSchema';
import { WarehouseSchema } from '../../src/core/inventory/infrastructure/persistence/schemas/WarehouseSchema';
import { TenantSchema } from '../../src/core/tenant/infrastructure/persistence/schemas/TenantSchema';
import { TemplateSchema } from '../../src/core/template/infrastructure/persistence/schemas/TemplateSchema';
import { UserSchema } from '../../src/core/identity/infrastructure/persistence/schemas/UserSchema';
import { MongoOrderRepository } from '../../src/core/ordering/infrastructure/persistence/MongoOrderRepository';
import { MongoPaymentRepository } from '../../src/core/payment/infrastructure/persistence/MongoPaymentRepository';
import { MongoShiftRepository } from '../../src/core/pos/infrastructure/persistence/MongoShiftRepository';
import { MongoProductRepository } from '../../src/core/catalog/infrastructure/persistence/MongoProductRepository';
import { MongoStockRepository } from '../../src/core/inventory/infrastructure/persistence/MongoStockRepository';
import { MongoStockMovementRepository } from '../../src/core/inventory/infrastructure/persistence/MongoStockMovementRepository';
import { MongoWarehouseRepository } from '../../src/core/inventory/infrastructure/persistence/MongoWarehouseRepository';
import { MongoTenantRepository } from '../../src/core/tenant/infrastructure/persistence/MongoTenantRepository';
import { MongoUserRepository } from '../../src/core/identity/infrastructure/persistence/MongoUserRepository';
import { MongoTemplateRepository } from '../../src/core/template/infrastructure/persistence/MongoTemplateRepository';
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
} from '../../src/core/ordering/application/services/OrderService';
import { PaymentService } from '../../src/core/payment/application/services/PaymentService';
import { ShiftService } from '../../src/core/pos/application/services/ShiftService';
import { ProductService } from '../../src/core/catalog/application/services/ProductService';
import { InventoryService } from '../../src/core/inventory/application/services/InventoryService';
import { TemplateService } from '../../src/core/template/application/services/TemplateService';
import { InvoiceRenderService } from '../../src/core/template/application/services/InvoiceRenderService';
import { OrderController } from '../../src/core/ordering/interfaces/http/controllers/OrderController';
import { PaymentController } from '../../src/core/payment/interfaces/http/controllers/PaymentController';
import { ShiftController } from '../../src/core/pos/interfaces/http/controllers/ShiftController';
import { ProductController } from '../../src/core/catalog/interfaces/http/controllers/ProductController';
import { InventoryController } from '../../src/core/inventory/interfaces/http/controllers/InventoryController';
import { errorHandler } from '../../src/@shared/interfaces/middleware/errorHandler';
import { generateTestToken } from './auth';

export interface IntegrationTestContext {
  app: Express;
  orderRepo: MongoOrderRepository;
  paymentRepo: MongoPaymentRepository;
  shiftRepo: MongoShiftRepository;
  productRepo: MongoProductRepository;
  stockRepo: MongoStockRepository;
  stockMovementRepo: MongoStockMovementRepository;
  warehouseRepo: MongoWarehouseRepository;
  tenantRepo: MongoTenantRepository;
  templateRepo: MongoTemplateRepository;
  orderModel: Model<any>;
  paymentModel: Model<any>;
  shiftModel: Model<any>;
  productModel: Model<any>;
  stockModel: Model<any>;
  stockMovementModel: Model<any>;
  warehouseModel: Model<any>;
  tenantModel: Model<any>;
  templateModel: Model<any>;
  orderService: CreateOrderService;
  paymentService: PaymentService;
  shiftService: ShiftService;
  inventoryService: InventoryService;
  token: string;
  tenantId: string;
  userId: string;
}

export interface IntegrationAppOptions {
  enforceShift?: boolean;
  permissions?: string[];
}

export function buildTaxServiceMock(): { calculate: (input: any) => Promise<any> } {
  return {
    calculate: async (input: any) => {
      const subtotal = input.items.reduce((s: number, i: any) => s + i.quantity * i.unitPrice, 0);
      const discount = input.discount ?? 0;
      const isPercentage = input.discountType === 'percentage';
      const discountAmount = isPercentage
        ? Math.round((subtotal * Math.min(discount, 100)) / 100)
        : Math.min(discount, subtotal);
      const taxableAmount = subtotal - discountAmount;
      const base = Math.round((taxableAmount * 11) / 12);
      const pajak = Math.round((base * 12) / 100);
      return {
        subtotal, discount, discountType: input.discountType ?? 'nominal', discountAmount,
        taxableAmount,
        taxes: [{ name: 'Pajak 12%', type: 'vat', rate: 12, baseAmount: taxableAmount, amount: pajak, compoundOrder: 0 }],
        taxAmount: pajak, taxBase: base, totalTax: pajak, charges: [], serviceCharge: 0,
        grandTotal: taxableAmount + pajak, pricingMode: 'exclusive',
      };
    },
  };
}

export async function buildIntegrationApp(options: IntegrationAppOptions = {}): Promise<IntegrationTestContext> {
  const tenantId = 'integration-tenant';
  const userId = 'integration-user';
  const permissions = options.permissions ?? [];
  const token = generateTestToken({ sub: userId, tenant: tenantId, permissions });

  const eventBus = { publish: () => {} };

  const orderModel = mongoose.model('Order', OrderSchema);
  const paymentModel = mongoose.model('Payment', PaymentSchema);
  const shiftModel = mongoose.model('Shift', ShiftSchema);
  const productModel = mongoose.model('Product', ProductSchema);
  const stockModel = mongoose.model('StockItem', StockSchema);
  const stockMovementModel = mongoose.model('StockMovement', StockMovementSchema);
  const warehouseModel = mongoose.model('Warehouse', WarehouseSchema);
  const tenantModel = mongoose.model('Tenant', TenantSchema);
  const templateModel = mongoose.model('Template', TemplateSchema);
  const userModel = mongoose.model('User', UserSchema);

  const orderRepo = new MongoOrderRepository(orderModel);
  const paymentRepo = new MongoPaymentRepository(paymentModel);
  const shiftRepo = new MongoShiftRepository(shiftModel);
  const productRepo = new MongoProductRepository(productModel);
  const stockRepo = new MongoStockRepository(stockModel);
  const stockMovementRepo = new MongoStockMovementRepository(stockMovementModel);
  const warehouseRepo = new MongoWarehouseRepository(warehouseModel);
  const tenantRepo = new MongoTenantRepository(tenantModel);
  const userRepo = new MongoUserRepository(userModel);
  const templateRepo = new MongoTemplateRepository(templateModel);

  const inventoryService = new InventoryService(stockRepo, stockMovementRepo, warehouseRepo, eventBus);
  const shiftService = new ShiftService(shiftRepo, undefined, orderRepo, userRepo);
  const taxService = buildTaxServiceMock();
  const shiftRepoForEnforcement = options.enforceShift ? shiftRepo : undefined;

  const createOrderService = new CreateOrderService(orderRepo, eventBus, userRepo, shiftRepoForEnforcement);
  const voidApprovalService: any = undefined;
  const makeOrderServices = () => ({
    update: new UpdateOrderService(orderRepo, eventBus),
    replaceItems: new ReplaceOrderItemsService(orderRepo, eventBus),
    voidOrder: new VoidOrderService(orderRepo, eventBus, voidApprovalService, inventoryService),
    voidItem: new VoidItemService(orderRepo, eventBus, voidApprovalService, inventoryService),
    payOrder: new PayOrderService(orderRepo, eventBus, userRepo),
    voidPayment: new VoidPaymentService(orderRepo, eventBus, voidApprovalService),
    reopen: new ReopenOrderService(orderRepo, eventBus),
    splitItem: new SplitItemService(orderRepo, eventBus, createOrderService),
    removeItem: new RemoveItemService(orderRepo, eventBus),
    updateQty: new UpdateItemQuantityService(orderRepo, eventBus),
    voidRollback: new VoidAndRollbackService(orderRepo, eventBus, voidApprovalService, inventoryService),
    topay: new TopayService(orderRepo, eventBus, userRepo),
    refund: new RefundService(orderRepo, eventBus),
    applyDiscount: new ApplyDiscountService(orderRepo, eventBus),
    setSC: new SetServiceChargeService(orderRepo, eventBus),
    hold: new HoldOrderService(orderRepo, eventBus, inventoryService),
    recall: new RecallOrderService(orderRepo, eventBus, inventoryService),
    closeBill: new CloseBillService(orderRepo, eventBus, inventoryService),
  });

  const paymentService = new PaymentService(
    paymentRepo,
    orderRepo,
    null as any,
    tenantRepo,
    taxService as any,
    null as any,
    eventBus,
    null as any,
    inventoryService,
    userRepo,
    shiftRepoForEnforcement,
    null as any,
    null as any,
  );

  const templateService = new TemplateService(templateRepo);
  const invoiceRenderService = new InvoiceRenderService(templateService);

  const s = makeOrderServices();
  const orderController = new OrderController(
    createOrderService,
    s.update,
    s.replaceItems,
    s.voidOrder,
    s.voidItem,
    s.payOrder,
    s.voidPayment,
    s.reopen,
    s.splitItem,
    s.removeItem,
    s.updateQty,
    s.voidRollback,
    s.topay,
    s.refund,
    s.applyDiscount,
    s.setSC,
    s.hold,
    s.recall,
    s.closeBill,
    orderRepo,
    paymentRepo,
    tenantRepo,
    invoiceRenderService,
  );
  const paymentController = new PaymentController(paymentService);
  const shiftController = new ShiftController(shiftService);
  const productService = new ProductService(productRepo, eventBus);
  const productController = new ProductController(productService);
  const inventoryController = new InventoryController(inventoryService);

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/orders', createOrderRoutes(orderController));
  app.use('/api/payments', createPaymentRoutes(paymentController));
  app.use('/api/shifts', createShiftRoutes(shiftController));
  app.use('/api/products', createProductRoutes(productController));
  app.use('/api/inventory', createInventoryRoutes(inventoryController));
  app.use(errorHandler);

  return {
    app,
    orderRepo, paymentRepo, shiftRepo, productRepo, stockRepo, stockMovementRepo, warehouseRepo, tenantRepo, templateRepo,
    orderModel, paymentModel, shiftModel, productModel, stockModel, stockMovementModel, warehouseModel, tenantModel, templateModel,
    orderService: createOrderService,
    paymentService,
    shiftService,
    inventoryService,
    token,
    tenantId,
    userId,
  };
}