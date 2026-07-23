# POSMono - Roadmap Implementasi Fase 1

> Comparative analysis of POS_CURRENT_FEATURES vs current DDD codebase
> Date: July 2026
> Last updated: July 22, 2026

---

## Status Domain Mapping

| Domain | POS_CURRENT_FEATURES | DDD Saat Ini | Status |
|--------|---------------------|--------------|--------|
| Auth | Login (userId/email), JWT 7 days, supervisor auth | AuthService, TokenService, JwtStrategy | ✅ |
| User | CRUD, password bcrypt, role & outlet assignment | User aggregate + MongoUserRepository | ✅ |
| Role | 30+ granular permissions, system roles | Role entity + Permission value object | ✅ |
| Outlet | Multi-outlet scoping | Tenant bounded context | ✅ |
| Family | Top-level grouping, linked to family | Family aggregate + MongoFamilyRepository + FamilyService | ✅ |
| Category | CRUD, linked to category | Category entity with familyId/parentId | ✅ |
| Product | price, cost, stock, barcode, modifiers, image, taxes, discounts | Product entity + Modifier entity separate | ✅ |
| Modifier | name, options[], price, per product/family, required | Modifier aggregate + MongoModifierRepository | ✅ |
| Member | tier, totalOrders, totalSpend, phone search | Customer aggregate with IAddress, loyaltyPoints, recordVisit, search | ✅ |
| Tax | 35 fields, 9 scopes, TaxRule with conditions, DPP fraction | TaxConfiguration + TaxRule + Engine exist | ✅ |
| Discount | 4 types: percentage, nominal, buy_x_get_y, min_purchase | DiscountConfiguration + Rule + Engine exist | ✅ |
| Promotion | 14 rule types, exclusive/stackable, usage limits | Promotion aggregate + 14 rule types + evaluator + service + controller | ✅ |
| Payment Method | split, rounding per method, card last four | Payment domain with split, refund, Midtrans | ✅ |
| Order | state machine, tax detail, void item, void payment, split, topay | Order domain + 15 services, full state machine | ✅ |
| Closing | Shift status, CashPickup, payment bd breakdown, expected/actual difference | Shift aggregate + cashPickup + updateSales + paymentBreakdown | ✅ |
| Report | Sales/Finance/Cashier/Member/Product/Tax reports | DailyMetric + ReportAggregation + ReportService | ✅ |
| Setting | transactionType, menu config, order number prefix | Setting aggregate + KeyValue store + 5 routes | ✅ |
| Upload | image processing, Sharp, Multer | UploadService with multer + sharp + 3 routes | ✅ |

---

## Phase 1.1: Core POS Operations

### Step 1: Order domain upgrade ✅ DONE

**Implemented Fields:**
- orderNumber format: `ORD-YYYYMMDD-XXXX` ✅
- voidedAt, voidedBy, voidedByName, voidedReason, voidedItems ✅
- transactionType: dine_in, takeaway, delivery, online ✅
- tableNumber, customerName ✅
- paymentBreakdown[] ✅
- serviceCharge / serviceChargeRate ✅
- dppTotal ✅
- discountTotal / discountBreakdown ✅
- promotions[] ✅
- splitting functionality (SplitItemService) ✅
- topay (combined cash+non-cash payment) ✅

**Implemented States:**
- draft, confirmed, paid, preparing, completed, cancelled, refunded, voided, partially-voided ✅

**Implemented Events:**
- ordering.order.created ✅
- ordering.order.confirmed ✅
- ordering.order.voided ✅
- ordering.order.item-voided ✅
- ordering.order.refunded ✅
- ordering.order.payment_voided ✅
- ordering.order.paid ✅
- ordering.order.reopened ✅

