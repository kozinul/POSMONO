# PROJECT ROADMAP

> POSMono — Modular Business Operating System
> Solo Founder · Multi-Tenant SaaS · Indonesia Market

---

## SECTION 1 — PROJECT OVERVIEW

| Field | Value |
|-------|-------|
| **Project Name** | POSMono |
| **Vision** | Modular business operating system for Indonesian small businesses |
| **Target Market** | UMKM (MVP) → Restaurant → Hospitality/Villa |
| **Current Phase** | MVP Development |
| **Architecture** | Modular Monolith + Multi-Tenant SaaS |
| **Patterns** | DDD · Event-Driven · CQRS-ready |
| **Frontend** | React + Vite + TypeScript |
| **Backend** | Node.js + Express.js + TypeScript |
| **Database** | MongoDB |
| **Infrastructure** | Docker · Redis · pnpm monorepo |

### Long-Term Roadmap

```
MVP (UMKM) ──→ Restaurant Module ──→ Villa Module ──→ AI/Platform
  2026              2026-2027            2027              2028
```

---

## SECTION 2 — MASTER ROADMAP

### PHASE A — Foundation Setup `[x]`

| Task | Status |
|------|--------|
| Monorepo scaffolding (pnpm + turbo) | `[x]` |
| Docker environment (MongoDB, Redis) | `[x]` |
| Shared package (types, utils, constants) | `[x]` |
| Backend folder structure (DDD layers) | `[x]` |
| Frontend folder structure (feature-based) | `[x]` |
| TypeScript strict config | `[x]` |
| ESLint + Prettier setup | `[x]` |

**Completion:** 100%

---

### PHASE B — Core Backend Development `[~]`

| Task | Status |
|------|--------|
| Authentication & JWT | `[x]` |
| Tenant system (multi-tenant isolation) | `[x]` |
| RBAC (roles & permissions) | `[x]` |
| Event bus (in-process) | `[x]` |
| Product catalog module | `[x]` |
| Category module | `[x]` |
| Family module (menu type: food/beverage) | `[x]` |
| SKU / variant system | `[x]` |
| Inventory module | `[x]` |
| Stock movement & adjustment | `[x]` |
| POS cart engine | `[x]` |
| Checkout / order processing | `[x]` |
| Payment handling (cash) | `[x]` |
| Payment method management (CRUD) | `[x]` |
| Receipt generation | `[x]` |
| Basic reporting | `[x]` |
| Upload service (image) | `[x]` |
| Settings (key-value store) | `[x]` |
| Member/Customer domain | `[x]` |
| Promotion domain (14 rule types) | `[x]` |

**Completion:** ~98%

---

### PHASE C — Core Frontend Development `[~]`

| Task | Status |
|------|--------|
| Project scaffolding (Vite + React Router) | `[x]` |
| Login page | `[x]` |
| Dashboard layout | `[x]` |
| Product management UI (search, filter, CRUD, image upload, tags) | `[x]` |
| Family management UI (Food/Beverage tabs) | `[x]` |
| Category management UI | `[x]` |
| Inventory management UI | `[x]` |
| POS page (3-level filter: Menu Type → Family → Category) | `[x]` |
| Checkout flow UI | `[x]` |
| Receipt view | `[x]` |
| Reports page | `[x]` |
| Settings page | `[x]` |
| Shift management UI | `[x]` |
| Member management UI | `[x]` |
| Promotion management UI | `[x]` |
| Payment method management UI (presets, color picker) | `[x]` |

**Completion:** ~95%

---

### PHASE D — POS Engine `[~]`

| Task | Status |
|------|--------|
| Cart state management | `[x]` |
| Barcode scanning | `[x]` |
| Discount & promo engine | `[x]` |
| Tax calculation engine | `[x]` |
| DPP Nilai Lain (Indonesia PPN 12%) | `[x]` |
| Compound tax (Service Charge + PPN) | `[x]` |
| Category-based & product-based tax | `[x]` |
| Tax exemption rules | `[x]` |
| Split bill | `[ ]` |
| Hold / recall order | `[ ]` |

**Completion:** ~60%

