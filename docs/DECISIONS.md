# ARCHITECTURE DECISIONS

> Records of technical decisions and their rationale.
> Keep this updated so future-you knows why things are the way they are.

---

## Template

```markdown
---

### DECISION-XXX

**Date:** YYYY-MM-DD

**Problem:**
*

**Options Considered:**
1. Option A — pros/cons
2. Option B — pros/cons
3. Option C — pros/cons

**Chosen Option:**
*

**Reasoning:**
*

**Consequences:**
* Positive:
* Negative:

**Revisit Date:** YYYY-MM-DD (if applicable)
```
---

### DECISION-011

**Date:** 2026-07-26

**Problem:**
Tax subsystem refactoring — separate Charge from TaxRule as first-class entity, and add Adjustment Pipeline orchestration.

**Context:**
Previously, Service Charge was modeled as a `TaxRule` with `taxType: 'service_charge'`. This conflated two different concepts: **taxes** (government-mandated levies like PPN) and **charges** (merchant-imposed fees like Service Charge, Delivery Fee). Additionally, the pricing engine had no formal orchestration — Discount, Charge, Tax, and Rounding were computed in hardcoded order with no way for tenants to reorder.

**Options Considered:**

1. **Keep Service Charge as TaxRule** — Add more fields to TaxRule to handle charge-specific logic.
   - Pros: No schema migration
   - Cons: TaxRule becomes bloated, violates single responsibility

2. **Separate Charge as first-class entity** — New `Charge` entity with its own domain logic, stored in `TaxConfiguration.charges[]`.
   - Pros: Clean separation of concerns, each entity handles its own calculation
   - Cons: Migration needed for existing service_charge rules

3. **Hardcoded pipeline order** — Discount(10) → Charge(20) → Tax(30) → Rounding(40) in PricingEngine.
   - Pros: Simple, predictable
   - Cons: No flexibility for tenants who want different ordering

4. **Configurable Adjustment Pipeline** — Steps sorted by `sequence` number, configurable per entity.
   - Pros: Tenant-configurable, extensible to new adjustment types
   - Cons: Slightly more complex

**Chosen Option:**
Options 2 + 4 — Separate Charge entity + Configurable Adjustment Pipeline.

**Reasoning:**
- **Charge** is semantically different from TaxRule: charges are merchant decisions, taxes are regulatory compliance
- The pipeline pattern (like SAP/Oracle/Dynamics ERP) is proven for financial calculation engines
- Sequence numbers on each entity (Discount=10, Charge=20, TaxRule=30, Rounding=40) let tenants reorder without code changes
- Legacy fields (`charges[]`, `taxes[]`, `taxAmount`) are derived from `adjustments[]` for backward compatibility

**Implementation:**
- Backend: `Charge.ts` domain entity with `new()`, `flat()`, `create()`, `calculate()`, `calculateInclusive()`, `shouldApply()`
- Backend: `Adjustment.ts` types (`Adjustment`, `AdjustmentType`, `AdjustmentStep`, `PipelineContext`)
- Backend: `AdjustmentPipeline.ts` orchestrator — sorts steps by sequence, executes in order
- Backend: 4 step implementations — `DiscountStep`, `ChargeStep`, `TaxStep`, `RoundingStep`
- Backend: `PricingEngine` refactored to produce `adjustments[]` + legacy fields
- Backend: `POST /charges`, `DELETE /charges/:chargeId` API endpoints
- Frontend: `taxCalculator.ts` updated with `adjustments[]` in `TaxCalcResult`
- Frontend: `useAddCharge()`, `useDeleteCharge()` hooks; `GeneralSettingsPage` migrated from service_charge TaxRule to Charge API

**Consequences:**
- Positive: Clean domain model, tenant-configurable ordering, ERP-grade pipeline, backward compatible
- Negative: Migration needed for existing service_charge rules, slightly more code for pipeline steps

**Revisit Date:** When adding new adjustment types (e.g., surcharges, rebates)

---

## Decisions

### DECISION-001

**Date:** 2026-06-30

**Problem:**
Database isolation strategy for multi-tenant architecture.

**Options Considered:**

1. **Database per tenant** — Each tenant gets their own MongoDB database.
   - Pros: Strong isolation, easy to migrate individual tenants
   - Cons: Connection pool explosion, complex backup/restore, expensive with MongoDB Atlas

2. **Shared database with tenant-scoped collections** — Single database, every document has `tenantId`.
   - Pros: Simple, cheap, easy to query across tenants, single backup
   - Cons: Risk of data leakage if `tenantId` filter is forgotten, harder to migrate tenants