**Implemented Services (15 use cases):**
- CreateOrderService ✅
- UpdateOrderService ✅
- VoidOrderService ✅
- VoidItemService ✅
- PayOrderService ✅
- VoidPaymentService ✅
- ReopenOrderService ✅
- SplitItemService ✅
- RemoveItemService ✅
- UpdateItemQuantityService ✅
- VoidAndRollbackService ✅
- TopayService ✅ (combined cash+non-cash)
- RefundService ✅
- ApplyDiscountService ✅
- SetServiceChargeService ✅

**Domain Methods:**
- applyDiscount(discountBreakdown) ✅
- setServiceCharge(rate) ✅
- setRoundingMethod(method) ✅
- refund(refundedBy, refundedByName, reason) ✅
- topay(paymentBreakdown, cashierId, cashierName) ✅

**recalculateTotals() logic:**
- discountTotal from discountBreakdown[] ✅
- dppTotal = subtotal - discountTotal ✅
- serviceCharge = afterDiscount * serviceChargeRate ✅
- rounding: nearest/up/down ✅

**Files:**
- `backend/src/core/ordering/domain/Order.ts` - Order aggregate root with full state machine
- `backend/src/core/ordering/domain/__tests__/Order.test.ts` - 47 unit tests
- `backend/src/core/ordering/application/services/OrderService.ts` - 15 use case services
- `backend/src/core/ordering/infrastructure/persistence/schemas/OrderSchema.ts` - full Mongoose schema
- `backend/src/core/ordering/infrastructure/persistence/MongoOrderRepository.ts` - repository + aggregations
- `backend/src/core/ordering/interfaces/http/controllers/OrderController.ts` - full controller
- `backend/src/core/ordering/interfaces/http/routes/order.routes.ts` - 17 routes

### Step 2: Order controller endpoints ✅ DONE

**Implemented Routes:**
- GET /api/orders ✅
- GET /api/orders/:id ✅
- POST /api/orders ✅
- PUT /api/orders/:id ✅
- POST /api/orders/:id/pay ✅
- POST /api/orders/:id/topay ✅
- POST /api/orders/:id/void ✅
- POST /api/orders/:id/void-item ✅
- POST /api/orders/:id/void-payment ✅
- POST /api/orders/:id/void-rollback ✅
- POST /api/orders/:id/refund ✅
- POST /api/orders/:id/apply-discount ✅
- POST /api/orders/:id/service-charge ✅
- POST /api/orders/:id/split-item ✅
- PATCH /api/orders/:id/reopen ✅
- DELETE /api/orders/:id/item ✅
- PATCH /api/orders/:id/item/quantity ✅

### Step 3: Cashier Frontend components ✅ DONE

**Implemented Components:**
- TransactionHistory Component (recent 15 transactions, expand/collapse, void buttons) ✅
- VoidOrderModal Component (reason, confirmation checkbox, void entire order) ✅
- VoidItemModal Component (item selection with radio, reason, confirmation) ✅
- VoidPayment Component (payment method selection, reason, confirmation) ✅

**Implemented Hooks:**
- useRecentOrders(limit) - fetches recent orders with 15s auto-refresh ✅
- useVoidOrder() - mutation for voiding entire order ✅
- useVoidItem() - mutation for voiding specific item ✅

**UI Features:**
- Status color badges (draft, confirmed, paid, preparing, completed, cancelled, refunded, voided, partially-voided) ✅
- Voidable status check: paid, confirmed, partially-voided ✅
- Payment breakdown display with method labels (Tunai, QRIS, Transfer, Kartu) ✅
- Voided items display with red background ✅
- Supervisor user info from auth store ✅

**Files:**
- `frontend/src/core/orders/components/TransactionHistory.tsx` - 167 lines
- `frontend/src/core/orders/components/VoidOrderModal.tsx` - 113 lines
- `frontend/src/core/orders/components/VoidItemModal.tsx` - 145 lines
- `frontend/src/core/orders/components/VoidPayment.tsx` - 155 lines
- `frontend/src/core/orders/hooks/useOrders.ts` - useVoidOrder, useVoidItem, useRecentOrders hooks
- `frontend/src/core/orders/pages/OrderListPage.tsx` - Full order list with void actions

