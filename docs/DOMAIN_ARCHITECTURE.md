# Domain-Driven Design Architecture

> **Platform:** POSMono — Modular Business Operating System
> **Status:** Architecture Planning (Pre-Code)
> **Mindset:** Shopify / Square / Toast — enterprise-grade SaaS

---

## Table of Contents

1. [Domain Identification & Bounded Contexts](#1-domain-identification--bounded-contexts)
2. [Domain Relationships & Context Map](#2-domain-relationships--context-map)
3. [Event-Driven Communication & Event Catalog](#3-event-driven-communication--event-catalog)
4. [Multi-Tenant Strategy](#4-multi-tenant-strategy)
5. [High-Level Database Architecture](#5-high-level-database-architecture)
6. [Role & Permission Architecture](#6-role--permission-architecture)
7. [Extension / Plugin Architecture](#7-extension--plugin-architecture)
8. [Domain Map & Event Flow Diagrams](#8-domain-map--event-flow-diagrams)

---

## 1. Domain Identification & Bounded Contexts

### 1.1 Separation Principle

Every bounded context is a self-contained vertical slice with:
- Its own **ubiquitous language** (terms mean what they say inside the context)
- Its own **domain model** (entities, value objects, aggregates)
- Its own **data store** (collections are private to the context)
- Its own **business rules** (invariants enforced at the aggregate boundary)

```
┌────────────────────────────────────────────────────────┐
│                    PLATFORM LAYER                       │
│                                                        │
│   Identity Context         Tenant Context              │
│   (who you are)           (which tenant)               │
│                                                        │
│   Billing Context          Notification Context        │
│   (platform billing)      (cross-channel comms)        │
└────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────┐
│                    CORE DOMAIN LAYER                    │
│                                                        │
│   Catalog Context       Ordering Context               │
│   (products, prices)    (carts, orders, status)        │
│                                                        │
│   Inventory Context     POS Context                    │
│   (stock, warehouse)    (register, shift, session)     │
│                                                        │
│   Payment Context       Customer Context               │
│   (transactions, QRIS)  (profiles, loyalty)            │
│                                                        │
│   Reporting Context                                    │
│   (analytics, metrics)                                 │
└────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────┐
│                   EXTENSION LAYER                       │
│                                                        │
│   Restaurant Context     Hospitality Context           │
│   (tables, kitchen)     (booking, housekeeping)        │
│                                                        │
│   Retail Context                                        │
│   (suppliers, PO)                                      │
└────────────────────────────────────────────────────────┘
```

### 1.2 Bounded Context Catalog

#### PLATFORM DOMAINS (shared across all tenants)

| Context | Responsibility | Core Aggregate |
|---------|---------------|----------------|
| **Identity** | Authentication, authorization, user management, RBAC, session management | `User`, `Role`, `Permission` |
| **Tenant** | Tenant lifecycle, provisioning, configuration, feature flags, domain/subdomain routing | `Tenant`, `TenantConfig` |
| **Billing** | Subscription plans, metering, invoicing, payment collection for SaaS fees | `Subscription`, `Plan`, `Invoice` |
| **Notification** | Multi-channel message delivery (WhatsApp, email, push, in-app), template management | `Notification`, `Template` |
| **Audit** | Immutable audit log for all domain events, compliance tracing | `AuditEvent` |

#### CORE DOMAINS (business operations)

| Context | Responsibility | Core Aggregate |
|---------|---------------|----------------|
| **Catalog** | Product definitions, categories, variants, modifiers, pricing, barcodes | `Product`, `Category`, `Variant` |
| **Ordering** | Cart management, order lifecycle, order state machine, discounts, taxes | `Order`, `Cart`, `OrderItem` |
| **Inventory** | Stock levels, warehouse management, stock movements, low-stock alerts | `Stock`, `Warehouse`, `StockMovement` |
| **POS** | Cash register, shift management, tender sessions, receipt generation | `Register`, `Shift`, `PaymentSession` |
| **Payment** | Payment processing, Midtrans integration, QRIS, refunds, transaction log | `Payment`, `Transaction`, `Refund` |
| **Customer** | Customer profiles, loyalty points, purchase history, communication preferences | `Customer`, `LoyaltyAccount` |
| **Reporting** | Aggregated metrics, sales reports, inventory reports, dashboard data, export | `Report`, `Dashboard`, `Metric` |

#### EXTENSION DOMAINS (gated by tenant feature flags)

| Context | Responsibility | Core Aggregate | Parent Phase |
|---------|---------------|----------------|-------------|
| **Restaurant** | Table management, floor plan, kitchen display, waiter workflow, split bill, printer | `DiningTable`, `KitchenOrder`, `FloorPlan` | Phase 2 |
| **Hospitality** | Property/room management, booking engine, reservations, check-in/out, housekeeping, guest stays | `Booking`, `Stay`, `Room`, `Guest`, `HousekeepingTask` | Phase 3 |
| **Retail** | Supplier management, purchase orders, barcode generation, bulk pricing | `Supplier`, `PurchaseOrder` | Phase 1+ |

### 1.3 Bounded Context Canvas (per context)

Every context is documented with this template:

```
BOUNDED CONTEXT: [Name]
─────────────────────────────────────────────────
Ubiquitous Language: [terms glossary]
Domain Role:        [core | supporting | generic | extension]
Aggregates:         [list of aggregate roots]
Events Published:   [events this context emits]
Events Consumed:    [events this context handles]
External Systems:   [integrations via infrastructure]
Team Ownership:     [team/individual]
```

**Example — Ordering Context:**

```
BOUNDED CONTEXT: Ordering
─────────────────────────────────────────────────
Ubiquitous Language:
  Order      — A request to purchase goods, has a lifecycle (draft→confirmed→paid→cancelled)
  Cart       — Temporary collection of items before conversion to order
  OrderItem  — A single line on an order, references a product+quantity+price
  Discount   — Reduction applied at line or order level
  Tax        — Tax applied per line item based on product category

Domain Role:        Core
Aggregates:         Order, Cart
Events Published:   OrderCreated, OrderConfirmed, OrderCancelled, OrderRefunded
Events Consumed:    PaymentCompleted (mark order paid), StockAdjusted (verify availability)
External Systems:   — (no direct external I/O)
Team Ownership:     Ordering Team
```

---

## 2. Domain Relationships & Context Map

### 2.1 Strategic DDD — Context Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONTEXT MAP LEGEND                                   │
│                                                                             │
│   ═══>  upstream/downstream (conformist)                                    │
│   - - >  event-driven (published language)                                  │
│   <══>   shared kernel (partnership)                                        │
│   ───    open-host service (OHS)                                            │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌────────────┐
                    │  Identity  │───>───>───>───>───>───>───>────┐
                    └────────────┘                                 │
                         │                                         │
                         │ (authenticates)                         │
                         ▼                                         ▼
                    ┌────────────┐                          ┌──────────────┐
                    │   Tenant   │───>───>───>───>───>───>──│ Notification │
                    └────────────┘                          └──────────────┘
                         │                                       ▲
                         │ (configures)                           │ (sends receipts,
                         ▼                                       │  alerts, etc.)
                    ┌────────────┐                               │
              ┌────>│  Catalog   │────>────>────>────>────>──────┘
              │     └────────────┘
              │          │
              │          ▼
              │     ┌────────────┐     ┌────────────┐     ┌────────────┐
              │     │  Ordering  │────>│  Payment   │────>│ Inventory  │
              │     └────────────┘     └────────────┘     └────────────┘
              │          │                  │                  │
              │          │                  │                  │
              │          ▼                  ▼                  ▼
              │     ┌────────────┐     ┌────────────┐     ┌────────────┐
              │     │  Customer  │     │  Reporting │     │   Audit    │
              │     └────────────┘     └────────────┘     └────────────┘
              │
              │     ┌───────────────── EXTENSION DOMAINS ─────────────────┐
              │     │                                                     │
              │     │   ┌────────────┐   ┌────────────┐   ┌────────────┐  │
              └────>│ Restaurant  │   │Hospitality │   │   Retail   │  │
                    └────────────┘   └────────────┘   └────────────┘  │
                         │                 │                 │         │
                         ▼                 ▼                 ▼         │
                    ┌────────────┐   ┌────────────┐   ┌────────────┐  │
                    │   POS      │   │   POS      │   │ Inventory  │  │
                    └────────────┘   └────────────┘   └────────────┘  │
                    (via events)    (via events)      (via events)    │
                    └─────────────────────────────────────────────────┘
```

### 2.2 Domain Interaction Rules

| Source Domain | Target Domain | How | What |
|--------------|--------------|-----|------|
| **Ordering** | Payment | Event | `OrderConfirmed` → triggers payment request |
| **Payment** | Ordering | Event | `PaymentCompleted` → marks order paid |
| **Payment** | Inventory | Event | `PaymentCompleted` → reserves/reduces stock |
| **Payment** | Reporting | Event | `PaymentCompleted` → updates sales metrics |
| **Payment** | Notification | Event | `PaymentCompleted` → sends receipt to customer |
| **Ordering** | Customer | Event | `OrderCreated` → updates customer purchase history |
| **Ordering** | Notification | Event | `OrderConfirmed` → sends order confirmation |
| **Ordering** | Restaurant | Event | `OrderCreated` → creates kitchen ticket |
| **Ordering** | POS | Event | `OrderCreated` → opens register session |
| **Catalog** | Ordering | Query | `getProductById` → validates product exists |
| **Inventory** | Catalog | Event | `StockAdjusted` → updates product availability |
| **Identity** | All | Middleware | Validates JWT, resolves user identity |
| **Tenant** | All | Middleware | Resolves tenant context for data isolation |
| **All** | Audit | Event | Each context publishes events to audit log |
| **Tenant** | Billing | Event | `TenantCreated` → creates subscription |
| **Billing** | Tenant | Command | `SuspendTenant` → disables access if unpaid |
| **Restaurant** | POS | Extension | Adds table-based ordering to POS workflow |
| **Hospitality** | Booking | Extension | Adds room charges to POS workflow |

### 2.3 Communication Types

```
Context-to-Context communication follows strict rules:

1. EVENT: async, fire-and-forget, eventual consistency
   Used when: downstream does NOT need immediate response
   Example: OrderCreated → Inventory (reduce stock eventually)

2. COMMAND: sync, request-response within same transaction boundary
   Used when: strong consistency required
   Example: Catalog → Ordering (validate product exists)

3. QUERY: sync, read-only
   Used when: one context needs data from another
   Example: Ordering → Catalog (get product details for display)

4. SAGA: long-running, compensating actions
   Used when: distributed transaction across contexts
   Example: Order fullfillment saga — reserve stock, process payment,
            confirm order, or rollback
```

### 2.4 Dependency Direction

```
                   PLATFORM
              ┌────────────────┐
              │  No dependency  │  ← Identity, Tenant, Audit
              │  on core/ext    │
              └────────────────┘
                      ▲
                      │ depends on platform
                      │
              ┌────────────────┐
              │    CORE        │
              │  Dependencies: │  ← Catalog, Ordering, Inventory,
              │  Identity,     │     Payment, Customer, POS, Reporting
              │  Tenant        │
              └────────────────┘
                      ▲
                      │ depends on core + platform
                      │
              ┌────────────────┐
              │   EXTENSION    │
              │  Dependencies: │  ← Restaurant, Hospitality, Retail
              │  Core Domains  │
              └────────────────┘
```

**CRITICAL RULE:** Extensions NEVER depend on other extensions. Restaurant never imports Hospitality.

---

## 3. Event-Driven Communication & Event Catalog

### 3.1 Event Bus Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     INTERNAL EVENT BUS                       │
│                                                             │
│                    ┌──────────────────┐                     │
│                    │   EventBus       │                     │
│                    │  (EventEmitter)  │                     │
│                    └────────┬─────────┘                     │
│                             │                               │
│         ┌───────────────────┼───────────────────┐           │
│         ▼                   ▼                   ▼           │
│  ┌────────────┐     ┌────────────┐     ┌────────────┐      │
│  │  Context A  │     │  Context B  │     │  Context C  │     │
│  │  Publisher  │     │ Subscriber  │     │ Subscriber  │     │
│  └────────────┘     └────────────┘     └────────────┘      │
│                                                             │
│  Correlation ID propagated across ALL handlers              │
│  Tenant ID attached to every event                          │
│  Failed handlers → Dead Letter Queue (BullMQ)               │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Complete Domain Event Catalog

Every event follows this envelope:

```typescript
{
  eventId: string,          // UUID v4
  eventName: string,        // "{context}.{aggregate}.{action}"
  aggregateId: string,      // ID of the aggregate that raised it
  aggregateType: string,    // e.g., "Order", "Payment"
  tenantId: string,         // Tenant context
  correlationId: string,    // Trace across the entire flow
  causationId: string,      // Parent event ID
  occurredAt: Date,         // ISO 8601
  payload: object,          // Type-specific data
  metadata: {
    userId: string,         // Who triggered it
    sourceIp: string,
    userAgent: string
  }
}
```

#### PLATFORM EVENTS

```
Event Name                          Publisher       Subscribers                Payload
─────────────────────────────────────────────────────────────────────────────────────────
platform.tenant.created             Tenant          Billing, Notification       { tenantId, ownerId, plan }
platform.tenant.suspended           Tenant          Identity, All               { tenantId, reason }
platform.tenant.activated           Tenant          Billing, Notification       { tenantId }
platform.tenant.config.updated      Tenant          All middleware              { tenantId, config }

platform.user.registered            Identity        Notification                { userId, tenantId, email }
platform.user.logged_in             Identity        Audit                       { userId, tenantId, ip }
platform.user.role.assigned         Identity        Audit                       { userId, roleId }
platform.user.role.revoked          Identity        Audit                       { userId, roleId }

platform.subscription.created       Billing         Tenant                      { subscriptionId, plan, tenantId }
platform.subscription.renewed       Billing         Notification                { subscriptionId, expiry }
platform.invoice.paid               Billing         Notification                { invoiceId, amount }
platform.invoice.overdue            Billing         Tenant, Notification        { invoiceId, daysOverdue }
```

#### CORE EVENTS

```
Event Name                          Publisher       Subscribers                Payload
─────────────────────────────────────────────────────────────────────────────────────────
catalog.product.created             Catalog         Inventory, Reporting        { productId, sku, name }
catalog.product.updated             Catalog         Inventory                   { productId, changes }
catalog.product.deleted             Catalog         Inventory, Ordering         { productId }
catalog.product.price.changed       Catalog         Ordering, Reporting         { productId, oldPrice, newPrice }
catalog.category.created            Catalog         Reporting                   { categoryId, name }

ordering.cart.created               Ordering        Customer                    { cartId, customerId }
ordering.cart.converted             Ordering        Customer                    { cartId, orderId }
ordering.order.created              Ordering        Payment, Inventory,         { orderId, items,
                                                    POS, Customer,                   total, tenantId }
                                                    Notification, Restaurant
ordering.order.confirmed            Ordering        Payment, Notification       { orderId, confirmedAt }
ordering.order.cancelled            Ordering        Inventory, Payment          { orderId, reason }
ordering.order.refunded             Ordering        Payment, Reporting          { orderId, refundAmount }

inventory.stock.reserved            Inventory       Ordering                    { orderId, reservationId }
inventory.stock.adjusted            Inventory       Catalog, Reporting          { productId, delta, reason }
inventory.stock.released            Inventory       Ordering                    { orderId, items }
inventory.stock.low_alert           Inventory       Notification                { productId, currentStock, minLevel }
inventory.stock.out_of_stock        Inventory       Notification, Catalog       { productId }

pos.shift.opened                    POS             Reporting                   { shiftId, registerId, cashierId }
pos.shift.closed                    POS             Reporting                   { shiftId, expectedTotal, actualTotal }
pos.sale.completed                  POS             Reporting, Payment          { saleId, amount, items }
pos.receipt.generated               POS             Notification                { receiptUrl, orderId }

payment.transaction.created         Payment         Ordering                    { transactionId, orderId, amount }
payment.transaction.pending         Payment         Ordering                    { transactionId, paymentMethod }
payment.transaction.completed       Payment         Ordering, Inventory,        { transactionId, orderId,
                                                    Notification, Reporting,        amount, method,
                                                    Customer                        paidAt }
payment.transaction.failed          Payment         Ordering, Notification      { transactionId, reason }
payment.transaction.refunded        Payment         Ordering, Reporting         { transactionId, refundAmount }
payment.qris.qrcode.generated       Payment         POS                         { qrCodeUrl, amount, expiry }

customer.profile.created            Customer        Reporting                   { customerId, name }
customer.loyalty.points_earned      Customer        Notification                { customerId, points, total }
customer.loyalty.points_redeemed    Customer        Notification                { customerId, points, orderId }

reporting.dashboard.snapshot        Reporting       Notification                { dashboardId, period, metrics }
```

#### EXTENSION EVENTS

```
Event Name                          Publisher       Subscribers                Payload
─────────────────────────────────────────────────────────────────────────────────────────
restaurant.table.occupied           Restaurant      POS, Ordering               { tableId, orderId, guests }
restaurant.table.freed              Restaurant      POS                         { tableId }
restaurant.order.sent_to_kitchen    Restaurant      POS, Notification           { kitchenOrderId, items, tableId }
restaurant.order.ready              Restaurant      POS, Notification           { kitchenOrderId, tableId }
restaurant.order.served             Restaurant      POS                         { kitchenOrderId, tableId }
restaurant.split_bill.created       Restaurant      Payment                     { splitId, parentOrderId, portions }
restaurant.printer.job.sent         Restaurant      Audit                       { printerId, jobType, success }

hospitality.booking.created         Hospitality     Payment                     { bookingId, propertyId, dates, total }
hospitality.booking.confirmed       Hospitality     Payment, Notification       { bookingId, depositAmount }
hospitality.booking.cancelled       Hospitality     Payment                     { bookingId, penalty }
hospitality.booking.checked_in      Hospitality     POS, Housekeeping           { bookingId, roomId, guestId }
hospitality.booking.checked_out     Hospitality     POS, Billing                { bookingId, roomId, finalBill }
hospitality.booking.no_show         Hospitality     Payment                     { bookingId, policy }
hospitality.housekeeping.task_created   Hospitality    Notification             { taskId, roomId, type }
hospitality.housekeeping.task_completed  Hospitality    POS                     { taskId, completedBy }
hospitality.guest.arrived           Hospitality     Notification                { guestId, bookingId }

retail.supplier.created             Retail          Catalog                     { supplierId, name }
retail.purchase_order.created       Retail          Inventory                   { poId, items, expectedDate }
retail.purchase_order.received      Retail          Inventory, Payment          { poId, receivedItems }
```

### 3.3 Event Flow — Complete Order Lifecycle

```
TIME    PUBLISHER          EVENT                    SUBSCRIBERS
───┼─────────────────────────────────────────────────────────
   │
   │  POS/Customer     OrderCreated                Inventory (reserve stock)
   │                                               Customer (add to history)
   │                                               Notification (send confirmation)
   │                                               Restaurant (create kitchen ticket if restaurant module active)
   │
   │  Ordering          OrderConfirmed              Payment (initiate payment)
   │
   │  Payment           TransactionPending          Ordering (mark as pending payment)
   │
   │  Midtrans          TransactionCompleted        Ordering (mark as paid)
   │                                               Inventory (commit stock reduction)
   │                                               Customer (update loyalty points)
   │                                               Notification (send receipt)
   │                                               Reporting (record sale)
   │
   │  Payment           TransactionFailed           Ordering (mark payment failed)
   │                                               Inventory (release stock reservation)
   │                                               Notification (alert user)
   │
   │  Ordering          OrderCancelled              Inventory (release stock if reserved)
   │                                               Payment (void if already processing)
   │
   │  POS               ReceiptGenerated            Notification (send to customer)
   │
   │  Ordering          OrderRefunded               Inventory (add stock back if items returned)
   │                                               Payment (process refund)
   │                                               Reporting (adjust metrics)
```

---

## 4. Multi-Tenant Strategy

### 4.1 Three Options Analysis

#### Option A: Shared Database with `tenantId` Discriminator

```
┌────────────────────────────────┐
│       posmono (database)        │
│                                 │
│  users:                         │
│  ┌───┬──────────┬──────────┐   │
│  │id │ tenantId │ name     │   │
│  ├───┼──────────┼──────────┤   │
│  │ 1 │ abc123   │ Warung A │   │
│  │ 2 │ xyz789   │ Cafe B   │   │
│  └───┴──────────┴──────────┘   │
│                                 │
│  orders:                        │
│  ┌───┬──────────┬──────┐       │
│  │id │ tenantId │total │       │
│  ├───┼──────────┼──────┤       │
│  │ 1 │ abc123   │ 50000│       │
│  │ 2 │ xyz789   │ 75000│       │
│  └───┴──────────┴──────┘       │
└────────────────────────────────┘
```

| Criteria | Rating |
|----------|--------|
| Operational complexity | 🟢 Low — single DB to manage |
| Data isolation | 🔴 Weak — every query must filter by tenantId |
| Backup/restore | 🔴 Complex — extracting single tenant data is hard |
| Tenant deletion | 🟡 Medium — soft delete + cleanup |
| Schema changes | 🟢 Easy — one schema to migrate |
| Cross-tenant queries | 🟢 Easy (for platform analytics) |
| Scalability | 🔴 Limited — single DB becomes bottleneck |
| Compliance | 🔴 Cannot guarantee physical data separation |

#### Option B: Database per Tenant

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  posmono_abc  │   │  posmono_xyz │   │ posmono_sys  │
│  (Warung A)   │   │  (Cafe B)    │   │ (platform)   │
│               │   │              │   │              │
│  users        │   │  users       │   │  tenants     │
│  orders       │   │  orders      │   │  plans       │
│  products     │   │  products    │   │  templates   │
│  inventory    │   │  inventory   │   │  global_roles│
│  payments     │   │  payments    │   │              │
└──────────────┘   └──────────────┘   └──────────────┘
```

| Criteria | Rating |
|----------|--------|
| Operational complexity | 🟡 Medium — many DBs to manage |
| Data isolation | 🟢 Strong — complete physical separation |
| Backup/restore | 🟢 Easy — per-tenant backup, simple restore |
| Tenant deletion | 🟢 Easy — drop entire database |
| Schema changes | 🟡 Medium — need migration per DB (migration script) |
| Cross-tenant queries | 🔴 Hard — query across all databases manually |
| Scalability | 🟢 Excellent — can shard tenants across clusters |
| Compliance | 🟢 Full compliance — data physically separated |
| Connection overhead | 🟡 Medium — connection pooling per tenant |
| Cost | 🟡 More connections, more storage (less shared indexes) |

#### Option C: Hybrid Approach

```
┌──────────────────────────────────────────────────┐
│                   Cluster                         │
│                                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │   Shard 1   │  │   Shard 2   │  │ Platform  │ │
│  │             │  │             │  │           │ │
│  │ posmono_abc │  │ posmono_xyz │  │ tenants   │ │
│  │ posmono_123 │  │ posmono_456 │  │ plans     │ │
│  │             │  │             │  │ templates │ │
│  └─────────────┘  └─────────────┘  └───────────┘ │
│                                                    │
│  Routing layer: tenantId → { shard, database }     │
│  Stored in Redis for fast lookup                   │
└──────────────────────────────────────────────────────┘
```

| Criteria | Rating |
|----------|--------|
| Operational complexity | 🔴 High — shard management + routing |
| Data isolation | 🟢 Strong |
| Backup/restore | 🟢 Easy per-tenant |
| Scalability | 🟢 Excellent — add shards horizontally |
| Cross-tenant queries | 🟡 Medium — scatter-gather across shards |
| Cost efficiency | 🟢 Better — distribute load across shards |

### 4.2 Recommendation: Option B (Database per Tenant) with Option C readiness

**For Phase 1 (modular monolith, small tenants):**

Start with **Database per Tenant** directly. MongoDB makes this operationally simple with `mongoose.createConnection()` per tenant.

```
┌─────────────────────────────────────────────┐
│           ConnectionManager                  │
│                                              │
│  Map<tenantId, Connection>                   │
│  TTL: 30 minutes idle → close connection    │
│                                              │
│  On request:                                  │
│  1. Resolve tenantId from subdomain/JWT      │
│  2. Look up mapping: tenantId → databaseName │
│  3. Get/create cached connection             │
│  4. Set tenant context on req                │
└─────────────────────────────────────────────┘
```

**Redis stores the routing table:**

```
tenant:abc123 → { database: "posmono_abc123", shard: "primary", plan: "premium" }
tenant:xyz789 → { database: "posmono_xyz789", shard: "primary", plan: "starter" }
```

**Platform database (`posmono_system`) stores:**

```javascript
// Global — NOT per tenant
tenants: {
  _id: "abc123",
  name: "Warung A",
  status: "active",
  plan: "premium",
  businessType: "retail",
  modules: ["retail"],
  databaseName: "posmono_abc123",
  createdAt: ISODate,
  config: { timezone: "Asia/Jakarta", currency: "IDR", locale: "id" }
}

plans: {
  _id: "starter",
  name: "Starter",
  features: { maxUsers: 3, maxProducts: 100, modules: ["retail"] },
  price: 150000
}

global_templates: {
  _id: "receipt_default",
  type: "receipt",
  content: "...mustache template..."
}
```

**Each tenant database contains:**

```javascript
// Per-tenant — FULLY ISOLATED
users, roles, permissions,
products, categories, variants,
orders, order_items,
inventory, stock_movements,
payments, transactions, refunds,
customers, loyalty_points,
shifts, registers,
reports_cache, audit_log
```

**Why NOT shared DB (Option A):**
- `tenantId` on every query is one bug away from a data leak
- Cannot safely do `db.dropDatabase()` to delete a tenant
- Indexes grow linearly across tenants
- One tenant's bad query slows everyone down

**Why database-per-tenant is right for this product:**
- UMKM tenants have small data — one database handles thousands easily
- Regulatory compliance (BPOM, Kemenkeu may require data residency)
- Customers feel safer knowing their data is a separate database
- DDD naturally aligns — each context owns its collections

### 4.3 Tenant Resolution Strategies

```
Strategy 1: SUBDOMAIN (recommended for production)
  Request: https://warung-a.posmono.app/api/orders
  Resolve: warung-a → Tenant.findOne({ slug: "warung-a" }) → tenantId

Strategy 2: CUSTOM DOMAIN (premium tier)
  Request: https://pos.warung-a.com/api/orders
  Resolve: warung-a.com → Tenant.findOne({ domain: "warung-a.com" }) → tenantId

Strategy 3: HEADER (for API clients / mobile)
  Request: POST /api/orders
  Header: X-Tenant-Id: abc123
  Resolve: abc123 → lookup in Redis cache → tenantId

Strategy 4: JWT CLAIM (for authenticated requests)
  JWT payload: { sub: "user_1", tenant: "abc123", role: "cashier" }
  Resolve: Extract from token → validate tenant is active
```

---

## 5. High-Level Database Architecture

### 5.1 Collection Design per Tenant Database

```
TENANT DATABASE: posmono_{tenantId}
═══════════════════════════════════════════

── IDENTITY ──────────────────────────────
users
  _id, tenantId, email, passwordHash, displayName, roleId,
  isActive, lastLoginAt, preferences, createdAt, updatedAt

roles
  _id, tenantId, name, description, permissions[], isSystem,
  createdAt

── CATALOG ───────────────────────────────
categories
  _id, tenantId, name, parentId, sortOrder, isActive,
  createdAt, updatedAt

products
  _id, tenantId, sku, name, description, categoryId,
  basePrice, imageUrls[], tags[], isActive,
  metadata: { isFood: bool, isDrink: bool, taxCategory: string },
  createdAt, updatedAt

product_variants
  _id, productId, name, price, sku, stock, isActive

product_modifiers
  _id, productId, name, type: (select|multi), options[],
  min, max, isRequired

── ORDERING ──────────────────────────────
carts
  _id, tenantId, customerId, items[], status, expiresAt,
  createdAt, updatedAt

orders
  _id, tenantId, orderNumber, status: (draft|confirmed|paid|
    preparing|cancelled|refunded), items[], subtotal, discount,
  tax, total, paymentStatus, customerId, cashierId, notes,
  source: (pos|waiter|online), metadata: { tableId?, roomId? },
  createdAt, paidAt, updatedAt

order_items
  _id, orderId, productId, variantId, productName, quantity,
  unitPrice, totalPrice, modifiers[], tax: { rate, amount }

── INVENTORY ─────────────────────────────
warehouses
  _id, tenantId, name, address, isActive, createdAt

stock
  _id, tenantId, productId, variantId, warehouseId,
  quantity, reservedQuantity, minLevel, maxLevel,
  updatedAt

stock_movements
  _id, tenantId, productId, variantId, warehouseId,
  type: (in|out|adjustment|reserve|release), quantity,
  referenceType, referenceId, notes, userId, createdAt

── POS ───────────────────────────────────
registers
  _id, tenantId, name, location, isActive, createdAt

shifts
  _id, tenantId, registerId, cashierId, status: (open|closed),
  openingBalance, closingBalance, expectedTotal, actualTotal,
  openedAt, closedAt

── CUSTOMER ──────────────────────────────
customers
  _id, tenantId, name, phone, email, address, isMember,
  totalVisits, totalSpent, lastVisitAt, tags[], preferences,
  createdAt, updatedAt

loyalty_accounts
  _id, tenantId, customerId, points, tier, pointsExpireAt,
  createdAt, updatedAt

loyalty_transactions
  _id, tenantId, accountId, type: (earn|redeem|expire),
  points, referenceType, referenceId, createdAt

── PAYMENT ───────────────────────────────
payments
  _id, tenantId, orderId, amount, status: (pending|completed|
    failed|refunded), method: (cash|qris|transfer|card),
  referenceNumber, metadata: { midtransTransactionId, qrCodeUrl },
  paidAt, createdAt

transactions
  _id, tenantId, paymentId, type: (sale|refund|fee),
  amount, provider: (midtrans|cash), providerTransactionId,
  status, rawResponse, createdAt

refunds
  _id, tenantId, orderId, paymentId, amount, reason,
  status: (pending|processed|failed), processedAt, createdAt

── NOTIFICATION ──────────────────────────
notifications
  _id, tenantId, type: (order_confirmation|receipt|promo|alert),
  channel: (whatsapp|email|push), recipient, subject, body,
  status: (pending|sent|failed|read), referenceType, referenceId,
  sentAt, readAt, createdAt

notification_templates
  _id, tenantId, type, channel, subject, body_template,
  variables[], isActive

── AUDIT ─────────────────────────────────
audit_log
  _id, tenantId, eventName, aggregateType, aggregateId,
  userId, correlationId, causationId, payload, ipAddress,
  userAgent, createdAt

── METRICS ───────────────────────────────
daily_metrics
  _id, tenantId, date, metrics: {
    totalOrders, totalRevenue, totalCustomers, avgOrderValue,
    topProducts[], paymentMethodBreakdown
  }, createdAt, updatedAt
```

### 5.2 Extension Module Collections

#### Restaurant Module (tenant has `modules: ["restaurant"]`)

```
restaurant_tables
  _id, tenantId, tableNumber, capacity, status: (available|
    occupied|reserved|cleaning), qrCodeUrl, position: {x, y},
  section, createdAt, updatedAt

restaurant_floor_plans
  _id, tenantId, name, sections[], width, height,
  isActive, createdAt

restaurant_reservations
  _id, tenantId, tableId, customerName, customerPhone,
  guestCount, timeFrom, timeTo, status: (pending|confirmed|seated|cancelled),
  notes, createdAt, updatedAt

restaurant_kitchen_orders
  _id, tenantId, orderId, tableId, status: (pending|preparing|
    ready|served|cancelled), items[], priority,
  preparedBy[], startedAt, readyAt, servedAt, createdAt

restaurant_split_bills
  _id, tenantId, orderId, portions[], status: (active|
    completed), totalAmount, createdAt

restaurant_printer_jobs
  _id, tenantId, printerId, jobType: (order|receipt),
  content, status: (pending|sent|failed), sentAt, createdAt
```

#### Hospitality Module (tenant has `modules: ["hospitality"]`)

```
hospitality_properties
  _id, tenantId, name, type: (villa|hotel), address,
  amenities[], policies: { checkIn, checkOut, cancellation },
  images[], isActive, createdAt

hospitality_rooms
  _id, tenantId, propertyId, roomNumber, roomTypeId,
  floor, status: (available|occupied|maintenance|cleaning),
  maxGuests, basePrice, amenities[], isActive, createdAt

hospitality_room_types
  _id, tenantId, name, description, basePrice,
  maxGuests, amenities[], images[], isActive

hospitality_bookings
  _id, tenantId, propertyId, roomId, guestId,
  checkIn, checkOut, status: (pending|confirmed|cancelled|
    checked_in|checked_out|no_show), totalAmount, depositPaid,
  source: (direct|ota|agent), otaReference, source: (direct|ota|agent),
  specialRequests, createdAt, updatedAt

hospitality_stays
  _id, tenantId, bookingId, roomId, guestId,
  checkInAt, checkOutAt, status: (active|completed),
  charges[], totalCharges, createdAt

hospitality_guests
  _id, tenantId, name, phone, email, idType, idNumber,
  address, preferences, isBlacklisted, totalStays, createdAt

hospitality_housekeeping_tasks
  _id, tenantId, roomId, type: (clean|tidy|turn_down|deep_clean|
    maintenance), priority, status: (pending|assigned|in_progress|
    completed), assignedTo, notes, scheduledAt, completedAt, createdAt
```

### 5.3 System Database Collections

```
PLATFORM DATABASE: posmono_system
══════════════════════════════════════

tenants
  _id, name, slug, domain, ownerId, plan,
  status: (active|suspended|trial|cancelled),
  businessType: (retail|restaurant|hospitality|mixed),
  modules: ["retail", "restaurant"],
  databaseName, config: { timezone, currency, locale },
  billingEmail, createdAt, updatedAt

plans
  _id, name, price, billingCycle: (monthly|annual),
  features: { maxUsers, maxProducts, maxTransactions,
    modules, storage }, isActive

global_users (platform admins only)
  _id, email, passwordHash, name, role: (superadmin|support),
  isActive, createdAt

global_roles
  _id, name: (superadmin|support|analyst),
  permissions[], isSystem

audit_log (platform-level events only)
  _id, eventName, aggregateType, aggregateId,
  payload, userId, ipAddress, createdAt

migrations
  _id, name, appliedAt, batch

jobs (BullMQ — stored in Redis, but mirrored for durability)
  _id, type, data, status, attempts, maxAttempts,
  scheduledAt, completedAt, error
```

### 5.4 Indexing Strategy

```javascript
// Every tenant collection includes:
{ tenantId: 1, ... }  // All queries filtered by tenant

// Critical indexes per collection:

users:       { tenantId: 1, email: 1 }  // unique compound
             { tenantId: 1, roleId: 1 }

products:    { tenantId: 1, sku: 1 }  // unique compound
             { tenantId: 1, categoryId: 1 }
             { tenantId: 1, name: "text" }  // search

orders:      { tenantId: 1, orderNumber: 1 }  // unique compound
             { tenantId: 1, status: 1, createdAt: -1 }
             { tenantId: 1, customerId: 1, createdAt: -1 }
             { tenantId: 1, createdAt: -1 }  // date range queries
             { tenantId: 1, "items.productId": 1 }  // product sales lookup

stock:       { tenantId: 1, productId: 1, warehouseId: 1 }  // unique compound
             { tenantId: 1, quantity: 1 }  // low stock queries

payments:    { tenantId: 1, orderId: 1 }  // unique
             { tenantId: 1, status: 1, createdAt: -1 }
             { "metadata.midtransTransactionId": 1 }  // webhook lookup

audit_log:   { tenantId: 1, createdAt: -1 }
             { tenantId: 1, correlationId: 1 }  // trace debugging
             { tenantId: 1, eventName: 1, createdAt: -1 }

daily_metrics: { tenantId: 1, date: -1 }  // unique compound

// Hospitality
hospitality_bookings: { tenantId: 1, roomId: 1, checkIn: 1, checkOut: 1 }  // availability
                    { tenantId: 1, status: 1, checkIn: 1 }

// Restaurant
restaurant_tables:  { tenantId: 1, status: 1 }
restaurant_kitchen_orders: { tenantId: 1, status: 1, createdAt: 1 }
```

---

## 6. Role & Permission Architecture

### 6.1 Two-Level Hierarchy

```
PLATFORM LEVEL ──────────────────────────────────
  Super Admin     — Full platform access, manage all tenants
  Support         — View tenant data for troubleshooting
  Analyst         — Cross-tenant analytics (read-only aggregates)

TENANT LEVEL ────────────────────────────────────
  Owner           — Full tenant access, billing, user management
  Manager         — All operational access, no billing/settings
  Supervisor      — Shift management, override prices, void orders
  Cashier         — POS operations, create orders, process payments
  Waiter          — Table management, order taking (restaurant)
  Kitchen Staff   — View kitchen orders, update status (restaurant)
  Housekeeping    — View tasks, update room status (hospitality)
  Staff           — Basic read-only access
```

### 6.2 Permission Model

```typescript
// Permissions are strings in the format:
// "{context}:{action}" or "{context}:{entity}:{action}"

// Actions: create | read | update | delete | manage | approve | void | override

PLATFORM PERMISSIONS
────────────────────
platform.tenants.read
platform.tenants.manage
platform.plans.read
platform.plans.manage
platform.reports.read
platform.support.access

TENANT PERMISSIONS
──────────────────
── Identity ──
tenant.users.read
tenant.users.create
tenant.users.update
tenant.users.delete
tenant.users.manage_roles

── Catalog ──
catalog.products.read
catalog.products.create
catalog.products.update
catalog.products.delete
catalog.categories.read
catalog.categories.manage

── Orders ──
orders.read
orders.create
orders.update
orders.cancel
orders.refund
orders.void
orders.override_price

── Inventory ──
inventory.read
inventory.adjust
inventory.transfer
inventory.count

── POS ──
pos.register.open
pos.register.close
pos.shift.open
pos.shift.close
pos.sale.process
pos.receipt.print
pos.discount.apply
pos.discount.override_max

── Payments ──
payments.read
payments.process
payments.refund
payments.void

── Customers ──
customers.read
customers.create
customers.update
customers.delete

── Reporting ──
reports.read
reports.export
reports.dashboard.customize

── Settings ──
settings.general.read
settings.general.update
settings.payment.read
settings.payment.update
settings.billing.read
settings.billing.update

── EXTENSION PERMISSIONS ──

── Restaurant ──
restaurant.tables.read
restaurant.tables.manage
restaurant.floor_plan.manage
restaurant.kitchen.view
restaurant.kitchen.update_status
restaurant.reservations.read
restaurant.reservations.create
restaurant.reservations.manage
restaurant.split_bill.process
restaurant.printer.manage

── Hospitality ──
hospitality.properties.read
hospitality.properties.manage
hospitality.rooms.read
hospitality.rooms.manage
hospitality.bookings.read
hospitality.bookings.create
hospitality.bookings.manage
hospitality.checkin.process
hospitality.checkout.process
hospitality.guests.read
hospitality.guests.manage
hospitality.housekeeping.view
hospitality.housekeeping.manage
```

### 6.3 Role-to-Permission Mapping (Default Seed)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ROLE          │ PERMISSIONS                                             │
├─────────────────────────────────────────────────────────────────────────┤
│ Super Admin   │ platform:*                                              │
│ Support       │ platform:tenants:read, platform:support:access          │
│               │ tenant:* (read-only visibility)                         │
│ Analyst       │ platform:reports:read, tenant:reports:* (anonymized)    │
│               │                                                         │
│ Owner         │ tenant:*                                                │
│ Manager       │ tenant:* except settings:billing:*, settings:payment:*  │
│               │                                                         │
│ Supervisor    │ catalog:*, orders:*, customers:*,                        │
│               │ inventory:read, inventory:adjust,                       │
│               │ pos:*, payments:read, payments:refund,                  │
│               │ reports:*,                                              │
│               │ restaurant:* (if enabled)                               │
│               │ hospitality:* (if enabled)                              │
│               │                                                         │
│ Cashier       │ catalog:products:read, catalog:categories:read,         │
│               │ orders:create, orders:read, orders:update,              │
│               │ inventory:read,                                        │
│               │ pos:shift:open, pos:shift:close, pos:sale:process,      │
│               │ pos:receipt:print, pos:discount:apply,                 │
│               │ payments:process, payments:read,                       │
│               │ customers:read, customers:create                       │
│               │                                                         │
│ Waiter        │ catalog:products:read,                                  │
│               │ orders:create, orders:read, orders:update,              │
│               │ restaurant:tables:read, restaurant:tables:manage,       │
│               │ restaurant:kitchen:view,                                │
│               │ restaurant:split_bill:process,                          │
│               │ customers:read, customers:create                        │
│               │                                                         │
│ Kitchen       │ restaurant:kitchen:view,                                │
│               │ restaurant:kitchen:update_status                        │
│               │                                                         │
│ Housekeeping  │ hospitality:rooms:read,                                 │
│               │ hospitality:housekeeping:view,                          │
│               │ hospitality:housekeeping:manage                         │
│               │                                                         │
│ Staff         │ catalog:products:read,                                  │
│               │ inventory:read,                                        │
│               │ reports:read                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Permission Enforcement Points

```
┌─────────────────────────────────────────────────────────────┐
│                    PERMISSION ENFORCEMENT                    │
│                                                             │
│  LAYER 1 — API Gateway / Middleware                         │
│  ─────────────────────────────────────                      │
│  Request comes in → JWT decoded → tenant resolved           │
│  → Role loaded → permission checked BEFORE controller       │
│                                                             │
│  LAYER 2 — Application Service                              │
│  ─────────────────────────────────────                      │
│  Use case checks: Can THIS user perform THIS action         │
│  on THIS resource? (e.g., only owner can delete users)      │
│                                                             │
│  LAYER 3 — Domain Layer                                     │
│  ─────────────────────────────────────                      │
│  Aggregate enforces business invariants:                    │
│  "A shift can only be closed by the cashier who opened it"  │
│  "An order can only be voided by a supervisor or above"     │
│                                                             │
│  LAYER 4 — Data Layer                                       │
│  ─────────────────────────────────────                      │
│  Every query filtered by tenantId                           │
│  Repository base class adds tenantId filter automatically   │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Extension / Plugin Architecture

### 7.1 Module Manifest Contract

Every extension module MUST provide a manifest describing its integration points.

```typescript
interface ModuleManifest {
  // Identity
  name: string;                      // "restaurant"
  version: string;                   // "1.0.0"
  displayName: string;               // "Restaurant Module"
  description: string;               // "Table management, kitchen display, waiter ordering"
  businessTypes: string[];           // ["restaurant", "mixed"]

  // Dependencies
  dependencies: string[];            // ["ordering", "inventory", "pos"]
  optionalDependencies?: string[];   // ["payment"]

  // Extension Points
  extends: {
    aggregates?: string[];            // Which core aggregates it extends
    events: {
      publishes: string[];            // New events this module adds
      subscribes: string[];           // Core events it listens to
    };
    routes: string[];                 // API route prefixes
    socketNamespaces: string[];       // Socket.IO namespaces
    queueWorkers: string[];           // BullMQ queue names
  };

  // Permissions
  permissions: string[];             // New permissions this module introduces

  // UI
  ui: {
    routes: string[];                 // Frontend route paths
    navItems: NavItem[];              // Sidebar menu entries
    components: {
      pos?: string[];                 // Components injected into POS screen
      dashboard?: string[];           // Dashboard widgets
    };
  };

  // Config Schema
  configSchema: object;               // Zod schema for module config
}
```

### 7.2 Module Loading Flow

```
STARTUP SEQUENCE
═════════════════

1. Server starts
2. Load platform config (env vars, global settings)
3. Initialize shared infrastructure (DB, Redis, event bus)
4. Scan `modules/` directory for all available modules
5. For each module found:
   a. Read manifest
   b. Validate manifest (dependencies exist, no circular deps)
   c. Register module in registry (in-memory Map)

ON REQUEST (per-tenant)
════════════════════════

1. Resolve tenant (subdomain/header/JWT)
2. Load tenant config from Redis cache
3. Get tenant's enabledModules (e.g., ["restaurant"])
4. For each enabled module:
   a. Load module's routes → register in Express router
   b. Subscribe module's event handlers to event bus
   c. Initialize module's socket.IO namespaces
   d. Register module's permissions in RBAC system
   e. Start module's queue workers
5. Cache "active modules" for this tenant (TTL: 5 min)
6. Proceed to handle request

ON MODULE ACTIVATION (admin toggles module ON)
═══════════════════════════════════════════════

1. Admin enables "restaurant" module in tenant settings
2. Tenant config updated → `modules.enabled.push("restaurant")`
3. Event published: `platform.tenant.config.updated`
4. Module loader detects change → hot-loads module at next request

ON MODULE DEACTIVATION (admin toggles module OFF)
═════════════════════════════════════════════════

1. Admin disables module
2. System verifies: no active orders/dependencies using module
3. Graceful cleanup: unregister routes, unsubscribe handlers
4. Tenant config updated → `modules.enabled` without module
```

### 7.3 Module Isolation Rules

```
┌─────────────────────────────────────────────────────────────┐
│                    MODULE ISOLATION                          │
│                                                             │
│  RULE 1: No direct imports between modules                  │
│  ─────────────────────────────────────────                  │
│  restaurant.ts NEVER does:                                  │
│    import { Booking } from '@modules/hospitality';         │
│  Instead: Publish event → Hospitality subscribes            │
│                                                             │
│  RULE 2: Modules extend via events, not inheritance         │
│  ─────────────────────────────────────────                  │
│  Restaurant subscribes to OrderCreated to create            │
│  kitchen tickets. It does NOT extend the Order class.       │
│                                                             │
│  RULE 3: Module data is fully isolated                      │
│  ─────────────────────────────────────────                  │
│  Collections are prefixed: restaurant_tables,               │
│  hospitality_bookings. Same tenant database, no overlap.   │
│                                                             │
│  RULE 4: Core never knows about modules                     │
│  ─────────────────────────────────────────                  │
│  Core domains don't import extension types.                 │
│  Extensions adapt to core, not vice versa.                  │
│                                                             │
│  RULE 5: Module = deployable unit                           │
│  ─────────────────────────────────────────                  │
│  When ready, ANY module can be extracted to a               │
│  standalone microservice without changing core code.        │
│  The event bus becomes an external message queue.           │
└─────────────────────────────────────────────────────────────┘
```

### 7.4 Module Capability Matrix

| Capability | Retail | Restaurant | Hospitality |
|-----------|--------|------------|-------------|
| **Core POS** | ✅ Native | ✅ Core + table flow | ✅ Core + room charge flow |
| **Catalog** | ✅ Products, barcodes | ✅ Products, modifiers | ✅ Products, amenities |
| **Orders** | ✅ Standard | ✅ Table-based, split bill | ✅ Room charge, booking |
| **Inventory** | ✅ Stock, suppliers, PO | ✅ Stock only | ✅ Stock only |
| **Payments** | ✅ Cash, QRIS, transfer | ✅ Same + split | ✅ Same + deposit |
| **Customers** | ✅ Profiles, loyalty | ✅ Same + reservation | ✅ Guest profiles, stays |
| **Tables** | ❌ | ✅ Floor plan, waiter | ❌ |
| **Kitchen** | ❌ | ✅ KDS, printer | ❌ |
| **Booking** | ❌ | ✅ Reservations | ✅ Full booking engine |
| **Rooms** | ❌ | ❌ | ✅ Room types, properties |
| **Housekeeping** | ❌ | ❌ | ✅ Tasks, scheduling |
| **Check-in/out** | ❌ | ❌ | ✅ Full workflow |

### 7.5 Future Microservice Extraction Path

```
Phase 1: Modular Monolith
┌──────────────────────────────────────────────┐
│  Single deployment — all contexts in process │
│  Event bus: in-process EventEmitter          │
│  Communication: sync (DI) + async (events)   │
│  Database: MongoDB per tenant                │
└──────────────────────────────────────────────┘

Phase 2: Domain Extraction (when 1 context needs isolation)
┌──────────────────────────────────────────────┐
│  Identify high-load/high-compliance context  │
│  Extract: Payment (PCI compliance)           │
│                                              │
│  Changes:                                     │
│   - Payment becomes standalone service        │
│   - In-process EventBus → BullMQ (Redis)     │
│   - Sync queries → HTTP API / gRPC           │
│   - Shared types → NPM package               │
└──────────────────────────────────────────────┘

Phase 3: Multiple Services
┌──────────────────────────────────────────────┐
│         API Gateway (Express Gateway)         │
│               │         │                     │
│     ┌─────────┘         └─────────┐          │
│     ▼                             ▼          │
│  Ordering                    Payment          │
│  Service                     Service          │
│     │                             │           │
│     └─────────┬──────────────────┘           │
│               ▼                              │
│         Message Queue                        │
│         (RabbitMQ / NATS)                    │
│               │                              │
│     ┌─────────┼─────────┐                   │
│     ▼         ▼         ▼                    │
│ Inventory  Reporting  Notification           │
│ Service    Service    Service                │
│                                              │
│  Each service: own DB, own deployment        │
│  Communication: async events only            │
│  UI: BFF (Backend for Frontend) per client   │
└──────────────────────────────────────────────┘
```

---

## 8. Domain Map & Event Flow Diagrams

### 8.1 Complete Domain Map

```
                        ╔══════════════════════════╗
                        ║       PLATFORM LAYER     ║
                        ╠══════════════════════════╣
                        ║ ┌─────────┐ ┌─────────┐ ║
                        ║ │IDENTITY │ │ TENANT  │ ║
                        ║ │ Auth    │ │ Tenant  │ ║
                        ║ │ Users   │ │ Config  │ ║
                        ║ │ Roles   │ │ Onboard │ ║
                        ║ │Perms    │ │ Feature │ ║
                        ║ └────┬────┘ └────┬────┘ ║
                        ║      │            │       ║
                        ║ ┌────┴────────────┴────┐ ║
                        ║ │       AUDIT          │ ║
                        ║ │  Immutable log       │ ║
                        ║ │  Compliance trail    │ ║
                        ║ └─────────────────────┘ ║
                        ╚══════════════════════════╝
                                  │
                                  │ Tenant Middleware
                                  │ Identity Middleware
                                  ▼
         ╔══════════════════════════════════════════════╗
         ║              CORE DOMAIN LAYER              ║
         ╠══════════════════════════════════════════════╣
         ║                                              ║
         ║  ┌──────────┐    ┌──────────┐              ║
         ║  │ CATALOG  │───>│ ORDERING │              ║
         ║  │ Products │    │ Orders   │              ║
         ║  │Variants  │    │ Carts    │              ║
         ║  │Modifiers │    │Discounts │              ║
         ║  └──────────┘    └────┬─────┘              ║
         ║                       │                     ║
         ║                       ▼                     ║
         ║  ┌──────────┐    ┌──────────┐              ║
         ║  │INVENTORY │<───│ PAYMENT  │              ║
         ║  │ Stock    │    │ Midtrans │              ║
         ║  │Warehouse │    │ QRIS     │              ║
         ║  │Movement  │    │ Refund   │              ║
         ║  └──────────┘    └────┬─────┘              ║
         ║                       │                     ║
         ║              ┌────────┼────────┐            ║
         ║              ▼        ▼        ▼            ║
         ║  ┌──────────┐ ┌──────────┐ ┌──────────┐    ║
         ║  │ CUSTOMER │ │ NOTIF    │ │REPORTING │    ║
         ║  │ Profiles │ │WhatsApp  │ │Analytics │    ║
         ║  │ Loyalty  │ │ Email    │ │Dashboard │    ║
         ║  │ History  │ │ Push     │ │Export    │    ║
         ║  └──────────┘ └──────────┘ └──────────┘    ║
         ║                                              ║
         ║  ┌──────────┐                              ║
         ║  │    POS   │                              ║
         ║  │ Register │                              ║
         ║  │  Shift   │                              ║
         ║  │ Session  │                              ║
         ║  └──────────┘                              ║
         ╚══════════════════════════════════════════════╝
                                  │
                                  │ Event Bus
                                  ▼
         ╔══════════════════════════════════════════════╗
         ║            EXTENSION LAYER                   ║
         ╠══════════════════════════════════════════════╣
         ║                                              ║
         ║  ┌──────────────────────────────────────────┐║
         ║  │           RESTAURANT MODULE              │║
         ║  │                                          │║
         ║  │  Tables ─> Orders ─> Kitchen ─> Serve   │║
         ║  │    ↑          │           │              │║
         ║  │  FloorPlan   SplitBill  Printer          │║
         ║  └──────────────────────────────────────────┘║
         ║                                              ║
         ║  ┌──────────────────────────────────────────┐║
         ║  │         HOSPITALITY MODULE                │║
         ║  │                                          │║
         ║  │  Booking ─> CheckIn ─> Stay ─> CheckOut │║
         ║  │    ↑                    │                │║
         ║  │  Calendar            Housekeeping        │║
         ║  └──────────────────────────────────────────┘║
         ║                                              ║
         ║  ┌──────────────────────────────────────────┐║
         ║  │            RETAIL MODULE                  │║
         ║  │                                          │║
         ║  │  Suppliers ─> PurchaseOrder ─> Receive   │║
         ║  │                              │           │║
         ║  │                           Inventory      │║
         ║  └──────────────────────────────────────────┘║
         ╚══════════════════════════════════════════════╝
```

### 8.2 Complete Order-to-Receipt Event Flow

```
ORDER LIFECYCLE — FULL EVENT STORM
═══════════════════════════════════

                  ┌─────────────────────────────────────┐
                  │          1. ORDER CREATED            │
                  │  Source: POS / Waiter / API          │
                  │  Actor: Cashier / Waiter / Customer  │
                  └──────────────────┬──────────────────┘
                                     │
                     ┌───────────────┼───────────────┐
                     ▼               ▼               ▼
              ┌────────────┐  ┌────────────┐  ┌────────────┐
              │ Inventory  │  │ Customer   │  │ Restaurant │
              │ Reserve    │  │ Add to     │  │ Create     │
              │ stock      │  │ history    │  │ kitchen    │
              └────────────┘  └────────────┘  │ ticket     │
                                               └────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │          2. ORDER CONFIRMED          │
                  │  Cashier completes order entry       │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │        3. PAYMENT REQUESTED          │
                  │  Source: POS (cash/QRIS)             │
                  │  Actor: Cashier                      │
                  └──────────────────┬──────────────────┘
                                     │
                          ┌──────────┴──────────┐
                          ▼                     ▼
                   ┌────────────┐       ┌────────────┐
                   │ 4a. CASH  │       │ 4b. QRIS   │
                   │ Complete  │       │ Generate   │
                   │ instantly │       │ QR code    │
                   └─────┬─────┘       └──────┬─────┘
                         │                    │
                         ▼                    ▼
                  ┌─────────────────────────────────────┐
                  │       4. PAYMENT COMPLETED           │
                  │  Cash: instant                       │
                  │  QRIS: webhook callback              │
                  └──────────────────┬──────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
  ┌────────────┐            ┌────────────┐            ┌────────────┐
  │ Inventory  │            │  Ordering  │            │  Customer  │
  │ Commit     │            │ Mark order │            │ Add loyalty│
  │ stock      │            │ as PAID    │            │ points     │
  │ reduction  │            └────────────┘            └────────────┘
  └────────────┘
         │
         ▼
  ┌────────────┐
  │  Catalog   │
  │ Update     │
  │ availability│
  └────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │        5. RECEIPT GENERATED          │
                  │  Source: POS                         │
                  │  Actor: System (auto)                │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │     6. NOTIFICATION DISPATCHED       │
                  │  Channel: WhatsApp (via n8n)         │
                  │  Content: Receipt + Thank you        │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │        7. REPORTING UPDATED          │
                  │  Metrics: daily_metrics              │
                  │  Real-time: dashboard socket push    │
                  └─────────────────────────────────────┘
```

### 8.3 Hospitality Booking → Stay → Checkout Event Flow

```
BOOKING LIFECYCLE — FULL EVENT STORM
═════════════════════════════════════

          ┌─────────────────────────────────────┐
          │       1. BOOKING CREATED             │
          │  Source: Hotel front desk / Website  │
          │  Actor: Receptionist / Guest         │
          └──────────────────┬──────────────────┘
                             │
                             ▼
          ┌─────────────────────────────────────┐
          │     2. BOOKING CONFIRMED             │
          │  Deposit payment requested           │
          └──────────────────┬──────────────────┘
                             │
                             ▼
          ┌─────────────────────────────────────┐
          │     3. DEPOSIT PAYMENT               │
          │  Payment Completed event             │
          │  → Booking status: confirmed         │
          └──────────────────┬──────────────────┘
                             │
                             ▼
          ┌─────────────────────────────────────┐
          │       4. GUEST CHECKED IN            │
          │  Actor: Receptionist                 │
          │  POS opens room charges tab          │
          │  Housekeeping notified: room taken   │
          └─────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
  ┌────────────┐    ┌────────────┐    ┌────────────┐
  │    POS     │    │Housekeeping│    │ Restaurant │
  │ Room tab   │    │ Mark room  │    │ Room       │
  │ open       │    │ occupied   │    │ charges    │
  └────────────┘    └────────────┘    │ possible   │
                                      └────────────┘
                             │
                             │ (During stay)
                             │   Guest orders food → charged to room
                             │   Housekeeping cleans room daily
                             │   Mini-bar consumption → added to bill
                             ▼
          ┌─────────────────────────────────────┐
          │       5. GUEST CHECKED OUT           │
          │  Actor: Receptionist                 │
          │  Actions:                            │
          │  • Settle all POS charges            │
          │  • Process final payment             │
          │  • Generate invoice                  │
          │  • Release room                      │
          │  • Update guest history              │
          └──────────────────┬──────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
  ┌────────────┐    ┌────────────┐    ┌────────────┐
  │  Payment   │    │Housekeeping│    │  Billing   │
  │ Final      │    │ Create     │    │ Generate   │
  │ settlement │    │ cleaning   │    │ invoice    │
  └────────────┘    │ task       │    └────────────┘
                    └────────────┘
                             │
                             ▼
          ┌─────────────────────────────────────┐
          │     6. REPORTING UPDATED             │
          │  Occupancy rate, revenue,            │
          │  average stay duration               │
          └─────────────────────────────────────┘
```

### 8.4 Restaurant Table → Order → Kitchen → Serve Event Flow

```
RESTAURANT ORDER LIFECYCLE
══════════════════════════

         ┌─────────────────────────────────────┐
         │      1. TABLE OCCUPIED               │
         │  Actor: Waiter                        │
         │  Guests seated at table              │
         │  POS: Create order for table         │
         └──────────────────┬──────────────────┘
                            │
                            ▼
         ┌─────────────────────────────────────┐
         │      2. ORDER ITEMS ADDED            │
         │  Actor: Waiter (via tablet)          │
         │  Items added to table order          │
         └──────────────────┬──────────────────┘
                            │
                            ▼
         ┌─────────────────────────────────────┐
         │     3. ORDER SENT TO KITCHEN         │
         │  Actor: Waiter clicks "Send"         │
         │  Event: OrderSentToKitchen           │
         │  • Printer: prints order ticket      │
         │  • KDS screen: updates queue         │
         └──────────────────┬──────────────────┘
                            │
                            ▼
         ┌─────────────────────────────────────┐
         │     4. KITCHEN PREPARING             │
         │  Actor: Chef                         │
         │  KDS: Item status → "preparing"     │
         └──────────────────┬──────────────────┘
                            │
                            ▼
         ┌─────────────────────────────────────┐
         │      5. ORDER READY                  │
         │  Actor: Chef                         │
         │  KDS: Item status → "ready"         │
         │  Notification: Waiter alerted        │
         │  Printer: ready ticket (optional)    │
         └──────────────────┬──────────────────┘
                            │
                            ▼
         ┌─────────────────────────────────────┐
         │      6. ORDER SERVED                 │
         │  Actor: Waiter picks up & serves     │
         │  KDS: Item status → "served"        │
         └──────────────────┬──────────────────┘
                            │
                            │ (Repeat 2-6 for additional courses)
                            ▼
         ┌─────────────────────────────────────┐
         │      7. BILL REQUESTED               │
         │  Actor: Customer / Waiter            │
         │  Optional: Split bill                │
         └──────────────────┬──────────────────┘
                            │
                            ▼
         ┌─────────────────────────────────────┐
         │      8. PAYMENT COMPLETED            │
         │  (same as standard POS flow)         │
         │  Event: PaymentCompleted             │
         └──────────────────┬──────────────────┘
                            │
                            ▼
         ┌─────────────────────────────────────┐
         │      9. TABLE FREED                  │
         │  Actor: Housekeeping / Waiter        │
         │  Table status → "available"          │
         │  Floor plan updated in real-time     │
         └─────────────────────────────────────┘
```

### 8.5 Event Flow — Complete Interaction Matrix

```
                        PUBLISHER (→)
                        ┌────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
                        │Identity│Tenant│Catalog│Ordering│Payment│Inventory│POS│Customer│Reporting│Notification│Restaurant│Hospitality│
────────────────────────┼────────┼──────┼───────┼────────┼───────┼─────────┼───┼────────┼─────────┼────────────┼──────────┼───────────┤
SUBSCRIBER (↓)          │        │      │       │        │       │         │   │        │         │            │          │           │
────────────────────────┼────────┼──────┼───────┼────────┼───────┼─────────┼───┼────────┼─────────┼────────────┼──────────┼───────────┤
Identity                │   ·    │  ·   │   ·   │   ·    │   ·   │    ·    │ · │   ·    │    ·    │     ·      │    ·     │     ·     │
Tenant                  │   ·    │  ·   │   ·   │   ·    │   ·   │    ·    │ · │   ·    │    ·    │     ·      │    ·     │     ·     │
Catalog                 │   ·    │  ·   │   ·   │   ·    │   ·   │   ◄     │ · │   ·    │    ·    │     ·      │    ·     │     ·     │
Ordering                │   ·    │  ·   │   ·   │   ·    │   ◄   │    ◄    │ · │   ·    │    ·    │     ·      │    ·     │     ·     │
Payment                 │   ·    │  ·   │   ·   │   ◄    │   ·   │    ·    │ · │   ·    │    ·    │     ·      │    ·     │     ◄     │
Inventory               │   ·    │  ·   │   ·   │   ◄    │   ◄   │    ·    │ · │   ·    │    ·    │     ·      │    ·     │     ·     │
POS                     │   ·    │  ·   │   ·   │   ◄    │   ·   │    ·    │ · │   ·    │    ·    │     ·      │    ◄     │     ◄     │
Customer                │   ·    │  ·   │   ·   │   ◄    │   ◄   │    ·    │ · │   ·    │    ·    │     ·      │    ·     │     ·     │
Reporting               │   ·    │  ·   │   ◄   │   ◄    │   ◄   │    ◄    │ ◄ │   ·    │    ·    │     ·      │    ·     │     ◄     │
Notification            │   ◄    │  ·   │   ·   │   ◄    │   ◄   │    ◄    │ ◄ │   ·    │    ·    │     ·      │    ·     │     ◄     │
Audit                   │   ◄    │  ◄   │   ◄   │   ◄    │   ◄   │    ◄    │ ◄ │   ◄    │    ◄    │     ◄      │    ◄     │     ◄     │
Restaurant              │   ·    │  ·   │   ·   │   ◄    │   ·   │    ·    │ · │   ·    │    ·    │     ·      │    ·     │     ·     │
Hospitality             │   ·    │  ·   │   ·   │   ·    │   ◄   │    ·    │ · │   ·    │    ·    │     ·      │    ·     │     ·     │
────────────────────────┴────────┴──────┴───────┴────────┴───────┴─────────┴───┴────────┴─────────┴────────────┴──────────┴───────────┘

◄ = Subscribes to events from this publisher
· = No direct event subscription
```

---

## Architectural Guarantees Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURAL DECISIONS                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Q: Why NOT a monolith for a POS?                                  │
│  A: Because this is NOT a POS app. It's a business operating       │
│     system that happens to have a POS module. The architecture     │
│     must support multiple industries from day one.                 │
│                                                                    │
│  Q: Why DDD bounded contexts?                                      │
│  A: Each business capability (ordering, payment, inventory) has    │
│     its own lifecycle, team, and scaling needs. DDD gives us       │
│     the cleanest separation for parallel evolution.                │
│                                                                    │
│  Q: Why event-driven internal communication?                       │
│  A: Tight coupling between POS, inventory, and payments kills      │
│     maintainability. Events let contexts evolve independently      │
│     and prepare us for microservice extraction.                    │
│                                                                    │
│  Q: Why database-per-tenant instead of shared?                     │
│  A: In a POS/commerce platform, data isolation is non-negotiable.  │
│     One query bug with tenantId filter = data leak = business      │
│     death. Database-per-tenant also aligns with Indonesian         │
│     data residency regulations.                                    │
│                                                                    │
│  Q: Why modular monolith first?                                    │
│  A: Microservices before product-market fit is premature           │
│     complexity. Modular monolith gives us the SAME boundaries      │
│     without the operational overhead of distributed systems.       │
│     Extraction is a deployment decision, not a rewrite.            │
│                                                                    │
│  Q: How is this different from other POS platforms?                │
│  A: Most POS platforms are monoliths with plugins bolted on.       │
│     This is DDD-first, event-driven, multi-tenant from day one.   │
│     Modules are not plugins — they're bounded contexts that        │
│     extend the platform through events.                            │
│                                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Next Steps (After Architecture Approval)

```
1. Create empty folder structure matching the DDD layout
2. Implement Shared Kernel (base classes: AggregateRoot, Entity, ValueObject, DomainEvent)
3. Implement Event Bus infrastructure
4. Implement Multi-tenant middleware + ConnectionManager
5. Implement Identity context (auth → JWT → RBAC)
6. Implement Tenant context (onboarding → provisioning)
7. Implement Catalog context (products → CRUD)
8. Implement Ordering context (carts → orders → state machine)
9. Implement Payment context (Midtrans → QRIS → webhooks)
10. Implement Inventory context (stock → movements → alerts)
11. Implement POS context (registers → shifts → sessions)
12. Implement Customer context
13. Implement Notification context (WhatsApp via n8n)
14. Implement Reporting context (aggregations → dashboards)
15. Implement Extension modules (Restaurant → Hospitality → Retail)
```