---

### PHASE E — Payment System `[ ]`

| Task | Status |
|------|--------|
| Cash payment flow | `[x]` |
| Transfer confirmation (manual) | `[ ]` |
| Payment reconciliation | `[ ]` |
| Invoice generation | `[ ]` |

**Completion:** ~25%

---

### PHASE F — Reporting `[ ]`

| Task | Status |
|------|--------|
| Daily sales report | `[x]` |
| Product performance | `[ ]` |
| Inventory summary | `[ ]` |
| Profit & loss simple | `[ ]` |

**Completion:** ~25%

---

### PHASE G — Testing & QA `[~]`

| Task | Status |
|------|--------|
| Unit tests (backend) | `[x]` |
| Service tests (mocked repos) | `[x]` |
| Repository tests (mongodb-memory-server) | `[x]` |
| API tests (Supertest) | `[x]` |
| Integration tests | `[x]` |
| Frontend smoke tests | `[x]` |
| E2E tests (critical paths) | `[ ]` |
| Load testing | `[ ]` |

**Completion:** ~85%

---

### PHASE H — MVP Deployment `[~]`

| Task | Status |
|------|--------|
| Production Dockerfile | `[x]` |
| CI/CD pipeline | `[x]` |
| VPS / cloud provisioning | `[ ]` |
| SSL & domain setup | `[ ]` |
| First tenant onboarding | `[ ]` |
| Monitoring (logs, errors) | `[ ]` |
| Backup strategy | `[ ]` |

**Completion:** ~30%

---

## SECTION 3 — WEEKLY DEVELOPMENT CHECKLIST

### WEEK 1 — Foundation `[x]`

- `[x]` Monorepo setup (pnpm + turbo)
- `[x]` Docker compose (MongoDB + Redis)
- `[x]` Dockerfile (multi-stage)
- `[x]` Backend DDD structure
- `[x]` Frontend structure
- `[x]` Shared package
- `[x]` TypeScript configs

### WEEK 2 — Auth & Tenant `[x]`

- `[x]` Authentication module
- `[x]` JWT strategy
- `[x]` Tenant middleware
- `[x]` RBAC system
- `[x]` User management
- `[x]` Login API
- `[x]` Login page

### WEEK 3 — Product Catalog `[x]`

- `[x]` Product module (CRUD)
- `[x]` Category module
- `[x]` SKU system
- `[x]` Variant support
- `[x]` Product UI (list, create, edit)
- `[x]` Category UI
- `[x]` Image upload

### WEEK 4 — Inventory `[x]`

- `[x]` Inventory module
- `[x]` Stock movement tracking
- `[x]` Stock adjustment
- `[x]` Low stock alert
- `[x]` Inventory UI
- `[x]` Stock history UI

### WEEK 5 — POS Cart `[x]`

- `[x]` Cart engine (backend)
- `[x]` POS page layout
- `[x]` Product search
- `[x]` Cart state (frontend)
- `[x]` Add/remove items
- `[x]` Quantity adjustment

### WEEK 6 — Checkout & Payment `[x]`

- `[x]` Order creation
- `[x]` Checkout flow
- `[x]` Cash payment
- `[x]` Receipt generation
- `[x]` Order history

### WEEK 7 — Reports `[x]`

- `[x]` Daily sales report
- `[x]` Report UI
- `[x]` Dashboard metrics
- `[x]` Shift management UI

### WEEK 8 — Testing & Polish `[x]`

- `[x]` Backend unit tests (Layer 1: 93 tests)
- `[x]` Backend service tests (Layer 2: 85 tests)
- `[x]` Repository tests (Layer 3: 66 tests)
- `[x]` API tests (Layer 4: 20 tests)
- `[x]` Integration tests (Layer 5: 24 tests)
- `[x]` Frontend smoke test (11 tests)
- `[x]` Bug fixing
- `[x]` UI polish

### WEEK 9 — MVP Launch Prep

- `[x]` Production build (Dockerfile + compose.prod.yml)
- `[ ]` Deploy to VPS
- `[ ]` Domain + SSL
- `[ ]` Pilot tenant onboarding
- `[ ]` Go-live