---

## Phase 1.2: Payment and Shift enhancements

### Step 4: Payment upgrades ✅ DONE

**Implemented Fields:**
- splitBills (array of portion) ✅
- qrCodeUrl ✅
- paymentTransactionId (from Midtrans) ✅
- provider ✅
- cardLastFour ✅

**Implemented Entities:**
- Payment aggregate (with complete, fail, refund, split methods) ✅
- Refund aggregate (standalone, persisted to `refunds` collection) ✅

**Implemented Services:**
- payCash (creates order + payment in one flow) ✅
- processByOrderId (pay existing order by orderId) ✅
- refund (creates Refund entity, updates Payment status) ✅
- payOpenBill (pay order with existing breakdown) ✅
- splitBill (split payment across multiple methods) ✅
- getByOrder, list ✅

**Implemented Routes:**
- GET /api/payments ✅
- GET /api/payments/:orderId ✅
- POST /api/payments/pay-cash ✅
- POST /api/payments/process ✅
- POST /api/payments/:id/refund ✅
- POST /api/payments/split ✅

**Files:**
- `backend/src/core/payment/domain/Payment.ts` - Payment aggregate root
- `backend/src/core/payment/domain/Refund.ts` - Refund aggregate root (standalone)
- `backend/src/core/payment/domain/PaymentMethod.ts` - PaymentMethod entity
- `backend/src/core/payment/application/services/PaymentService.ts` - 6 service methods
- `backend/src/core/payment/infrastructure/persistence/schemas/PaymentSchema.ts` - Payment + SplitBill schemas
- `backend/src/core/payment/infrastructure/persistence/schemas/RefundSchema.ts` - Refund schema
- `backend/src/core/payment/infrastructure/persistence/MongoPaymentRepository.ts` - Payment repository
- `backend/src/core/payment/infrastructure/persistence/MongoRefundRepository.ts` - Refund repository
- `backend/src/core/payment/interfaces/http/controllers/PaymentController.ts` - 6 endpoints
- `backend/src/core/payment/interfaces/http/routes/payment.routes.ts` - 6 routes

### Step 5: Shift enhancement ✅ DONE

**Implemented Fields:**
- physicalCash ✅
- expectedCash ✅
- totalCashPickups ✅
- totalSales/cashSales/nonCash ✅
- totalTransactions ✅
- paymentBreakdown[] ✅
- cashPickups[] ✅

**Implemented Actions:**
- cashPickup (amount, reason, pickedAt, pickedBy) ✅
- expectedCash = openingCash + cashSales - totalCashPickups ✅

**Implemented Service:**
- openShift (register) ✅
- closeShift (physicalCash) ✅
- cashPickup ✅
- updateSales ✅

**Implemented Routes:**
- GET  /shifts/active ✅
- POST /shifts/open ✅
- POST /shifts/:id/close ✅
- POST /shifts/:id/pickup ✅
- PUT  /shifts/:id/sales ✅

**Files:**
- `backend/src/core/pos/domain/Shift.ts` - ICashPickup, IPaymentBreakdownEntry, addCashPickup(), updateSales()
- `backend/src/core/pos/infrastructure/persistence/schemas/ShiftSchema.ts` - CashPickupSchema, PaymentBreakdownEntrySchema
- `backend/src/core/pos/infrastructure/persistence/MongoShiftRepository.ts` - findActiveShifts()
- `backend/src/core/pos/application/services/ShiftService.ts` - cashPickup(), updateSales(), getActiveShifts()
- `backend/src/core/pos/interfaces/http/controllers/ShiftController.ts` - cashPickup(), updateSales(), getActive()
- `backend/src/core/pos/interfaces/http/routes/shift.routes.ts` - /active, /:id/pickup, /:id/sales

---

## Phase 1.3: Catalog/Product enhancements

### Step 6: Modifiers ✅ DONE

