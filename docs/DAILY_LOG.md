# DAILY ENGINEERING LOG

> Solo founder daily journal — POSMono

---

## Template

Copy this block for each new day:

```markdown
### DATE: YYYY-MM-DD

**Today I worked on:**
*

**Problems encountered:**
*

**What I completed:**
*

**What I learned:**
*

**Tomorrow priority:**
*

**Productivity score:** 1-10 (1 = wasted day, 10 = crushed it)

**Notes:**
*
```

---

## Entries

### DATE: 2026-08-05 — Free item scaling by qualifying sets, split payment receipts, promotion schema index fix

**Today I worked on:**

- **Discount Engine: free item scaling** — `FreeItemEffect` now scales quantity by qualifying sets (`floor(matchCount / minItems)`). Added `qualifyingSets.ts` helper to determine qualifying items and sets based on `product_match`, `category_match`, and `min_items` conditions.
- **Discount Engine: fixed price & bundle price** — `FixedPriceEffect` and `BundlePriceEffect` now use qualifying items from conditions when specific target product/productIds are not explicitly provided.
- **Pricing Service: line items free items** — `PricingService` now adds free items directly into `lineItems[]` with `isFreeItem: true`, `unitPrice: 0`, and `discount = originalUnitPrice * qty`.
- **Payment & Split Bill receipts** — `PaymentService` and `PaymentController` now handle `splitIndex` and `splitBaseOrderNumber` on `payCash` and `processSplitBill`, generating individual receipts for each split payment portion.
- **Frontend: PaymentModal refactoring** — Updated `PaymentModal` and `ReceiptDisplay` to handle individual split bill receipts and display split order numbering (`ORD-xxx/1`, `ORD-xxx/2`).
- **Promotion Schema & Indexing** — Updated `PromotionSchema` sparse index using `partialFilterExpression: { code: { $type: 'string' } }` so empty code fields do not cause duplicate key errors. `MongoPromotionRepository` now unsets empty code fields upon save.

**Files changed:**

- `backend/src/core/discount/domain/strategies/effects/qualifyingSets.ts` (NEW)
- `backend/src/core/discount/domain/strategies/effects/FreeItemEffect.ts`, `FixedPriceEffect.ts`, `BundlePriceEffect.ts`, `EffectStrategy.ts`
- `backend/src/core/discount/domain/DiscountEngine.ts`
- `backend/src/core/pricing/application/services/PricingService.ts`
- `backend/src/core/payment/application/services/PaymentService.ts`
- `backend/src/core/payment/interfaces/http/controllers/PaymentController.ts`
- `backend/src/core/promotion/infrastructure/persistence/schemas/PromotionSchema.ts`
- `backend/src/core/promotion/infrastructure/persistence/MongoPromotionRepository.ts`
- `backend/src/core/promotion/infrastructure/sync/PromotionToDiscountMapper.ts`
- `frontend/src/core/pos/components/PaymentModal.tsx`
- `frontend/src/core/pos/store/posStore.ts`
- `docs/pricing/04-discount-engine.md`
- `docs/API_REFERENCE.md`

**What I learned:**

- Promo effects like `free_item` must scale proportionally when customers purchase multiple qualifying sets (e.g., buy 2 get 1 → buy 4 gets 2).
- Split payment receipts require carrying `splitIndex` and `splitBaseOrderNumber` through payment execution so printed receipts clearly identify split bill portions.

**Productivity score:** 9

---

### DATE: 2026-08-04 — Inventory reserve/release, warehouse integration, receipt free items, held bill fix, toast notifications

**Today I worked on:**

- **Inventory: reserve/release stock** — `Stock.reserve()` and `Stock.release()` methods, wired into HoldOrderService (reserve), RecallOrderService (release), VoidOrderService (release) so held/cancelled orders properly lock and release stock
- **Inventory: warehouse integration** — `InventoryService` now auto-resolves warehouse via `resolveWarehouseId(tenantId)`, new endpoints: `POST /inventory/reserve`, `POST /inventory/release`, `POST /inventory/import`, `POST /inventory/export`
- **Inventory: repository interfaces** — created `StockRepository.ts`, `StockMovementRepository.ts`, `WarehouseRepository.ts` domain interfaces; Mongo implementations updated to implement them
- **Inventory: typed repos** — `InventoryService` and `WarehouseService` rewritten with typed repositories, injected `warehouseRepository` into container
- **Frontend: WarehouseListPage** — CRUD page for warehouse management with toggle active
- **Frontend: StockListPage enhanced** — pagination (20/page), CSV export/import, reserve/release in movement history
- **Frontend: new hooks** — `useReserveStock`, `useReleaseStock`, `useExportStock`, `useImportStock`, `useWarehouseList`, `useCreateWarehouse`, `useUpdateWarehouse`, `useDeleteWarehouse`
- **Receipt: free items display** — fixed entire pipeline to show free items (from promotions) on receipts: added `isFreeItem` to `IOrderItem` and `LineItem` types, `PaymentModal` now sends all items (not filtering free ones), `PaymentService` preserves `isFreeItem` in order items (skips stock deduction for free items), `ReceiptRenderService` passes `isFreeItem` through to DocumentData, added `gratisLabel`/`priceLabel`/`idr` formatters, registered `items.*` fields in template engine defaults
- **Bug fix: held bill items lost** — `saveBill()` now updates `heldOrders` Zustand state after successful backend save; `mergeHeldOrders()` now compares by `id:total` (not just IDs) so polling refreshes stale item content
- **Toast notifications** — created `useToast.ts` utility using SweetAlert2 with `position: 'top-start'`, auto-dismiss, hover-to-pause; wired into `saveBill()` success/error and bill close feedback (replaced `window.confirm`)

**Files changed:**

- `shared/src/types/domain/inventory.ts` — added `availableQuantity`, `beforeQuantity`, `afterQuantity`, `updatedAt`
- `backend/src/core/inventory/domain/Stock.ts` — `reserve()`, `release()` methods
- `backend/src/core/inventory/domain/StockRepository.ts` (NEW)
- `backend/src/core/inventory/domain/StockMovementRepository.ts` (NEW)
- `backend/src/core/inventory/domain/WarehouseRepository.ts` (NEW)
- `backend/src/core/inventory/application/services/InventoryService.ts` — rewritten with typed repos, warehouse integration, reserve/release
- `backend/src/core/inventory/application/services/WarehouseService.ts` — typed repo, `listActive()`
- `backend/src/core/inventory/infrastructure/persistence/MongoStockRepository.ts`
- `backend/src/core/inventory/infrastructure/persistence/MongoStockMovementRepository.ts`
- `backend/src/core/inventory/infrastructure/persistence/MongoWarehouseRepository.ts`
- `backend/src/core/inventory/interfaces/http/controllers/InventoryController.ts`
- `backend/src/core/inventory/interfaces/http/routes/inventory.routes.ts`
- `backend/src/core/ordering/application/services/OrderService.ts` — HoldOrder/RecallOrder/VoidOrder wired with inventoryService
- `backend/src/core/ordering/domain/Order.ts` — `isFreeItem` on IOrderItem
- `backend/src/core/payment/application/services/PaymentService.ts` — preserves `isFreeItem`, skips stock deduction for free items
- `backend/src/core/document-engine/types/document-data.ts` — `isFreeItem` on LineItem
- `backend/src/core/document-engine/engine/formatters.ts` — `gratisLabel`, `priceLabel`, `idr` formatters
- `backend/src/core/document-engine/defaults.ts` — `items.*` field registrations
- `backend/src/core/template/application/services/ReceiptRenderService.ts` — passes `isFreeItem` through
- `backend/src/bootstrap/container.ts` — warehouseRepository injection
- `backend/tests/services/InventoryService.test.ts` — 34 tests
- `backend/tests/services/WarehouseService.test.ts` (NEW) — 11 tests
- `frontend/src/@shared/hooks/useToast.ts` (NEW)
- `frontend/src/app/router.tsx` — `/inventory/warehouses` route
- `frontend/src/layouts/DashboardLayout.tsx` — nav "Gudang"
- `frontend/src/core/inventory/hooks/useInventory.ts` — new hooks
- `frontend/src/core/inventory/pages/StockListPage.tsx` — pagination, CSV export/import
- `frontend/src/core/inventory/pages/WarehouseListPage.tsx` (NEW)
- `frontend/src/core/pos/components/PaymentModal.tsx` — sends free items to backend
- `frontend/src/core/pos/pages/PosPage.tsx` — toast on bill close
- `frontend/src/core/pos/store/posStore.ts` — `saveBill()` updates heldOrders, `mergeHeldOrders()` content comparison, toast feedback

**What I learned:**

- Free items from promotions need to flow through the entire pipeline (frontend → backend order → receipt renderer → template engine) — filtering them out at any point breaks the receipt display
- Held bill state management requires keeping the in-memory cache in sync with backend saves; comparing only order IDs in `mergeHeldOrders` caused stale data to persist through 15s polling
- SweetAlert2 toast mode (`toast: true, position: 'top-start'`) is a clean replacement for `window.confirm` — less disruptive UX

**Productivity score:** 9

---

### DATE: 2026-08-01 — Inventory (stok) dual-scheme + auto-decrement on payment

**Today I worked on:**