---

## SECTION 4 — MVP FEATURE CHECKLIST

| Feature | Status |
|---------|--------|
| Authentication (register, login, logout) | `[x]` |
| Tenant management (multi-tenant) | `[x]` |
| User & role management (RBAC) | `[x]` |
| Product management (CRUD + SKU) | `[x]` |
| Category management | `[x]` |
| Inventory management | `[x]` |
| Stock movement tracking | `[x]` |
| POS cart (add/remove/qty) | `[x]` |
| Checkout & order processing | `[x]` |
| Cash payment | `[x]` |
| Receipt printing (thermal) | `[~]` |
| Basic reporting (daily sales) | `[x]` |
| Shift management (open/close register) | `[x]` |
| Dashboard (summary cards + recent orders) | `[x]` |
| Settings page | `[x]` |
| Bug fixing & polish | `[x]` |
| **MVP Ready** | **`[ ]`** |

---

## SECTION 5 — FUTURE FEATURES (DO NOT BUILD YET)

> ⚠️ **NOT MVP** — Do not implement until MVP is live with real users.

| Feature | Notes |
|---------|-------|
| `[ ]` Restaurant module | Kitchen printer, table management, online ordering |
| `[ ]` Villa / hospitality module | Reservation calendar, check-in/out, housekeeping |
| `[ ]` Mobile app (Capacitor) | Wraps existing frontend for mobile install |
| `[ ]` Desktop app (Electron) | Offline-first desktop POS |
| `[ ]` Offline sync | Local-first with background sync when online |
| `[ ]` Bluetooth printer | ESC/POS over Bluetooth |
| `[ ]` Barcode scanner | Hardware scanner integration |
| `[ ]` Payment gateway | QRIS, GoPay, OVO, bank transfer |
| `[ ]` Multi-currency | For tourism/hospitality |
| `[ ]` AI automation | Auto-stock reorder, sales prediction |
| `[ ]` Plugin runtime | 3rd-party plugin system |
| `[ ]` Marketplace | Plugin store |

**Rule:** If it's not in the MVP checklist, do not build it.

---

## SECTION 6 — CURRENT ARCHITECTURE STATUS

| Design | Status |
|--------|--------|
| System architecture (overview) | `[x]` |
| DDD tactical design (entities, aggregates, repos) | `[x]` |
| Database schema design (MongoDB collections) | `[x]` |
| API design (RESTful routes) | `[x]` |
| Authentication & JWT design | `[x]` |
| RBAC / permission design | `[x]` |
| Event bus / domain events | `[x]` |
| Infrastructure (Docker, networking) | `[x]` |
| Transaction engine design | `[x]` |
| Offline sync architecture | `[ ]` |
| Printer architecture | `[ ]` |
| Plugin architecture | `[ ]` |
| Deployment architecture | `[ ]` |

---

## SECTION 7 — CURRENT BLOCKERS

### Blocker 1

| Field | Value |
|-------|-------|
| **Problem** | Printer integration strategy not finalized — USB thermal vs Bluetooth vs cloud (e.g., QZ Tray, WebUSB, ESC/POS over network). |
| **Possible Solutions** | 1) WebUSB for browser-based direct printing, 2) QZ Tray app for reliable thermal, 3) Network printer proxy via local server. |
| **Priority** | Medium |
| **Deadline** | Before MVP launch (Week 8) |
| **Status** | Researching |

### Blocker 2

| Field | Value |
|-------|-------|
| **Problem** | Tenant middleware needs centralized schema — user scoping via `tenantId` is currently ad-hoc in some services. |
| **Possible Solutions** | 1) Extract tenant context into a shared middleware that injects `tenantId` into every request, 2) Create tenant-scoped Mongo connection pool. |
| **Priority** | High |
| **Deadline** | This week |
| **Status** | Resolved — `tenantId` is now injected via `authenticate` middleware + `X-Tenant-Id` header |

### Blocker 3

