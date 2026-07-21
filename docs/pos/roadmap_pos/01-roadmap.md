# POSMono - Roadmap Implementasi Fase 1

> Comparative analysis of POS_CURRENT_FEATURES vs current DDD codebase
> Date: July 2026

---

## Status Domain Mapping

| Domain | POS_CURRENT_FEATURES | DDD Saat Ini | Status |
|--------|---------------------|--------------|--------|
| Auth | Login (userId/email), JWT 7 days, supervisor auth | AuthService, TokenService, JwtStrategy | ✅ |
| User | CRUD, password bcrypt, role & outlet assignment | User aggregate + MongoUserRepository | ✅ |
| Role | 30+ granular permissions, system roles | Role entity + Permission value object | ✅ |
| Outlet | Multi-outlet scoping | Tenant bounded context | ✅ |
| Family | Top-level grouping, linked to category | Family aggregate + MongoFamilyRepository + FamilyService | ✅ |
| Category | CRUD, linked to family | Category entity with familyId/parentId | ✅ |
| Product | price, cost, stock, barcode, modifiers, image, taxes, discounts | Product entity + Modifier entity separate | ✅ |
| Modifier | name, options[], price, per product/family, required | Modifier aggregate + MongoModifierRepository | ✅ |
| Member | tier, totalOrders, totalSpend, phone search | Customer domain (only stub) | 🔴 |
| Tax | 35 fields, 9 scopes, TaxRule with conditions, DPP fraction | TaxConfiguration + TaxRule + Engine exist | ✅ |
| Discount | 4 types: percentage, nominal, buy_x_get_y, min_purchase | DiscountConfiguration + Rule + Engine exist | ✅ |
| Promotion | 14 rule types, exclusive/stackable, usage limits | Missing (Promotion entity not built) | 🔴 |
| Payment Method | split, rounding per method, card last four | Payment domain (basic, split/Rounding not built) | 🔴 |
| Order | state machine, tax detail, void item, void payment, split, topay (pay with cash+non-cash) | Order domain, OrderService basic exist | 🔴 |
| Closing | Shift status, CashPickup, payment bd breakdown, expected/actual difference | Shift aggregate + cashPickup + updateSales + paymentBreakdown | ✅ |
| Report | Sales/Finance/Cashier/Member/Product/Tax reports | DailyMetric + ReportAggregation + ReportService | ✅ |
| Setting | transactionType, menu config, order number prefix | Missing | 🔴 |
| Upload | image processing, Sharp, Multer | Missing | 🔴 |

---

## Phase 1.1: Core POS Operations (0.5 months)

### Step 1: Migrate Order related features from POS_CURRENT ✅ PENDING

Add to existing Order domain:

**Missing Fields:**
- orderNumber format: `ORD-YYYYMMDD-XXXX`
- voidedAt, voidedBy, voidedByName, voidedReason, voidedItems
- transactionType: dine_in, takeaway, delivery, online
- tableNumber, customerName
- paymentBreakdown[]
- serviceCharge/ServiceServiceChargeRate
- dppTotal
- discountTotal/ discountBreakdown
- promotions[]
- splitting functionality
- topay

Actions:

**Domain:**
```typescript
// backend/src/core/ordering/domain/Order.ts

type TransactionType = 'dine_in' | 'takeaway' | 'delivery' | 'online'

interface IBreakdownEntry {
  method: string;
  code: string;
  amount: number;
  change: number;
  cardLastFour: string;
}

interface IPromotionBreakdown {
  id: string;
  name: string;
  totalDiscount: number;
}
```

**Missing states:**
- voided
- partially-voided

**Events:**
- ordering.order.voided
- ordering.order.item_voided
- ordering.order.refunded

**Service:**
- createOrder
- addOrderItem
- removeOrderItem
- updateItemQuantity
- voidOrder
- voidItem
- voidAndRollback
- voidPayment
- reopen

**Schema:**
- Add paymentBreakdown
- Add transactionType
- Add void-related fileds

IAdd these fields to OrderSchema.

### Step 2: migrate Order related Controller endpoints ✅ PENDING

**Missing routes:**
- GET /orders/:id
- POST /orders/:id/void
- POST /orders/:id/void-item
- POST /orders/:id/void-payment
- PUT /orders/:id/pay
- PATCH /orders/:id/close-open