3. **Shared collection with tenant view** — Same as #2 but with MongoDB views for tenant isolation.
   - Pros: Adds database-level isolation layer
   - Cons: Views add complexity, not supported by all MongoDB drivers well

**Chosen Option:**
Option 2 — Shared database with tenant-scoped collections.

**Reasoning:**
- MVP phase: cost and simplicity matter more than perfect isolation
- `tenantId` middleware enforces scoping at the application level
- Can migrate to database-per-tenant later if needed
- Single connection pool is simpler to manage

**Consequences:**
- Positive: Cheaper, simpler, single point for backups
- Negative: Must never miss a `tenantId` filter — middleware is mandatory

**Revisit Date:** When first 50 tenants are onboarded.

---

### DECISION-002

**Date:** 2026-06-30

**Problem:**
Package manager and monorepo tooling.

**Options Considered:**

1. **npm workspaces** — Built-in, no extra dependency.
   - Pros: No extra tooling
   - Cons: Slow installs, no native caching, limited workspace features

2. **pnpm workspaces + Turborepo**
   - Pros: Fast installs (content-addressable store), strict dependency isolation, turbo caching, parallel builds
   - Cons: Extra complexity, pnpm learning curve

3. **Nx** — Full-featured monorepo tool.
   - Pros: Powerful generators, dependency graph, caching
   - Cons: Overkill for 3 packages, steep learning curve

**Chosen Option:**
Option 2 — pnpm workspaces + Turborepo.

**Reasoning:**
- pnpm saves disk space with content-addressable store
- Turbo provides parallel builds and caching out of the box
- Sufficient for current monorepo size without being over-engineered
- Industry standard for Node.js monorepos

**Consequences:**
- Positive: Fast installs, parallel builds, small disk footprint
- Negative: Must keep lockfile updated, pnpm-specific quirks

**Revisit Date:** N/A

---

### DECISION-003

**Date:** 2026-06-30

**Problem:**
Process architecture — monolith vs microservices.

**Options Considered:**

1. **Microservices** — Each module is a separate deployable service.
   - Pros: Independent scaling, team scaling, technology diversity
   - Cons: Operational nightmare for solo dev, network latency, distributed transactions

2. **Modular Monolith** — Single deployable unit with clear module boundaries.
   - Pros: Simple deployment, fast iteration, shared infrastructure, no network overhead
   - Cons: Cannot scale modules independently, risk of boundary erosion

3. **Modular Monolith with extractable modules** — Same as #2 but modules are designed as if they could be extracted later.
   - Pros: All the benefits of #2 + future-proofed for microservices
   - Cons: Slightly more upfront design discipline

**Chosen Option:**
Option 3 — Modular Monolith with extractable modules.

**Reasoning:**
- Solo developer: one deployable unit is all I can manage
- DDD module boundaries make extraction possible later
- Event-driven communication between modules prepares for future split
- No premature distribution

**Consequences:**
- Positive: Single deploy, fast iteration, eventual migration path
- Negative: Must maintain module boundaries strictly

**Revisit Date:** When the codebase exceeds 100k lines or when team grows beyond 3 developers.

---

### DECISION-004

**Date:** 2026-06-30

**Problem:**
Event bus implementation — in-process vs external message broker.

**Options Considered:**

1. **In-process EventEmitter** — Events stay in the same Node.js process.
   - Pros: Zero infrastructure, no latency, simple, perfect for monolith
   - Cons: No persistence, lost on crash, not available to external services

2. **Redis pub/sub** — Events published via Redis channels.
   - Pros: Can have multiple consumers, decoupled
   - Cons: No persistence, messages lost if subscriber is down

3. **BullMQ (Redis-backed queue)** — Persistent job queue.
   - Pros: Persistent, retries, delayed jobs, job scheduling
   - Cons: More infrastructure, complexity overhead

4. **RabbitMQ / Kafka** — Full message broker.
   - Pros: Enterprise-grade, durable, replayable
   - Cons: Massive overkill for MVP

**Chosen Option:**
Option 1 — In-process EventEmitter (with option to migrate to BullMQ).

**Reasoning:**
- In a monolith, all subscribers are in the same process — no need for network transport
- Can wrap EventEmitter with a `IEventBus` interface, making swap-out trivial
- BullMQ dependency is already in package.json for when we need persistent queues

**Consequences:**
- Positive: Zero latency, simple code, easy to debug
- Negative: Events are lost on server crash — acceptable for MVP but must address before production

