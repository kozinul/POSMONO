# Testing Strategy

> **Project:** POSMono — Modular Business Operating System
> **Stack:** Node.js · Express · MongoDB · Docker · Redis
> **Architecture:** Multi-tenant · Modular Monolith · DDD · Repository Pattern · Event Driven
> **Testing Stack:** Vitest · Supertest · Bruno
> **Status:** Active Development — MVP Phase

---

## Table of Contents

1. [Testing Philosophy](#1-testing-philosophy)
2. [Testing Layers](#2-testing-layers)
3. [Test Folder Structure](#3-test-folder-structure)
4. [Module Test Coverage](#4-module-test-coverage)
5. [Multi-Tenant Testing Rules](#5-multi-tenant-testing-rules)
6. [API Testing Strategy](#6-api-testing-strategy)
7. [Database Testing Strategy](#7-database-testing-strategy)
8. [Domain Event Testing](#8-domain-event-testing)
9. [Test Priority Order](#9-test-priority-order)
10. [Critical Business Flows](#10-critical-business-flows)
11. [Testing Debt (MVP Phase)](#11-testing-debt-mvp-phase)
12. [Test Failure Log](#12-test-failure-log)
13. [Weekly Testing Roadmap](#13-weekly-testing-roadmap)
14. [Engineering Rules](#14-engineering-rules)

---

## 1. Testing Philosophy

### Principles

**Business logic must be tested first.**
Domain entities and application services contain the rules that make money. If they break, the business breaks. These are tested before anything else.

**Frontend testing is postponed.**
The frontend is a presentation layer. Business rules live on the backend. During MVP, manual visual verification is sufficient for UI. Automated frontend tests begin after 10 paying customers.

**Automated testing is preferred over manual.**
Manual testing does not scale. Every critical flow must have an automated test that can run in CI in under 60 seconds.

**Testing must happen continuously.**
Write tests as you build, not as a separate phase. Each module is tested at the time of implementation.

**Prevent regressions before adding features.**
A failing test suite is a blocker. Fix regressions immediately. Never stack new code on broken tests.

### Development Rule

> **Never add a new feature without adding tests.**
>
> This is non-negotiable. If the feature is important enough to build, it is important enough to protect with tests. The only exception is experimental/prototype code that is explicitly marked and never reaches production.

---

## 2. Testing Layers

```
┌─────────────────────────────────────────────┐
│            LAYER 5: INTEGRATION              │
│  Full request → database → response flow     │
│  Module communication                        │
│  External service contracts                  │
├─────────────────────────────────────────────┤
│            LAYER 4: API                       │
│  Endpoint contracts                          │
│  Middleware (auth, tenant context)           │
│  Request validation (Zod schemas)            │
│  Error handling & status codes               │
├─────────────────────────────────────────────┤
│            LAYER 3: REPOSITORY               │
│  Database persistence                        │
│  Queries & aggregations                      │
│  Tenant filtering & isolation                │
│  MongoDB indexes                             │
├─────────────────────────────────────────────┤
│            LAYER 2: SERVICE                  │
│  Application services                        │
│  Business workflows                          │
│  Use cases (CreateOrder, PayCash, etc.)      │
│  Domain event publication                    │
├─────────────────────────────────────────────┤
│            LAYER 1: DOMAIN                   │
│  Entities                                    │
│  Value Objects                               │
│  Aggregate Roots                             │
│  Business rules & invariants                 │
│  Domain event creation                       │
└─────────────────────────────────────────────┘
```

### Layer 1 — Domain Testing

Tests pure business logic with zero dependencies. No database, no network, no frameworks.

**What to test:**
- Entity creation and state transitions
- Value object equality and validation
- Aggregate root invariants (e.g., cannot pay a cancelled order)
- Business rule enforcement
- Domain event creation on state changes

**What NOT to test:**
- Serialization (assumed correct)
- Repository persistence (covered in Layer 3)

### Layer 2 — Service Testing

Tests application services using mocked repositories and event bus.

**What to test:**
- Use case execution (happy path)
- Business workflow validation (e.g., pay → stock decremented)
- Error conditions (not found, already paid, insufficient amount)
- Domain event publishing

**What NOT to test:**
- Database behavior (covered in Layer 3)
- HTTP concerns (covered in Layer 4)

### Layer 3 — Repository Testing

Tests database persistence using `mongodb-memory-server`. No mocking — real queries against an in-memory MongoDB instance.

**What to test:**
- Create, read, update operations
- Queries with filters, sorting, pagination
- Tenant filtering (every query must filter by tenantId)
- Compound index performance

**What NOT to test:**
- Business logic (already covered in Layer 1)
- HTTP layer (covered in Layer 4)

### Layer 4 — API Testing

Tests HTTP endpoints using Supertest. Full Express app with real middleware, but mocked services/repositories.

**What to test:**
- Route availability and HTTP methods
- Authentication middleware (valid token, expired token, missing token)
- Tenant context middleware
- Request validation (invalid body → 400)
- Success responses (structure, status codes)

**What NOT to test:**
- Database persistence (covered in Layer 3)
- Deep business logic (covered in Layer 1-2)

### Layer 5 — Integration Testing

Tests complete request flows from HTTP to database and back. Real database, real services, real middleware. Mock only external services (Midtrans, email, etc.).

**What to test:**
- Full flow: create product → add stock → create order → pay → verify
- Cross-module communication: Order → Payment → Inventory
- Tenant isolation: Tenant A cannot access Tenant B data

**What NOT to test:**
- External payment provider callbacks (test with contract tests separately)

---

## 3. Test Folder Structure

Tests mirror the source code structure exactly.

```
backend/
├── src/
│   ├── @shared/
│   │   ├── domain/
│   │   │   └── __tests__/
│   │   │       └── AggregateRoot.test.ts
│   │   └── config/
│   │       └── __tests__/
│   │           └── env.test.ts
│   └── core/
│       ├── identity/
│       │   ├── domain/__tests__/
│       │   │   └── User.test.ts
│       │   ├── application/__tests__/
│       │   │   └── AuthService.test.ts
│       │   ├── infrastructure/__tests__/
│       │   │   └── MongoUserRepository.test.ts
│       │   └── interfaces/__tests__/
│       │       └── auth.routes.test.ts
│       ├── ordering/
│       │   ├── domain/__tests__/
│       │   │   └── Order.test.ts
│       │   ├── application/__tests__/
│       │   │   └── OrderService.test.ts
│       │   └── infrastructure/__tests__/
│       │       └── MongoOrderRepository.test.ts
│       ├── payment/
│       │   ├── domain/__tests__/
│       │   │   └── Payment.test.ts
│       │   ├── application/__tests__/
│       │   │   └── PaymentService.test.ts
│       │   └── infrastructure/__tests__/
│       │       └── MongoPaymentRepository.test.ts
│       ├── catalog/
│       │   ├── domain/__tests__/
│       │   │   └── Product.test.ts
│       │   ├── application/__tests__/
│       │   │   └── ProductService.test.ts
│       │   └── infrastructure/__tests__/
│       │       └── MongoProductRepository.test.ts
│       ├── inventory/
│       │   ├── domain/__tests__/
│       │   │   ├── Stock.test.ts
│       │   │   └── StockMovement.test.ts
│       │   ├── application/__tests__/
│       │   │   └── InventoryService.test.ts
│       │   └── infrastructure/__tests__/
│       │       └── MongoStockRepository.test.ts
│       ├── tenant/
│       │   ├── domain/__tests__/
│       │   │   └── Tenant.test.ts
│       │   ├── application/__tests__/
│       │   │   └── TenantService.test.ts
│       │   └── infrastructure/__tests__/
│       │       └── MongoTenantRepository.test.ts
│       └── pos/
│           ├── domain/__tests__/
│           │   └── Shift.test.ts
│           └── application/__tests__/
│               └── ShiftService.test.ts
├── tests/
│   ├── fixtures/
│   │   ├── index.ts              # Barrel export
│   │   ├── identity.fixtures.ts
│   │   ├── ordering.fixtures.ts
│   │   ├── payment.fixtures.ts
│   │   ├── catalog.fixtures.ts
│   │   ├── inventory.fixtures.ts
│   │   └── tenant.fixtures.ts
│   ├── factories/
│   │   ├── index.ts
│   │   ├── user.factory.ts
│   │   ├── order.factory.ts
│   │   ├── product.factory.ts
│   │   └── tenant.factory.ts
│   ├── helpers/
│   │   ├── db.ts                 # mongodb-memory-server setup/teardown
│   │   ├── container.ts           # Mock DI container
│   │   └── auth.ts                # Generate test JWT tokens
│   ├── mock-data/
│   │   ├── users.ts
│   │   ├── orders.ts
│   │   ├── products.ts
│   │   └── tenants.ts
│   └── integration/
│       └── flows/
│           ├── order-to-payment.test.ts
│           ├── tenant-isolation.test.ts
│           └── create-order-full-flow.test.ts
└── vitest.config.ts
```

### File Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| Domain test | `*.test.ts` | `Order.test.ts` |
| Service test | `*.test.ts` | `AuthService.test.ts` |
| Repository test | `*.test.ts` | `MongoOrderRepository.test.ts` |
| API route test | `*.test.ts` | `order.routes.test.ts` |
| Integration test | `*.test.ts` | `order-to-payment.test.ts` |
| Fixture | `*.fixtures.ts` | `ordering.fixtures.ts` |
| Factory | `*.factory.ts` | `order.factory.ts` |

---

## 4. Module Test Coverage

### Coverage Targets

| Module | Target Coverage | Risk Level | Notes |
|--------|---------------|------------|-------|
| Identity | 85% | High | Auth cannot break |
| Tenant | 85% | High | Isolation is critical |
| Ordering (POS) | 80% | Critical | Core business flow |
| Payment | 80% | Critical | Money-related |
| Catalog | 70% | Medium | Mostly CRUD |
| Inventory | 70% | Medium | CRUD + stock math |
| POS (Shift) | 50% | Low | Simple lifecycle |

### Identity Module (Target: 85%)

| Test | Layer | Priority |
|------|-------|----------|
| Login with valid credentials | Service | P1 |
| Login with wrong password | Service | P1 |
| Login with inactive user | Service | P1 |
| JWT token generation | Service | P1 |
| JWT token validation (expired, malformed) | Service | P1 |
| Logout invalidates session | Service | P1 |
| Register new user | Service | P1 |
| Register duplicate email | Service | P1 |
| Role validation — valid role | Service | P2 |
| Role validation — insufficient permission | Service | P2 |
| User list with pagination | Service | P2 |
| User activate/deactivate | Service | P2 |
| Auth middleware — no token | API | P1 |
| Auth middleware — valid token | API | P1 |
| Auth middleware — expired token | API | P1 |

### Tenant Module (Target: 85%)

| Test | Layer | Priority |
|------|-------|----------|
| Create tenant with valid data | Service | P1 |
| Create tenant with duplicate slug | Service | P1 |
| Get current tenant by ID | Service | P1 |
| Update tenant settings | Service | P1 |
| Tenant slug uniqueness | Repository | P1 |
| Tenant isolation — cross-tenant query returns nothing | Repository | P1 |
| Tenant context middleware sets req.tenantId | API | P1 |

### Catalog Module (Target: 70%)

| Test | Layer | Priority |
|------|-------|----------|
| Create product with valid data | Service | P1 |
| Create product with missing required fields | Service | P1 |
| Update product name/price | Service | P2 |
| Update product with invalid price | Service | P2 |
| Delete product (soft delete) | Service | P2 |
| List products by tenant | Repository | P1 |
| List products with category filter | Repository | P2 |
| List products with pagination | Repository | P2 |
| Create category | Service | P2 |
| List categories | Repository | P2 |

### Inventory Module (Target: 70%)

| Test | Layer | Priority |
|------|-------|----------|
| Adjust stock — positive adjustment | Domain | P1 |
| Adjust stock — negative adjustment (out) | Domain | P1 |
| Adjust stock — insufficient stock | Domain | P1 |
| Get stock by product and warehouse | Repository | P1 |
| List stock movements for a product | Repository | P2 |
| Low stock query (below threshold) | Repository | P2 |
| Create warehouse | Service | P2 |
| Tenant-scoped warehouse queries | Repository | P1 |

### Ordering Module (Target: 80%)

| Test | Layer | Priority |
|------|-------|----------|
| Create order with items | Domain | P1 |
| Create order — calculates subtotal, tax, total | Domain | P1 |
| Create order — generates domain event | Domain | P1 |
| Confirm order — valid transition | Domain | P1 |
| Confirm order — invalid transition (paid → confirmed) | Domain | P1 |
| Cancel order — valid | Domain | P1 |
| Cancel order — already paid throws error | Domain | P1 |
| Mark paid — sets payment status | Domain | P1 |
| Create order service — full flow | Service | P1 |
| List orders with status filter | Repository | P2 |
| Create order via API — 201 response | API | P1 |
| Create order via API — invalid body returns 400 | API | P1 |

### Payment Module (Target: 80%)

| Test | Layer | Priority |
|------|-------|----------|
| Create payment with cash method | Domain | P1 |
| Complete payment — sets paidAt, status | Domain | P1 |
| Complete payment — already completed throws | Domain | P1 |
| Fail payment — sets status to failed | Domain | P1 |
| Pay cash service — success flow | Service | P1 |
| Pay cash — order not found | Service | P1 |
| Pay cash — order already paid | Service | P1 |
| Pay cash — insufficient amount | Service | P1 |
| Pay cash — order marked paid after payment | Service | P1 |
| Pay cash — payment and order events published | Service | P1 |
| Pay cash via API — 200 response | API | P1 |
| Pay cash via API — invalid amount returns 400 | API | P1 |

### POS / Shift Module (Target: 50%)

| Test | Layer | Priority |
|------|-------|----------|
| Open shift with starting balance | Domain | P1 |
| Close shift — valid transition | Domain | P1 |
| Close shift — already closed throws | Domain | P1 |
| Close shift — calculates expected vs actual | Domain | P2 |
| Open shift via API | API | P2 |

---

## 5. Multi-Tenant Testing Rules

This is the most critical section. Tenant isolation is a security requirement, not a feature. A breach means one customer sees another customer's data — this destroys trust and may be illegal.

### Principle

> **Every repository method MUST filter by tenantId.**
>
> There is no exception. If a query does not include a tenantId filter, it is a security bug.

### Mandatory Isolation Test Cases

| # | Test Case | Expected Behavior |
|---|-----------|-------------------|
| 1 | Tenant A queries products → returns only Tenant A's products | Repository layer |
| 2 | Tenant B queries products → returns only Tenant B's products | Repository layer |
| 3 | Tenant A queries orders → returns only Tenant A's orders | Repository layer |
| 4 | Tenant B queries orders → returns only Tenant B's orders | Repository layer |
| 5 | Tenant A accesses Tenant B's product by ID → returns null/403 | Service layer |
| 6 | Tenant A updates Tenant B's product → returns error | Service layer |
| 7 | Tenant A accesses Tenant B's order → returns error | Service layer |
| 8 | Tenant A accesses Tenant B's stock → returns error | Service layer |
| 9 | Tenant A accesses Tenant B's users → returns error | Service layer |
| 10 | Tenant A accesses Tenant B's payments → returns error | Service layer |

### SaaS Security Checklist

Every module must pass these checks before being considered complete:

```
□ Each repository method filters by tenantId
□ Each service method validates tenant ownership
□ Each API endpoint uses req.tenantId from middleware (not request body)
□ Tenant ID is set by middleware, never by client
□ No endpoint allows cross-tenant ID injection
□ Indexes include tenantId for filtered queries
□ Tests exist for cross-tenant access attempts
□ Create operations attach tenantId to the entity
```

### Implementation Rules

1. **Never trust the client.** Tenant ID must come from the JWT payload, set by the `authenticate` middleware, available as `req.tenantId`. If a client sends a tenantId in the request body, ignore it or reject it.

2. **Mongoose query defense.** Every repository method that reads data must include a `tenantId` filter. Example:
   ```typescript
   // Correct — always filter by tenant
   const docs = await this.model.find({ tenantId, ...otherFilters });

   // WRONG — never query without tenant filter
   const doc = await this.model.findById(id); // Exposes data cross-tenant
   ```

3. **Secondary index strategy.** Every collection must have a compound index on `{ tenantId, ...otherFields }` to ensure tenant-filtered queries use indexes.

4. **Cross-tenant test is mandatory.** For every module, there must be at least one test that proves Tenant A cannot access Tenant B's data.

---

## 6. API Testing Strategy

### Tool Choice

| Tool | Purpose | When |
|------|---------|------|
| Supertest | Automated API tests in Vitest | CI pipeline, pre-commit |
| Bruno | Manual API exploration, debugging | Development, onboarding |

**Supertest** runs against the actual Express app in-process. It is fast, deterministic, and runs in CI. All critical API tests use Supertest.

**Bruno** is used for ad-hoc testing, exploring edge cases, and demonstrating API behavior to new developers. Bruno collections are committed to the repository.

### Bruno Collection Structure

```
bruno/
├── bruno.json                  # Bruno config
├── environments/
│   ├── Local.bru              # localhost:4000
│   └── Production.bru         # production URL
└── collections/
    └── POSMono API/
        ├── Auth/
        │   ├── Login.bru
        │   ├── Register.bru
        │   ├── Logout.bru
        │   └── Me.bru
        ├── Tenant/
        │   ├── Create Tenant.bru
        │   ├── Get Current Tenant.bru
        │   └── Update Settings.bru
        ├── Catalog/
        │   ├── Create Product.bru
        │   ├── List Products.bru
        │   ├── Get Product.bru
        │   ├── Update Product.bru
        │   ├── Delete Product.bru
        │   └── Categories CRUD.bru
        ├── Inventory/
        │   ├── Get Stock.bru
        │   ├── Adjust Stock.bru
        │   └── Stock Movements.bru
        ├── Orders/
        │   ├── Create Order.bru
        │   ├── List Orders.bru
        │   └── Get Order.bru
        ├── Payments/
        │   ├── Pay Cash.bru
        │   └── Get Payment.bru
        └── POS/
            ├── Open Shift.bru
            └── Close Shift.bru
```

### Environment Variables

```json
{
  "BASE_URL": "http://localhost:4000/api",
  "ACCESS_TOKEN": "",
  "TENANT_ID": "",
  "USER_ID": "",
  "PRODUCT_ID": ""
}
```

### Reusable Auth Flow

Each Bruno collection should include a `Login.bru` request that sets the `ACCESS_TOKEN` environment variable globally. Subsequent requests read this variable from the Authorization header.

```
// Login.bru — runs first, sets ACCESS_TOKEN
POST {{BASE_URL}}/auth/login
Body: { "email": "owner@test.com", "password": "password123" }

// Script (post-response):
// bru.setEnvVar("ACCESS_TOKEN", res.body.data.token);
// bru.setEnvVar("TENANT_ID", res.body.data.tenantId);
```

### Supertest Structure in Vitest

```typescript
import request from 'supertest';
import { createApp } from '../../../bootstrap/app';
import { generateTestToken } from '../../../tests/helpers/auth';

const app = createApp();

describe('POST /api/payments/pay-cash', () => {
  const token = generateTestToken({ tenantId: 'tenant-1', userId: 'user-1' });

  it('returns 200 on successful cash payment', async () => {
    const res = await request(app)
      .post('/api/payments/pay-cash')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId: 'order-123', amount: 50000 });

    expect(res.status).toBe(200);
    expect(res.body.data.payment.status).toBe('completed');
    expect(res.body.data.order.status).toBe('paid');
  });

  it('returns 400 when amount is insufficient', async () => {
    const res = await request(app)
      .post('/api/payments/pay-cash')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId: 'order-123', amount: 100 }); // Order total is 50000

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Insufficient');
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/payments/pay-cash')
      .send({ orderId: 'order-123', amount: 50000 });

    expect(res.status).toBe(401);
  });
});
```

---

## 7. Database Testing Strategy

### Infrastructure

Use `mongodb-memory-server` for repository and integration tests. This downloads and runs a real MongoDB binary in-memory. It is fast, isolated, and requires no external infrastructure.

```typescript
// tests/helpers/db.ts
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer;

export async function setupTestDb(): Promise<string> {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  return uri;
}

export async function teardownTestDb(): Promise<void> {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

export async function clearCollections(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}
```

### Rules

| Rule | Description |
|------|-------------|
| **Never test against development database** | Always use mongodb-memory-server. A test that accidentally writes to dev database is a data-loss incident. |
| **Reset state between tests** | Use `clearCollections()` in `beforeEach` to ensure test isolation. Never rely on test ordering. |
| **Seed only what you need** | Each test creates its own data. Shared seeds lead to brittle tests. |
| **Test indexes explicitly** | Create indexes in a `beforeAll` and verify query performance with `.explain()`. |

### What to Test in Repository Layer

| Concern | Test | Example |
|---------|------|---------|
| Writes | Document is persisted correctly | `save(order)` → find by ID returns correct fields |
| Reads | Query returns expected documents | `findByTenant(tenantId)` returns only that tenant's docs |
| Tenant filtering | Cross-tenant query returns empty | Tenant B queries Tenant A's data → no results |
| Pagination | Offset + limit works correctly | Page 2 returns second page of results |
| Unique constraints | Duplicate unique field is rejected | Creating two users with same email throws |
| Compound indexes | Index is used for common queries | `.explain()` shows `IXSCAN`, not `COLLSCAN` |

### Database Reset Strategy

```typescript
// In each repository test file:

beforeEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDb();
});
```

This ensures each test starts with a clean database. No shared state between tests.

---

## 8. Domain Event Testing

Domain events are a first-class concept in this architecture. Every state change on an aggregate root should produce a domain event. These events must be tested explicitly.

### What to Test

| Concern | Example |
|---------|---------|
| Event creation | `Order.create()` produces `ordering.order.created` |
| Event payload | Event contains correct orderId, tenantId, items, total |
| Event metadata | Event has eventName, aggregateId, aggregateType, timestamp |
| Event clearing | After `clearEvents()`, no events remain |
| Multiple events | A single operation can produce multiple events |

### Example Test

```typescript
describe('Order domain events', () => {
  it('emits ordering.order.created on creation', () => {
    const order = Order.create({
      tenantId: 'tenant-1',
      items: [validItem],
      subtotal: 50000,
      discount: 0,
      tax: 5000,
      total: 55000,
      customerId: null,
      cashierId: 'cashier-1',
      notes: '',
      source: 'pos',
      metadata: {},
    });

    const events = order.domainEvents;
    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe('ordering.order.created');
    expect(events[0].aggregateId).toBe(order.id.toValue());
    expect(events[0].tenantId).toBe('tenant-1');
    expect(events[0].payload.total).toBe(55000);
  });

  it('clears events after clearEvents() is called', () => {
    const order = Order.create(/* ... */);
    order.clearEvents();
    expect(order.domainEvents).toHaveLength(0);
  });

  it('emits ordering.order.cancelled on cancel', () => {
    const order = Order.create(/* ... */);
    order.clearEvents(); // Clear creation event
    order.cancel('Customer changed mind');

    const events = order.domainEvents;
    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe('ordering.order.cancelled');
    expect(events[0].payload.reason).toBe('Customer changed mind');
  });
});
```

### Event Naming Convention

```
{module}.{entity}.{action}
```

Examples:
- `identity.user.registered`
- `ordering.order.created`
- `ordering.order.confirmed`
- `ordering.order.cancelled`
- `payment.payment.completed`

---

## 9. Test Priority Order

Do not test everything at once. Prioritize based on business risk.

### Phase 1 — Identity + Tenant (Week 1-2)

```
P1: Login, JWT validation, register
P1: Auth middleware (no token, valid token, expired token)
P1: Tenant creation, slug uniqueness
P1: Tenant context middleware
P1: Cross-tenant isolation (MUST — block data breach)
```

### Phase 2 — Ordering + Payment (Week 3-4)

```
P1: Order creation (state transitions, invariants)
P1: PaymentService.payCash (success + all error cases)
P1: Order.markPaid → Payment.complete flow
P1: Domain event publication
P2: Order listing, pagination
```

### Phase 3 — Catalog + Inventory (Week 5-6)

```
P1: Product CRUD (create, update, delete)
P1: Stock adjustment (in, out, insufficient)
P1: Low stock query
P2: Category CRUD
P2: Stock movement history
```

### Phase 4 — POS Shift + Integration (Week 7-8)

```
P1: Shift open/close lifecycle
P2: Full integration flow (create order → pay → verify stock)
P2: Full tenant isolation scan (every module)
P2: Regression test suite
```

---

## 10. Critical Business Flows

These flows must never break. A failure here means the system cannot process transactions — which means the business cannot operate.

### Flow 1 — Onboarding

```
User registers
  ↓
Tenant created
  ↓
User logs in
  ↓
User creates product
  ↓
User adds stock
```

**Test coverage required:** 100% of this flow. Each step must have a passing test before deployment.

**Regression checklist:**
```
□ User registration creates tenant
□ Login returns valid JWT
□ JWT contains tenantId
□ Product creation persists and returns ID
□ Stock adjustment reflects immediately
□ New user can access only their own data
```

### Flow 2 — POS Transaction (Money Flow)

```
Cashier opens shift
  ↓
Cashier adds items to cart
  ↓
Cart calculates correct total
  ↓
Customer pays cash
  ↓
Payment recorded
  ↓
Order status changes to "paid"
  ↓
Stock decremented
  ↓
Receipt data generated
```

**Test coverage required:** 100%. Every branch must be tested. This flow touches money.

**Regression checklist:**
```
□ Shift must be open before order can be created
□ Cart total = sum of (quantity × unitPrice) for all items
□ Cash payment validates amount ≥ total
□ Change amount = payment amount − total
□ Order.paymentStatus = completed after payment
□ Order.status = paid after payment
□ Stock decremented by exact quantity ordered
□ Payment record is immutable after creation
□ Payment has reference number
```

### Flow 3 — Tenant Isolation (Security Flow)

```
Tenant A creates product P1
  ↓
Tenant B queries all products
  ↓
Tenant B must NOT see P1
  ↓
Tenant B queries product by P1's ID
  ↓
Tenant B must get 404/403
```

**Test coverage required:** 100% of all repository and service methods.

**Regression checklist:**
```
□ Every repository query includes tenantId filter
□ Every service method validates tenant ownership before returning entity
□ Every create operation sets tenantId from JWT, not request body
□ Error message does not reveal existence of data in another tenant
□ API returns 404 (not 403) for cross-tenant access to prevent enumeration
```

---

## 11. Testing Debt (MVP Phase)

The following are intentionally not tested during MVP. This is a conscious decision to ship faster.

### Not Tested Now (MVP)

| Area | Reason | When to Add |
|------|--------|-------------|
| Frontend components | Business logic is on backend; UI changes frequently | After 10 paying customers |
| Frontend state management (Zustand) | Trivial store; changes often | When POS page has complex state |
| E2E (Playwright) | High maintenance cost; slow in CI | After 5 paying customers |
| Visual regression | No design system yet | Before public launch |
| Performance / load testing | 0 users; single-process server | After 20 concurrent users |
| Security scanning (OWASP) | Manual review is sufficient for MVP | Before first customer deployment |
| External provider integration (Midtrans) | Test manually via sandbox | Before Midtrans integration |
| Offline behavior | MVP is always online | When offline requirement emerges |
| Mobile responsiveness | MVP targets desktop browser | When mobile usage detected |
| Accessibility (a11y) | MVP targets cashier who can read | When accessibility requirement exists |

### Testing Debt Tracking

Each item of testing debt must be recorded in `docs/BACKLOG.md` with the label `[test-debt]`. Example:

```markdown
- [ ] [test-debt] Add E2E test for POS flow (Playwright) — target: after 5 customers
- [ ] [test-debt] Add Midtrans webhook signature verification test — target: before Midtrans integration
```

---

## 12. Test Failure Log

When a test fails, log it. Track patterns. If the same test fails repeatedly, the test or the code under it is fragile.

### Template

```markdown
## Test Failure Log

### TID-{YYYYMMDD}-{NNN}

- **Date:** 2026-07-01
- **Module:** core/payment
- **Failed Test:** PayCashService › returns error when order not found
- **Reason:** OrderRepository.findById returned null for valid ID because repository was using wrong collection name
- **Severity:** High (blocking payment flow)
- **Temporary Fix:** Verified collection name in connection setup
- **Permanent Fix:** Refactored MongoOrderRepository to accept model via DI; added integration test for repository
- **Status:** Resolved
```

### Log Rules

1. Every CI failure must be logged within 24 hours.
2. Every recurring failure triggers a refactoring of the test or the code.
3. "Flaky" tests are either fixed or deleted. Flaky tests are worse than no tests.

---

## 13. Weekly Testing Roadmap

Tests are written **as each module is implemented**, not as a separate phase. This roadmap tracks the order in which modules are tested relative to their implementation.

| Week | Module | Focus |
|------|--------|-------|
| 1 | Infrastructure | Install Vitest, configure test scripts, create fixtures, helpers, factories |
| 1-2 | Identity | Domain + Service + Repository + API tests for auth, users, roles |
| 2-3 | Tenant | Domain + Service + Repository tests; tenant isolation base tests |
| 3-4 | Catalog | Domain + Service + Repository tests for products and categories |
| 4-5 | Inventory | Domain + Service + Repository tests for stock, movements, warehouse |
| 5-6 | Ordering | Domain + Service + Repository + API tests for order lifecycle |
| 6-7 | Payment | Domain + Service + Repository + API tests for cash payment |
| 7-8 | Integration + Regression | Isolation scan, full POS flow, regression suite |

### Daily Practice

> **Write the test before or during implementation, not after.**
>
> - New domain entity → write entity test first
> - New service method → write service test alongside
> - New API endpoint → write route test before merging

---

## 14. Engineering Rules

### Rule 1 — Never merge untested code

Every module must have passing tests for:
- Domain layer (entities, aggregate roots, invariants)
- Service layer (use cases, workflows, error handling)
- Tenant isolation (cross-tenant access prevention)

Without these, the module is considered incomplete.

### Rule 2 — Never deploy without API tests

Before any deployment:
- All critical flow tests pass (Flow 1, 2, 3 from section 10)
- Auth middleware tests pass
- No cross-tenant access tests fail

If any of these fail, deployment is blocked.

### Rule 3 — Never add a new endpoint without tests

Every new route must include:
- One happy-path test (200 response)
- One auth-failure test (401 without token)
- One validation-failure test (400 with invalid body)
- One tenant-isolation test (cross-tenant access returns 404)

### Rule 4 — Always test tenant isolation

Tenant isolation is not optional. Every module must prove that:
- Tenant A cannot read Tenant B's data
- Tenant A cannot write to Tenant B's data
- Tenant A cannot delete Tenant B's data

### Rule 5 — Business logic testing is mandatory

Domain entities and services must be tested. Repository and API layers are important, but business logic is the foundation. If the domain is correct, the rest can be refactored safely.

### Rule 6 — Prevent regressions before adding features

A failing test suite is a blocker. Fix the regression first, then add the feature. The rule is:

```
1. Reproduce the regression with a test
2. Fix the code
3. Verify the test passes
4. Add the new feature with its own tests
5. Deploy
```

---

## Quick Reference

### Commands

```bash
# Run all tests
pnpm --filter backend test

# Run tests in watch mode
pnpm --filter backend test --watch

# Run tests with coverage
pnpm --filter backend test -- --coverage

# Run a single test file
pnpm --filter backend test -- src/core/ordering/domain/__tests__/Order.test.ts

# Run tests matching a pattern
pnpm --filter backend test -- -t "pay cash"
```

### Vitest Configuration

```typescript
// backend/vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    setupFiles: ['tests/helpers/setup.ts'],
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/core/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.routes.ts',
        'src/**/*.schema.ts',
        'src/bootstrap/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared/src'),
    },
  },
});
```
