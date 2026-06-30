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
| **Est. MVP Completion** | Q3 2026 |

### Long-Term Roadmap

```
MVP (UMKM) ──→ Restaurant Module ──→ Villa Module ──→ AI/Platform
  2026              2026-2027            2027              2028
```

---

## SECTION 2 — DEVELOPMENT PHASES

### PHASE A — Foundation Setup `[x]`

| Task | Status |
|------|--------|
| Monorepo scaffolding (pnpm + turbo) | `[x]` |
| Docker environment (MongoDB, Redis) | `[x]` |
| Shared package (types, utils, constants) | `[x]` |
| Backend folder structure (DDD layers) | `[x]` |
| Frontend folder structure (feature-based) | `[x]` |
| TypeScript strict config | `[x]` |
| ESLint + Prettier | `[x]` |

**Completion:** 100%

---

### PHASE B — Core Backend Development `[~]`

| Task | Status |
|------|--------|
| Authentication & JWT | `[x]` |
| Refresh token + session management | `[x]` |
| Logout + current user endpoint | `[x]` |
| Tenant system (multi-tenant isolation) | `[x]` |
| Tenant CRUD + settings API | `[x]` |
| RBAC (roles & permissions) | `[x]` |
| Event bus (in-process) | `[x]` |
| Domain entities (all modules) | `[x]` |
| MongoDB schemas + indexes | `[x]` |
| Repositories (User, Product, Order, Tenant) | `[x]` |
| Application use cases | `[~]` |
| HTTP routes & controllers | `[~]` |
| Product catalog (CRUD + categories + barcode) | `[x]` |
| Category management | `[x]` |
| Order module | `[~]` |
| Payment module (Midtrans) | `[~]` |
| Inventory module | `[~]` |
| POS cart engine | `[~]` |
| Checkout & order processing | `[ ]` |
| Receipt generation | `[ ]` |
| Basic reporting | `[ ]` |

**Completion:** ~55%

---

### PHASE C — Core Frontend Development `[~]`

| Task | Status |
|------|--------|
| Project scaffolding (Vite + React Router) | `[x]` |
| Login page (functional) | `[x]` |
| Dashboard layout + sidebar | `[x]` |
| Auth store + API client | `[x]` |
| POS page (cart UI) | `[~]` |
| Product management UI | `[ ]` |
| Order management UI | `[ ]` |
| Inventory management UI | `[ ]` |
| Checkout flow UI | `[ ]` |
| Receipt view | `[ ]` |
| Reports page | `[ ]` |
| Settings page | `[ ]` |

**Completion:** ~30%

---

### PHASE D — POS Engine `[ ]`

| Task | Status |
|------|--------|
| Cart state management | `[ ]` |
| Barcode scanning | `[ ]` |
| Discount & promo engine | `[ ]` |
| Tax calculation | `[ ]` |
| Split bill | `[ ]` |
| Hold / recall order | `[ ]` |

**Completion:** 0%

---

### PHASE E — Payment System `[ ]`

| Task | Status |
|------|--------|
| Cash payment flow | `[ ]` |
| Midtrans payment integration | `[ ]` |
| Payment reconciliation | `[ ]` |
| Invoice generation | `[ ]` |

**Completion:** 0%

---

### PHASE F — Reporting `[ ]`

| Task | Status |
|------|--------|
| Daily sales report | `[ ]` |
| Product performance | `[ ]` |
| Inventory summary | `[ ]` |
| Profit & loss simple | `[ ]` |

**Completion:** 0%

---

### PHASE G — Testing & QA `[ ]`

| Task | Status |
|------|--------|
| Unit tests (backend domain) | `[ ]` |
| Integration tests (API) | `[ ]` |
| E2E tests (critical paths) | `[ ]` |
| Load testing | `[ ]` |

**Completion:** 0%

---

### PHASE H — MVP Deployment `[ ]`

| Task | Status |
|------|--------|
| Production Dockerfile | `[x]` |
| CI/CD pipeline | `[ ]` |
| VPS / cloud provisioning | `[ ]` |
| SSL & domain setup | `[ ]` |
| First tenant onboarding | `[ ]` |
| Monitoring (logs, errors) | `[ ]` |
| Backup strategy | `[ ]` |