- Defined the **dual stock-tracking scheme**: `quantity == 0` (or no stock record) → product is *untracked*, sells unlimited, sales only counted; `quantity > 0` → *tracked*, validated + decremented on payment
- Backend: `InventoryService.decrementForSale` / `incrementForReturn` (skip untracked, reject insufficient tracked stock), `stockOut`/`stockIn` now accept `referenceType` (`sale`/`refund` for accurate movement audit)
- Backend: `PaymentService` now auto-deducts stock on `payCash`, `processByOrderId`, `payOpenBill`, `splitBill` (only when the order transitions unpaid → paid, via `paymentBreakdown.length === 0` guard), and restores stock on `refund` (single-payment orders only)
- Backend: published `inventory.stock.adjusted` / `inventory.stock.low_alert` domain events (they were being cleared by `save()` and never emitted); eventBus now broadcasts them over socket.io
- Frontend: `useInventory` hooks (stock list, movements, stock-in/out, adjust); POS cart clamps quantity to available stock (`CartItem.stock`); `ProductCard` shows `Stok: ∞` for untracked and `Stok: N`/`Habis` for tracked
- Frontend: replaced the Inventory stub with a full page — product×stock table, status badges (Tidak dilacak / Stok rendah / Aman), low-stock filter, stock-in/out/adjust modal, and movement history table

**Files changed:**

- `backend/src/core/inventory/application/services/InventoryService.ts`
- `backend/src/core/payment/application/services/PaymentService.ts`
- `backend/src/bootstrap/container.ts`, `backend/src/bootstrap/eventBus.ts`
- `frontend/src/core/inventory/hooks/useInventory.ts` (new)
- `frontend/src/core/inventory/pages/StockListPage.tsx` (full UI)
- `frontend/src/core/pos/store/posStore.ts`, `ProductCard.tsx`, `PosPage.tsx`, `hooks/useProducts.ts`
- `docs/API_REFERENCE.md` — dual scheme + pay-cash stock side-effect

**What I learned:**

- Domain events added in an aggregate are silently dropped if the repo's `save()` calls `clearEvents()` and nothing publishes them — the events existed in `Stock.adjust()` but were never broadcast until now
- "Once per order" stock deduction is safest keyed on the order's `paymentBreakdown` going from empty → non-empty, not on payment amount
- Free/promo items must never decrement stock — keep them out of `pay-cash` items

**Productivity score:** 9

---

### DATE: 2026-08-01 — Receipt vs Cart Discount Double-Counting Fix

**Today I worked on:**

- **Bug: receipt total ≠ cart total** — promo/auto-apply discount applied twice during `POST /payments/pay-cash`, so the printed/thermal receipt showed a lower total than what the cashier quoted in the cart
  - Example (ORD-20260801-9469): 1x Jus Jeruk Rp 18.000, rule diskon 30% → cart Rp 12.600; cashier pays Rp 12.600; receipt printed `Total Diskon -Rp 10.800`, `TOTAL Rp 7.200`, `Kembalian Rp 5.400`
  - Root cause: `PaymentModal.handleSubmit` sent `discount = pricing.promotionDiscount + manualDiscount`; `PaymentService.payCash` re-applied the same rules via `discountService.apply()` and added them on top → double discount (60% instead of 30%)
  - Fix: `PaymentModal` now sends only the manual discount (`discount: manualDiscount, discountType: manualDiscountType`); backend remains the single authority for promo/auto-apply discounts

**Files changed:**

- `frontend/src/core/pos/components/PaymentModal.tsx` — send only manual discount + correct discountType to pay-cash
- `docs/BUG_TRACKER.md` — BUG-005 (CRITICAL)
- `docs/API_REFERENCE.md` — documented pay-cash `discount` contract (manual-only, no double counting)

**What I learned:**

- The frontend pricing result (`promotionDiscount`) is for display only — never echo it back to the backend as an input, or the discount engine will apply it a second time
- Keep discount ownership on one side: the backend recomputes promo/auto discounts, the client only passes manual discounts

**Productivity score:** 8

---

### DATE: 2026-07-28

**Today I worked on:**

- **Unified Pricing Engine** — single backend service orchestrating all pricing calculations, frontend purely renders results
- Replaced local `derive()` in POS store with async `recalculate()` calling `POST /pricing/calculate`

**Backend changes:**

- `core/pricing/application/services/PricingService.ts` — new orchestrator: DiscountEngineAdapter → Charges → TaxEngine → Rounding → PricingResult
- `core/pricing/api/pricing.controller.ts` — POST /pricing/calculate handler
- `core/pricing/api/pricing.routes.ts` — route factory with DI
- `bootstrap/routes.ts` — registered `/api/pricing` with discountRepo, taxConfigRepo, promoCodeRepo
- `DiscountServiceAdapter` — added free item multiplier (`qualifyingSets = floor(matchCount / minimumQuantity)`)
- `PromotionToDiscountMapper` — added `buy_x_get_y` (→ product_match + min_items), `time_range`, `customer_tag` condition mapping
- `ConditionStrategy.ts` — extended ConditionType union with `time_range` and `customer_tag`
- `TimeRangeCondition.ts` — new strategy: checks `startHour/startMinute/endHour/endMinute` against current time
- `CustomerTagCondition.ts` — new strategy: checks customer tags against rule's `customerTags[]`
- `ConditionEvaluator.ts` — registered TimeRangeCondition and CustomerTagCondition

**Frontend changes:**

- `posStore.ts` — rewritten: removed `derive()`, `calculateTax`, `calculateDiscount` imports; added `recalculate()` async (calls pricing API with debounce 50ms); simplified state to `pricing: PricingResult | null`
- `PosPage.tsx` — rewritten: uses `pricing` from store for all display; useEffect calls `recalculate()` on items/promoCode/manualDiscount changes; shows originalSubtotal → promotion → netSubtotal → SC → tax → grandTotal
- `PaymentModal.tsx` — rewritten: uses pricing result; filters free items from payment request; sends pricing data to payment API; shows full breakdown in modal
- `ReceiptDisplay.tsx` — updated: renders from PricingResult (originalSubtotal, promotion, netSubtotal, SC, tax, grandTotal)
- `CartItemRow.tsx` — shows "GRATIS" badge for free items, hides quantity controls
- `usePricing.ts` — new hook: `useCalculatePricing` mutation calling `POST /pricing/calculate`
- `useDiscountConfiguration.ts` — extended types: `time_range`, `customer_tag` in ConditionType; `ruleId` in FreeItemConfiguration
- `discountCalculator.ts` — added `countQualifyingSets()` for multiply promos; `productPriceLookup` param; `freeItemCount` in `applyEffects()`
- Auto free items: useEffect in PosPage auto-adds/removes/updates free items based on `pricing.lineItems` where `isFreeItem: true`

**Pricing pipeline order:**

```
Original Subtotal
  → Promotion/Discount (percentage, nominal, buy_x_get_y, free items, promo codes)
  → Net Subtotal
  → Service Charge (from net subtotal)
  → Tax (on netSubtotal + serviceCharge)
  → Rounding
  → Grand Total
```

**PricingResult shape:**

```typescript
{
  originalSubtotal: number;
  promotionDiscount: number;
  netSubtotal: number;
  serviceCharge: number;
  serviceChargeName: string;
  taxBase: number;
  tax: number;
  taxName: string;
  taxRate: number;
  rounding: number;
  grandTotal: number;
  lineItems: PricingLineItem[];
  appliedRules: Array<{ ruleId, ruleName, discountAmount, description }>;
  adjustments: Array<{ id, type, name, sequence, base, rate?, amount, affectsTaxBase, affectsGrandTotal }>;
}
```

**TypeScript:** Backend 0 errors (in pricing files), Frontend 0 errors

**What I learned:**

- Free items tracked via `isFreeItem` + `freeByRuleId` on CartItem; backend PricingService splits line items (free portion gets discount = unitPrice × freeQty)
- `qualifyingSets = floor(matchCount / minimumQuantity)` enables "buy 2 get 1 free" multiply behavior (buy 4 get 2 free)
- Debounced async recalculation (50ms) after cart changes prevents excessive API calls during rapid user interaction

**Tomorrow priority:**

- End-to-end test of full pricing flow (create promo → add items → verify pricing API → complete payment)
- MVP deployment

**Productivity score:** 9

---

### DATE: 2026-07-23

**Today I worked on:**

- Deleted MenuType entity entirely (domain, schema, repository, service, controller, routes)
- Updated Family entity — removed `menuType` field; Family is now the top-level grouping
- Simplified catalog hierarchy from 4 levels (MenuType → Family → Category → Product) to 2 levels (Family → Category → Product)
- Updated ProductListPage — filter simplified to Family → Category (cascading pills)
- Updated PosPage — filter simplified to Family → Category
- Updated FamilyListPage — removed MenuType tabs and field
- Removed `/menu-types` route from frontend router and backend API
- Updated all docs (ARCHITECTURE, API_REFERENCE, DATABASE_ARCHITECTURE, POS_CURRENT_FEATURES, roadmap)

**Database migration needed:**
```javascript
db.menu_types.drop()
db.families.updateMany({}, { $unset: { menuType: "" } })
```

---

### DATE: 2026-06-30

**Today I worked on:**