**Created Modifier entity:**

```typescript
// backend/src/core/catalog/domain/Modifier.ts

interface IModifier {
  id: string;
  tenantId: string;
  productId: string | null; // null = global
  familyId: string | null;
  name: string;
  options: IModifierOption[];
  required: boolean;
  isActive: boolean;
}
```

**Implemented Features:**
- GET /api/modifiers ✅
- POST /api/modifiers ✅
- PUT /api/modifiers/:id ✅
- DELETE /api/modifiers/:id ✅
- GET /api/modifiers/global ✅
- GET /api/modifiers/product/:productId ✅
- GET /api/modifiers/family/:familyId ✅

**Files:**
- `backend/src/core/catalog/domain/Modifier.ts` - Modifier aggregate root
- `backend/src/core/catalog/infrastructure/persistence/schemas/ModifierSchema.ts` - ModifierOptionSchema, ModifierSchema
- `backend/src/core/catalog/infrastructure/persistence/MongoModifierRepository.ts` - findByProduct(), findByFamily(), findGlobal()
- `backend/src/core/catalog/application/services/ModifierService.ts` - full CRUD + listByProduct/Family/Global
- `backend/src/core/catalog/interfaces/http/controllers/ModifierController.ts`
- `backend/src/core/catalog/interfaces/http/routes/modifier.routes.ts`

### Step 7: Enhance Category/Product ✅ DONE

**Implemented:**
- Add familyId to Category ✅
- Add parentId to Category ✅ (already existed)
- Add bc field to Product ✅
- Add country/region/currency to Product ✅
- Auto-generate slug for barcode from product name ✅

**Files updated:**
- `backend/src/core/catalog/application/services/ProductService.ts` - bc, country, region, currency in inputs; auto-slug barcode
- `shared/src/validation/schemas/product-schemas.ts` - bc, imageUrls, country, region, currency in Zod schema

### Step 7b: Family Domain ✅ DONE

**Created Family aggregate:**

```typescript
// backend/src/core/catalog/domain/Family.ts

type MenuType = 'food' | 'beverage';

interface IFamily {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  menuType: MenuType;  // top-level menu classification
  sortOrder: number;
  isActive: boolean;
}
```

**Implemented Features:**
- GET /api/families ✅
- GET /api/families/by-menu-type/:menuType ✅
- POST /api/families ✅
- PUT /api/families/:id ✅
- DELETE /api/families/:id ✅
- GET /api/categories/by-family/:familyId ✅

**3-Level Menu Hierarchy:**
```
Menu Type (Food / Beverage)
  └── Family (Western, Asia, Hot Drinks, etc.)
       └── Category (Main Course, Coffee, etc.)
            └── Product
```

**Files:**
- `backend/src/core/catalog/domain/Family.ts` - Family aggregate root
- `backend/src/core/catalog/infrastructure/persistence/schemas/FamilySchema.ts`
- `backend/src/core/catalog/infrastructure/persistence/MongoFamilyRepository.ts`
- `backend/src/core/catalog/application/services/FamilyService.ts`
- `backend/src/core/catalog/interfaces/http/controllers/FamilyController.ts`
- `backend/src/core/catalog/interfaces/http/routes/family.routes.ts`

**Updated Category:**
- `backend/src/core/catalog/domain/Category.ts` - added familyId field
- `backend/src/core/catalog/infrastructure/persistence/schemas/CategorySchema.ts` - added familyId index
- `backend/src/core/catalog/infrastructure/persistence/MongoCategoryRepository.ts` - added findByFamily()
- `backend/src/core/catalog/application/services/CategoryService.ts` - added listByFamily(), familyId in create/update
- `backend/src/core/catalog/interfaces/http/controllers/CategoryController.ts` - added familyId in schema, listByFamily()
- `backend/src/core/catalog/interfaces/http/routes/category.routes.ts` - added /by-family/:familyId

---