**Revisit Date:** Before first production deployment.

---

### DECISION-005

**Date:** 2026-06-30

**Problem:**
Frontend state management.

**Options Considered:**

1. **React Context + useReducer** — Built-in, no dependencies.
   - Pros: Zero dependencies, simple
   - Cons: Performance issues with frequent updates (POS cart), boilerplate

2. **Redux Toolkit** — Industry standard.
   - Pros: DevTools, middleware, ecosystem
   - Cons: Heavy boilerplate, overkill for solo project

3. **Zustand** — Lightweight state management.
   - Pros: Minimal boilerplate, no providers, works outside React, simple API
   - Cons: Less ecosystem than Redux

4. **Jotai / Recoil** — Atomic state.
   - Pros: Fine-grained updates
   - Cons: Newer, less community adoption

**Chosen Option:**
Option 3 — Zustand.

**Reasoning:**
- Perfect balance of simplicity and power
- Can be used outside React (for API interceptors, etc.)
- POS cart needs frequent updates — Zustand handles this well without performance tuning
- Minimal boilerplate compared to Redux

**Consequences:**
- Positive: Clean code, easy testing, fast renders
- Negative: None significant

**Revisit Date:** N/A

---

### DECISION-006

**Date:** 2026-06-30

**Problem:**
Server-side rendering vs client-side rendering for frontend.

**Options Considered:**

1. **SSR (Next.js)** — Server-rendered React.
   - Pros: SEO, initial load speed
   - Cons: More infrastructure, more complexity, SSR for a POS app adds no value

2. **CSR (Vite SPA)** — Client-rendered React.
   - Pros: Simple, fast development, easy deployment (static files), works offline with PWA
   - Cons: Slower initial load, poor SEO

**Chosen Option:**
Option 2 — CSR with Vite.

**Reasoning:**
- POS is a logged-in app — SEO is irrelevant
- CSR + PWA gives near-native experience
- Vite build is fast and outputs static files — trivial to deploy
- Offline support via PWA is more valuable than SSR

**Consequences:**
- Positive: Simple deployment, fast builds, PWA-ready
- Negative: None for this use case

**Revisit Date:** If we add a public-facing website or customer portal.

---

### DECISION-007

**Date:** 2026-07-26

**Problem:**
Tax calculation with fraction modifier (DPP Nilai Lain) — how to represent Indonesian PPN 12% with effective 11% rate.

**Context:**
Indonesian tax regulation (PMK-131/2024) requires PPN 12% with a DPP fraction of 11/12 for certain goods/services. This means the effective tax rate is 11%, not 12%.

**Options Considered:**

1. **Store effective rate directly** — Store 11% as the rate, no fraction modifier.
   - Pros: Simple, no fraction math
   - Cons: Doesn't match regulation reference, hard to explain to auditors

2. **Store nominal rate + fraction modifier** — Store 12% rate with 11/12 fraction modifier.
   - Pros: Matches regulation exactly, auditors can verify
   - Cons: More complex calculation, UI needs to explain effective rate

3. **Dual display** — Store rate + modifier, but show effective rate in UI.
   - Pros: Both accurate and user-friendly
   - Cons: Extra UI complexity

**Chosen Option:**
Option 3 — Store nominal rate + fraction modifier, show effective rate in UI.

**Reasoning:**
- Regulatory compliance: auditors need to see 12% rate and 11/12 fraction
- User experience: POS operators need to see the actual effective rate (11%)
- The `TaxRule.calculateTax()` applies modifier before rate calculation
- UI labels now show "Pajak Efektif" with calculated percentage

**Implementation:**
- Backend: `TaxRule.modifier` stores `{ type: 'fraction', config: { numerator: 11, denominator: 12 } }`
- Backend: `FractionModifierStrategy.apply()` returns `amount * (numerator / denominator)`
- Frontend: Settings page shows preview "Pajak Efektif = 12% × 11/12 = 11.00%"
- Frontend: POS receipt shows rule name only (no confusing rate percentage)

**Consequences:**
- Positive: Regulatory compliant, user-friendly, extensible to other fraction-based taxes
- Negative: Slightly more complex than storing effective rate directly

**Revisit Date:** When Indonesian tax regulation changes.

---

### DECISION-008

**Date:** 2026-07-26

**Problem:**
Promotion → Discount engine sync — how to make POS auto-apply promos created in Promotions page.

**Context:**
The POS reads discount config from `/api/discount/{tenantId}`, but promos are created in `/api/promotions`. These were two separate systems.