### Step 3: Implement Cashier Frontend components ✅ PENDING

Create in frontend:

- TransactionHistory Component (recent transactions, void, void item)
- VoidOrderModal Component
- VoidItemModal Component
- VoidPayment Component

Also stripe notification strings to determine supervisor authentication.

---

## Phase 1.2: Payment and Shift enhancements

### Step 4: Payment upgrades ✅ PENDING

**Missing Fields:**
- splitBills (array of portion)
- This reminds patient; clear.
- qrCodeUrl
- paymentTransactionId (from Midtrans)
- provider
- cardLastFour

**New entities:**
- Refund (reason, status)

**Service upgrades:**
- Process payment by order id and amount
- Process refund (from void)
- Pay open bill
- Split bill (for restaurant)

**Routes:**
- PAY removed; POST /orders/:id/pay
- POST /payments/:id/refund
- POST /payments/split


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

### Step 7: Enhance Category/Product ✅ DONE (partial)

**Implemented:**
- Add familyId to Category ✅
- Add parentId to Category ✅ (already existed)

**Still TODO:**
- Add bc field to Product
- Add country/region/currency
- Auto-generate slug for barcode

### Step 7b: Family Domain ✅ DONE

**Created Family aggregate:**

```typescript
// backend/src/core/catalog/domain/Family.ts

interface IFamily {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}
```

**Implemented Features:**
- GET /api/families ✅
- POST /api/families ✅
- PUT /api/families/:id ✅
- DELETE /api/families/:id ✅
- GET /api/categories/by-family/:familyId ✅

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

## Phase 2: Advanced features (1-2 months)

### Step 8: Migration ✅ PENDING

Create Promotion domain with 14 rule types

Structure:
- PromotionId (Identifier)
- attributes: name, code, priority, exclusive/stackable
- ruleLogic: AND OR, 14 types
- Promotion service (evaluate all)
- Conditions evaluator for each type

Style:
- Backend: 30+ Promotion entity files.
- Frontend: Promotion rule builder.
- Controller/route GET /promotions, POST /promotions validate/apply

### Step 9: Geo/Location address migration ✅ PENDING

Create:

```typescript
// backend/src/core/customer/domain/Customer.ts
interface IAddress {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}
```

Customer entity:
- add loyalty points, visit count, last visit
- phone
- tag

Service:
- full CRUD
- search by phone

Routes: GET/POST/PUT/DELETE for /api/members (Customer)

### Step 10: Upload service ✅ PENDING

Multer + Sharp + S3/Supabase storage.

Routes: POST /api/upload

### Step 11: Reporting aggregation ✅ DONE

See Phase 1.4 above.

### Step 12: Settings ✅ PENDING

Implement KeyValue store

Routes: GET /settings, PUT /settings

Set keys: roundconfig: { method, precision }, orderNumberPrefix, defaultPagination.

### Step 13: API testing ✅ PENDING

Test Coffee: unit tests for all domain models, route tests, fixture directory.

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
| 1 | 1 | Order domain updated with void, split, partial void, paymentBreakdown | ⏳ Pending |
| 2 | 1 | Order controller updated with all missing endpoints | ⏳ Pending |
| 3 | 2 | Payment domain updated with full split & rounding | ⏳ Pending |
| 4 | 2 | Payment controller updated | ⏳ Pending |
| 5 | 3 | Shift domain updated with cash pickup and report | ✅ Done |
| 6 | 3 | Modifier domain created | ✅ Done |
| 6b | 3 | Family domain created, Category enhanced with familyId | ✅ Done |
| 7 | 4 | Product and category enhancements (partial) | 🟡 Partial |
| 7b | 4 | Report infrastructure, aggregation pipelines | ✅ Done |
| 8 | 5-6 | Promotion domain, service, route | ⏳ Pending |
| 9 | 7 | Customer domain synchronization | ⏳ Pending |
| 10 | 7 | Upload service | ⏳ Pending |
| 11 | 8 | ~~Reporting aggregation pipelines~~ | ✅ Done |
| 12 | 8 | Setting store | ⏳ Pending |
| 13 | 9-10 | Testing | ⏳ Pending |