## Phase 1.4: Reporting enhancements ✅ DONE

### Step 11b: Report infrastructure ✅ DONE

**Created Report infrastructure:**

```typescript
// backend/src/core/reporting/domain/Report.ts

interface IDailyMetric {
  id: string;
  tenantId: string;
  date: string;
  metrics: {
    totalOrders: number;
    totalRevenue: number;
    totalCustomers: number;
    avgOrderValue: number;
    topProducts: Array<{ productId: string; name: string; total: number }>;
    paymentMethodBreakdown: Record<string, number>;
  };
}
```

**Implemented Features:**
- GET /api/reports/dashboard ✅
- GET /api/reports/daily ✅
- GET /api/reports/sales ✅
- GET /api/reports/cashier ✅
- GET /api/reports/daily-metrics ✅
- POST /api/reports/daily-metrics/generate ✅

**Aggregation Pipelines:**
- getDailySalesAggregation - total orders, revenue, items, avg order value
- getPaymentBreakdownAggregation - payment method breakdown
- getTopProductsAggregation - top selling products with revenue
- getCashierPerformanceAggregation - cashier performance metrics
- getSalesByCategoryAggregation - sales grouped by category

**Files:**
- `backend/src/core/reporting/domain/Report.ts` - DailyMetric with update() method
- `backend/src/core/reporting/infrastructure/persistence/schemas/DailyMetricSchema.ts` - new
- `backend/src/core/reporting/infrastructure/persistence/MongoDailyMetricRepository.ts` - new
- `backend/src/core/reporting/infrastructure/aggregation/ReportAggregation.ts` - 5 aggregation pipelines
- `backend/src/core/reporting/application/services/ReportService.ts` - enhanced with aggregation
- `backend/src/core/reporting/interfaces/http/controllers/ReportController.ts` - added cashier, dailyMetrics, generateDailyMetric
- `backend/src/core/reporting/interfaces/http/routes/report.routes.ts` - added new routes

**DI Registration:**
- `backend/src/bootstrap/container.ts` - registered Family, Modifier, DailyMetric, ReportAggregation
- `backend/src/bootstrap/routes.ts` - mounted /api/families, /api/modifiers routes

---

## Phase 2: Advanced features

### Step 8: Promotion domain ✅ DONE

**Implemented 14 Rule Types:**
- min_purchase, min_items, buy_x_get_y ✅
- percentage_off, nominal_off, fixed_price ✅
- free_item, bundle_price ✅
- product_match, category_match ✅
- day_of_week, date_range, time_range, customer_tag ✅

**Implemented Fields:**
- name, code, description, priority ✅
- exclusive, stackable ✅
- ruleLogic: AND / OR ✅
- rules[] with type + params ✅
- effects[] with type/value/target/maxDiscount ✅
- usageLimit, usedCount ✅
- minPurchase, isActive ✅
- validFrom, validUntil ✅
- metadata ✅

**Implemented Methods:**
- isApplicable(context) - evaluates all rules with AND/OR logic ✅
- evaluateRule(rule, context) - per-rule condition evaluator ✅
- calculateDiscount(context) - computes discount breakdown ✅
- incrementUsage(), activate(), deactivate() ✅

**Implemented Services:**
- create (with code uniqueness check) ✅
- update ✅
- getById, list, getActive ✅
- validate (check code + conditions) ✅
- apply (calculate discount + increment usage) ✅
- delete ✅

**Implemented Routes:**
- GET /api/promotions ✅
- GET /api/promotions/:id ✅
- POST /api/promotions ✅
- PUT /api/promotions/:id ✅
- POST /api/promotions/validate ✅
- POST /api/promotions/apply ✅
- DELETE /api/promotions/:id ✅

