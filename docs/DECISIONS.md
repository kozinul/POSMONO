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
