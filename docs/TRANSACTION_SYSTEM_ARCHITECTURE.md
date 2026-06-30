# Transaction & POS System Architecture

> **Platform:** POSMono — Modular Business Operating System
> **Status:** Architecture Design
> **Mindset:** Shopify / Square / Toast — enterprise-grade SaaS

---

## Table of Contents

1. [Transaction Engine Architecture](#1-transaction-engine-architecture)
2. [Offline Sync Architecture](#2-offline-sync-architecture)
3. [Conflict Resolution Strategy](#3-conflict-resolution-strategy)
4. [POS Device Management](#4-pos-device-management)
5. [Printer Architecture](#5-printer-architecture)
6. [Data Consistency Strategy](#6-data-consistency-strategy)
7. [Plugin Runtime Architecture](#7-plugin-runtime-architecture)
8. [Scalability Roadmap](#8-scalability-roadmap)

---

## 1. Transaction Engine Architecture

### 1.1 Philosophy

The transaction engine is the heart of the POS system. It must be:

- **Reliable** — every transaction must complete or rollback cleanly
- **Observable** — every state transition is logged and traceable
- **Resilient** — partial failures (payment succeeds, inventory fails) are handled
- **Offline-capable** — works without internet, syncs when connected
- **Extensible** — restaurant split-bill, hospitality room-charge, retail layaway all extend the same engine

### 1.2 Order State Machine

```
                                  ┌─────────────────────────────────────┐
                                  │         ORDER STATE MACHINE         │
                                  │                                     │
                                  │              ┌──────────┐          │
                                  │     ┌────────│  DRAFT   │────────┐ │
                                  │     │        └──────────┘        │ │
                                  │     │                            │ │
                                  │     ▼                            ▼ │
                                  │ ┌──────────┐             ┌──────────┐
                                  │ │ CANCELLED│             │CONFIRMED │
                                  │ └──────────┘             └────┬─────┘
                                  │                               │
                                  │                               ▼
                                  │                          ┌──────────┐
                                  │               ┌──────────│ PENDING  │
                                  │               │          │ PAYMENT  │
                                  │               │          └────┬─────┘
                                  │               ▼               ▼
                                  │          ┌──────────┐  ┌──────────┐
                                  │          │ PAYMENT  │  │ PAYMENT  │
                                  │          │PROCESSING│  │  FAILED  │
                                  │          └────┬─────┘  └──────────┘
                                  │               │
                                  │               ▼
                                  │          ┌──────────┐
                                  │          │   PAID   │
                                  │          └────┬─────┘
                                  │               │
                                  │        ┌──────┴──────┐
                                  │        ▼             ▼
                                  │  ┌──────────┐  ┌──────────┐
                                  │  │COMPLETED │  │ PARTIALLY│
                                  │  │          │  │ REFUNDED │
                                  │  └──────────┘  └────┬─────┘
                                  │                     │
                                  │                     ▼
                                  │                ┌──────────┐
                                  │                │   FULL   │
                                  │                │ REFUNDED │
                                  │                └──────────┘
                                  └─────────────────────────────────────┘
```

```
LEGEND:
─────────────────────────────────────────────────────────────────────
draft           → Cart converted to order, not yet confirmed
cancelled       → Cancelled before payment (no financial impact)
confirmed       → Order validated, inventory reserved
pending_payment → Awaiting payment gateway response
payment_processing → Midtrans processing, QRIS waiting scan
payment_failed  → Payment declined/expired
paid            → Payment received, order finalized
completed       → Order fulfilled (items delivered/service rendered)
partially_refunded → Some items returned
fully_refunded  → Full amount returned
```

### 1.3 State Transition Rules

```
TRANSITION                  TRIGGER                     VALIDATION
──────────────────────  ─────────────────────────  ─────────────────────────────
draft → confirmed       Cashier confirms cart       Products exist, stock available,
                                                    price valid, customer valid
confirmed → cancelled   Cashier cancels             Only if not paid
confirmed → pending_    Initiate payment            Payment method selected,
  payment                                           amount matches total
pending_payment →       Payment gateway response    Midtrans signature valid,
  paid                                              amount matches
pending_payment →       Payment failed/timeout      Retry logic exhausted
  payment_failed
pending_payment →       Cashier cancels during      Only if no payment captured
  cancelled             payment
paid → completed        Mark as fulfilled           All items delivered
paid → partially_       Process refund              Refund reason, amount ≤ paid
  refunded
paid → fully_refunded   Process full refund         Refund reason
completed →             Reverse fulfillment         Only within return window
  partially_refunded
```

### 1.4 Transaction Flow — Complete Saga

```
                     TRANSACTION SAGA
                     ═════════════════

STEP 1: CREATE ORDER
─────────────────────
  Cart → Order (draft)
  ↓
  Validate products exist in catalog
  Validate prices match catalog (or price override permission)
  Validate customer (if provided)
  ↓
  Publish: ordering.order.created

STEP 2: RESERVE INVENTORY
──────────────────────────
  Handle: ordering.order.created
  ↓
  For each item, check stock availability
  If any item insufficient stock → fail with reason per item
  Reserve stock (increment reservedQuantity)
  ↓
  Publish: inventory.stock.reserved
  ↓
  If reservation fails → publish ordering.order.reservation_failed
    → Order returns to draft with error details

STEP 3: CONFIRM ORDER
──────────────────────
  After stock reservation confirmed
  ↓
  Transition order: draft → confirmed
  ↓
  Publish: ordering.order.confirmed

STEP 4: PROCESS PAYMENT
────────────────────────
  Handle: ordering.order.confirmed
  ↓
  Create payment record (status: pending)
  ↓
  If QRIS: generate Midtrans QR code
  If Cash: skip gateway
  If Transfer: generate VA number
  ↓
  Transition order: confirmed → pending_payment
  ↓
  Publish: payment.transaction.created
  ↓
  Wait for payment gateway webhook or cash confirmation

STEP 5a: PAYMENT SUCCESS
─────────────────────────
  Webhook received: payment.transaction.completed
  ↓
  Validate webhook signature (Midtrans)
  Verify amount matches
  Verify order is in pending_payment state
  ↓
  Update payment: status → completed
  Transition order: pending_payment → paid
  Record paidAt timestamp
  ↓
  Publish: payment.transaction.completed

STEP 5b: PAYMENT FAILED
────────────────────────
  Payment gateway: transaction.failed
  or
  QRIS expired (timeout)
  ↓
  Update payment: status → failed
  Transition order: pending_payment → payment_failed
  ↓
  Publish: payment.transaction.failed
  ↓
  Handle: payment.transaction.failed
    → Release stock reservation
    → Publish: inventory.stock.released

STEP 6: COMMIT INVENTORY
─────────────────────────
  Handle: payment.transaction.completed
  ↓
  Convert reservation to actual deduction
  Decrement quantity by reservedQuantity
  Decrement reservedQuantity by reservedQuantity
  Record stock movement (type: out)
  ↓
  Publish: inventory.stock.adjusted
  Check low stock threshold
  If below minLevel → publish: inventory.stock.low_alert

STEP 7: UPDATE CUSTOMER
────────────────────────
  Handle: payment.transaction.completed
  ↓
  Update customer totalVisits+1, totalSpent+=amount, lastVisitAt
  Add loyalty points
  ↓
  Publish: customer.loyalty.points_earned

STEP 8: GENERATE RECEIPT
─────────────────────────
  Handle: payment.transaction.completed
  ↓
  Generate receipt number
  Store receipt data (embedded in order or separate collection)
  If printer configured → queue print job
  ↓
  Publish: pos.receipt.generated

STEP 9: UPDATE REPORTING
─────────────────────────
  Handle: payment.transaction.completed
  ↓
  Upsert daily_metrics:
    totalOrders+1
    totalRevenue+=amount
    totalCustomers (unique)
    topProducts update
    paymentMethodBreakdown update
    hourlyBreakdown update
    cashierPerformance update
  ↓
  Publish: reporting.dashboard.snapshot

STEP 10: SEND NOTIFICATIONS
───────────────────────────
  Handle: payment.transaction.completed
  ↓
  If customer has notification preference:
    Send receipt via WhatsApp/Email
  If low stock:
    Send alert to manager
  ↓
  Publish: notification.sent

STEP 11: RESTAURANT EXTENSION (if module active)
─────────────────────────────────────────────────
  Handle: payment.transaction.completed
  ↓
  If order has tableId:
    Free table (status → available)
    If split bill → mark portion as paid
  If kitchen orders pending → update status
```

### 1.5 Saga Orchestrator — Compensation

Each step in the saga MUST have a compensating action for rollback:

```
STEP                    COMMIT ACTION               COMPENSATION
──────────────────  ─────────────────────────  ─────────────────────────────
Create Order         Insert order (draft)       Delete order (if draft)
Reserve Inventory    Increment reservedQuantity Decrement reservedQuantity
Confirm Order        draft → confirmed          confirmed → draft
Process Payment      Create payment record      Void payment record
Payment Success      payment → completed        Process refund
Deduct Inventory     quantity -= reserved       quantity += reserved
Update Customer      totalSpent += amount       totalSpent -= amount
Update Reporting     metrics += sale            metrics -= sale
Send Notification    Send message               No compensation (already sent)
```

### 1.6 Order Status History — Immutable Log

Every state transition is recorded in `order_status_history`:

```javascript
{
  _id: "osh_" + nanoid,
  tenantId: "tnt_abc123",
  orderId: "ord_abc123",
  previousStatus: "pending_payment",
  newStatus: "paid",
  changedBy: "usr_456",         // userId or "system" for webhook
  changedByRole: "cashier",
  reason: "Payment completed via QRIS",
  source: "payment_webhook",    // pos | payment_webhook | system | api
  correlationId: "corr_xyz",
  metadata: {
    paymentId: "pay_abc",
    transactionId: "midtrans_123"
  },
  createdAt: ISODate("2026-06-30T10:30:00Z")
}
```

### 1.7 Payment Session — POS Context

The POS context manages the active payment session tied to a register and shift:

```javascript
{
  _id: "psn_" + nanoid,
  tenantId: "tnt_abc123",
  registerId: "reg_001",
  shiftId: "sft_001",
  orderId: "ord_abc123",
  status: "active" | "processing_payment" | "completed" | "failed" | "cancelled",
  paymentMethod: "qris" | "cash" | "transfer" | null,
  amount: 50000,
  paymentSession: {
    provider: "midtrans",
    transactionId: "midtrans_123",
    qrCodeUrl: "https://...",
    qrCodeExpiry: ISODate("2026-06-30T10:35:00Z"),
    status: "pending" | "success" | "failed" | "expired"
  },
  cashReceived: null,           // for cash payments
  cashChange: null,
  timeline: [
    { event: "session_created", at: ISODate(...) },
    { event: "payment_initiated", method: "qris", at: ISODate(...) },
    { event: "payment_completed", at: ISODate(...) }
  ],
  createdAt: ISODate(...),
  updatedAt: ISODate(...)
}
```

### 1.8 Cashier Shift — Register Context

```javascript
{
  _id: "sft_" + nanoid,
  tenantId: "tnt_abc123",
  registerId: "reg_001",
  cashierId: "usr_456",
  status: "open" | "closed",
  openingBalance: 500000,       // starting cash in drawer
  closingBalance: null,         // counted cash at close
  expectedTotal: null,          // system-calculated expected cash
  actualTotal: null,            // physically counted cash
  difference: null,             // actualTotal - expectedTotal (overage/shortage)
  transactionCount: 0,
  totalSales: 0,
  totalCashSales: 0,
  totalQrisSales: 0,
  totalRefunds: 0,
  startedAt: ISODate("2026-06-30T08:00:00Z"),
  closedAt: null,
  notes: null,
  createdAt: ISODate(...),
  updatedAt: ISODate(...)
}
```

### 1.9 Transaction Engine — Key Design Decisions

```
DECISION                        CHOICE                      WHY
────────────────────────  ────────────────────────  ──────────────────────────────
State machine location   Domain layer (OrderStatus)  Business logic in domain, not
                                                     infrastructure or controller
Saga pattern             Choreography via events      Simpler than orchestrator in
                                                     modular monolith; each context
                                                     subscribes and acts
Inventory reserve        Reserve on order confirm     Prevents overselling during
                          release on cancel/fail       payment processing window
Payment timeout          15 min QRIS expiry            Midtrans QRIS has 15min TTL
                         configurable per gateway
Receipt generation       On payment complete event     Async via event handler;
                                                     can be retried independently
Order numbering          ORD-{tenantSeq}{dateRand}    Per-tenant sequential with
                                                     date prefix for readability
Version field            Optimistic locking on         Prevents concurrent modification
                         orders and inventory          from multiple POS devices
```

---

## 2. Offline Sync Architecture

### 2.1 Philosophy

POS MUST work without internet. The offline architecture follows these principles:

1. **Local-first** — all operations are written to local storage first, synced to server when online
2. **Optimistic UI** — user sees immediate feedback, sync happens in background
3. **Eventual consistency** — server is source of truth, local state converges
4. **No data loss** — operations are queued locally and retried until acknowledged
5. **Transparent** — cashier should not know they are offline (except an indicator)

### 2.2 Architecture Overview

```
                         OFFLINE ARCHITECTURE
                         ════════════════════

┌────────────────────────────────────────────────────────────────────┐
│                        BROWSER / ELECTRON                           │
│                                                                    │
│  ┌─────────────────┐    ┌─────────────────┐    ┌───────────────┐  │
│  │   React App     │    │   Service        │    │  Electron     │  │
│  │   (POS UI)      │◄──►│   Worker         │◄──►│  Main Process │  │
│  └────────┬────────┘    └────────┬────────┘    └───────┬───────┘  │
│           │                      │                      │          │
│           ▼                      ▼                      ▼          │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                 LOCAL DATA LAYER                             │  │
│  │                                                              │  │
│  │  ┌──────────────────┐  ┌──────────────────┐                 │  │
│  │  │   IndexedDB       │  │   Sync Queue     │                 │  │
│  │  │   (Operational)   │  │   (Pending Ops)  │                 │  │
│  │  │                   │  │                  │                 │  │
│  │  │  • products       │  │  • order.created │                 │  │
│  │  │  • categories     │  │  • payment.done  │                 │  │
│  │  │  • customers      │  │  • shift.open    │                 │  │
│  │  │  • orders (cache) │  │  • etc.          │                 │  │
│  │  │  • inventory      │  │                  │                 │  │
│  │  │  • settings       │  │                  │                 │  │
│  │  └──────────────────┘  └──────────────────┘                 │  │
│  │                                                              │  │
│  │  ┌──────────────────┐  ┌──────────────────┐                 │  │
│  │  │   Sync Engine     │  │   Conflict       │                 │  │
│  │  │   (Background)    │──►│   Detector       │                 │  │
│  │  └──────────────────┘  └──────────────────┘                 │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼  HTTPS (REST + WebSocket)
                              │
┌────────────────────────────────────────────────────────────────────┐
│                        SERVER                                       │
│                                                                    │
│  ┌─────────────────┐    ┌─────────────────┐    ┌───────────────┐  │
│  │   Sync API       │    │   Event Bus     │    │  Transaction  │  │
│  │   (REST)         │───►│   (Process)     │───►│  Engine       │  │
│  └─────────────────┘    └─────────────────┘    └───────────────┘  │
│                                                                    │
│  ┌─────────────────┐    ┌─────────────────┐    ┌───────────────┐  │
│  │   Conflict       │    │   Outbox        │    │  Dead Letter  │  │
│  │   Resolver       │    │   (BullMQ)      │    │  Queue        │  │
│  └─────────────────┘    └─────────────────┘    └───────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### 2.3 Local Storage Strategy — IndexedDB

IndexedDB is the storage engine. It handles structured data, large volumes, and complex queries.

```
DATABASE NAME: posmono_{tenantId}
VERSION: Managed via migration

OBJECT STORES:
──────────────

STORE: sync_meta
  Key: "tenant_info"
  Value: { tenantId, lastSyncAt, syncToken, serverTimeDiff }

STORE: cached_data
  Key: collection_name + ":" + record_id
  Value: { data, version, lastSyncedAt, synced: boolean }
  Indexes: collection_name, synced

STORE: pending_operations
  Key: auto-increment
  Value: {
    id: string (uuid),
    type: "order.create" | "payment.process" | "shift.close",
    payload: object,
    createdAt: timestamp,
    retryCount: number,
    status: "pending" | "syncing" | "failed" | "confirmed",
    lastError: string | null
  }
  Indexes: status, createdAt

STORE: offline_orders
  Key: order_id
  Value: { full order document, localStatus, syncedAt }
  Indexes: synced, localStatus

STORE: local_events
  Key: event_id
  Value: { eventName, payload, createdAt, syncedAt }
  Indexes: synced
```

### 2.4 Sync Data Flow

```
ONLINE OPERATION:
─────────────────
  1. User creates order
  2. API call to server
  3a. Server processes → returns success
  3b. If server unreachable → fallback to offline flow

OFFLINE OPERATION:
──────────────────
  1. User creates order
  2. API call fails (timeout/network error)
  3. Local cache is checked for:
     a. Products (to validate prices)
     b. Customers (to validate existing)
  4. Order stored in offline_orders store
  5. Operation queued in pending_operations store
  6. User continues working normally
  7. Receipt number assigned locally (prefix: "OFF-{timestamp}")

SYNC TRIGGER:
─────────────
  Triggers:
    a. Network status change (online event)
    b. Periodic poll (every 30s when online)
    c. Manual sync button
    d. Service worker "online" event

SYNC SEQUENCE:
──────────────
  1. Acquire sync lock (prevent concurrent syncs)
  2. Get server's current state version (syncToken)
  3. Upload pending operations in order:
     a. Local orders first (oldest first)
     b. Each operation sent with:
        - clientId (device ID)
        - clientTimestamp
        - idempotency key
  4. Server processes each operation:
     a. Check idempotency (already processed?)
     b. Process operation
     c. Return processed result + server version
  5. On success:
     a. Mark operation as "confirmed"
     b. Update local record with server-assigned data (order number, IDs)
     c. Update local version to match server
  6. On conflict:
     a. Run conflict resolver (see Section 3)
     b. If auto-resolvable → resolve and mark complete
     c. If manual resolution needed → flag for user review
  7. Download latest data from server:
     a. Get delta since last syncToken
     b. Update cached_data store
     c. Purge stale local-only records
  8. Release sync lock
  9. Update sync_meta with new syncToken
```

### 2.5 What Gets Cached Offline

```
ALWAYS CACHED (full read):
──────────────────────────
  • Products (name, price, stock level, category)
  • Categories
  • Customers (name, phone, loyalty)
  • Tax settings
  • Receipt templates
  • User permissions (for offline auth)
  • Register/shift info

CACHED WITH EXPIRY:
───────────────────
  • Stock levels (re-synced every 5 min)
  • Open orders (for resume capability)
  • Recent transactions (last 50 for reference)

NOT CACHED (online only):
────────────────────────
  • Reporting/analytics data
  • Audit logs
  • System-wide configurations
  • Other tenants' data
```

### 2.6 Offline Payment Handling

```
CASH PAYMENTS OFFLINE:
─────────────────────
  • Work fully offline
  • Record cash amount received
  • Calculate change offline
  • Sync when online

QRIS PAYMENTS OFFLINE:
─────────────────────
  • Cannot generate QR code offline (needs Midtrans API)
  • Show "Online required for QRIS" message
  • Suggest cash as alternative
  • If QRIS required: queue order, generate QR when online

DEFERRED PAYMENT:
─────────────────
  • Create order in "pending_payment_offline" state
  • Store locally
  • When online: initiate payment automatically
  • Cashier sees notification: "Complete payment for order XXX"
```

### 2.7 Offline-First Frontend Patterns (React)

```
HOOKS:
──────

useOnlineStatus()
  Returns: { isOnline, wasOffline, lastOnlineAt }
  Uses: navigator.onLine + Socket.IO connection state

useOfflineCache(collection, query)
  Returns: { data, isSyncing, lastSyncedAt, error }
  Behavior:
    - Read from IndexedDB first (instant)
    - Fetch from server if online (background refresh)
    - Update IndexedDB with server response

useOfflineMutation(operationType)
  Returns: { mutate, isPending, isOfflineQueued }
  Behavior:
    - Try API call first
    - On failure: queue to IndexedDB
    - Return optimistic response immediately
```

### 2.8 Electron-Specific Offline

```
Electron has additional capabilities:
  - Local SQLite for more complex queries
  - File system access for receipts
  - Native network detection
  - Background sync even when app is minimized

┌─────────────────────────────────────────────┐
│              ELECTRON MAIN PROCESS            │
│                                              │
│  SQLite (optional)       File System         │
│  ┌─────────────────┐    ┌────────────────┐  │
│  │ • Local receipt  │    │ • Save receipts │  │
│  │   store          │    │   as PDF        │  │
│  │ • Full-text      │    │ • Export data   │  │
│  │   search         │    │ • Log files     │  │
│  └─────────────────┘    └────────────────┘  │
│                                              │
│  Network Detection        Auto-updater       │
│  ┌─────────────────┐    ┌────────────────┐  │
│  │ • Socket status  │    │ • Background    │  │
│  │ • Keep-alive     │    │   sync when     │  │
│  │ • Retry logic    │    │   app closed    │  │
│  └─────────────────┘    └────────────────┘  │
└─────────────────────────────────────────────┘
```

### 2.9 Offline Sync — Key Design Decisions

```
DECISION                        CHOICE                      WHY
────────────────────────  ────────────────────────  ──────────────────────────────
Local storage            IndexedDB                     Structured data, large
                                                      volumes, complex queries,
                                                      supported in all targets
                                                      (browser/Electron/Capacitor)
Sync trigger             Event-based + periodic        Immediate when online,
                                                      fallback to polling
Sync direction           Bidirectional (diff-based)    Server is source of truth,
                                                      but local changes uploaded
Idempotency              Client-generated              Prevents duplicate
                          idempotency key               operations on retry
Offline receipt number   OFF-{timestamp}-{deviceId}    Clearly identifiable
                                                      as offline-created
Conflict detection       Version vector                Compare client version
                          (document version)            vs server version
Offline auth             Cache JWT + permission        Allow login check
                          snapshot locally              from cached data
```

---

## 3. Conflict Resolution Strategy

### 3.1 Types of Conflicts

```
CONFLICT TYPE               SCENARIO                    SEVERITY
──────────────────────  ───────────────────────────  ──────────────────────
Stock oversell           Two cashiers sell same item   CRITICAL — financial
                          offline. Both reserve 5.      loss if oversold
                          Only 8 in stock.
Order version conflict   Cashier A edits order.        HIGH — data loss
                          Cashier B edits same order.   if not handled
                          Both submit changes.
Duplicate customer       Two cashiers create same      MEDIUM — duplicates
                          customer offline with         require merge
                          different phone formats.
Payment double-charge    Payment initiated on two       CRITICAL — financial
                          devices for same order.       loss
Shift mismatch           Shift opened on device A.     MEDIUM — reporting
                          Device B doesn't know.        inconsistency
Product price change     Manager updates price         LOW — honor old price
                          online. Cashier has old       or use new?
                          cached price.
Category delete          Category deleted online.      MEDIUM — orphaned
                          Cashier uses it offline.      products
User deactivated         User deactivated online.      HIGH — security
                          Still active in local cache.  risk
```

### 3.2 Conflict Resolution Strategies

```
STRATEGY: LAST-WRITE-WINS (LWW)
─────────────────────────────────
  Use when: Non-critical data, any version is fine
  Example: Customer notes, product description
  Rule: Server timestamp wins. Client timestamp recorded as history.
  Risk: Low — data is not financial

STRATEGY: FIRST-COMMIT-WINS (FCW)
───────────────────────────────────
  Use when: First action should be honored
  Example: Inventory reservation
  Rule: First successful server commit wins. Subsequent commits fail.
  Risk: Medium — second cashier gets "insufficient stock" error

STRATEGY: MERGE WITH DOMAIN RULES
───────────────────────────────────
  Use when: Both changes are valid, need intelligent merge
  Example: Two separate items added to same order by different users
  Rule: Merge both sets of changes, increment version
  Risk: Low — both changes preserved

STRATEGY: MANUAL REVIEW
─────────────────────────
  Use when: Conflict cannot be auto-resolved
  Example: Price override conflict, split bill amounts
  Rule: Flag for manager review. Order held in "conflict" state.
  Risk: Medium — requires human intervention

STRATEGY: COMPENSATING TRANSACTION
────────────────────────────────────
  Use when: Conflict detected after processing
  Example: Stock oversold — both payments succeeded
  Rule: Execute compensating action (auto-refund, notify manager)
  Risk: Low — financial impact covered
```

### 3.3 Recommended Strategy by Entity

```
ENTITY                  STRATEGY                    DETAILS
──────────────────  ────────────────────────  ─────────────────────────────────
Inventory/Stock      First-commit-wins +        version field, reject stale
                     compensating transaction   writes, auto-refund if oversold
Order status         Version + merge            version field, merge concurrent
                                                item additions
Order items          Last-write-wins with       per-item version, not whole
                     per-item version           order
Customer profile     Last-write-wins            server timestamp wins
Product catalog      Server wins                offline cache invalidated
                     (stale cache rejected)     on next fetch
Shift data           First-commit-wins          only first shift open accepted
Payment              Idempotency key            prevent double charge
                     + first-commit-wins
Pricing              Honor cached for           5 min cache TTL, use cached
                     5 min, then server         price within window, then
                     wins                       force refresh
```

### 3.4 Stock Conflict — Detailed Handling

```
SCENARIO: Stock oversell
─────────────────────────
  Item: "Nasi Goreng"
  Stock in DB: 8
  Device A (offline) sells 5  → reserves 5 locally
  Device B (offline) sells 5  → reserves 5 locally
  Total reserved: 10 (oversold by 2)

SYNC SEQUENCE:
──────────────
  1. Device A comes online → syncs order
  2. Server: inventory version matches
  3. Server: stock 8, reserve request 5 → OK
  4. Server: stock becomes 3 (8 - 5)
  5. Server: version incremented

  6. Device B comes online → syncs order
  7. Server: inventory version MISMATCH
  8. Server: current stock 3, reserve request 5 → INSUFFICIENT
  9. Server: reject the reservation
  10. Server: return error to Device B

DEVICE B HANDLING:
───────────────────
  11. Sync engine receives "insufficient_stock" error
  12. Order placed in "payment_pending_conflict" state
  13. Notification to cashier: "Some items out of stock"
  14. Options:
      a. Cancel order
      b. Remove out-of-stock items and proceed
      c. Force override (manager PIN required)

COMPENSATION (if both already paid):
─────────────────────────────────────
  If both payments already processed automatically:
    1. Detect oversell during reconciliation
    2. Auto-refund second order
    3. Notify both cashiers
    4. Log incident in audit
```

### 3.5 Inventory Version Field — Optimistic Locking

```javascript
// INVENTORY_ITEMS schema (with version control)
{
  _id: "inv_abc123",
  tenantId: "tnt_abc123",
  productId: "prd_001",
  warehouseId: "wh_001",
  quantity: 95,
  reservedQuantity: 3,
  availableQuantity: 92,           // = quantity - reservedQuantity (denormalized)
  version: 12,                     // incremented on every mutation
  lastMutation: {
    type: "reserve" | "release" | "adjust" | "out" | "in",
    orderId: "ord_abc123",
    quantity: -5,
    timestamp: ISODate(...)
  },
  updatedAt: ISODate(...)
}

// Atomic update with version check:
const result = await db.inventory.findOneAndUpdate(
  {
    _id: "inv_abc123",
    version: clientVersion,        // optimistic lock
    $expr: { $gte: [{ $subtract: ["$quantity", "$reservedQuantity"] }, requestQuantity] }
  },
  [
    {
      $set: {
        reservedQuantity: { $add: ["$reservedQuantity", requestQuantity] },
        version: { $add: ["$version", 1] },
        updatedAt: new Date(),
        "lastMutation.type": "reserve",
        "lastMutation.quantity": requestQuantity,
        "lastMutation.timestamp": new Date()
      }
    }
  ]
);

if (!result) {
  // Either: version mismatch OR insufficient stock
  throw new InventoryConflictError("Stock changed or insufficient");
}
```

### 3.6 Conflict Resolution — Server-Side Engine

```
┌─────────────────────────────────────────────────────────┐
│              CONFLICT RESOLUTION ENGINE                   │
│                                                          │
│  Receive sync request from device                        │
│         │                                                │
│         ▼                                                │
│  ┌─────────────────┐                                     │
│  │ Validate         │  Check idempotency key             │
│  │ Idempotency      │  If already processed → return OK  │
│  └────────┬────────┘                                     │
│           ▼                                              │
│  ┌─────────────────┐                                     │
│  │ Check Version    │  Compare client version vs server  │
│  │                  │  If match → process normally       │
│  └────────┬────────┘  If mismatch → enter conflict       │
│           │           resolver                           │
│           ▼                                              │
│  ┌─────────────────┐                                     │
│  │ Conflict         │  Determine conflict type:          │
│  │ Classifier       │    • stock_conflict                │
│  │                  │    • order_version                 │
│  │                  │    • duplicate_customer            │
│  │                  │    • stale_cache                   │
│  └────────┬────────┘    • payment_duplicate              │
│           │                                              │
│           ▼                                              │
│  ┌─────────────────┐                                     │
│  │ Apply Strategy   │  Based on entity + conflict type:  │
│  │                  │    • FCW → reject if stale         │
│  │                  │    • LWW → accept server version   │
│  │                  │    • Merge → intelligent merge     │
│  │                  │    • Manual → flag for review      │
│  └────────┬────────┘    • Compensate → execute rollback  │
│           │                                              │
│           ▼                                              │
│  ┌─────────────────┐                                     │
│  │ Return Result    │  { status, resolvedData,           │
│  │                  │    conflict: null | { type,        │
│  │                  │    details, resolution } }         │
│  └─────────────────┘                                     │
└─────────────────────────────────────────────────────────┘
```

### 3.7 Offline Sync — Idempotency Key Design

Every operation generated offline carries a unique idempotency key:

```javascript
{
  idempotencyKey: "ord_create_tnt_abc123_device_xyz_20260630T103000Z_001",
  // Format: {operation}_{tenant}_{device}_{timestamp}_{counter}
}
```

Server maintains a TTL cache (48h) of processed keys:

```
REDIS CACHE:
────────────
  Key: idempotency:{key}
  Value: { status: "processed", resultId: "ord_abc123" }
  TTL: 172800 (48 hours)
```

---

## 4. POS Device Management

### 4.1 Device Types

```
DEVICE TYPE         PLATFORM            USE CASE
──────────────  ─────────────────  ──────────────────────────────
Web POS         Browser            Desktop POS in browser
PWA POS         PWA + Service      Tablet/handheld POS
                Worker             with offline support
Desktop POS     Electron           Full-featured POS with
                                   printer + scanner + cash drawer
Mobile POS      Capacitor (iOS/    On-the-go ordering,
                 Android)          inventory scanning
KDS Display     Browser (full-     Kitchen Display Screen
                screen)            (read-only)
Customer        Tablet/iPad        Customer self-service
Display                               (order status, promotions)
```

### 4.2 Device Registration Flow

```
                  DEVICE REGISTRATION
                  ════════════════════

Tenant Admin goes to Settings → Devices
         │
         ▼
  "Register New Device"
         │
         ▼
  Server generates:
    • deviceId (dev_{nanoid})
    • deviceSecret (256-bit random token)
    • registration QR code (encoded: { tenantId, deviceId, secret, apiUrl })
         │
         ▼
  Admin assigns:
    • Device name (e.g., "Kasir 1")
    • Device type (web|pwa|desktop|mobile|kds|customer_display)
    • Location (e.g., "Lantai 1")
    • Allowed features (pos|inventory|reporting|settings)
    • Max offline duration (hours)
         │
         ▼
  Server stores:
    • Device record (see schema below)
    • Hashed secret (never stored in plaintext)
         │
         ▼
  Device is activated:
    • PWA: Scan QR → store in localStorage
    • Desktop: Scan QR → store in electron-store
    • Mobile: Scan QR → store in secure storage
         │
         ▼
  First connection:
    • Device sends: { deviceId, signature(deviceSecret + nonce) }
    • Server validates signature
    • Server issues device JWT (short-lived, 24h)
    • Device stores JWT for API calls
```

### 4.3 Device Schema

```javascript
SERVER-SIDE DEVICE RECORD:
──────────────────────────
{
  _id: "dev_" + nanoid,
  tenantId: "tnt_abc123",

  // Identity
  name: "Kasir 1",
  type: "desktop" | "web" | "pwa" | "mobile" | "kds" | "customer_display",
  model: "Dell Optiplex 3080",     // optional
  os: "Windows 11",
  browser: "Chrome 120",
  appVersion: "1.2.0",

  // Auth
  deviceSecretHash: "$2b...",      // bcrypt hash of device secret
  isActive: true,

  // Status
  status: "registered" | "active" | "inactive" | "suspended",
  lastHeartbeatAt: ISODate(...),
  lastIpAddress: "192.168.1.100",
  lastSyncAt: ISODate(...),

  // Capabilities
  features: ["pos", "receipt_print"],
  maxOfflineHours: 24,
  hasPrinter: true,
  hasScanner: true,
  hasCashDrawer: true,

  // Location
  location: "Lantai 1 - Kasir Utama",
  metadata: {},

  // Current session
  currentShiftId: "sft_001" | null,
  currentRegisterId: "reg_001" | null,
  cashierId: "usr_456" | null,       // currently logged in user

  createdAt: ISODate(...),
  updatedAt: ISODate(...)
}

CLIENT-SIDE DEVICE STORE:
─────────────────────────
{
  tenantId: "tnt_abc123",
  deviceId: "dev_abc123",
  deviceSecret: "encrypted-on-device",
  deviceJwt: "eyJ...",              // short-lived token
  registeredAt: ISODate(...),
  apiUrl: "https://api.posmono.app"
}
```

### 4.4 Device Authentication

```
DEVICE AUTH FLOW:
─────────────────

  Every API request includes device JWT:
    Header: Authorization: Bearer {userJwt}
    Header: X-Device-Id: dev_abc123
    Header: X-Device-Token: {deviceJwt}

  DEVICE JWT PAYLOAD:
  {
    sub: "dev_abc123",
    tenant: "tnt_abc123",
    type: "desktop",
    iat: 1719731400,
    exp: 1719817800       // 24h expiry
  }

  DEVICE TOKEN REFRESH:
  ─────────────────────
  Before expiry, device calls:
    POST /api/devices/refresh-token
    Body: { deviceId, signature(nonce + deviceSecret) }
    Response: { deviceJwt: "eyJ..." }

  DEVICE SUSPENSION:
  ─────────────────
  Admin can suspend a device:
    • Immediately invalidates all device tokens
    • Blacklisted in Redis: device_blacklist:{deviceId}
    • Checked in middleware before every request
```

### 4.5 Device Heartbeat

```
HEARTBEAT PROTOCOL:
───────────────────

  Every 30 seconds (while app is foreground):
    POST /api/devices/{deviceId}/heartbeat
    Body: {
      timestamp: ISODate(...),
      status: "active" | "idle",
      currentUserId: "usr_456" | null,
      currentShiftId: "sft_001",
      batteryLevel: 85,           // mobile only
      memoryUsage: 45,            // percentage
      cpuUsage: 23,
      networkStatus: "online" | "offline",
      lastSyncAt: ISODate(...),
      pendingSyncCount: 3          // offline queue size
    }

  Server response:
    { status: "ok", commands: [...] }

  Server-side detection:
    • Missed 3 heartbeats → status: "inactive"
    • Missed 10 heartbeats → push notification to admin
    • Device inactive > maxOfflineHours → auto-suspend
```

### 4.6 Device Commands (Server → Device)

Server can send commands to devices via heartbeat response or WebSocket:

```
COMMAND                     PAYLOAD                             ACTION
──────────────────  ────────────────────────────────  ──────────────────────
force_sync          {}                                  Trigger immediate sync
lock_device         { reason: "suspended" }             Lock POS screen
show_notification   { title, message, type }            Display notification
update_available    { version, downloadUrl }            Trigger app update
clear_cache         {}                                  Clear local data
log_out_user        { userId }                          Force logout user
ping                {}                                  Respond with pong
reconfigure         { config }                          Update local config
```

### 4.7 Device Limit Per Tenant

```
TIER-BASED DEVICE LIMITS:
─────────────────────────

  PLAN            MAX DEVICES      MAX KDS       SUPPORT
  ────────────  ───────────────  ───────────  ─────────────────
  Starter           2              1            Web only
  Pro               5              3            + PWA + Mobile
  Premium           15             10           + Desktop + API
  Enterprise        Unlimited      Unlimited    All features

  ENFORCEMENT:
  ────────────
  • Checked during device registration
  • Checked during device activation
  • Cannot register if limit reached
  • Admin can deactivate old devices to free slots
```

### 4.8 Device Architecture — Key Decisions

```
DECISION                        CHOICE                      WHY
────────────────────────  ────────────────────────  ──────────────────────────────
Device identity          Unique deviceId per         Track per-device activity,
                          installation                revoke compromised devices
Device auth              Shared secret (scrambled)   No user interaction needed,
                          + short-lived JWT           automatic re-authentication
Heartbeat                30s interval                Balance between freshness
                                                     and bandwidth
Commands via heartbeat   Response body               No persistent connection
                                                     needed (works for PWA)
Offline limit            Configurable per device     Admin decides risk tolerance
Device suspension        Immediate + blacklist       Critical for security
```

---

## 5. Printer Architecture

### 5.1 Printer Types

```
PRINTER TYPE            INTERFACE           PROTOCOL            USE CASE
──────────────────  ─────────────────  ─────────────────  ─────────────────────
Thermal receipt      USB, LAN, BT       ESC/POS            Receipt, kitchen ticket
Kitchen printer      LAN, USB           ESC/POS            Kitchen orders
Invoice printer      LAN, USB           ESC/POS, PCL       A4 invoice
Label printer        USB, BT            ZPL, EPL           Barcode, price labels
Cash drawer          USB (printer       Epson standard      Cash drawer control
                     passthrough)
Customer display     USB, LAN           CD5220, ESC/POS    Customer-facing display
```

### 5.2 Architecture Overview

```
                    PRINTER ARCHITECTURE
                    ════════════════════

┌────────────────────────────────────────────────────────────────────┐
│                        DEVICE LAYER                                 │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                    PRINT AGENT                               │   │
│  │                                                              │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐           │   │
│  │  │  Web Print  │  │  Electron   │  │  Capacitor  │           │   │
│  │  │  (Browser)  │  │  Main Proc  │  │  Native     │           │   │
│  │  └──────┬─────┘  └──────┬─────┘  └──────┬──────┘           │   │
│  │         │               │               │                    │   │
│  │         ▼               ▼               ▼                    │   │
│  │  ┌────────────────────────────────────────────────────┐     │   │
│  │  │              Print Queue Manager                    │     │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐           │     │   │
│  │  │  │  Receipt  │ │ Kitchen  │ │  Label   │           │     │   │
│  │  │  │  Queue    │ │  Queue   │ │  Queue   │           │     │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘           │     │   │
│  │  └────────────────────────────────────────────────────┘     │   │
│  │                                                              │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐           │   │
│  │  │  USB       │  │  LAN/      │  │  Bluetooth │           │   │
│  │  │  Printer   │  │  Network   │  │  Printer   │           │   │
│  │  │  Driver    │  │  Printer   │  │  Driver    │           │   │
│  │  └────────────┘  └────────────┘  └────────────┘           │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
         │                          │
         │ (if local agent fails)   │ (preferred for network printers)
         ▼                          ▼
┌────────────────────────────────────────────────────────────────────┐
│                        SERVER LAYER                                 │
│                                                                    │
│  Print Job API ───► BullMQ Print Queue ───► Printer Workers       │
│         │                                                            │
│         ▼                                                            │
│  Template Renderer (server-side rendering of receipts)               │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────────┐  ┌──────────────────┐                       │
│  │  Receipt          │  │  Kitchen Ticket   │                       │
│  │  Template         │  │  Template         │                       │
│  │  (HTML→PDF→ESC/POS)│  │ (ESC/POS direct) │                       │
│  └──────────────────┘  └──────────────────┘                       │
└────────────────────────────────────────────────────────────────────┘
```

### 5.3 Print Strategy by Platform

```
WEB (PWA / Browser):
────────────────────
  Print via:
    • window.print() for simple receipts (POS-58/80)
    • Browser print dialog for invoices
    • WebUSB API for USB thermal printers (Chrome)
    • Web Bluetooth API for BT printers (Chrome)
    • Network printer via HTTP (if printer supports)
  Limitations:
    • No direct ESC/POS control
    • No cash drawer control
    • Browser print dialog appears (UX friction)
  Recommendation:
    • Use for receipt preview + fallback
    • ESC/POS via WebUSB if available

ELECTRON (Desktop):
───────────────────
  Print via:
    • Native Node.js modules (node-escpos, thermal-printer)
    • Direct USB/LAN connection to printer
    • Electron's printer API (webContents.print())
    • Child process for ESC/POS commands
  Advantages:
    • Full ESC/POS support
    • Cash drawer control
    • No browser print dialog
    • Multiple printer management
    • Offline print queue
  Recommendation:
    • PRIMARY print solution for serious POS
    • Local print agent handles all printer types

CAPACITOR (Mobile):
───────────────────
  Print via:
    • Capacitor printer plugin (thermal)
    • Bluetooth printer (ESC/POS via Capacitor BLE)
    • Android Print Service
  Limitations:
    • Limited to Bluetooth + network printers
    • USB requires OTG + specific plugins
  Recommendation:
    • Best effort via Bluetooth
    • Fall back to server-side print queue
```

### 5.4 Print Job Flow

```
                     PRINT JOB LIFECYCLE
                     ════════════════════

1. EVENT TRIGGER:
    pos.receipt.generated  →  Start print job
    restaurant.order.sent_to_kitchen  →  Print kitchen ticket

2. TEMPLATE SELECTION:
    ┌────────────────┐
    │ ReceiptTemplate │  ─── 58mm thermal receipt
    │ KitchenTicket   │  ─── 80mm kitchen order
    │ InvoiceTemplate │  ─── A4 invoice
    │ LabelTemplate   │  ─── Barcode/label
    │ ReportTemplate  │  ─── Sales report
    └────────────────┘

3. TEMPLATE RENDERING:
    Template variables:
    {
      tenant: { name, address, phone, taxId },
      order: { number, items, totals, payments },
      customer: { name, phone },
      cashier: { name },
      timestamp: ISODate(...)
    }

4. FORMAT CONVERSION:
    HTML Template
      → PDF (for A4/label)
      → ESC/POS binary (for thermal)
      → ZPL (for label printers)
      → Plain text (for dot matrix)

5. ROUTING:
    Determine target printer:
      Local device → send to local print agent
      Network printer → send directly via IP/port
      Server queue → send to BullMQ for server-side printing

6. PRINT EXECUTION:
    • Send to printer via appropriate driver
    • Handle printer errors:
      - Printer offline → retry 3x, then queue
      - Paper jam → notify user
      - Out of paper → pause queue
    • Mark job as completed

7. CONFIRMATION:
    • Mark print job status: "sent" | "failed"
    • Record in printer_jobs collection
    • Publish event: printer.job.completed
```

### 5.5 ESC/POS Template System

```
TEMPLATE ENGINE:
────────────────

Templates are stored in the database per tenant (with platform defaults):

{
  _id: "tpl_" + nanoid,
  tenantId: "tnt_abc123",
  type: "receipt" | "kitchen" | "invoice" | "label" | "report",
  name: "Receipt 58mm Default",
  width: "58mm" | "80mm" | "A4" | "label",
  isDefault: true,
  content: {
    header: "{{tenant.name}}\n{{tenant.address}}\nTelp: {{tenant.phone}}\n",
    items: "{{#items}}{{quantity}}x {{name}} @ {{price}}\n{{/items}}",
    totals: "Subtotal: {{subtotal}}\nTax: {{tax}}\nTOTAL: {{total}}",
    footer: "Terima Kasih\n{{timestamp}}",
    styles: {
      font: "font_a" | "font_b",
      bold: bool,
      alignment: "left" | "center" | "right",
      doubleHeight: bool,
      doubleWidth: bool
    }
  },
  variables: {
    printerWidth: 32,           // char width
    charset: "cp437" | "iso8859_1"
  },
  isActive: true,
  createdAt: ISODate(...),
  updatedAt: ISODate(...)
}

SERVER-SIDE RENDERER:
─────────────────────

RenderTemplate(template, data) → Buffer (ESC/POS binary):
  1. Parse template with Mustache/Handlebars
  2. Convert plain text to ESC/POS commands:
     - Line feed
     - Cut paper (GS V m)
     - Open cash drawer (ESC p m t1 t2)
     - Barcode (GS k m n d1...dn)
     - QR code (GS (k pL pH cn fn)
  3. Return Buffer ready to send to printer
```

### 5.6 Printer Configuration (Admin Settings)

```javascript
{
  _id: "prn_" + nanoid,
  tenantId: "tnt_abc123",
  name: "Receipt Printer",
  type: "thermal" | "inkjet" | "label" | "kitchen",
  interface: "usb" | "lan" | "bluetooth" | "server",
  connection: {
    // For LAN printers:
    ipAddress: "192.168.1.100",
    port: 9100,                     // default ESC/POS port
    // For USB printers (Electron):
    vendorId: "0x04b8",
    productId: "0x0202",
    // For Bluetooth printers (Capacitor):
    macAddress: "00:11:22:33:44:55",
    // For server-side print (network printer at server location):
    serverPrintUrl: "http://print-server:9100"
  },
  settings: {
    width: "58mm",
    charactersPerLine: 32,
    charset: "cp437",
    cutPaper: true,
    openCashDrawer: true,
    numCopies: 1
  },
  templates: {
    receipt: "tpl_receipt_default",
    kitchen: "tpl_kitchen_default"
  },
  isDefault: false,
  isActive: true,
  assignedTo: ["register_001", "register_002"],  // which registers use this printer
  createdAt: ISODate(...),
  updatedAt: ISODate(...)
}
```

### 5.7 Kitchen Printer — Future Restaurant Module

```
KITCHEN PRINT FLOW:
───────────────────

  Waiter creates order on POS
         │
         ▼
  Order sent to kitchen
         │
         ▼
  Print job created:
    • Template: KitchenTicket
    • Content: table number, order items, modifiers,
               special instructions, order time
    • Priority: normal (vs urgent for long-waiting orders)
         │
         ▼
  Route to kitchen printer:
    • If LAN printer → send directly via socket
    • If USB printer (Electron) → local print queue
    • If KDS (screen) → display on Kitchen Display Screen
         │
         ▼
  Kitchen staff:
    • Receives printed ticket
    • Prepares order
    • Presses "Order Ready" on KDS or POS
         │
         ▼
  Waiter notified via Socket.IO + optional buzzer/watch

  KITCHEN PRINTER GROUPING:
  ─────────────────────────
  • "Bar Printer" → drinks only
  • "Kitchen Printer" → food only
  • "Expediter Printer" → completed orders for serving
  Items routed by product.metadata.kitchenCategory
```

### 5.8 Print Queue Reliability

```
RETRY POLICY:
────────────

  Attempt 1: Immediate
  Attempt 2: 5 seconds  (printer may be recovering)
  Attempt 3: 30 seconds
  Attempt 4: 5 minutes
  Attempt 5: 30 minutes
  After 5 failures → Mark as PERMANENTLY_FAILED
  → Notify admin: "Printer XYZ has not responded. Check connection."

PRINTER HEALTH CHECKS:
─────────────────────

  Every 60 seconds:
    1. Send status query to printer (ESC/POS DLE EOT)
    2. Expected response: printer status byte
    3. If no response → mark printer as offline
    4. Notify admin if printer was "active" just before

OFFLINE PRINTER HANDLING:
─────────────────────────

  If printer is offline when print job fires:
    1. Store job in local queue
    2. Show notification: "Receipt queued — printer offline"
    3. When printer comes back online:
       a. Print all queued jobs (in order)
       b. Show confirmation: "Queued receipts printed"
    4. If queue exceeds 20 jobs:
       a. Force re-routing to backup printer
       b. If no backup → save as PDF for later printing
```

### 5.9 Printer Architecture — Key Decisions

```
DECISION                        CHOICE                      WHY
────────────────────────  ────────────────────────  ──────────────────────────────
Primary print agent       Electron main process         Full ESC/POS, cash drawer,
                                                       multi-printer, offline queue
Browser fallback          WebUSB + Web Bluetooth        No install for casual users
                          + window.print()
Server-side print         BullMQ queue + worker         For network printers at
                                                       server location
Template engine           Server-side Mustache render   Consistent output across
                          → ESC/POS binary               all devices, one template
Print format              ESC/POS for thermal,          Industry standard for POS
                          PDF for A4
Print queue               BullMQ (server) +             Server handles network,
                          LocalForage (client)           client handles local
Printer discovery         Manual configuration          Network printer discovery
                          (IP/hostname)                  is unreliable; manual is
                                                         safer for production
Cash drawer               ESC/POS via printer           Standard passthrough
                          passthrough port               mechanism
```

---

## 6. Data Consistency Strategy

### 6.1 Consistency Requirements by Operation

```
OPERATION                       CONSISTENCY LEVEL       PATTERN
──────────────────────────  ───────────────────────  ──────────────────────
Create order → Reserve      Strong (within same      Choreography +
  stock                       request)                 compensation
Payment → Update order      Strong                  Webhook handler +
                                                        idempotency
Payment → Deduct stock      Eventual                Outbox + retry
Payment → Update reporting  Eventual                Outbox + retry
Payment → Send receipt      Eventual (at least      Queue + retry
                              once)
Sync offline order          Eventual                Version conflict check
Update product              Strong                  Direct write
Update inventory            Strong (optimistic       Version + CAS
                              lock)
Cross-context reads         Eventual (stale OK)     Cached with TTL
```

### 6.2 Patterns Used

```
PATTERN 1: OUTBOX PATTERN
───────────────────────────

  PROBLEM: Payment succeeded BUT inventory update failed.
           Receipt not sent. Reporting not updated.

  SOLUTION:
  ┌─────────────────────────────────────────────────────────────┐
  │                     OUTBOX PATTERN                           │
  │                                                              │
  │  1. Payment handler receives webhook                         │
  │  2. In a SINGLE atomic operation:                            │
  │     a. Update payment document (status: completed)           │
  │     b. Update order document (status: paid)                  │
  │     c. INSERT into outbox collection:                        │
  │        { event: "payment.completed",                         │
  │          payload: { orderId, amount },                       │
  │          status: "pending",                                  │
  │          createdAt: Date }                                   │
  │                                                              │
  │  3. Outbox worker (BullMQ) picks up pending events:          │
  │     a. Deduct stock (Inventory context)                      │
  │     b. Update reporting (Reporting context)                  │
  │     c. Send receipt (Notification context)                   │
  │                                                              │
  │  4. Each handler runs independently with retry:              │
  │     a. Success → mark outbox item as "completed"             │
  │     b. Failure → retry with exponential backoff              │
  │     c. Max retries → move to dead letter queue              │
  │                                                              │
  │  5. Idempotency: each handler checks if already processed    │
  └─────────────────────────────────────────────────────────────┘

  Why outbox instead of direct event publish?
  → If the process crashes AFTER publishing event but BEFORE
    the database write completes, you lose the event.
  → Outbox guarantees: event is only published if DB write
    succeeded (same transaction).

PATTERN 2: SAGA PATTERN (Choreography)
────────────────────────────────────────

  PROBLEM: Long-running business transaction across contexts.

  SOLUTION:
  ┌─────────────────────────────────────────────────────────────┐
  │                     SAGA (choreography)                      │
  │                                                              │
  │  Each context publishes events. Other contexts subscribe.    │
  │  If a step fails, the subscriber publishes a compensation    │
  │  event.                                                      │
  │                                                              │
  │  Example: Payment succeeds, inventory deduction fails:       │
  │                                                              │
  │  1. Payment context: payment.completed → published           │
  │  2. Inventory context: receives event                        │
  │  3. Inventory context: tries to deduct stock                 │
  │  4. Inventory context: STOCK DEDUCTION FAILS                 │
  │     (e.g., stock already depleted by concurrent order)       │
  │  5. Inventory context: publishes inventory.deduction_failed  │
  │     with { orderId, reason }                                 │
  │  6. Payment context: receives inventory.deduction_failed     │
  │  7. Payment context: initiates REFUND (compensation)         │
  │  8. Payment context: publishes payment.refunded              │
  │  9. Ordering context: sets order status to "refunded"        │
  └─────────────────────────────────────────────────────────────┘

PATTERN 3: DEAD LETTER QUEUE
──────────────────────────────

  PROBLEM: An event handler keeps failing (e.g., email provider down).

  SOLUTION:
  ┌─────────────────────────────────────────────────────────────┐
  │                     DEAD LETTER QUEUE                        │
  │                                                              │
  │  BullMQ configuration:                                      │
  │    maxAttempts: 5                                            │
  │    backoff: { type: "exponential", delay: 1000 }            │
  │    removeOnComplete: true                                    │
  │    removeOnFail: false                                       │
  │                                                              │
  │  After 5 failures:                                          │
  │    • Job moved to dead letter queue                         │
  │    • Admin alerted via notification                         │
  │    • Job stored in MongoDB for manual inspection            │
  │    • Admin can:                                             │
  │      - Retry the job                                        │
  │      - Skip the job (mark as resolved)                      │
  │      - Inspect error logs                                   │
  │                                                              │
  │  Monitoring:                                                │
  │    • Dead letter queue count on dashboard                   │
  │    • Alert if > 5 jobs in DLQ in 1 hour                     │
  │    • Weekly DLQ cleanup for resolved jobs                   │
  └─────────────────────────────────────────────────────────────┘
```

### 6.3 Outbox Collection Schema

```javascript
OUTBOX_COLLECTION:
──────────────────

{
  _id: "out_" + nanoid,
  tenantId: "tnt_abc123",

  // Event identity
  eventName: "payment.completed.deduct_stock",
  aggregateType: "Payment",
  aggregateId: "pay_abc123",

  // Correlation
  correlationId: "corr_xyz",
  causationId: "evt_parent",

  // Payload
  payload: {
    orderId: "ord_abc123",
    items: [{ productId: "prd_001", quantity: 2 }],
    amount: 50000
  },

  // Processing
  status: "pending" | "processing" | "completed" | "failed",
  attemptCount: 0,
  maxAttempts: 5,
  lastError: null | string,
  lastErrorAt: null | Date,
  scheduledAt: Date,               // for delayed retry
  processedAt: null | Date,

  // Metadata
  source: "payment_webhook",
  createdAt: Date,
  updatedAt: Date
}

Indexes:
  { status: 1, scheduledAt: 1 }           // worker picks next job
  { correlationId: 1 }                    // trace entire flow
  { aggregateType: 1, aggregateId: 1 }    // prevent duplicate
```

### 6.4 Transactional Boundaries

```
EACH CONTEXT OWNS ITS OWN DATA. NEVER CROSS-CONTEXT WRITES.

┌─────────────────────────────────────────────────────────────────┐
│                    TRANSACTION BOUNDARIES                         │
│                                                                  │
│  CONTEXT: PAYMENT                   CONTEXT: INVENTORY           │
│  ┌────────────────────────────┐    ┌────────────────────────┐   │
│  │  payments collection       │    │  inventory_items        │   │
│  │  transactions collection   │    │  stock_movements       │   │
│  │                            │    │                        │   │
│  │  WRITE: Payment context    │    │  WRITE: Inventory       │   │
│  │  only writes to these      │    │  context only writes   │   │
│  │  collections.              │    │  to these collections. │   │
│  └────────────────────────────┘    └────────────────────────┘   │
│                                                                  │
│  CONTEXT: ORDERING                  CONTEXT: REPORTING           │
│  ┌────────────────────────────┐    ┌────────────────────────┐   │
│  │  orders collection         │    │  daily_metrics         │   │
│  │  order_items collection    │    │  reports_cache         │   │
│  │  order_status_history      │    │                        │   │
│  └────────────────────────────┘    └────────────────────────┘   │
│                                                                  │
│  INTER-CONTEXT COMMUNICATION:                                    │
│  ────────────────────────────                                    │
│  • Write to own collections only                                 │
│  • Read from other contexts via QUERY (API call)                 │
│  • Coordinate via EVENTS (publish → subscribe)                   │
│  • If you need to write to another context's data:              │
│    → You DON'T. Send an event instead.                           │
└─────────────────────────────────────────────────────────────────┘
```

### 6.5 Failure Scenarios — Complete Map

```
SCENARIO                    IMPACT                  RECOVERY
────────────────────  ───────────────────────  ──────────────────────────────
Payment succeeds,     Inventory inconsistent    Outbox retry → compensate by
inventory update                               auto-refund if unrecoverable
fails
Payment succeeds,     Order stuck in "paid"    Outbox retry → mark order as
order update fails                             paid on retry
Payment succeeds,     Receipt not sent          Outbox retry → re-send
notification fails
Stock reserved,       Order cancelled, stock    Sagas → release stock
payment fails         stuck in reserved
Offline order sync    Duplicate order            Idempotency key prevents
fails                                            duplicate
Midtrans webhook      Payment not processed     Webhook retry by Midtrans
delayed (>5 min)                                + pull status periodically
Database connection   All requests fail         Circuit breaker → offline
lost for 30s                                    mode
Redis down            Cache misses, queues      Fallback to in-memory
                    unavailable                 queues, degrade gracefully
BullMQ worker crash   Queued jobs not           Supervisor auto-restarts
                    processing                  → jobs picked up on restart
```

### 6.6 Consistency Guarantees

```
GUARANTEE                   LEVEL                       IMPLEMENTATION
──────────────────  ────────────────────────  ─────────────────────────────────
Order creation       Strong consistency         Single DB write with validation
Payment processing   Strong (with gateway)       Webhook validation + idempotency
Inventory update     Eventual (with retry)       Outbox → retry → DLQ
Reporting update     Eventual (batch OK)         Outbox → batch write
Notification send    At-least-once               Queue → retry → idempotency
Cross-context reads  Read-your-writes            Same request → same DB read
Offline sync         Eventual (convergent)       Version check → conflict resolve
```

### 6.7 Data Consistency — Key Decisions

```
DECISION                        CHOICE                      WHY
────────────────────────  ────────────────────────  ──────────────────────────────
Cross-context writes      NEVER direct               Enforces DDD boundaries,
                                                    prevents tight coupling
Consistency model         Strong within context,     Pragmatic: strong where
                          eventual between contexts   money is involved, eventual
                                                      elsewhere
Outbox storage            MongoDB (same DB as         Part of existing transaction,
                          aggregate)                  no external dependency
Queue system             BullMQ (Redis)               Persistent, delayed retry,
                                                      rate limiting, DLQ
Retry backoff            Exponential: 1s, 5s, 30s,    Don't hammer failing
                          5m, 30m                     service
DLQ alert threshold      5 jobs in 1 hour             Early warning for systemic
                                                      issues
Manual intervention      Admin dashboard for DLQ      Non-technical admin can
                                                    retry/resolve jobs
```

---

## 7. Plugin Runtime Architecture

### 7.1 Philosophy

The plugin system enables business-type modules (Restaurant, Hospitality, Retail) to extend the core platform without modifying core code. This is NOT a general-purpose plugin system — it's a domain extension system.

```
PLUGIN PRINCIPLES:
──────────────────
  1. Modules register themselves via declarative manifests
  2. Modules CAN extend but NEVER modify core behavior
  3. Modules are tenant-gated (feature flags per tenant)
  4. Modules follow same DDD structure as core
  5. Modules communicate only via events (never direct imports)
  6. Modules can be enabled/disabled at runtime (with data retention)
```

### 7.2 Module Manifest System

```javascript
// modules/restaurant/manifest.ts
export const manifest: ModuleManifest = {
  // Identity
  id: "restaurant",
  name: "Restaurant Operations",
  version: "1.0.0",
  description: "Table management, kitchen display, waiter workflow, split bill",
  businessTypes: ["restaurant", "mixed"],

  // Dependencies on core bounded contexts
  dependencies: {
    core: ["ordering", "inventory", "pos", "payment", "catalog"],
    modules: []                    // modules cannot depend on other modules
  },

  // Extension points
  extends: {
    // Extend order schema with restaurant-specific fields
    entities: {
      "ordering.order": {
        fields: ["tableId", "waiterId", "guestCount", "diningOption"],
        events: ["restaurant.order.sent_to_kitchen"]
      },
      "pos.register": {
        fields: ["restaurantSettings.kdsEnabled"]
      }
    },

    // Provide new domain entities
    aggregates: [
      "DiningTable",
      "FloorPlan",
      "KitchenOrder",
      "SplitBill",
      "WaiterSession"
    ],

    // Provide new collections
    collections: [
      "restaurant_tables",
      "restaurant_floor_plans",
      "restaurant_reservations",
      "restaurant_kitchen_orders",
      "restaurant_split_bills",
      "restaurant_printer_jobs"
    ]
  },

  // Event subscriptions
  subscribesTo: [
    "ordering.order.created",
    "ordering.order.cancelled",
    "payment.transaction.completed"
  ],

  // Event publications
  publishes: [
    "restaurant.table.occupied",
    "restaurant.table.freed",
    "restaurant.order.sent_to_kitchen",
    "restaurant.order.ready",
    "restaurant.order.served",
    "restaurant.split_bill.created",
    "restaurant.printer.job.sent"
  ],

  // Routes registered
  routes: {
    api: [
      { path: "/api/restaurant/tables", method: "GET", handler: "listTables" },
      { path: "/api/restaurant/tables/:id", method: "PUT", handler: "updateTable" },
      { path: "/api/restaurant/kitchen-orders", method: "GET", handler: "listKitchenOrders" },
      { path: "/api/restaurant/split-bills", method: "POST", handler: "createSplitBill" }
    ],
    socket: [
      { event: "restaurant:table:update", handler: "handleTableUpdate" },
      { event: "restaurant:kitchen:status", handler: "handleKitchenStatus" }
    ]
  },

  // Permissions added
  permissions: [
    "restaurant.tables.read",
    "restaurant.tables.manage",
    "restaurant.floor_plan.manage",
    "restaurant.kitchen.view",
    "restaurant.kitchen.update_status",
    "restaurant.reservations.read",
    "restaurant.reservations.create",
    "restaurant.reservations.manage",
    "restaurant.split_bill.create",
    "restaurant.split_bill.close",
    "restaurant.menu.manage"
  ],

  // Settings registered
  settings: [
    { key: "restaurant.kdsEnabled", type: "boolean", default: true },
    { key: "restaurant.defaultPrinter", type: "string", default: "" },
    { key: "restaurant.autoSendToKitchen", type: "boolean", default: true }
  ],

  // UI extensions
  ui: {
    pos: {
      components: [
        { slot: "pos.header.actions", component: "TableSelector" },
        { slot: "pos.payment.options", component: "SplitBillButton" },
        { slot: "pos.order.sidebar", component: "TableInfoPanel" }
      ],
      pages: [
        { path: "/restaurant/floor-plan", component: "FloorPlanPage" },
        { path: "/restaurant/kitchen-display", component: "KitchenDisplayPage" },
        { path: "/restaurant/waiter-order", component: "WaiterOrderPage" }
      ]
    },
    settings: {
      pages: [
        { path: "/settings/restaurant", component: "RestaurantSettingsPage" }
      ]
    }
  },

  // Lifecycle hooks
  hooks: {
    onActivate: "handleModuleActivate",     // called when tenant enables module
    onDeactivate: "handleModuleDeactivate", // called when tenant disables
    onTenantSeed: "handleTenantSeed"        // called when tenant is created
  },

  // Seed data
  seedData: {
    settings: [
      { key: "restaurant.kdsEnabled", value: true },
      { key: "restaurant.autoSendToKitchen", value: true }
    ],
    sampleData: {
      tables: [
        { tableNumber: 1, capacity: 2, section: "Indoor" },
        { tableNumber: 2, capacity: 4, section: "Indoor" },
        { tableNumber: 3, capacity: 6, section: "Outdoor" }
      ]
    }
  }
};
```

### 7.3 Module Loader — Server Side

```
MODULE LOADER FLOW:
───────────────────

  Application startup:
  1. Scan modules directory for all index.ts files
  2. Load each module's manifest
  3. Validate:
     a. No circular dependencies between modules
     b. All core dependencies exist
     c. No duplicate event subscriptions
     d. No conflicting route paths
  4. Register modules in module registry (in-memory)

  Per-request middleware (tenantContext):
  1. Resolve tenant ID
  2. Fetch tenant's enabled modules (from tenant config)
  3. Filter module registry to only enabled modules
  4. Attach to req.enabledModules

  Route registration:
  1. For each enabled module:
     a. Register API routes (prefixed with module name)
     b. Register Socket.IO event handlers
     c. Register event bus subscriptions
     d. Register settings schema
  2. Routes are registered AFTER core routes
  3. Module routes can be prefixed: /api/restaurant/...

  Event subscription:
  1. Module handlers subscribe to core events
  2. Core NEVER knows about modules
  3. If module is disabled for tenant, its handlers are NOT registered
```

```javascript
// bootstrap/moduleLoader.ts (pseudocode)

class ModuleRegistry {
  private modules: Map<string, ModuleManifest> = new Map();
  private activeHandlers: Map<string, Function[]> = new Map();

  scanModules(): void {
    const moduleDirs = fs.readdirSync("src/modules");
    for (const dir of moduleDirs) {
      const manifest = require(`../modules/${dir}/manifest`).manifest;
      this.validateManifest(manifest);
      this.modules.set(manifest.id, manifest);
    }
  }

  activateForTenant(tenantId: string, enabledModules: string[]): void {
    for (const moduleId of enabledModules) {
      const manifest = this.modules.get(moduleId);
      if (!manifest) continue;

      // Register routes
      for (const route of manifest.routes.api) {
        router[route.method.toLowerCase()](
          route.path,
          tenantMiddleware(tenantId),
          moduleMiddleware(moduleId),
          routeHandler
        );
      }

      // Subscribe to events
      for (const eventName of manifest.subscribesTo) {
        eventBus.subscribe(eventName, (event) => {
          if (event.tenantId === tenantId) {
            moduleEventHandler(event);
          }
        });
      }
    }
  }

  private validateManifest(manifest: ModuleManifest): void {
    // 1. Core dependencies exist
    for (const dep of manifest.dependencies.core) {
      if (!boundedContexts.has(dep)) {
        throw new Error(`Module ${manifest.id} depends on missing core context: ${dep}`);
      }
    }

    // 2. No module-to-module dependencies
    if (manifest.dependencies.modules.length > 0) {
      throw new Error(`Module ${manifest.id} depends on another module. NOT ALLOWED.`);
    }

    // 3. No duplicate routes across modules
    // (checked during registration)
  }
}
```

### 7.4 Module Lifecycle

```
MODULE LIFECYCLE:
─────────────────

  DEVELOP ──► Build module with manifest
    │
    ▼
  DEPLOY ──► Module code deployed as part of the monolith
    │         (or as separate npm package in monorepo)
    │
    ▼
  REGISTER ──► System discovers module on startup
    │
    ▼
  ENABLE ──► Tenant admin enables module in settings
    │         • Routes registered for that tenant
    │         • Event handlers subscribed
    │         • Database migrations run (if needed)
    │         • Seed data created
    │         • onActivate hook called
    │
    ▼
  ACTIVE ──► Module is fully operational for tenant
    │
    ├──► DISABLE ──► Tenant admin disables module
    │                 • Routes unregistered for tenant
    │                 • Event handlers unsubscribed
    │                 • Data RETAINED (can re-enable)
    │                 • onDeactivate hook called
    │
    └──► REMOVE ──► Admin removes module permanently
                      • Data cleanup (optional)
                      • onDeactivate + cleanup
```

### 7.5 Module Activation Hooks

```javascript
// modules/restaurant/index.ts
export class RestaurantModule {
  constructor(
    private eventBus: EventBus,
    private container: AwilixContainer,
    private logger: Logger
  ) {}

  async onActivate(tenantId: string): Promise<void> {
    // 1. Create default floor plan
    await this.floorPlanRepository.createDefault(tenantId);

    // 2. Create default tables
    await this.tableRepository.createDefaults(tenantId);

    // 3. Set up kitchen printer (if printer configured)
    // 4. Register KDS if enabled
    // 5. Log activation
    this.logger.info("Restaurant module activated", { tenantId });
  }

  async onDeactivate(tenantId: string): Promise<void> {
    // 1. Close all open shifts for restaurant
    // 2. Free all occupied tables
    // 3. Complete pending kitchen orders
    // 4. Log deactivation
    this.logger.info("Restaurant module deactivated", { tenantId });
  }

  async onTenantSeed(tenantId: string): Promise<void> {
    // 1. Create sample tables
    // 2. Create sample floor plan
    // 3. Set default settings
  }
}
```

### 7.6 Module Extending Core Entities

Modules can extend core entities with additional fields. This is done via schema extension:

```javascript
// modules/restaurant/manifest.ts (schema extension portion)
{
  extends: {
    entities: {
      "ordering.order": {
        $extend: {
          tableId: { type: String, default: null, index: true },
          waiterId: { type: String, default: null, index: true },
          guestCount: { type: Number, default: 1 },
          diningOption: { type: String, enum: ["dine-in", "takeaway", "delivery"] }
        }
      }
    }
  }
}

// bootstrap/schemaExtender.ts
class SchemaExtender {
  extendCoreSchemas(moduleManifests: ModuleManifest[]): void {
    for (const manifest of moduleManifests) {
      for (const [entityName, extension] of Object.entries(manifest.extends.entities)) {
        const schema = mongoose.models[entityName]?.schema;
        if (schema) {
          schema.add(extension.$extend);
        }
      }
    }
  }
}
```

### 7.7 Module Isolation Rules

```
RULES:
──────

  DO:
  ✓ Module can read ANY core collection (read-only)
  ✓ Module can subscribe to ANY core event
  ✓ Module can publish its own events
  ✓ Module can add fields to core entities (via schema extension)
  ✓ Module can register its own API routes
  ✓ Module can have its own collections
  ✓ Module can use core services (DI container)
  ✓ Module can register its own settings

  DO NOT:
  ✗ Module CANNOT write to core collections (only its own)
  ✗ Module CANNOT override core behavior
  ✗ Module CANNOT depend on another module
  ✗ Module CANNOT modify core event flow
  ✗ Module CANNOT access another module's collections
  ✗ Module CANNOT bypass tenant context
```

### 7.8 Frontend Module Loading

```
FRONTEND MODULE SYSTEM:
───────────────────────

  Core app shell loads first:
    • Auth, tenant context, layout, navigation

  Module detection:
    • Server returns list of enabled modules for tenant
    • Frontend lazy-loads module bundles
    • Each module has:
      - ModuleRoutes.tsx (route definitions)
      - ModuleStore.ts (Zustand slice)
      - ModuleComponents (exported component map)

  Dynamic route injection:
    • React Router: useRoutes with dynamic route merging
    • Module routes are merged into main router
    • Each module page is wrapped in module guard component

  UI slot system:
    • Core defines "slots" (named component injection points)
    • Modules register components for specific slots
    • Examples:
      - pos.header.actions → TableSelector (restaurant)
      - pos.cart.sidebar → RoomChargesPanel (hospitality)
      - pos.payment.options → SplitBillButton (restaurant)

  Zustand dynamic stores:
    • Core creates store registry
    • Module stores are merged into root store on activation
    • Module store is unmounted when module is disabled

  Example:
  ┌──────────────────────────────────────────────┐
  │              POS LAYOUT                        │
  │  ┌──────────────────────────────────────────┐ │
  │  │  HEADER                                  │ │
  │  │  [POS Title]  [TableSelector*] [Profile] │ │
  │  ├──────────────────────────────────────────┤ │
  │  │  MAIN CONTENT                            │ │
  │  │  ┌──────────┐  ┌───────────────────────┐ │ │
  │  │  │ Products │  │  Cart                 │ │ │
  │  │  │ Grid     │  │  [Items]             │ │ │
  │  │  │          │  │  [Total]             │ │ │
  │  │  │          │  │  [Pay] [Split Bill*] │ │ │
  │  │  └──────────┘  └───────────────────────┘ │ │
  │  └──────────────────────────────────────────┘ │
  │           * = injected by restaurant module   │
  └──────────────────────────────────────────────┘
```

### 7.9 Plugin Architecture — Key Decisions

```
DECISION                        CHOICE                      WHY
────────────────────────  ────────────────────────  ──────────────────────────────
Plugin type               Domain extension modules     Not generic plugins —
                                                    purpose-built for
                                                    business domains
Module manifest           Declarative JSON object       Discoverable, validateable,
                                                        self-documenting
Extension mechanism       Schema extension + events     Core unchanged, modules
                                                        add on top
Dependencies              Core only (never modules)    Prevents circular dependency
                                                        graph complexity
Frontend loading          Dynamic import + slot system  Core bundle stays small,
                                                        modules loaded on demand
State sharing             Zustand registry              Module stores are isolated
                                                        by namespace
Runtime activation        Tenant-gated, hot-reloadable  No deploy needed to enable
                                                        module for tenant
```

---

## 8. Scalability Roadmap

### 8.1 Growth Stages

```
STAGE 1: LAUNCH (1-100 tenants)
──────────────────────────────────
  Architecture: Modular monolith (single process)
  Database:     Single MongoDB replica set
  Queue:        Single Redis instance (BullMQ)
  Cache:        Single Redis instance
  Real-time:    Single Socket.IO server
  Deployment:   1 server (8 vCPU, 32 GB RAM)

  Capacity:
    • 100 tenants × 500 orders/day = 50,000 orders/day
    • MongoDB replica set with 3 nodes
    • Single process handles all contexts

STAGE 2: GROWTH (100-1,000 tenants)
─────────────────────────────────────
  Architecture: Modular monolith (horizontally scaled)
  Database:     MongoDB sharded cluster
  Queue:        Redis cluster (BullMQ)
  Cache:        Redis cluster
  Real-time:    Socket.IO with Redis adapter (horizontal scale)
  Deployment:   2-4 servers behind load balancer

  Changes from Stage 1:
    • Multiple instances of the monolith behind a load balancer
    • File uploads moved to S3-compatible storage
    • Session storage moved to Redis (shared across instances)
    • BullMQ jobs processed by dedicated worker processes
    • MongoDB sharded by tenantId range

STAGE 3: EXPANSION (1,000-10,000 tenants)
───────────────────────────────────────────
  Architecture: Distributed services (some contexts extracted)
  Database:     MongoDB sharded cluster + dedicated per-service DBs
  Queue:        Redis cluster + per-service queues
  Real-time:    Dedicated Socket.IO cluster
  Deployment:   10+ servers, auto-scaling groups

  Changes from Stage 2:
    • Payment context extracted as separate service
    • Notification context extracted as separate service
    • Reporting context extracted as separate service
    • Printer service extracted as separate service
    • Each service can scale independently
    • Event bus becomes Redis-based (redis-smq or similar)

STAGE 4: ENTERPRISE (10,000+ tenants)
───────────────────────────────────────
  Architecture: Full microservices + platform teams
  Database:     Multi-cluster sharded MongoDB
  Queue:        Multi-cluster Redis / Kafka
  Real-time:    Dedicated WebSocket infrastructure
  Deployment:   Kubernetes with auto-scaling
                Dedicated per-region deployments
                Multi-region active-active
```

### 8.2 Extraction Priority

```
FIRST WAVE — High traffic, stable boundaries:
───────────────────────────────────────────────

  1. PAYMENT SERVICE
     Reason:
       • High latency sensitivity (webhook responses)
       • Compliance/PCI requirements
       • Independent scaling needed (peak vs off-peak)
       • Clear bounded context — clean extraction
     Strategy:
       • Extract payment context as standalone Express app
       • Event bus via Redis (same events, different process)
       • Dedicated MongoDB (or same cluster, different DB)
       • Only needs: authentication middleware (shared lib)

  2. NOTIFICATION SERVICE
     Reason:
       • Asynchronous by nature
       • Different reliability requirements (retry, backoff)
       • Can be backed by n8n for complex workflows
       • No real-time dependency on core
     Strategy:
       • Extract as worker process (BullMQ consumer)
       • No HTTP API needed (event-driven only)
       • Can be Node.js or Python (for ML-based notifications)
       • Integrates with n8n for WhatsApp/Email

  3. REPORTING SERVICE
     Reason:
       • Heavy queries affect core performance
       • Different data model (aggregated vs transactional)
       • Can use different tech (MongoDB aggregation vs OLAP)
       • Read-heavy, can be served from read replicas
     Strategy:
       • Materialized view pattern
       • Subscribe to events, build aggregated data
       • Serve dashboard via dedicated API
       • MongoDB aggregation pipeline or ClickHouse for scale

SECOND WAVE — Domain-specific, moderate traffic:
─────────────────────────────────────────────────

  4. PRINTER SERVICE
     Reason:
       • Device-specific protocol handling
       • Queue management per printer
       • Can be deployed close to devices (edge)
     Strategy:
       • WebSocket + BullMQ for print job management
       • Local print agent on devices (Electron)
       • Server-side fallback for network printers

  5. INVENTORY SERVICE
     Reason:
       • High contention (concurrent writes)
       • Needs dedicated optimization (version, CAS)
       • Can be extracted when stock operations become bottleneck
     Strategy:
       • Optimistic locking + version vectors
       • In-memory cache for fast reads (Redis)
       • Event-driven updates to catalog

  6. IDENTITY SERVICE
     Reason:
       • Universal dependency (every request)
       • Can be shared across products
       • SSO, OAuth, social login support
     Strategy:
       • OAuth 2.0 / OpenID Connect
       • JWT-based stateless auth
       • Separate user store (PostgreSQL for relational data)
```

### 8.3 Extraction Strategy — How to Extract

```
EXTRACTION PROCESS:
───────────────────

  PHASE 1 — IDENTIFY (Pre-extraction):
    1. Identify bounded context to extract
    2. Audit all direct dependencies (imports, function calls)
    3. Audit all event subscriptions/publishing
    4. Audit all shared data access
    5. Document the extraction boundary

  PHASE 2 — DECOUPLE (In-monolith preparation):
    1. Replace direct function calls with event-driven calls:
       BEFORE:  inventoryService.reserveStock(order)
       AFTER:   eventBus.publish(new OrderConfirmed(order))
    2. Extract shared code to @shared package:
       • Types, DTOs, validation schemas
       • Event definitions
       • API client (HTTP client for cross-service calls)
    3. Add integration test that works with both in-process
       and out-of-process event bus

  PHASE 3 — EXTRACT (Separate service):
    1. Create new service package in workspace:
       backend/services/payment-service/
    2. Copy domain + application layers (no infrastructure)
    3. Implement new infrastructure layer (new Express app)
    4. Add health check endpoint
    5. Add metrics endpoint
    6. Wire up event bus subscription

  PHASE 4 — MIGRATE (Traffic shift):
    1. Deploy new service alongside monolith
    2. Start in "shadow mode" — both monolith and service process requests
    3. Compare results, fix discrepancies
    4. Switch to "active mode" — service handles all traffic
    5. Remove old code from monolith

  PHASE 5 — OPTIMIZE:
    1. Scale service independently
    2. Optimize for service-specific needs
    3. Add caching, connection pooling, etc.
```

### 8.4 When NOT to Extract

```
SIGNS YOU SHOULD NOT EXTRACT (YET):
────────────────────────────────────

  ❌ Your monolith handles current load fine
     → Don't extract. Premature distribution kills velocity.

  ❌ You have < 5 engineers
     → Microservices need team-per-service model.
       With < 5 people, monolith is faster.

  ❌ The bounded context boundary is unclear
     → If you can't define clear events and data ownership,
       extraction will create distributed ball of mud.

  ❌ Cross-context queries are too frequent
     → If extracted service needs constant lookups from
       other services, latency penalty kills performance.

  ❌ You haven't fixed performance in monolith first
     → Optimize queries, add indexes, use Redis cache first.
       Often fixes the "need to scale" problem.

  ❌ Deployment complexity is not justified
     → Each extracted service adds: CI/CD, monitoring, logging,
       networking, secrets management, error tracking.

RULE OF THUMB:
──────────────
  "Monolith until you feel the pain of monolith, then extract
   one context at a time, only the context that causes pain."
```

### 8.5 Communication Across Services (Post-Extraction)

```
SERVICE COMMUNICATION:
───────────────────────

  SYNCHRONOUS (REST/gRPC):
  ────────────────────────
    Use when: Immediate response required, read-heavy
    Example: Identity → All (validate token)
    Pattern: Request-response with circuit breaker

  ASYNCHRONOUS (Event Bus):
  ─────────────────────────
    Use when: Eventual consistency acceptable
    Example: Payment → Ordering (payment completed)
    Pattern: Event bus (Redis/Kafka) with outbox

  EVENT BUS EVOLUTION:
  ────────────────────
    Stage 1: In-process EventEmitter
    Stage 2: Redis pub/sub (BullMQ events)
    Stage 3: Redis Streams / Kafka

    Migration per service extraction:
      1. Change event bus implementation from in-process
         to Redis pub/sub
      2. Service subscribes to events via Redis
      3. Core publishes to same channel
      4. No code changes in publishers/subscribers
```

### 8.6 Infrastructure Evolution

```
INFRASTRUCTURE BY STAGE:
─────────────────────────

STAGE 1 (1-100 tenants):
  ┌──────────────────────┐
  │  Single Server        │
  │  ┌────────────────┐  │
  │  │  Express App    │  │
  │  │  (all contexts) │  │
  │  └────────────────┘  │
  │  ┌────────────────┐  │
  │  │  MongoDB        │  │
  │  │  (replica set)  │  │
  │  └────────────────┘  │
  │  ┌────────────────┐  │
  │  │  Redis          │  │
  │  │  (cache+queue)  │  │
  │  └────────────────┘  │
  └──────────────────────┘

STAGE 2 (100-1,000 tenants):
  ┌──────────────────────────────────┐
  │  Load Balancer                    │
  │  ┌──────┐ ┌──────┐ ┌──────┐    │
  │  │ App  │ │ App  │ │ App  │    │
  │  │ Inst1│ │ Inst2│ │Inst3 │    │
  │  └──────┘ └──────┘ └──────┘    │
  │  ┌──────────────────────────┐   │
  │  │  MongoDB Sharded Cluster │   │
  │  │  + Redis Cluster         │   │
  │  │  + S3 (file storage)     │   │
  │  └──────────────────────────┘   │
  │  ┌──────────────────────────┐   │
  │  │  BullMQ Workers (dedicated)│   │
  │  └──────────────────────────┘   │
  └──────────────────────────────────┘

STAGE 3 (1,000-10,000 tenants):
  ┌─────────────────────────────────────────┐
  │  API Gateway (Kong/Traefik)              │
  │                                         │
  │  ┌────────┐ ┌────────┐ ┌────────┐     │
  │  │ Core   │ │Payment │ │Notif   │     │
  │  │Service │ │Service │ │Service  │     │
  │  └────────┘ └────────┘ └────────┘     │
  │                                         │
  │  ┌────────┐ ┌────────┐ ┌────────┐     │
  │  │Report  │ │Printer │ │Identity│     │
  │  │Service │ │Service │ │Service  │     │
  │  └────────┘ └────────┘ └────────┘     │
  │                                         │
  │  ┌──────────────────────────────┐      │
  │  │  Kafka / Redis Streams       │      │
  │  │  (Event Bus)                 │      │
  │  └──────────────────────────────┘      │
  │                                         │
  │  ┌──────────────────────────────┐      │
  │  │  MongoDB + PostgreSQL + S3   │      │
  │  └──────────────────────────────┘      │
  └─────────────────────────────────────────┘
```

### 8.7 Key Metrics for Extraction Decision

```
METRIC                      THRESHOLD TO EXTRACT           WHAT IT MEASURES
──────────────────────  ────────────────────────────  ───────────────────────────
CPU usage per context   > 70% consistently            Context is compute-heavy
DB queries per sec      > 500 for a single context    Context needs dedicated DB
Request latency p99     > 500ms for a context         Context needs optimization
                                                       or extraction
Event handler duration  > 1s average                  Handler is slow, blocking
                                                       other events
Deployment frequency    > 1x per week for same        Team is bottlenecked by
                         context change                 monolith deploy cycle
Team size per context   > 3 engineers on same         Team needs independent
                         context                       deploy schedule
Data growth per context > 100 GB                      Context needs dedicated
                                                       scaling for storage
```

---

## Appendix A: Architecture Decision Records

### ADR-001: Transaction State Machine in Domain Layer

```
Status: Accepted
Context: The order state machine is business logic.
Decision: Place OrderStatus in ordering/domain/OrderStatus.ts
  as a Value Object with explicit valid transitions.
Consequences: State transitions are validated at domain layer,
  preventing invalid states even if controller code has bugs.
```

### ADR-002: Idempotency Keys for All Mutations

```
Status: Accepted
Context: Offline sync, retry queues, and webhooks can cause
  duplicate operations.
Decision: Every mutation endpoint requires X-Idempotency-Key header.
  Redis TTL 48h for key deduplication.
Consequences: Safe retries for all operations. Slightly more
  request overhead.
```

### ADR-003: Database-Per-Tenant from Day One

```
Status: Accepted
Context: Multi-tenant SaaS with compliance requirements.
Decision: Each tenant gets dedicated MongoDB database.
  No shared collections across tenants.
Consequences: Absolute data isolation. Slightly more complex
  connection pooling. Easy tenant deletion.
```

### ADR-004: Outbox Pattern for Event Publishing

```
Status: Accepted
Context: Publishing events before DB write commits risks data loss.
Decision: Events are inserted into outbox collection in same
  transaction as business data. Worker reads outbox and publishes.
Consequences: Guaranteed event delivery. Additional DB write.
  Near-real-time latency.
```

### ADR-005: Choreography over Orchestration for Saga

```
Status: Accepted
Context: Payment→Inventory→Notification flow needs coordination.
Decision: Use choreography (event-driven) saga pattern.
  Each context publishes events; other contexts react.
Consequences: Looser coupling than orchestrator. Harder to trace
  complete saga. Better for modular monolith.
```

### ADR-006: Electron as Primary POS Platform

```
Status: Accepted
Context: POS needs direct hardware access (printers, scanners,
  cash drawer).
Decision: Electron is the primary/recommended POS platform.
  Web/PWA are fallbacks for casual use.
Consequences: Better hardware support. Separate desktop app to
  maintain. Web version always slightly behind in capabilities.
```

### ADR-007: IndexedDB over SQLite for Offline Storage

```
Status: Accepted
Context: Need to support Web, Electron, and Capacitor with one
  offline storage solution.
Decision: IndexedDB for all platforms. Electron can optionally
  use SQLite for advanced features.
Consequences: Single code path. IndexedDB works everywhere.
  Less query capability than SQLite.
```

---

## Appendix B: Risk Register

```
RISK                                LIKELIHOOD    IMPACT     MITIGATION
──────────────────────────────  ─────────────  ────────  ──────────────────────
Oversell during offline sync        Medium       High     Version field + FCW
                                                         + compensating refund
Payment webhook delayed             Low          High     Polling + manual
                                                         reconciliation
Two cashiers edit same order        Low          Medium   Version lock + merge
offline
Printer queue data loss             Low          Medium   Persist queue to
(on crash)                                                   IndexedDB + retry
Module causes core crash            Low          High     Module isolation:
                                                         error boundary per
                                                         handler + circuit breaker
Offline sync conflict not           Low          Low      Notification to admin
detected
BullMQ data loss (Redis down)       Low          High     Redis persistence +
                                                         monitoring + failover
Tenant accidentally deleted         Very Low     Critical Soft delete + 30-day
                                                         retention + backup
```

---

## Appendix C: Glossary

```
TERM                        DEFINITION
──────────────────────  ─────────────────────────────────────────────────
Saga                    Sequence of local transactions where each step
                        has a compensating action for rollback
Outbox                  Pattern where events are stored in DB before
                        being published to message queue
DLQ                     Dead Letter Queue — jobs that failed after max
                        retries, waiting for manual intervention
ESC/POS                 Industry standard command set for thermal
                        receipt printers (Epson)
FCW                     First-Commit-Wins — conflict resolution where
                        first successful write is accepted
LWW                     Last-Write-Wins — conflict resolution where
                        most recent timestamp is accepted
CAS                     Compare-And-Swap — atomic operation that
                        updates only if version matches
Idempotency             Property where same operation can be applied
                        multiple times with same result
Choreography            Saga pattern where each service publishes and
                        reacts to events independently
Orchestration           Saga pattern where a central coordinator
                        tells each service what to do
KDS                     Kitchen Display System — screen showing
                        pending kitchen orders
Bounded Context         DDD concept — a specific responsibility with
                        its own ubiquitous language and data model
```