| Field | Value |
|-------|-------|
| **Problem** | No CI/CD pipeline — manual deployment is fragile and time-consuming. |
| **Possible Solutions** | 1) GitHub Actions for build + deploy, 2) Docker Hub + watchtower on VPS. |
| **Priority** | Low (needed before pilot) |
| **Deadline** | Before Week 9 |
| **Status** | Not started |

---

## SECTION 8 — DAILY ENGINEERING LOG

### Template

```markdown
### DATE: YYYY-MM-DD

**Today I worked on:**
*

**Problems found:**
*

**Next task:**
*

**Notes / decisions:**
*
```

### Entries

### DATE: 2026-06-30

**Today I worked on:**

- Docker environment (MongoDB + Redis)
- Monorepo structure (pnpm, turbo, shared package)
- Backend DDD folder structure
- Frontend Vite + React Router setup
- Project roadmap creation

**Problems found:**

- `node_modules` mount had wrong permissions — fixed with `chown`
- `.turbo/cache` permission issue — fixed with `chown`
- `msgpackr-extract` native build failed on first attempt, rebuilt successfully

**Next task:**

- Complete POS cart engine (backend)
- Wire up cart state on frontend
- Checkout flow

---

## SECTION 9 — TECHNICAL DEBT TRACKER

| Debt | Priority | Created | Notes |
|------|----------|---------|-------|
| `[x]` Refactor auth middleware to be tenant-aware | High | Done | tenantId injected via authenticate middleware + X-Tenant-Id header |
| `[ ]` Improve inventory service performance | Medium | - | Needs MongoDB index audit |
| `[ ]` Standardize error response format | Medium | - | Some endpoints return inconsistent shapes |
| `[ ]` Add request validation (Zod) | Medium | - | Critical before pilot |
| `[ ]]` Optimize MongoDB indexes | Low | - | Run explain() on slow queries |
| `[ ]` Better error boundary on frontend | Low | - | Currently bare React error boundary |
| `[ ]` Add logging service (structured logs) | Low | - | `console.log` in some places |
| `[x]` Write API documentation | Low | Done | `docs/API_REFERENCE.md` covers 52 endpoints |

---

## SECTION 10 — PERSONAL RULES

> **Rules for solo development discipline.**

### Rule 1 — No non-MVP features

If it's not on the MVP checklist, do not build it. No restaurant module, no mobile app, no AI. Focus.

### Rule 2 — Ship first, polish later

Working software > perfect software. Get a working feature into production, then iterate.

### Rule 3 — No premature refactoring

If it works and isn't blocking progress, leave it alone. Refactor only when the code actively hurts development speed.

### Rule 4 — One thing at a time

Solo founder = single-threaded. Finish one module before starting the next. No context switching.

### Rule 5 — Validate with real users early

Don't build in the dark. Get a pilot customer on the MVP as soon as possible. Real feedback > assumptions.

### Rule 6 — Write tests for critical paths only

Unit test the core domain logic. Skip tests for CRUD boilerplate. Time is the scarcest resource.

### Rule 7 — Document decisions, not code

Write down why you chose something (ADR). Don't waste time on code comments — the code should be self-documenting.

### Rule 8 — Commit daily

Even if it's a small change. Daily commits create momentum and a safety net.

### Rule 9 — No feature creep during bug fixing

When fixing a bug, fix only the bug. Do not "improve" or "restructure" while debugging.

### Rule 10 — Sleep on big decisions

Architecture changes, tech swaps, pricing — never decide the same day. Sleep on it and review with fresh eyes.

---

## SECTION 11 — SUCCESS METRICS

| Milestone | Status | Target Date |
|-----------|--------|-------------|
| First working local MVP | `[ ]` | Week 9 |
| First deployed server | `[ ]` | Week 9 |
| First pilot customer | `[ ]` | Week 10 |
| First active tenant | `[ ]` | Week 10 |
| First paying customer | `[ ]` | Q3 2026 |
| 100 transactions processed | `[ ]` | Q3 2026 |
| 1,000 transactions processed | `[ ]` | Q4 2026 |
| 10 active tenants | `[ ]` | Q4 2026 |
| Revenue positive | `[ ]` | 2027 |

---

*Last updated: 2026-07-08*
*Updated daily during development.*