**Completion:** ~5%

---

## SECTION 3 — WEEKLY PROGRESS CHECKLIST

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

### WEEK 5 — POS Cart `[~]`

- `[ ]` Cart engine (backend)
- `[x]` POS page layout
- `[x]` Product search
- `[ ]` Cart state (frontend)
- `[ ]` Add/remove items
- `[ ]` Quantity adjustment

### WEEK 5 — POS Cart + Catalog API `[~]`

- `[x]` Product CRUD API (create, read, update, delete)
- `[x]` Category CRUD API
- `[x]` Product search + filtering
- `[x]` Barcode field
- `[ ]` Cart engine (backend)
- `[x]` POS page layout
- `[ ]` Cart state (frontend)

### WEEK 6 — Checkout & Payment

- `[ ]` Order creation
- `[ ]` Checkout flow
- `[ ]` Cash payment
- `[ ]` Receipt generation
- `[ ]` Order history

### WEEK 7 — Reports

- `[ ]` Daily sales report
- `[ ]` Report UI
- `[ ]` Dashboard metrics

### WEEK 8 — Testing & Polish

- `[ ]` Backend unit tests
- `[ ]` Frontend smoke test
- `[ ]` Bug fixing
- `[ ]` UI polish

### WEEK 9 — MVP Launch Prep

- `[ ]` Production build
- `[ ]` Deploy to VPS
- `[ ]` Domain + SSL
- `[ ]` Pilot tenant onboarding
- `[ ]` Go-live

---

## SECTION 4 — MVP FEATURE CHECKLIST

| Feature | Status |
|---------|--------|
| Authentication (login, logout, refresh) | `[x]` |
| Session management (refresh tokens) | `[x]` |
| Current user API (`/auth/me`) | `[x]` |
| Tenant management (multi-tenant) | `[x]` |
| Tenant settings API | `[x]` |
| User & role management (RBAC) | `[x]` |
| Product management (CRUD + SKU + barcode) | `[x]` |
| Category management | `[x]` |
| Inventory management | `[x]` |
| Stock movement tracking | `[x]` |
| POS cart (add/remove/qty) | `[~]` |
| Checkout & order processing | `[ ]` |
| Cash payment | `[ ]` |
| Receipt printing (thermal) | `[ ]` |
| Basic reporting (daily sales) | `[ ]` |
| Dashboard (summary cards) | `[x]` |
| Settings page | `[ ]` |
| Bug fixing & polish | `[ ]` |
| **MVP Ready** | **`[ ]`** |

---

## SECTION 5 — FUTURE FEATURES (NOT MVP)

> ⚠️ **DO NOT BUILD** until MVP is live with real users.

| Feature | Priority | Notes |
|---------|----------|-------|
| `[ ]` Restaurant module | LOW | Kitchen printer, table management, online ordering |
| `[ ]` Villa / hospitality module | LOW | Reservation calendar, check-in/out, housekeeping |
| `[ ]` Mobile app (Capacitor) | LOW | Wraps existing frontend for mobile install |
| `[ ]` Desktop app (Electron) | LOW | Offline-first desktop POS |
| `[ ]` Offline sync | LOW | Local-first with background sync |
| `[ ]` Bluetooth printer | LOW | ESC/POS over Bluetooth |
| `[ ]` Barcode scanner | LOW | Hardware scanner integration |
| `[ ]` Payment gateway (QRIS, GoPay) | MEDIUM | Digital payments |
| `[ ]` Multi-currency | LOW | For tourism/hospitality |
| `[ ]` AI automation | LOW | Auto-stock reorder, sales prediction |
| `[ ]` Plugin runtime | LOW | 3rd-party plugin system |
| `[ ]` Public API | LOW | For integrations |
| `[ ]` Marketplace | LOW | Plugin store |

---

## SECTION 6 — MILESTONES

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

*Last updated: 2026-06-30*