**Files:**
- `backend/src/core/promotion/domain/Promotion.ts` - Promotion aggregate root with 14 rule types, isApplicable, calculateDiscount
- `backend/src/core/promotion/application/services/PromotionService.ts` - 7 service methods
- `backend/src/core/promotion/infrastructure/persistence/schemas/PromotionSchema.ts` - Mongoose schema with rule/effect subdocuments
- `backend/src/core/promotion/infrastructure/persistence/MongoPromotionRepository.ts` - repository with findByCode, findActive
- `backend/src/core/promotion/interfaces/http/controllers/PromotionController.ts` - 7 endpoints with Zod validation
- `backend/src/core/promotion/interfaces/http/routes/promotion.routes.ts` - 7 routes

### Step 9: Geo/Location address migration ✅ DONE

**Implemented Fields:**
- IAddress struct: street, city, state, country, postalCode ✅
- address field accepts both `IAddress` and `string` (backward compatible) ✅
- loyaltyPoints field ✅
- totalVisits, totalSpent, lastVisitAt ✅
- phone, tags, email ✅

**Implemented Domain Methods:**
- recordVisit(amount) - increments visits, total spent, last visit ✅
- addLoyaltyPoints(points) - adds loyalty points ✅
- setAddress(address) - updates address ✅

**Implemented Services:**
- create ✅
- update ✅
- getById, list ✅
- searchByPhone ✅
- search (name, phone, email) ✅
- recordVisit ✅
- addLoyaltyPoints ✅
- delete ✅

**Implemented Routes:**
- GET /api/members ✅
- GET /api/members/search?q= ✅
- GET /api/members/phone/:phone ✅
- GET /api/members/:id ✅
- POST /api/members ✅
- PUT /api/members/:id ✅
- POST /api/members/:id/record-visit ✅
- POST /api/members/:id/loyalty-points ✅
- DELETE /api/members/:id ✅

**Files:**
- `backend/src/core/customer/domain/Customer.ts` - Customer aggregate with IAddress, loyaltyPoints, recordVisit, addLoyaltyPoints
- `backend/src/core/customer/application/services/CustomerService.ts` - 9 service methods
- `backend/src/core/customer/infrastructure/persistence/schemas/CustomerSchema.ts` - AddressSchema + loyaltyPoints
- `backend/src/core/customer/infrastructure/persistence/MongoCustomerRepository.ts` - with IAddress support
- `backend/src/core/customer/interfaces/http/controllers/CustomerController.ts` - 9 endpoints with address schema
- `backend/src/core/customer/interfaces/http/routes/customer.routes.ts` - 9 routes
- `frontend/src/core/members/hooks/useMembers.ts` - React Query hooks
- `frontend/src/core/members/pages/MemberListPage.tsx` - CRUD UI with search

### Step 10: Upload service ✅ DONE

**Implemented Features:**
- Multer memoryStorage, 10MB limit ✅
- Sharp image processing (resize, format conversion to webp, quality control) ✅
- Allowed MIME types: jpeg, png, webp, gif ✅
- UUID filename generation ✅
- Disk write to `backend/uploads/` ✅
- URL pattern: `/uploads/{folder}/{filename}` ✅

**Implemented Routes:**
- POST /api/upload (single file) ✅
- POST /api/upload/multiple (up to 10 files) ✅
- DELETE /api/upload (delete file) ✅

**Files:**
- `backend/src/core/upload/application/services/UploadService.ts` - multer config, sharp processing, upload/delete
- `backend/src/core/upload/interfaces/http/controllers/UploadController.ts` - single/multiple/delete endpoints
- `backend/src/core/upload/interfaces/http/routes/upload.routes.ts` - 3 routes with auth

### Step 11: Reporting aggregation ✅ DONE

See Phase 1.4 above.

### Step 12: Settings store ✅ DONE

**Implemented Fields:**
- key (unique per tenant) ✅
- value (Mixed/any) ✅
- category (default: 'general') ✅
- description ✅

**Implemented Services:**
- get (by key) ✅
- getAll (with optional category filter) ✅
- set (upsert by key) ✅
- setMany (batch upsert) ✅
- delete (by key) ✅

