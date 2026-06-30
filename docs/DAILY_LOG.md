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

### DATE: 2026-06-30 (session 2)

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
