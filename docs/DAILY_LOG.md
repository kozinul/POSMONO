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

### DATE: 2026-06-30 (session 3)

**Today I worked on:**

- STEP 5 — Identity Module: User roles & permissions
- Added `register` endpoint to AuthService/AuthController (create users within tenant)
- Created full Role management (MongoRoleRepository, RoleService, RoleController, role.routes.ts)
- Created User management (UserService, UserController for list/update/deactivate/activate)
- Created Permission listing endpoint (reads from shared PERMISSIONS constant)

**Problems encountered:**

- Role entity doesn't have an `update()` method — used `Role.hydrate()` to preserve ID on updates
- Had to add `findByTenant` to MongoUserRepository for user listing

**What I completed:**

- `POST /api/auth/register` — create user within tenant (authenticated)
- `GET/POST /api/roles`, `GET/PUT/DELETE /api/roles/:id` — full role CRUD
- `GET /api/users`, `GET/PUT /api/users/:id` — user listing & update
- `POST /api/users/:id/activate`, `POST /api/users/:id/deactivate` — user status toggle
- `GET /api/permissions` — list all available permissions from constants
- System roles protected from modification/deletion
- All registered in Awilix container + Express router
- Full `pnpm run build` — all 3 packages compiled successfully

**What I learned:**

- Role entity uses `hydrate()` for updates since it's an Entity (not AggregateRoot) without field setters
- MongoUserRepository extends MongoRepository base class which provides `save()` via upsert

**Tomorrow priority:**

- STEP 6 — POS Module: Cart engine & checkout flow

**Productivity score:** 9

**Notes:**

Identity module now has complete user management (CRUD + activate/deactivate), role management (CRUD, system role protection), and permission listing. Ready for POS integration.

---