- Set up Docker environment (MongoDB + Redis compose files, multi-stage Dockerfile)
- Created monorepo structure (pnpm workspaces, turbo config, shared package)
- Built backend DDD folder scaffold with all domain modules
- Set up frontend Vite + React Router + Tailwind + PWA
- Created project documentation (roadmap, architecture, backlog, decisions, bug tracker)
- Fixed `node_modules` permission issue on mounted volume
- Fixed `.turbo/cache` permission issue

**Problems encountered:**

- `node_modules` was mounted as a root-owned volume, blocked pnpm install
- `.turbo/cache` had wrong permissions, blocked turbo build
- `msgpackr-extract` native build failed on first attempt (rebuilt successfully)

**What I completed:**

- Full `pnpm install` — 867 packages installed
- Full `turbo run build` — all 3 packages compiled successfully
- All 6 docs files created

**What I learned:**

- Docker volume mounts in devcontainer preserve host ownership — need `chown` after first use
- Turbo cache dir permissions must match runtime user

**Tomorrow priority:**

- Wire product HTTP routes (CRUD endpoints)
- Build product management frontend page
- Connect POS cart state to backend API

**Productivity score:** 8

**Notes:**

Good foundation day. The build is green. Time to start wiring real endpoints tomorrow.

---

### DATE: 2026-07-01

**Today I worked on:**

- STEP 2 — Tenant Module: HTTP endpoints (create, getCurrent, updateSettings, slug check)
- STEP 3 — Catalog Module: Product CRUD + categories + barcode field
- Seed script: added categories, barcode field to products

**Problems encountered:**

- `MongoUserRepository.findById` signature conflicted with parent class — renamed to `findByIdAndTenant`
- Seed needed refactoring to create categories before products with proper ID references

**What I completed:**

- Tenant API: `POST /api/tenants`, `GET /api/tenants/current`, `PATCH /api/tenants/current/settings`, `GET /api/tenants/slug/:slug`
- Catalog API: `GET/POST /api/products`, `GET/PUT/DELETE /api/products/:id`, `GET/POST /api/categories`, `PUT/DELETE /api/categories/:id`
- Product domain: added `barcode` field + `update()` method
- Category domain: created entity + schema + repository + service + controller + routes
- Seed: now creates 3 categories (Minuman, Makanan, Snack) + 8 products with proper category references

**What I learned:**

- Container registration in awilix grows linearly per module — pattern is predictable
- Seed order matters: categories must exist before products reference them

**Tomorrow priority:**

- STEP 4 — Inventory Module

**Productivity score:** 9

**Notes:**

Good momentum. Three modules wired in one session. The pattern is consistent now: domain → infrastructure → application → interfaces → container → routes.

---

### DATE: 2026-07-01 (session 2)

**Today I worked on:**

- STEP 4 — Inventory Module: Warehouse entity + CRUD (full DDD stack)
- Created StockMovement domain entity + repository (was raw Mongoose model before)
- Updated StockMovement schema to align with shared types (new enum values, new fields)
- Added low-stock detection endpoint (`GET /api/inventory/low-stock`)
- Added `WarehouseId`, `StockMovementId`, `StockId` identifiers

**Problems encountered:**

- TS7006 implicit `any` on `.map()` — fixed with explicit type annotation
- StockMovement schema had mismatched enum values vs shared types — aligned both

**What I completed:**

- `Warehouse` domain entity (AggregateRoot) + Mongoose schema + MongoRepository
- `WarehouseService` + `WarehouseController` + `warehouse.routes.ts`
- `StockMovement` domain entity (Entity) + `MongoStockMovementRepository`
- Refactored `InventoryService` to use `stockMovementRepository` instead of raw `movementModel`
- Refactored `InventoryController` with low-stock + filterable movements
- Registered `warehouseModel`, `warehouseRepository`, `warehouseService`, `warehouseController`, `stockMovementRepository` in Awilix container
- Registered `/api/warehouses` routes in Express router
- Full `pnpm run build` — all 3 packages compiled successfully

**What I learned:**

- Awilix injector pattern is consistent across modules
- StockMovement as a domain entity gives better type safety than raw Mongoose model

**Tomorrow priority:**

- STEP 5 — Identity Module: User roles & permissions
- OR STEP 6 — POS Module: Cart & transaction logic

**Productivity score:** 9

**Notes:**

Inventory module is now feature-complete with Warehouse CRUD, stock in/out/adjust, low-stock alerts, and typed movement tracking. Ready for POS ordering integration.

---

### DATE: 2026-07-02

**Today I worked on:**

- STEP 6 — Ordering Module: Order domain entity + service + controller + routes
- Created `OrderItemId`, `OrderId` identifiers
- `Order` aggregate: status lifecycle (draft → confirmed → paid → fulfilled → cancelled/refunded)
- Order schema + `MongoOrderRepository` with pagination
- `CreateOrderService` — creates orders with items, calculates totals
- `OrderController` — create, list (paginated), getById
- Shift module: `Shift` domain entity, open/close logic with double-close prevention
- `ShiftService`, `ShiftController`, shift routes (list, current, open, close)
- Registered all in Awilix container + Express router
- Updated Redis session store config for token expiry

**Problems encountered:**

- DateTime format issues in Order serialization — `createdAt`/`updatedAt` need manual formatting for plain objects
- Shift close validation needed explicit `status === 'open'` check to prevent double-close

**What I completed:**

- `POST /api/orders` — create order with items (auto-calculates subtotal, tax, total)
- `GET /api/orders` — list orders by tenant with pagination + status filter
- `GET /api/orders/:id` — get single order detail
- `POST /api/orders/:id/pay` — mark order as paid (for cash)
- `GET /api/shifts` — list shifts by tenant
- `GET /api/shifts/current` — get current open shift
- `POST /api/shifts/open` — open register with opening balance
- `POST /api/shifts/:id/close` — close shift with closing balance validation
- Full `pnpm run build` — all packages compiled

**What I learned:**

- MongoDB dates serialize differently in aggregation pipelines vs find queries
- UPSERT pattern in MongoRepository handles both create and update consistently
- Domain validation in `close()` catches programmer errors at compile time vs runtime

**Tomorrow priority:**

- STEP 7 — POS Frontend: Integrate cart UI with backend API

**Productivity score:** 9

**Notes:**

Ordering and payment engine now complete. Backend can handle full purchase flow: open shift → add items → create order → pay → close shift.

---

### DATE: 2026-07-03

**Today I worked on:**

- STEP 7 — POS Frontend: Complete POS interface
- Updated Tailwind config with blue primary color (`#2176D2`)
- Updated `index.html` with Inter font, blue theme-color
- Rewrote `globals.css` with custom scrollbar + font styles
- Rewrote `DashboardLayout.tsx` — blue header matching template, sync status pill, nav links
- Created `useProducts` hook (React Query) — fetches products + categories
- Refactored `posStore` (Zustand) — full cart: add/remove/qty, discount, tax, payment modal state
- Rewrote `PosPage` — product grid (filter by category), cart sidebar (items + summary), payment modal
- Created `ProductCard` component — image, name, price, add-to-cart button
- Created `CartItemRow` component — product name, qty controls, line total, remove button
- Created `PaymentModal` component — amount received input, change calculation, confirm payment
- Created `ReceiptDisplay` component — order summary after successful payment

**Problems encountered:**

- Zustand store mutations require immer or manual spread — used spread + immer middleware
- Tailwind `bg-primary` scale needed custom extended colors in config
- Payment modal keyboard input for `uang dibayar` needs to handle Indonesian number format

**What I completed:**

- Full POS cart flow: browse → add to cart → adjust qty → pay → receipt
- Product grid with category filter tabs
- Cart sidebar with item list, discount field, subtotal/tax/total
- Payment modal with cash input + change calculation
- Receipt display after successful payment
- Responsive layout (cart sidebar, product grid)

**What I learned:**

- Zustand with immer middleware gives clean immutable state updates
- React Query staleTime configuration reduces unnecessary re-fetches
- Indonesian currency `Rp` formatting with `toLocaleString('id-ID')`

**Tomorrow priority:**

- Testing — Layer 1: Domain unit tests

**Productivity score:** 10

**Notes:**

POS frontend is now complete and matches the reference template. Cart flow is smooth with real-time totals. Ready for testing phase.

---

### DATE: 2026-07-04

**Today I worked on:**

- Testing Layer 1 — Domain unit tests (93 tests across 9 files)
- Created test fixtures: identity, tenant, catalog, inventory, POS
- `AggregateRoot.test.ts` — 5 tests (ID equality, event tracking, clearEvents)
- `User.test.ts` — 14 tests (creation, activation/deactivation, role assignment, password hashing)
- `Tenant.test.ts` — 17 tests (creation, slug validation, subscription tiers, settings)
- `Product.test.ts` — 10 tests (creation, pricing, barcode, activation/deactivation)
- `Stock.test.ts` — 14 tests (creation, stock-in/out, quantity calculations, low stock detection)
- `StockMovement.test.ts` — 4 tests (inbound/outbound/adjustment creation)
- `Shift.test.ts` — 7 tests (open/close flow, balance validation, double-close prevention)

**Problems encountered:**

- `Shift.close()` needed validation to prevent closing already-closed shifts — added guard clause
- Fixtures needed factory functions to avoid shared mutable state between tests
- `Product.create()` threw on empty tags array — fixed factory default

**What I completed:**