**Options Considered:**

1. **POS reads both endpoints** — Fetch discount config AND promo list separately.
   - Pros: No sync needed
   - Cons: Complex POS logic, duplicate evaluation, performance overhead

2. **PromotionToDiscountMapper** — Sync promo rules to discount config on save.
   - Pros: Single source of truth for POS, existing discount engine works unchanged
   - Cons: Sync timing, data duplication

3. **Unified discount engine** — Merge promotion and discount into one system.
   - Pros: Clean architecture
   - Cons: Major refactor, breaks existing APIs

**Chosen Option:**
Option 2 — `PromotionToDiscountMapper` syncs promo rules to discount config.

**Reasoning:**
- POS already has a working discount engine — no need to reinvent
- Mapper sets `promoCodeId` on synced discount rules for validation
- `DiscountServiceAdapter.validatePromoCode()` falls back to finding synced rules by `promoCodeId`
- Auto-apply works because POS always runs discount engine, not just when `promoCode` is provided

**Implementation:**
- `PromotionToDiscountMapper` converts promotion rules to discount rules
- `promoCodeId` field links synced rules back to original promotion
- `PaymentService` always calls `DiscountServiceAdapter.apply()` (removed `if (promoCode)` guard)
- `PaymentController` accepts `categoryId` for category-based promo conditions

**Consequences:**
- Positive: Auto-apply promos work, promo code validation works, single discount engine
- Negative: Sync must be kept in sync (on promotion create/update/delete)

**Revisit Date:** When promotion rules become significantly more complex than discount rules.

---

### DECISION-009

**Date:** 2026-07-26

**Problem:**
POS currency display — inconsistent formatting with decimal cents in Indonesian Rupiah.

**Context:**
IDR has no decimal subunits. Previous implementation used `toLocaleString('id-ID')` which sometimes produced `,6` or similar artifacts from floating point arithmetic.

**Options Considered:**

1. **`toLocaleString('id-ID')` everywhere** — Simple, built-in.
   - Pros: No custom code
   - Cons: Floating point artifacts, inconsistent display

2. **`formatIDR` helper** — Custom helper that rounds to integer and formats with thousand separator.
   - Pros: Consistent display, no decimals, proper rounding
   - Cons: Must use everywhere

3. **Backend returns pre-formatted strings** — API returns formatted currency.
   - Pros: Client doesn't need formatting logic
   - Cons: Wrong architecture, API should return numbers

**Chosen Option:**
Option 2 — `formatIDR` helper in `frontend/src/core/pos/utils/money.ts`.

**Reasoning:**
- `formatIDR(amount)` = `Math.round(amount).toLocaleString('id-ID')`
- POS store rounds all monetary values via `roundMoney()` using `Math.round()`
- All UI components use `formatIDR()` instead of `toLocaleString('id-ID')`
- Backend `PaymentService` also rounds monetary values before returning

**Consequences:**
- Positive: No decimal artifacts, consistent display across POS
- Negative: Must remember to use `formatIDR()` in new components

**Revisit Date:** N/A

---

### DECISION-010

**Date:** 2026-07-26

**Problem:**
Dashboard navigation — top header bar becoming crowded with menu items.

**Context:**
As more features were added (Products, Categories, Families, Promotions, Settings, etc.), the top header bar became too crowded to navigate effectively.

**Options Considered:**

1. **Keep header bar, add dropdowns** — Group menu items in dropdown menus.
   - Pros: Familiar pattern, minimal layout change
   - Cons: Dropdowns hide items, hard to discover

2. **Left sidebar navigation** — Move menu items to a persistent left sidebar.
   - Pros: Always visible, grouped by section, industry standard for dashboards
   - Cons: Reduces content width, requires layout change

3. **Hamburger menu** — Collapsible menu icon.
   - Pros: Maximizes content width when hidden
   - Cons: Hidden by default, extra click to navigate

**Chosen Option:**
Option 2 — Left sidebar navigation in `DashboardLayout.tsx`.

**Reasoning:**
- Industry standard for SaaS dashboards
- Always visible — no clicking to discover menu items
- Groups: Transaksi (POS, Orders), Menu (Products, Categories, Families, Modifiers), Pelanggan (Members), Keuangan (Payments), Promosi, Laporan, Pengaturan
- POS page renders fullscreen without sidebar (special case)

**Consequences:**
- Positive: Better navigation, discoverable menu items, professional appearance
- Negative: Slightly less content width, POS needs special handling

**Revisit Date:** N/A