**Implemented Domain Methods:**
- Setting.create() ✅
- Setting.hydrate() ✅
- Setting.updateValue() - fires settings.key.updated event ✅

**Implemented Routes:**
- GET /api/settings (list, optional ?category=) ✅
- GET /api/settings/:key ✅
- PUT /api/settings (upsert single) ✅
- PUT /api/settings/bulk (batch upsert) ✅
- DELETE /api/settings/:key ✅

**Files:**
- `backend/src/core/settings/domain/Setting.ts` - Setting aggregate with updateValue domain event
- `backend/src/core/settings/application/services/SettingService.ts` - get, getAll, set, setMany, delete
- `backend/src/core/settings/infrastructure/persistence/schemas/SettingSchema.ts` - key+tenant unique index
- `backend/src/core/settings/infrastructure/persistence/MongoSettingRepository.ts` - findByKey, upsertByKey
- `backend/src/core/settings/interfaces/http/controllers/SettingController.ts` - 5 endpoints
- `backend/src/core/settings/interfaces/http/routes/setting.routes.ts` - 5 routes

### Step 13: API testing ✅ DONE

**Domain Unit Tests (52 tests):**
- Promotion.test.ts (35 tests): create, isApplicable (14 rule types, AND/OR logic), calculateDiscount (percentage, nominal, fixed_price, free_item, bundle_price, maxDiscount, no effects), incrementUsage, activate/deactivate, hydrate, serialize
- Customer.test.ts (17 tests): create, recordVisit, addLoyaltyPoints, setAddress (string + IAddress struct), hydrate, serialize

**Service Tests (34 tests):**
- PromotionService.test.ts (16 tests): create (with code uniqueness), update, getById, list, validate (applicable/not found/not applicable), apply, delete
- CustomerService.test.ts (18 tests): create, update, getById, list, searchByPhone, search, recordVisit, addLoyaltyPoints, delete (with tenant isolation)

**Test Fixtures:**
- `tests/fixtures/promotion.fixtures.ts` - validPromotionInput, validPromotionWithUsageLimit
- `tests/fixtures/customer.fixtures.ts` - validCustomerInput, validCustomerInputNoMember

**Test Results:** 544 passed, 17 pre-existing failures (Shift close logic, PaymentService mock, integration tests)

---

## Dependencies

```mermaid
graph TD
    A[Order domain upgrade] --> B[Payment domain upgrade]
    A --> C[Shift domain gifts]
    D[Product domain] --> E[Modifier domain]
    B --> F[Order-Payment integration]
    B --> G[Payment-Member (User) integration]
    C --> H[Shift-Report integration]
    E --> I[Frontend Modifier picker]
    F --> J[Frontend Payment Modal refactor]
    J --> K[Frontend Receipt display refactor]
    K --> L[Frontend Transaction History]
```

## Estimated Timeline

| Step | Week | Deliverable | Status |
|------|------|-------------|--------|
| 1 | 1 | Order domain updated with void, split, partial void, paymentBreakdown, topay, refund, discount, service charge, rounding | ✅ Done |
| 2 | 1 | Order controller updated with all 17 endpoints | ✅ Done |
| 3 | 2 | Cashier frontend components (TransactionHistory, VoidOrderModal, VoidItemModal, VoidPayment) | ✅ Done |
| 4 | 2 | Payment domain: split, refund entity, processByOrderId, payOpenBill, splitBill | ✅ Done |
| 5 | 3 | Shift domain updated with cash pickup and report | ✅ Done |
| 6 | 3 | Modifier domain created | ✅ Done |
| 6b | 3 | Family domain created, Category enhanced with familyId | ✅ Done |
| 7 | 4 | Product and category enhancements | ✅ Done |
| 7b | 4 | Report infrastructure, aggregation pipelines | ✅ Done |
| 8 | 5-6 | Promotion domain, service, route | ✅ Done |
| 9 | 7 | Customer domain synchronization | ✅ Done |
| 10 | 7 | Upload service | ✅ Done |
| 11 | 8 | ~~Reporting aggregation pipelines~~ | ✅ Done |
| 12 | 8 | Setting store | ✅ Done |
| 13 | 9-10 | Testing | ✅ Done |