- 93 unit tests, all passing
- 6 fixture files for test data
- Edge cases tested: validation errors, state transitions, immutable IDs
- Test results documented in `docs/LAYER1_TEST_RESULTS.md`

**What I learned:**

- Vitest + tsx runner gives fast feedback loop for TypeScript domain tests
- Domain entity tests enforce business rules at the model level
- Value Object immutability catches bugs early (IDs shouldn't change after creation)

**Tomorrow priority:**

- Documentation — API Reference, Layer 1 test results, TEST_PROGRESS tracker
- OR STEP 8 — Reporting & Operations

**Productivity score:** 10

**Notes:**

Solid testing session. All domain entities now have test coverage. The double-close validation was a real bug caught by testing — exactly the kind of thing domain tests should catch.

---

### DATE: 2026-07-05

**Today I worked on:**

- Documentation: Created `docs/API_REFERENCE.md` (52 endpoints), `docs/TEST_PROGRESS.md` (5 testing layers), `docs/LAYER1_TEST_RESULTS.md`
- STEP 8 — Reporting & Operations backend:
  - `ReportService`, `ReportController`, `report.routes.ts`
  - Added `dateFrom`/`dateTo` filter to `MongoOrderRepository.findByTenant`
  - Added `getDailySales()` aggregation (orders by day with payment breakdown)
  - Added `getSummary()` for dashboard cards (today revenue, orders, pending)
  - Added `findByDate()` to `MongoShiftRepository`
  - Registered in container + routes
- STEP 8 — Reporting & Operations frontend:
  - `useOrders.ts` — hooks for orders, dashboard summary, daily/sales reports
  - `useShift.ts` — hooks for shift list, open/close mutations
  - `DashboardPage.tsx` — live data from `/api/reports/dashboard` with recent orders table
  - `OrderListPage.tsx` — full implementation with status/date filters + pagination
  - `ReportPage.tsx` — daily report card + sales report with date range picker
  - `ShiftPage.tsx` — open/close register modals + shift history table
  - Updated `router.tsx` (added `/reports`, `/shifts`) + `DashboardLayout.tsx` (nav items)
- Updated `PROJECT_ROADMAP.md` — marked all completed phases
- Updated `DAILY_LOG.md` — added entries for all recent sessions

**Problems encountered:**

- `ReportController` import path mismatch with `BaseController` — fixed relative path
- Shift frontend hooks called wrong API paths (`/shifts/open` vs `/shifts/current`) — aligned with backend routes

**What I completed:**

- Full reporting feature: dashboard API + daily/sales reports
- Order list with server-side filtering (status, date range) + pagination
- Shift management UI: open register with opening balance, close with closing balance
- Dashboard with live revenue/order/pending/low-stock metrics + recent orders table
- All docs updated

**What I learned:**

- MongoDB `$dateToString` in aggregation pipelines needs careful timezone handling
- `useQuery` `refetchInterval` gives auto-refresh for dashboard metrics
- Report aggregation via MongoDB pipeline is fast and flexible for MVP

**Tomorrow priority:**

- STEP 9 — Testing Layer 2: Integration tests (repository tests, API contract tests)

**Productivity score:** 10

**Notes:**

STEP 8 is feature-complete. The app now has a proper reporting section with daily sales, date-range reports, shift management, and a live dashboard. Docs are comprehensive. Ready for integration testing phase.

---

### DATE: 2026-07-06

**Today I worked on:**

- STEP 9 — Testing Layer 2: Service tests (45 tests across 4 files)
- `OrderService.test.ts` — 7 tests: order creation, totals calculation, tax, event publishing, order number generation
- `PaymentService.test.ts` — 13 tests: pay cash happy path, change calculation, reference number, insufficient amount, cross-tenant rejection, already-paid/cancelled order validation
- `ShiftService.test.ts` — 10 tests: open/close lifecycle, duplicate open prevention, double-close prevention, cross-tenant isolation, list/getCurrent
- `AuthService.test.ts` — 15 tests: login valid/invalid, inactive user, credential hiding, session creation, register, refresh token cycle, logout
- Updated `docs/TEST_PROGRESS.md` — Layer 2 marked ✅ with 45 tests

**Problems encountered:**

- `Order.markPaid()` doesn't emit domain events — PaymentService handles both payment + order event publishing; tests verified this correctly
- DAILY_LOG.md had a duplicate fragment from an earlier session — cleaned up

**What I completed:**

- 45 new service tests, all passing
- Full test suite: 138 tests across 13 files — 0 failures
- Mocked dependency pattern established for future service tests
- Critical paths covered: login, pay cash, open/close shift, create order

**What I learned:**

- Services with `any` typed dependencies are trivially mockable with `vi.fn()`
- `Order.markPaid()` silently mutates state without events — the calling service owns event publishing
- Cross-tenant rejection is tested at the service layer by checking tenant ownership before operations

**Tomorrow priority:**

- STEP 9 (cont) — Layer 3: Repository tests with mongodb-memory-server
- OR Layer 4: API route tests with Supertest

**Productivity score:** 9

**Notes:**

138 passing tests. Total coverage: Layer 1 (93 domain tests) + Layer 2 (45 service tests). Next layer is repository integration tests with real MongoDB in-memory.

---

### DATE: 2026-07-06 (session 2)

**Today I worked on:**

- STEP 9 — Testing Layer 3: Repository tests with mongodb-memory-server (27 tests)
  - `MongoOrderRepository.test.ts` — 11 tests: save/findById/update, findByTenant with status/date/pagination filters, cross-tenant isolation, getDailySales, getSummary
  - `MongoShiftRepository.test.ts` — 9 tests: save/findById, findOpenShift, findByTenant, findByDate, cross-tenant isolation
  - `MongoPaymentRepository.test.ts` — 7 tests: save/findById, findByOrder, findByTenant, cross-tenant isolation
- STEP 9 — Testing Layer 4: API route tests with Supertest (20 tests)
  - `auth.routes.test.ts` — 8 tests: login valid/invalid, register valid/duplicate/missing fields, /me with/without/wrong token
  - `order.routes.test.ts` — 6 tests: create order valid/empty/unauth, list orders, get by ID/404
  - `payment.routes.test.ts` — 6 tests: pay cash valid/insufficient/missing fields/unauth, change calculation, payment list
- Updated `tests/helpers/db.ts` — configured MongoDB 7.3.4 ARM64 binary for CI compatibility
- Updated `tests/helpers/setup.ts` — added MONGOMS env vars

**Problems encountered:**

- `mongodb-memory-server` failed to download MongoDB binary on ARM64/Debian 13 — resolved by configuring version 7.3.4 and Ubuntu 22.04 binary URL
- Duplicate key errors on `tenantId_1_orderNumber_1` index when creating orders in same millisecond — fixed with `setTimeout(10)` between saves
- `MongoOrderRepository.findByTenant` pagination test required sequential saves with unique order numbers

**What I completed:**

- 92 new tests: Layer 3 (27) + Layer 4 (20) + previous Layer 2 (45)
- Full test suite: 185 tests across 19 files — 0 failures
- All 4 testing layers now have coverage
- ARM64 MongoDB binary cached for CI speed

**What I learned:**

- MongoDB 7.3.4+ supports ARM64 but the default download URL tries Debian 12 → 404; using Ubuntu 2204 URL works
- Mongoose unique compound indexes require careful test timing when auto-generated values (orderNumber) could collide
- Supertest + in-memory Express app is fast (sub-200ms) for API contract testing

**Tomorrow priority:**

- STEP 9 (cont) — Layer 5: Integration tests (order-to-payment flow, tenant isolation)
- OR STEP 10 — MVP Polish: Bug fixes, UI refinement, deployment prep

**Productivity score:** 10

**Notes:**

185 tests across all 4 testing layers. The only remaining test layer is Layer 5 (full integration flow). The ARM64 MongoDB workaround is documented for future CI setup.

---

### DATE: 2026-07-06 (session 3)

**Today I worked on:**

- Fixed dev environment — created `src/dev.ts` with `mongodb-memory-server` for Docker-less development
- Fixed Vite config — added `host: true` so frontend accessible from host browser
- Fixed Awilix container — changed `injectionMode` from `PROXY` to `CLASSIC` (default proxy mode caused `Could not resolve 'execute'` on all controller methods)
- Fixed seed data — tenant ID changed to `dev-tenant` to match tenant middleware default
- Fixed login page — clear localStorage before login, extract `tenantId` from JWT payload (response doesn't include `tenant` field)
- Split container registrations into two `register()` calls to avoid circular resolution at registration time

**Problems encountered:**

- Awilix v10 default `PROXY` injection mode wraps resolved instances, intercepting ALL property access via container resolution — breaks every controller method call
- `container.resolve()` inside a `register()` block can't find dependencies registered in the same call
- Frontend login expected `data.data.tenant.id` in response but backend doesn't return tenant info
- MongoDB in-memory seed writes to `posmono_system` while app connects to default database — fixed by running seed inline before app boot

**What I completed:**

- `GET /health` — working
- `POST /api/auth/login` — working (admin@demo.com / admin123)
- Frontend accessible at `http://localhost:5173`
- No Docker required for development

**What I learned:**

- Awilix `injector` + `PROXY` mode creates a proxy that intercepts ALL property access — not just constructor injection
- `MongoMemoryServer` on ARM64 needs version 7.3.4 with Ubuntu 22.04 binary URL
- Vite dev server defaults to `localhost` only — need `host: true` for devcontainer port forwarding
- Splitting `container.register()` into multiple calls is the cleanest way to handle inter-dependent registrations

**Tomorrow priority:**

- Layer 5: Integration tests
- OR barcode scanning & discount engine

**Productivity score:** 8

**Notes:**

Spent most of the session debugging Awilix proxy behavior. Dev environment now works without Docker — in-memory MongoDB with auto-seed. Frontend-backend integration verified end-to-end.

---

### DATE: 2026-07-07

**Today I worked on:**

- WEEK 8 — Testing & Polish (complete)
- Layer 5 Integration: Created `tenant-isolation.test.ts` — 11 tests covering cross-tenant isolation for orders, payments, shifts, products, and inventory
- Layer 2 Service tests: Created `TenantService.test.ts` (10), `ProductService.test.ts` (14), `InventoryService.test.ts` (16)
- Layer 3 Repository tests: Created `MongoUserRepository.test.ts` (10), `MongoTenantRepository.test.ts` (8), `MongoProductRepository.test.ts` (12), `MongoStockRepository.test.ts` (9)
- Frontend smoke test: Created `posStore.test.ts` (11 tests) — cart logic, tax, payment flow
- UI Polish: Extracted shared `formatCurrency` utility, fixed `Rp`/`Rp.` inconsistency across all POS components, added error state to PosPage, removed hardcoded values (stock, "Local State", "Pesanan #0001")
- Updated all docs: TEST_PROGRESS.md, PROJECT_ROADMAP.md, DAILY_LOG.md, BACKLOG.md

**Problems encountered:**

- Tenant.create() and Product.create() need all fields including `modules` and `imageUrls` — fixed test fixtures
- SKU unique index caused duplicate key errors in product repository tests — fixed with unique SKUs per test
- Frontend ProductCard had hardcoded `stock={15}` prop — made optional with default

**What I completed:**

- 90 new tests across 8 new test files
- Total: 299 tests (28 backend + 1 frontend), 0 failures
- Frontend build + PWA service worker compiles clean
- All `Rp` formatting now consistent across the app

**Tomorrow priority:**

- WEEK 9 — MVP Deployment: production build, VPS deploy, domain + SSL, pilot tenant onboarding

**Productivity score:** 10

**Notes:**

Week 8 is fully wrapped. The test suite grew from 198 to 299 tests (+51% increase). The frontend is polished with consistent currency formatting and proper error states. Ready for deployment.

---

### DATE: 2026-07-07

**Today I worked on:**

- Fixed PWA service worker in dev mode (disabled VitePWA plugin except in production)
- Fixed double `/api` prefix in axios calls (baseURL + hooks both had `/api`)
- Created `placeholder.svg` for missing product images
- Added service worker auto-unregistration on app load
- Updated production `docker/Dockerfile` to build frontend
- Updated `server.ts` to serve frontend static files in production
- Created `docker/docker-compose.prod.yml`
- Created `.github/workflows/ci.yml` (test + lint + Docker build/push)
- Created `backend/.env.example`

**Problems encountered:**

- `file:///` protocol error from stale PWA service worker — fixed by unregistering SW + disabling PWA in dev
- Double `/api` prefix in `useProducts.ts` and `PaymentModal.tsx` — caused 404s on all API calls
- `placeholder.svg` missing — hardcoded image URLs from API returned 404 in browser
- `docker/Dockerfile` didn't build frontend — fixed by adding `frontend/package.json` to deps stage and `frontend/dist` to runner

**What I completed:**

- PWA/dev mode cleanup
- API URL normalization
- Production Docker setup
- CI/CD pipeline
- 299/299 tests passing

**Tomorrow priority:**

- Deploy to VPS (DigitalOcean / any provider)
- Set up domain + SSL (Caddy or nginx)
- Seed first tenant + pilot onboarding

**Productivity score:** 9

**Notes:**

Moved from Week 8 (Testing & Polish) into Week 9 (MVP Launch Prep). The production deployment setup is now ready: single Docker image serves backend + frontend, CI pipeline runs tests and builds on push. Next session is actual VPS deployment.

---

### DATE: 2026-07-08

**Today I worked on:**

- Tax Engine module — built from scratch (shared types, Zod validation, domain entities, MongoDB schemas + repos):
  - TaxConfiguration aggregate root with embedded TaxRule[] (5 rule types: standard, category, product, compound, exemption)
  - TaxRule with TaxCalculationStrategy (`standard_percentage`, `indonesia_ppn_2025`) + `taxBaseModifier` for DPP Nilai Lain
  - TaxTransactionRecord for full audit trail with rule snapshots
  - MongoTaxConfigurationRepository — upsert by tenantId + initializeDefault with rate 12 indonesia_ppn_2025
  - MongoTaxTransactionRecordRepository — paginated history
  - TaxConfigurationId, TaxRuleId, TaxTransactionRecordId identifiers
- TaxService.calculate() — compound tax engine:
  - Sorts rules by compoundOrder; each rule's base = previous compound result
  - applyDiscount() — discount BEFORE tax (not after). Returns {amount, items, breakdown}
  - validateRules() — validates rule integrity (no circular compounds, valid rates, valid modifier format)
  - calculateTaxAmount() — applies taxBaseModifier → falls back to calculationStrategy → computes tax
  - evaluateModifier() — parses "11/12" style fraction strings via safeEval
- REST API — 8 endpoints: GET/PUT/PATCH config, POST rules, PUT/DELETE rule by ID, POST calculate (test calculator), GET history
- DI container — registered in Awilix
- PaymentService refactored — removed tenantRepository dependency, uses TaxService.calculate()
- All test helpers updated with mock TaxService — 297/297 tests passing
- Frontend useTaxConfiguration hook (5 hooks) + "Aturan Pajak" section in settings page
- Vite config: added server.fs.allow for shared package
- Default PPN: rate 12, strategy indonesia_ppn_2025 (DPP Nilai Lain = effective 11%)

**Problems encountered:**

- Vite 5 restricts serving files outside project root — server.fs.allow required for shared package
- Compound tax required sorting by compoundOrder before iteration
- Discount before tax required refactor of old PaymentService logic

**What I completed:**

- Full Tax Engine module with compound tax, DPP modifiers, 5 rule types, audit trail
- 8 REST endpoints + frontend management UI
- PaymentService delegation to TaxService

**What I learned:**

- Compound tax with configurable order is more flexible than hardcoded SC→PPN
- taxBaseModifier makes DPP Nilai Lain configurable without code changes
- Vite 5 fs.allow is essential for monorepos with workspace-linked packages

**Tomorrow priority:**

- Register tax routes (if not already)
- Per-item discount
- Printer engine template/spec
- MVP deployment (VPS + SSL + pilot tenant)
- Legacy tax config migration script

**Productivity score:** 10

**Notes:**

Tax Engine is the most architecturally significant module so far. Compound engine with configurable strategies, DPP modifiers, and 5 rule types spans the full DDD stack. The indonesia_ppn_2025 strategy correctly handles Indonesia's 2025 PPN (12% × 11/12 = 11% effective). Backend: 286 tests (down from 299 because 13 old tests replaced by new patterns). Frontend: 11 tests. All passing.

---

## July 21, 2026 — Menu Type System + Product Management

**Session:** Menu Type classification + full product CRUD frontend

**What I worked on:**

- **Menu Type classification system** — added `menuType` (`'food' | 'beverage'`) field to Family entity for top-level menu grouping
- **3-level hierarchy**: Menu Type → Family → Category → Product
- **Product management page** — complete rewrite with full CRUD, search, image upload, tags, pagination
- **Families management page** — new page with Food/Beverage tab filtering

**Backend changes:**

- `Family.ts` — added `menuType: MenuType` to interface, class, create, update, serialize
- `FamilySchema.ts` — added `menuType` field (enum, default 'food') + compound index `(tenantId, menuType)`
- `MongoFamilyRepository.ts` — added `menuType` mapping + `findByMenuType()` method
- `FamilyService.ts` — added `menuType` to CreateFamilyInput/UpdateFamilyInput + `listByMenuType()` method
- `FamilyController.ts` — added `listByMenuType()` handler + Zod schema for `menuType`
- `family.routes.ts` — added `GET /families/by-menu-type/:menuType`
- `ProductService.ts` — added `imageUrls`, `country`, `region`, `currency` to CreateProductInput

**Frontend changes:**

- `products/hooks/useProducts.ts` — **new** shared hooks: `useProductList`, `useCategoryList`, `useFamilyList`, `useCreateProduct`, `useUpdateProduct`, `useDeleteProduct`, `useUpload`
- `pos/hooks/useFamilies.ts` — **new** hook for fetching families with menuType filter
- `products/pages/ProductListPage.tsx` — **rewrite** with search, 3-level filter, pagination, image upload, tags, delete confirmation, category name resolution
- `families/pages/FamilyListPage.tsx` — **new** CRUD page with Food/Beverage tabs
- `pos/pages/PosPage.tsx` — added Menu Type tabs + Family pills above Category pills
- `app/router.tsx` — added `/families` route
- `layouts/DashboardLayout.tsx` — added Families nav item

**Products page features:**

| Feature | Description |
|---------|-------------|
| Search | Cari by nama, SKU, atau barcode |
| 3-level filter | Menu Type → Family → Category |
| Pagination | 20 items/page with navigation |
| Image upload | Upload via modal, preview, remove |
| Tags | Input + Enter, badge chips, remove |
| Delete confirmation | Modal before nonaktifkan |
| Category resolution | Shows category name from categoryId |

**TypeScript:** Backend 0 errors, Frontend 0 errors

**What I learned:**

- Adding `menuType` to Family (rather than creating a separate MenuType entity) keeps the hierarchy simple for 2-value enum
- Frontend hooks separation (`products/hooks/useProducts.ts`) enables reuse across ProductListPage and POS page
- Image upload integration requires multer middleware on backend + FormData on frontend

**Tomorrow priority:**

- Per-item discount
- Printer engine template/spec
- MVP deployment (VPS + SSL + pilot tenant)
- Seed data for default families (Western, Asia, Hot Drinks, etc.)

**Productivity score:** 9

---

## July 21, 2026 — Payment Method Management (Session 2)

**Session:** Payment method CRUD system

**What I worked on:**

- **PaymentMethod domain entity** — new aggregate for managing payment methods (Cash, Card, QRIS, Transfer, etc.)
- **Full DDD stack** — entity, schema, repository, service, controller, routes
- **Frontend management page** — CRUD with preset buttons, color picker, icon support

**Backend changes (7 files):**

- `PaymentMethod.ts` — domain entity with fields: `name`, `code`, `icon`, `color`, `sortOrder`, `requiresReference`, `config`
- `PaymentMethodSchema.ts` — Mongoose schema with unique index `(tenantId, code)`
- `MongoPaymentMethodRepository.ts` — CRUD + `findActiveByTenant()`, `findByCode()`
- `PaymentMethodService.ts` — business logic + code uniqueness check
- `PaymentMethodController.ts` — 6 HTTP handlers
- `paymentMethod.routes.ts` — REST routes
- `container.ts` + `routes.ts` — registered at `/api/payment-methods`

**Frontend changes (4 files):**

- `payment-methods/hooks/usePaymentMethods.ts` — shared hooks for CRUD
- `payment-methods/pages/PaymentMethodListPage.tsx` — full management page
- `router.tsx` — added `/payment-methods` route
- `DashboardLayout.tsx` — added "Payment" nav item

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payment-methods` | List all |
| GET | `/api/payment-methods/active` | List active only |
| GET | `/api/payment-methods/:id` | Get by ID |
| POST | `/api/payment-methods` | Create |
| PUT | `/api/payment-methods/:id` | Update |
| DELETE | `/api/payment-methods/:id` | Delete |

**Page features:**

- 6 preset buttons (Tunai, Kartu, QRIS, Transfer, E-Wallet, Kredit) for quick setup
- Color picker + emoji icon support
- `requiresReference` flag for methods that need reference numbers
- Delete confirmation modal

**What I learned:**

- PaymentMethod is a separate entity from Payment — it's configuration, not transaction data
- Preset buttons significantly speed up initial setup for tenants
- `requiresReference` flag enables UI to conditionally show reference input in POS

**TypeScript:** Backend 0 errors, Frontend 0 errors

**Productivity score:** 9

---

## July 21, 2026 — Discount & Promo Engine Integration

**Session:** Wire discount engine into POS checkout flow

**What I worked on:**

- **Promo code at checkout** — wired `DiscountServiceAdapter` into `PaymentService.payCash` so promo codes are validated and applied during payment
- **Promotion breakdown on orders** — store `promotions[]` and `discountBreakdown[]` on the Order entity when a promo is applied
- **Combined discounts** — manual discount + promo code discount are combined (capped to subtotal) before tax calculation
- **Metadata enrichment** — order and payment metadata now include `promoCode`, `promoDiscount`, `manualDiscount` for audit trail

**Backend changes (3 files):**

- `PaymentService.ts` — added `discountService` (DiscountServiceAdapter) to constructor; `payCash` now accepts `promoCode`, validates via discount engine, applies promo discount, combines with manual discount, stores promotion breakdown on order
- `PaymentController.ts` — added `promoCode` (optional string) to `payCashSchema`
- `container.ts` — injected `discountService` into `paymentService`

**How it works:**

1. Frontend sends `{ items, amountPaid, discount, discountType, promoCode }` to `POST /api/payments/pay-cash`
2. If `promoCode` is provided, `DiscountServiceAdapter.apply()` evaluates all active discount rules against the cart items
3. Matching rules produce `totalDiscount` + `appliedRules[]` breakdown
4. Promo discount is combined with any manual discount
5. Combined discount is passed to `TaxService.calculate()` (discount before tax)
6. Order stores `promotions[]` and `discountBreakdown[]` for receipt/reporting
7. Payment metadata includes `promoCode`, `promoDiscount`, `manualDiscount`

**Discount engine (already built in `core/discount/`):**

- 8 condition types: MinPurchase, MinItems, CategoryMatch, ProductMatch, DateRange, DayOfWeek, QuantityThreshold, PromoCode
- 5 effect types: PercentageOff, NominalOff, FreeItem, FixedPrice, BundlePrice
- Client-side calculator in `discountCalculator.ts` for instant UI feedback
- Server-side validation via `DiscountServiceAdapter.apply()` at checkout

**TypeScript:** Backend 0 errors, Frontend 0 errors

**Productivity score:** 8

---

## July 23, 2026 — Split Bill "Bayar Satu per Satu" + Hold/Recall Polish

**Session:** Implement pay-one-at-a-time split bill with item selection, split order numbering, and collapsible held orders sidebar

**What I worked on:**

- **Hold/Recall UI rework** — deleted old `HoldModal.tsx` and `HeldOrdersBar.tsx`; replaced with `HeldOrdersPanel.tsx` (collapsible 280px sidebar on the left with toggle button + vertical text)
- **Customer name & table number fields** — moved above cart in `PosPage.tsx`, always visible; Hold button validates requiring name OR table number before holding
- **Hold is instant** — `holdOrder()` clears cart immediately, backend sync in background (fire-and-forget); `recallOrder()` syncs backend + restores customer/table fields
- **Tax calculator fix** — inclusive mode now correctly extracts SC and PPN independently from subtotal; `grandTotal` = `taxableAmount` in inclusive mode (no SC on top)
- **`setTaxConfig` bug fix** — was not storing `taxConfig` in Zustand state, so subsequent `addItem` calls used null config → tax always 0
- **Cart & PaymentModal cleanup** — removed duplicate service charge line in cart; only shows `taxBreakdown` with rate percentage
- **PaymentModal rewrite for split bill** — removed old "Bayar Biasa"/"Split Bill" tabs; replaced with item checkbox selection → pay selected items only → receipt → remaining items stay in cart → repeat
- **Store split tracking** — added `splitNumber`, `splitBaseOrderNumber`, `removeItems()`, `resetSplit()` to `posStore.ts`; `clearCart` resets split state
- **ReceiptDisplay update** — shows `ORD-xxx/N` suffix during split; shows "X item tersisa" when items remain; "Bayar Sisanya" button opens payment modal for remaining; "Selesai" when cart empty
- **Database config** — `dev.ts` updated to support real MongoDB (`MONGO_URI` in `.env`) with in-memory fallback

**Files changed:**

- `backend/src/core/ordering/domain/Order.ts` — hold/recall methods, 'held' status
- `backend/src/core/ordering/domain/__tests__/Order.test.ts` — 58 tests passing
- `backend/src/core/ordering/infrastructure/persistence/schemas/OrderSchema.ts` — 'held' in enum
- `backend/src/core/ordering/application/services/OrderService.ts` — HoldOrderService, RecallOrderService
- `backend/src/core/ordering/interfaces/http/controllers/OrderController.ts` — hold/recall handlers
- `backend/src/core/ordering/interfaces/http/routes/order.routes.ts` — POST /:id/hold, PATCH /:id/recall
- `backend/src/bootstrap/container.ts` — registered hold/recall services
- `backend/src/dev.ts` — smart MongoDB (real or in-memory fallback), seed logic
- `frontend/src/@shared/utils/taxCalculator.ts` — inclusive/exclusive pricing fix
- `frontend/src/@shared/styles/globals.css` — held-orders-scroll styles
- `frontend/src/core/pos/store/posStore.ts` — splitNumber, splitBaseOrderNumber, removeItems, resetSplit, Receipt type update
- `frontend/src/core/pos/components/PaymentModal.tsx` — complete rewrite: item checkboxes, pay selected only, split flow
- `frontend/src/core/pos/components/ReceiptDisplay.tsx` — ORD-xxx/N suffix, Bayar Sisanya button, paid items only
- `frontend/src/core/pos/components/HeldOrdersPanel.tsx` — new: collapsible sidebar for held orders
- `frontend/src/core/pos/pages/PosPage.tsx` — customer/table inputs above cart, Hold with validation

**TypeScript:** Backend 0 errors, Frontend 0 errors

**Productivity score:** 9

---

### DATE: 2026-07-23

**What I worked on:**

- **MenuType entity** — new domain entity (`MenuType.ts`) with CRUD, separate from Family. Replaces hardcoded `'food' | 'beverage'` enum with dynamic string-based menu types (Makanan, Minuman, Snack, dll)
- **Backend full stack** — MenuType domain entity, Mongoose schema, MongoMenuTypeRepository, MenuTypeService (create/list/update/rename/delete), MenuTypeController, menuType.routes
- **Rename sync** — `PUT /api/menu-types/:id/rename` automatically updates all families using the old name via `updateMenuTypeBulk()`
- **Delete guard** — delete fails if any family still references the menu type
- **Frontend MenuTypeListPage** — CRUD page at `/menu-types` with table, create/edit modal, toggle active, delete with confirmation
- **FamilyListPage update** — menuType field now uses dropdown from `/menu-types` API (was free text input)
- **Tab updates** — PosPage, ProductListPage, FamilyListPage all fetch menu types from `/menu-types` API for tabs (was derived from families via `Set`)
- **Shared types** — added `MenuType` interface to `shared/src/types/domain/catalog.ts`
- **DI registration** — MenuType model, repository, service, controller registered in `container.ts` + `routes.ts`
- **Nav bar** — added "Menu Types" link in `DashboardLayout.tsx`
- **Docs** — updated ARCHITECTURE.md, API_REFERENCE.md, POS_CURRENT_FEATURES.md with MenuType domain and endpoints

**Files changed:**

- `backend/src/core/catalog/domain/MenuType.ts` — new entity
- `backend/src/core/catalog/infrastructure/persistence/schemas/MenuTypeSchema.ts` — new schema
- `backend/src/core/catalog/infrastructure/persistence/MongoMenuTypeRepository.ts` — new repository
- `backend/src/core/catalog/application/services/MenuTypeService.ts` — new service
- `backend/src/core/catalog/interfaces/http/controllers/MenuTypeController.ts` — new controller
- `backend/src/core/catalog/interfaces/http/routes/menuType.routes.ts` — new routes
- `backend/src/core/catalog/infrastructure/persistence/MongoFamilyRepository.ts` — added `updateMenuTypeBulk()`
- `backend/src/bootstrap/container.ts` — registered MenuType DI
- `backend/src/bootstrap/routes.ts` — registered `/api/menu-types` routes
- `shared/src/types/domain/catalog.ts` — added `MenuType` interface
- `frontend/src/core/menu-types/pages/MenuTypeListPage.tsx` — new page
- `frontend/src/core/families/pages/FamilyListPage.tsx` — dropdown from API, tabs from API
- `frontend/src/core/pos/pages/PosPage.tsx` — tabs from `/menu-types` API
- `frontend/src/core/products/pages/ProductListPage.tsx` — tabs from `/menu-types` API
- `frontend/src/app/router.tsx` — added `/menu-types` route
- `frontend/src/layouts/DashboardLayout.tsx` — added "Menu Types" nav item
- `docs/ARCHITECTURE.md` — added MenuType to catalog domain structure
- `docs/API_REFERENCE.md` — added MenuType endpoints section
- `docs/POS_CURRENT_FEATURES.md` — added MenuType domain + endpoints

**Tests:** 555/572 passing (17 pre-existing failures in Shift/Order/Payment)

**Productivity score:** 8

---

### DATE: 2026-07-26

**Today I worked on:**

- **Charge entity as first-class domain entity** — separated from TaxRule
  - `Charge.ts`: ICharge interface + Charge class with `new()`, `flat()`, `create()`, `calculate()`, `calculateInclusive()`, `shouldApply()`, `serialize()`
  - `sequence` field added to ICharge (default 20) and ITaxRule (default 30)
  - `service_charge` removed from TaxType union
  - `includeInTaxBase` removed from ITaxRule (now on Charge entity)
  - CRUD endpoints: `POST /api/tax/charges`, `DELETE /api/tax/charges/:chargeId`
- **Adjustment Pipeline** — SAP/Oracle/Dynamics-style orchestration layer
  - `Adjustment.ts`: types (Adjustment, AdjustmentType, AdjustmentStep, PipelineContext)
  - `AdjustmentPipeline.ts`: orchestrator that sorts steps by sequence, executes in order
  - 4 step implementations: `DiscountStep`, `ChargeStep`, `TaxStep`, `RoundingStep`
  - `PricingEngine` refactored to produce `adjustments[]` + legacy fields (charges[], taxes[], taxAmount)
  - Both inclusive and exclusive modes produce adjustments
- **Frontend migration**
  - `taxCalculator.ts`: `Adjustment` type, `adjustments[]` in TaxCalcResult, `sequence` on IChargeConfig
  - `useTaxConfiguration.ts`: IChargeConfig with sequence, useAddCharge(), useDeleteCharge() hooks
  - `GeneralSettingsPage.tsx`: migrated from service_charge TaxRule to Charge API
  - `posStore.ts`: reads SC name from charges instead of rules
- **Documentation** — updated all docs: POS_CURRENT_FEATURES, API_REFERENCE, DECISIONS (ADR-011), DAILY_LOG, roadmap, README

**Problems encountered:**

- Pipeline test shallow copy issue — `PipelineContext` spread caused steps to modify a copy; fixed by passing original context reference
- Stub test helper defaulted type to 'CHARGE' when not specified; fixed by adding explicit type in tests

**What I completed:**

- 147 tests passing: 133 backend (9 files) + 14 frontend (1 file)
- 0 `service_charge` references in source code
- All 8 documentation files updated

**What I learned:**

- Separating Charge from TaxRule follows the same pattern as separating Discount from Promotion — domain entities should represent one concept
- Pipeline pattern with configurable sequence is more flexible than hardcoded order
- Legacy field derivation from new `adjustments[]` ensures backward compatibility without breaking existing consumers

**Tomorrow priority:**

- MVP deployment (VPS + SSL + pilot tenant)
- Consider adding Adjustment Pipeline tests for edge cases (zero amounts, negative adjustments)

**Productivity score:** 9

---

### DATE: 2026-07-27

**Today I worked on:**

- **Biaya Tambahan (Charges) CRUD in Settings** — full management UI in GeneralSettingsPage
  - Per-charge toggle (activate/deactivate) without deleting
  - Inline edit form: name, rate/amount, type (persen/nominal), DPP toggle
  - Add form with DPP (includeInTaxBase) toggle
  - Delete button per charge
- **POS cart charges display** — charges rendered individually between Subtotal and Pajak
  - Added `charges[]` to POSState interface, derive() return, clearCart()
  - Cart shows each charge with name and amount before tax
- **Backend: PUT /api/tax/charges/:chargeId** — new route + controller handler for charge updates
  - `useUpdateCharge()` hook added to frontend
- **Fixed: Charges not appearing in POS cart** (root cause: scope.type missing)
  - Backend `ChargeSchema` scope.type had no `default: 'all'` — Mongoose stored scope without type
  - Frontend `scopeMatches()` returned `false` for undefined type (fell through to `default: return false`)
  - Fixed backend schema default + frontend scopeMatches() treats missing type as 'all'
- **Fixed: handleSave deleting charges** — old SC sync logic in Settings `handleSave()` used `serviceChargeEnabled` (always `false` after UI removal) and deleted any active charge on every save
  - Removed dead SC sync block + 4 unused state variables
- **Fixed: PaymentService 500 error on pay-cash** — PricingResult refactoring changed field names
  - `discountAmount` → `discount`, `taxableAmount` → `taxBase`, `totalTax` → `taxAmount`
  - Removed `perItemTax` (no longer exists), replaced with proportional per-item calculation
  - `serviceCharge` → sum of `charges[]`, `taxBreakdown` → `taxes`
- **Fixed: Sales per Product report grand total** — was double-counting SC when included in tax base
  - Changed from `dpp + tax + serviceCharge` to `totalSales + tax + serviceCharge`
  - Fixed in 3 places: summary, per-product row, per-transaction row

**Problems encountered:**

- Scope type bug was subtle — MongoDB stored `{ entityId: '', entityName: '' }` without `type`, frontend scopeMatches() silently filtered out the charge
- PricingResult interface changed names but PaymentService wasn't updated → NaN values → MongoDB rejected save → 500

**What I completed:**

- 4 commits pushed to origin/master
- Biaya Tambahan full CRUD with toggle/edit/delete/DPP
- POS cart individual charge display
- All payment, tax, and report bugs fixed

**What I learned:**

- Always set `default` values in Mongoose schemas for nested enum fields — undefined enum values silently break switch/match logic downstream
- When refactoring return types (PricingResult), grep for all consumers before deploying

**Tomorrow priority:**

- Test payment flow end-to-end with charges active
- MVP deployment

**Productivity score:** 8

---

### DATE: 2026-07-28 (session 2) — Promotion Time + Buy X Pay Y

**Today I worked on:**

- **Time support for promotion validity** — `validFrom`/`validUntil` changed from `<input type="date">` to `<input type="datetime-local">` so users can pick both date and time
- **PromotionToDiscountMapper endDate fix** — `23:59:59.999` override only applies when time is midnight (no time specified); preserves user-specified time otherwise
- **Buy X Pay Y rule type** — created `BuyXPayYEditor.tsx` frontend, registered in registry, mapped in backend `PromotionToDiscountMapper`

**Files changed:**

- `frontend/src/core/promotions/components/PromotionForm.tsx` — `datetime-local` inputs + `toDatetimeLocal()` helper
- `backend/src/core/promotion/infrastructure/sync/PromotionToDiscountMapper.ts` — endDate time-preserving logic, buy_x_pay_y mapping
- `frontend/src/core/promotions/components/rules/BuyXPayYEditor.tsx` — new rule editor
- `frontend/src/core/promotions/components/rules/registry.ts` — registered buy_x_pay_y

**Productivity score:** 9

---

### DATE: 2026-07-29 — Logging System + Real-Time POS Sync

**Today I worked on:**

- **File-based structured logging** — `Logger.ts` rewritten with `pino/file` transport that writes JSON lines to `backend/logs/app.log` in addition to console pretty-print in dev mode
- **Real-time POS sync via Socket.io** — complete event-driven pipeline for auto-refreshing POS when products/discounts/taxes change

**Backend changes:**

- `backend/src/bootstrap/socket.ts` — **new** Socket.io server init with JWT auth, tenant room isolation
- `backend/src/bootstrap/app.ts` — `http.createServer` + `initSocketServer` attachment
- `backend/src/bootstrap/eventBus.ts` — bridge subscribes to 10 domain event types and forwards to Socket.io clients (filtered by tenant room)
- `backend/.../ProductService.ts` — injects `eventBus`, publishes `PRODUCT_CREATED/UPDATED/DELETED` on CRUD
- `backend/.../PromotionService.ts` — injects `eventBus`, publishes `DISCOUNT_CONFIG_UPDATED` on sync/remove
- `backend/.../container.ts` — injects `eventBus` into ProductService & PromotionService

**Frontend changes:**

- `frontend/src/@shared/hooks/useRealtimeSync.ts` — **new** hook listens for `domain-event` on socket, maps event name to React Query key, calls `invalidateQueries()`
- `frontend/src/core/pos/pages/PosPage.tsx` — calls `useRealtimeSync()` hook on mount
- `shared/src/constants/events.ts` — added `DISCOUNT_CONFIG_UPDATED`, `TAX_CONFIG_UPDATED`

**Bug fixes:**

- `backend/src/dev.ts` — fixed `mongoose.connection.db` possibly undefined with optional chaining
- `backend/src/.../ProductController.ts` — fixed null→undefined conversion for backward compatibility (pricingMode)
- `shared/src/validation/schemas/product-schemas.ts` — removed `.nullable()` from `pricingMode` enum

**Verification:**

- Frontend `npx tsc --noEmit` — 0 errors
- Backend `npx tsc --noEmit` — 0 errors
- Server starts on port 3000 with Socket.io ready
- Logs written to both console (pretty) and `backend/logs/app.log` (JSON)

**Event → Socket flow:**

```
ProductService.create/update/delete
  └─ publish DomainEvent ke EventBus
PromotionService.syncDiscountConfig/removeDiscountConfigById
  └─ publish DomainEvent ke EventBus
       │
       ▼
    eventBus.ts
  subscription → getIO().to(tenantId).emit('domain-event', event)
       │
       ▼ (WebSocket, filtered by tenantId)
    Frontend useRealtimeSync()
  eventName → queryKey → invalidateQueries()
       │
       ▼
    POS auto-refresh (no polling)
```

### DATE: 2026-07-29

**Today I worked on:**

- **Buy X Pay Y — cheapest & most expensive item mode** — added `applyTo: 'cheapest' | 'most_expensive'` config toggle
- **Fixed infinite pricing calculation loop** — `useEffect` watching `[items]` caused `recalculate()` → `set(items: [...])` → new ref → trigger again
- **Fixed zod validation** — `ruleSchema` enum missing `buy_x_pay_y` causing 400 on promotion create

**Changes:**

- `backend/.../BuyXPayYEffect.ts` — reads `applyTo` from config; sort asc for `cheapest`, desc for `most_expensive`
- `frontend/.../BuyXPayYEditor.tsx` — radio toggle "Termurah / Termahal" with dynamic label
- `frontend/.../registry.ts` — default `applyTo: 'cheapest'`
- `frontend/.../discountCalculator.ts` — sort by `applyTo` mode
- `backend/.../PromotionToDiscountMapper.ts` — passes `applyTo` through to effect config
- `frontend/.../PosPage.tsx` — removed `items` from `useEffect` dependency (break infinite loop)
- `backend/.../PromotionController.ts` — added `buy_x_pay_y` to zod rule enum

**Problems encountered:**

- Infinite pricing loop: `useEffect([items]) → recalculate() → set(items: [...updatedItems, ...freeItems]) → new array ref → useEffect fires again`
- 400 on promotion create: zod `ruleSchema` didn't include `buy_x_pay_y`

**Productivity score:** 9

### DATE: 2026-07-30

**Today I worked on:**

- **Document Template Engine — entire backend + frontend**
  - Backend: Expression Engine (arithmetic parser + AST evaluator), Formatter pipeline (6 default formatters + plugin registry), Expression + Format integration into VariableResolver
  - Backend: TableNode support (columnar data rendering with headers), RepeaterNode (scoped field resolution per item using Proxy)
  - Backend: ThermalRenderer (ESC/POS binary buffer generation), PdfRenderer (pdfkit PDF generation), wired into DocumentRenderer
  - Backend: Template versioning (saveVersion, listVersions, rollback in repository + service), export/import endpoints
  - Backend: Render API (POST /api/templates/render, /render/preview, /validate), 3 new endpoints on TemplateController
  - Backend: KOT and Invoice A4 default templates in seed, 4 templates total
  - Frontend: Template list page (CRUD cards, edit, duplicate, export, publish, delete, modal for create/edit)
  - Frontend: Designer page with 3-panel layout — ToolboxPanel (Sections/Fields/Components tabs with drag), CanvasPanel (drop zone, zoom, paper preview, section/node rendering, empty state), PropertiesPanel (dynamic form for font, align, transform, field path, label, format)
  - Frontend: DesignerContext with useReducer (ADD_SECTION, TOGGLE_SECTION, ADD_NODE, REMOVE_NODE, UPDATE_NODE, MOVE_NODE, LOAD_TEMPLATE, SET_SELECTED)
  - Frontend: Route `/templates` and `/templates/:id/designer`, sidebar navigation entry

**Changes:**

- `backend/src/core/document-engine/engine/ExpressionEvaluator.ts` — NEW
- `backend/src/core/document-engine/engine/formatters.ts` — NEW (FormatterRegistry, 6 default formatters, pipe syntax)
- `backend/src/core/document-engine/engine/VariableResolver.ts` — UPDATED (expr(), pipe format, RepeaterNode with Proxy scoping, TableNode with column rendering)
- `backend/src/core/document-engine/renderer/thermal/ThermalLayoutCalculator.ts` — UPDATED (flattenNode for children, table content rendering)
- `backend/src/core/document-engine/renderer/thermal/ThermalRenderer.ts` — NEW (ESC/POS binary buffer)
- `backend/src/core/document-engine/renderer/pdf/PdfRenderer.ts` — NEW (pdfkit PDF buffer)
- `backend/src/core/document-engine/renderer/DocumentRenderer.ts` — UPDATED (renderThermal, renderPdf)
- `backend/src/core/document-engine/engine/TemplateEngine.ts` — UPDATED (renderThermal, renderPdf)
- `backend/src/core/template/application/services/RenderService.ts` — NEW
- `backend/src/core/template/application/services/TemplateService.ts` — UPDATED (saveVersion on create/update/publish/duplicate, rollback, listVersions)
- `backend/src/core/template/interfaces/http/controllers/TemplateController.ts` — UPDATED (render, renderPreview, validate, exportTemplate, importTemplate, listVersions, rollback)
- `backend/src/core/template/interfaces/http/routes/template.routes.ts` — UPDATED (export, versions, rollback, render, render/preview, validate endpoints)
- `backend/src/bootstrap/container.ts` — UPDATED (RenderService, versionModel injection, renderService)
- `backend/src/bootstrap/routes.ts` — NO CHANGE (already has template routes)
- `backend/src/seed.ts` — UPDATED (KOT and Invoice A4 templates)
- `frontend/src/core/templates/pages/TemplateListPage.tsx` — NEW
- `frontend/src/core/templates/pages/DesignerPage.tsx` — NEW
- `frontend/src/modules/designer/context/DesignerContext.tsx` — NEW
- `frontend/src/modules/designer/components/ToolboxPanel.tsx` — NEW
- `frontend/src/modules/designer/components/CanvasPanel.tsx` — NEW
- `frontend/src/modules/designer/components/PropertiesPanel.tsx` — NEW
- `frontend/src/@shared/hooks/useSweetAlert.ts` — NEW
- `frontend/src/app/router.tsx` — UPDATED (TemplateListPage, DesignerPage routes)
- `frontend/src/layouts/DashboardLayout.tsx` — UPDATED (Templates sidebar)

**Problems encountered:**

- TableNode field resolution needed dual lookup (scoped item first, then root data fallback) — solved with `resolveFieldInTable` helper
- ThermalLayoutCalculator needed `flattenNode` to handle children from repeaters and containers — replaced inline content resolution
- `Loading` duplicate declaration in router.tsx after edits — fixed by removing extra
- CanvasPanel import path pointing to backend — fixed to use local type definition
- TemplateListPage had wrong hook reference (`useSweetAlert` returned `fire` not `Swal`) — fixed to use Swal directly or updated hook correctly

**Productivity score:** 10