---

## Summary

**Completed (15/15 steps):**
- Step 1: Order domain upgrade ✅
- Step 2: Order controller endpoints ✅
- Step 3: Cashier frontend components ✅
- Step 4: Payment upgrades ✅
- Step 5: Shift enhancement ✅
- Step 6: Modifiers ✅
- Step 6b: Family domain ✅
- Step 7: Category + Product enhancements ✅
- Step 7b: Report infrastructure ✅
- Step 8: Promotion domain ✅
- Step 9: Customer/Member domain ✅
- Step 10: Upload service ✅
- Step 11: Reporting aggregation ✅
- Step 12: Settings store ✅
- Step 13: API testing ✅

**All steps completed!**

---

## Phase 2: Stabilization & Enhancement (Plan)

> Created: July 22, 2026
> Status: Planning

### Priority 1: Fix Pre-existing Test Failures

- [ ] Fix Shift close logic — `expectedTotal` not including `updateSales` amounts (Shift.test.ts, ShiftService.test.ts, MongoShiftRepository.test.ts)
- [ ] Fix PaymentService percentage discount mock — test expects `5000` but gets `10` (PaymentService.test.ts)
- [ ] Fix integration tests — order-payment-flow, tenant-isolation, void-item returning 500 (likely missing DI wiring in test app bootstrap)

### Priority 2: POS Frontend Refinement

- [x] Receipt display refactor — print-ready format, promo breakdown display
- [x] Hold order functionality — save draft order, recall later ✅ (Hold/Recall with collapsible sidebar)
- [x] Customer name & table number fields above cart
- [x] Inclusive/exclusive tax pricing (SC & PPN extracted from price or added on top)
- [x] Split bill — pay one at a time (item checkboxes, sequential partial payments, ORD-xxx/N numbering)
- [ ] Keyboard shortcuts — F1 search, F2 pay, F3 hold, Esc cancel
- [ ] Real-time order updates via WebSocket

### Priority 3: Order-Payment Integration

- [ ] Auto `recordVisit()` when order is paid (wire CustomerService into PaymentService)
- [ ] Auto `addLoyaltyPoints()` based on spend (configurable points-per-rupiah)
- [ ] Customer search in POS page (phone lookup before payment)

### Priority 4: Supervisor Auth

- [ ] PIN-based supervisor authentication for void actions
- [ ] Supervisor session timeout (configurable)
- [ ] Audit log for supervisor actions

### Priority 5: Midtrans Integration

- [ ] Sandbox mode toggle (SettingStore key: `midtrans.sandbox`)
- [ ] Webhook handler for payment notifications
- [ ] QRIS generation via Midtrans API

### Priority 6: Frontend Promotion Rule Builder

- [ ] Visual rule builder UI (drag-and-drop conditions)
- [ ] Effect configuration (percentage, nominal, free item, bundle)
- [ ] Preview discount before saving

### Priority 7: DevOps & Deployment

- [ ] Docker Compose for local dev (MongoDB, backend, frontend)
- [ ] GitHub Actions CI (lint, test, build)
- [ ] Environment-based config (.env.staging, .env.production)

### Priority 8: Performance & Optimization

- [ ] MongoDB index audit — ensure all query patterns are indexed
- [ ] Redis caching for frequently accessed configs (tax, discount, promotion)
- [ ] Pagination optimization for large order lists

### Priority 9: Phase 2 Features (Future)

- [ ] Multi-outlet reporting aggregation
- [ ] Inventory sync across outlets
- [ ] Customer loyalty program tiers (Bronze/Silver/Gold/Platinum)
- [ ] Gift card / voucher system
- [ ] Table management (QR code per table)
