# Database Architecture — POSMono

> Platform: SaaS Business Operating System
> Database: MongoDB 7+
> Strategy: Database-per-tenant with event-driven design

---

## Table of Contents

1. [Core Collections](#1-core-collections)
2. [Multi-Tenant Strategy](#2-multi-tenant-strategy)
3. [Collection Relationships](#3-collection-relationships)
4. [Audit & History Strategy](#4-audit--history-strategy)
5. [Soft Delete Strategy](#5-soft-delete-strategy)
6. [Event-Driven Database Design](#6-event-driven-database-design)
7. [Extension Modules Strategy](#7-extension-modules-strategy)
8. [Indexing Strategy](#8-indexing-strategy)
9. [Future Scalability](#9-future-scalability)

---

## 1. Core Collections

### 1.1 Database Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                    MONGODB DEPLOYMENT                            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  System Database (posmono_system)                        │   │
│  │  ─────────────────────────────                           │   │
│  │  tenants, billing_plans, global_roles,                   │   │
│  │  system_config, migrations                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Tenant Database (posmono_{tenantId}) — RETAIL           │   │
│  │  ───────────────────────────────────────                 │   │
│  │  users, roles, products, orders, inventory, payments,    │   │
│  │  customers, notifications, audit_logs, ...               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Tenant Database (posmono_{tenantId}) — RESTAURANT       │   │
│  │  ───────────────────────────────────────                 │   │
│  │  Same core + restaurant_tables, kitchen_orders, ...      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Tenant Database (posmono_{tenantId}) — HOSPITALITY      │   │
│  │  ───────────────────────────────────────                 │   │
│  │  Same core + rooms, reservations, guests,               │   │
│  │  housekeeping_tasks, ...                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Platform-Level Collections (posmono_system)

These collections exist ONCE at platform level and are NEVER duplicated per tenant.

```
SYSTEM DATABASE: posmono_system
═══════════════════════════════════════════════════════════════

PLATFORM_TENANTS
────────────────
{
  _id: ObjectId,
  tenantId: string,          // "tnt_abc123"
  name: string,              // "Warung Makmur"
  slug: string,              // "warung-makmur"
  domain: string | null,     // "pos.warungmakmur.com"
  ownerEmail: string,
  businessType: "retail" | "restaurant" | "hospitality" | "mixed",
  planId: ObjectId,          // references billing_plans
  status: "trial" | "active" | "suspended" | "cancelled",
  databaseName: string,      // "posmono_tnt_abc123"
  modules: ["retail", "restaurant"],
  features: {
    maxUsers: 5,
    maxProducts: 500,
    maxTransactionsPerMonth: 1000,
    modules: ["retail"]
  },
  config: {
    timezone: "Asia/Jakarta",
    currency: "IDR",
    locale: "id",
    dateFormat: "DD/MM/YYYY"
  },
  billingEmail: string,
  trialEndsAt: Date,
  createdAt: Date,
  updatedAt: Date
}
Indexes:
  { slug: 1 }                 // unique — subdomain lookup
  { domain: 1 }               // sparse unique — custom domain
  { status: 1, trialEndsAt: 1 }  // trial expiry scanner


BILLING_PLANS
─────────────
{
  _id: ObjectId,
  planId: string,            // "starter", "pro", "enterprise"
  name: string,              // "Starter"
  price: number,             // 150000 (IDR)
  billingCycle: "monthly" | "annual",
  features: {
    maxUsers: number,
    maxProducts: number,
    maxTransactionsPerMonth: number,
    modules: string[],        // which modules are included
    storage: number
  },
  isActive: boolean,
  createdAt: Date
}
Indexes:
  { planId: 1 }               // unique


GLOBAL_AUDIT_LOG
────────────────
{
  _id: ObjectId,
  tenantId: string,           // which tenant triggered this
  eventName: string,          // "platform.tenant.created"
  aggregateType: string,
  aggregateId: string,
  userId: string | null,
  payload: object,
  ipAddress: string,
  userAgent: string,
  createdAt: Date
}
Indexes:
  { createdAt: -1 }
  { tenantId: 1, createdAt: -1 }
  { eventName: 1, createdAt: -1 }
```

### 1.3 Tenant-Level Collections

Each tenant gets these collections in their own database.

```
TENANT DATABASE: posmono_{tenantId}
═══════════════════════════════════════════════════════════════

── IDENTITY DOMAIN ────────────────────────────────────────────

USERS
─────
{
  _id: string,                // "usr_" + nanoid
  tenantId: string,
  email: string,
  passwordHash: string,
  displayName: string,
  roleId: string,
  isActive: boolean,
  isDeleted: boolean,         // soft delete
  deletedAt: Date | null,
  lastLoginAt: Date | null,
  preferences: {
    language: "id" | "en",
    theme: "light" | "dark",
    receiptFooter: string
  },
  createdAt: Date,
  updatedAt: Date
}
Indexes:
  { tenantId: 1, email: 1 }        // unique compound
  { tenantId: 1, roleId: 1 }
  { tenantId: 1, isActive: 1 }

Note: _id is a human-readable string, not ObjectId. This pattern
is used for ALL tenant collections to make debugging easy and
avoid ObjectId coupling across contexts.


ROLES
─────
{
  _id: string,                // "role_" + nanoid
  tenantId: string,
  name: string,               // "Cashier", "Manager", "Owner"
  description: string,
  permissions: string[],      // ["orders.create", "payments.process", ...]
  isSystem: boolean,          // system roles cannot be deleted
  isDeleted: boolean,
  deletedAt: Date | null,
  createdAt: Date
}
Indexes:
  { tenantId: 1, name: 1 }        // unique compound
  { tenantId: 1 }


── TENANT DOMAIN ──────────────────────────────────────────────

TENANT_SETTINGS
───────────────
{
  _id: string,                // "cfg_" + nanoid
  tenantId: string,
  key: string,                // "pos.receiptFooter", "pos.defaultTax"
  value: any,
  updatedBy: string,
  createdAt: Date,
  updatedAt: Date
}
Indexes:
  { tenantId: 1, key: 1 }         // unique compound


── CATALOG DOMAIN ────────────────────────────────────────────

FAMILIES
────────
{
  _id: string,                // "fam_" + nanoid
  tenantId: string,
  name: string,               // "Western", "Hot Drinks"
  description: string,
  sortOrder: number,
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date
}
Indexes:
  { tenantId: 1, name: 1 }        // unique compound


CATEGORIES
──────────
{
  _id: string,                // "cat_" + nanoid
  tenantId: string,
  name: string,               // "Makanan", "Minuman"
  familyId: string | null,    // links to Family (menu grouping)
  parentId: string | null,    // supports sub-categories
  sortOrder: number,
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date
}
Indexes:
  { tenantId: 1, name: 1 }        // unique compound
  { tenantId: 1, familyId: 1 }    // filter by family


PRODUCTS
────────
{
  _id: string,                // "prd_" + nanoid
  tenantId: string,
  sku: string,                // "BRG-001" (unique per tenant)
  barcode: string,            // EAN/UPC barcode for scanner
  bc: string,                 // additional barcode
  name: string,
  description: string,
  categoryId: string,
  basePrice: number,
  pricingProfileId: string | null,  // link to pricing profile
  imageUrls: string[],
  tags: string[],
  country: string,
  region: string,
  currency: string,
  isActive: boolean,
  metadata: Record<string, unknown>,
  createdAt: Date,
  updatedAt: Date
}
Indexes:
  { tenantId: 1, sku: 1 }           // unique compound
  { tenantId: 1, barcode: 1 }       // barcode lookup
  { tenantId: 1, categoryId: 1 }    // filter by category
  { tenantId: 1, name: "text" }     // text search index
  { tenantId: 1, isActive: 1 }


PRODUCT_VARIANTS
────────────────
{
  _id: string,                // "var_" + nanoid
  tenantId: string,
  productId: string,
  name: string,               // "Large", "Small", "Mocha"
  sku: string,                // unique per tenant
  price: number,
  isActive: boolean,
  isDeleted: boolean,
  deletedAt: Date | null,
  createdAt: Date,
  updatedAt: Date
}
Indexes:
  { tenantId: 1, productId: 1 }
  { tenantId: 1, sku: 1 }           // unique


PRODUCT_PRICING
───────────────
{
  _id: string,                // "prc_" + nanoid
  tenantId: string,
  productId: string,
  variantId: string | null,
  basePrice: number,
  costPrice: number | null,   // for margin calculation
  taxRate: number,            // effective tax rate (e.g. 0.11 = 12% × 11/12 modifier)
  discountAllowed: boolean,
  maxDiscountPercent: number, // 0-100
  validFrom: Date,
  validTo: Date | null,       // null = active indefinitely
  createdAt: Date,
  updatedAt: Date
}
Indexes:
  { tenantId: 1, productId: 1, variantId: 1, validFrom: -1 }


── INVENTORY DOMAIN ───────────────────────────────────────────

WAREHOUSES
──────────
{
  _id: string,                // "wh_" + nanoid
  tenantId: string,
  name: string,               // "Gudang Utama"
  address: string,
  isActive: boolean,
  isDeleted: boolean,
  deletedAt: Date | null,
  createdAt: Date,
  updatedAt: Date
}
Indexes:
  { tenantId: 1 }


INVENTORY_ITEMS
───────────────
{
  _id: string,                // "inv_" + nanoid
  tenantId: string,
  productId: string,
  variantId: string | null,
  warehouseId: string,
  quantity: number,
  reservedQuantity: number,   // locked by active orders
  minLevel: number,
  maxLevel: number,
  version: number,            // optimistic concurrency
  createdAt: Date,
  updatedAt: Date
}
Indexes:
  { tenantId: 1, productId: 1, warehouseId: 1 }  // unique compound
  { tenantId: 1, quantity: 1 }                    // low-stock queries
  { tenantId: 1, warehouseId: 1 }


STOCK_MOVEMENTS
───────────────
{
  _id: string,                // "mov_" + nanoid
  tenantId: string,
  productId: string,
  variantId: string | null,
  warehouseId: string,
  type: "in" | "out" | "adjustment" | "reserve" | "release" | "transfer",
  quantity: number,           // positive = in, negative = out
  previousStock: number,      // snapshot before change
  newStock: number,           // snapshot after change
  referenceType: "order" | "purchase_order" | "adjustment" | "transfer",
  referenceId: string | null,
  reason: string,
  userId: string,
  metadata: object,           // extensible
  createdAt: Date
}
Indexes:
  { tenantId: 1, productId: 1, warehouseId: 1, createdAt: -1 }
  { tenantId: 1, referenceType: 1, referenceId: 1 }
  { tenantId: 1, type: 1, createdAt: -1 }
  { tenantId: 1, createdAt: -1 }              // TTL-capable for archive
Note: This collection is APPEND-ONLY. Never update or delete records.


── ORDERS DOMAIN ──────────────────────────────────────────────

CARTS
─────
{
  _id: string,                // "crt_" + nanoid
  tenantId: string,
  customerId: string | null,
  sessionId: string,          // browser session for anonymous carts
  items: [
    {
      productId: string,
      variantId: string | null,
      productName: string,
      quantity: number,
      unitPrice: number,
      modifiers: [{ name: string, price: number }],
      notes: string
    }
  ],
  status: "active" | "converted" | "abandoned",
  expiresAt: Date,             // TTL index for abandoned carts
  createdAt: Date,
  updatedAt: Date
}
Indexes:
  { tenantId: 1, status: 1, expiresAt: 1 }
  { tenantId: 1, customerId: 1, status: 1 }
  { expiresAt: 1 }             // TTL: auto-delete after expiry


ORDERS
──────
{
  _id: string,                // "ord_" + nanoid
  tenantId: string,
  orderNumber: string,        // "ORD-ABC123" (human readable)
  status: "draft" | "confirmed" | "paid" | "preparing" | "completed" | "cancelled" | "refunded",
  items: [
    {
      productId: string,
      variantId: string | null,
      productName: string,
      quantity: number,
      unitPrice: number,
      totalPrice: number,
      modifiers: [{ name: string, price: number }],
      tax: { rate: number, amount: number }
    }
  ],
  totals: {
    subtotal: number,
    discount: number,
    discountType: "percentage" | "fixed",
    tax: number,
    grandTotal: number
  },
  paymentStatus: "pending" | "completed" | "failed" | "refunded",
  customerId: string | null,
  cashierId: string,            // user who processed
  waiterId: string | null,      // restaurant
  tableId: string | null,       // restaurant
  roomId: string | null,        // hospitality
  notes: string,
  source: "pos" | "waiter" | "online" | "booking",
  version: number,              // optimistic concurrency
  metadata: {
    guestCount: number,         // restaurant
    diningOption: "dine-in" | "takeaway" | "delivery"
  },
  paidAt: Date | null,
  createdAt: Date,
  updatedAt: Date
}
Indexes:
  { tenantId: 1, orderNumber: 1 }       // unique compound
  { tenantId: 1, status: 1, createdAt: -1 }
  { tenantId: 1, customerId: 1, createdAt: -1 }
  { tenantId: 1, cashierId: 1, createdAt: -1 }
  { tenantId: 1, source: 1, createdAt: -1 }
  { tenantId: 1, createdAt: -1 }
  { tenantId: 1, "items.productId": 1 }   // product sales analysis


ORDER_ITEMS
───────────
Note: Items are EMBEDDED in orders array for fast reads.
This collection exists for transactional reporting only.

{
  _id: string,
  tenantId: string,
  orderId: string,
  orderNumber: string,
  productId: string,
  variantId: string | null,
  productName: string,
  quantity: number,
  unitPrice: number,
  totalPrice: number,
  costPrice: number | null,       // for profit calculation
  tax: { rate: number, amount: number },
  modifiers: [{ name: string, price: number }],
  createdAt: Date
}
Indexes:
  { tenantId: 1, orderId: 1 }
  { tenantId: 1, productId: 1, createdAt: -1 }
  { tenantId: 1, createdAt: -1 }


ORDER_STATUS_HISTORY
────────────────────
{
  _id: string,
  tenantId: string,
  orderId: string,
  previousStatus: string,
  newStatus: string,
  changedBy: string,              // userId
  reason: string | null,
  createdAt: Date
}
Indexes:
  { tenantId: 1, orderId: 1, createdAt: -1 }


── PAYMENTS DOMAIN ────────────────────────────────────────────

PAYMENT_METHODS
───────────────
{
  _id: string,                // "pm_" + nanoid
  tenantId: string,
  name: string,               // "Tunai", "Kartu Kredit", "QRIS"
  code: string,               // "cash", "card", "qris" (unique per tenant)
  description: string,
  icon: string,               // emoji icon
  color: string,              // hex color for UI
  sortOrder: number,
  isActive: boolean,
  requiresReference: boolean, // true for card/transfer (need reference number)
  config: object,             // method-specific configuration
  createdAt: Date,
  updatedAt: Date
}
Indexes:
  { tenantId: 1, code: 1 }        // unique compound
  { tenantId: 1, isActive: 1 }


PAYMENTS
────────
{
  _id: string,                // "pay_" + nanoid
  tenantId: string,
  orderId: string,
  orderNumber: string,
  amount: number,
  status: "pending" | "completed" | "failed" | "refunded",
  method: "cash" | "qris" | "transfer" | "card" | "split",
  referenceNumber: string,    // internal reference
  providerReference: string,  // Midtrans transaction ID
  qrCodeUrl: string | null,
  splitBills: [               // for restaurant split bill
    {
      portionId: string,
      amount: number,
      status: "pending" | "paid",
      method: string
    }
  ],
  paidAt: Date | null,
  createdAt: Date,
  updatedAt: Date
}
Indexes:
  { tenantId: 1, orderId: 1 }                 // unique
  { tenantId: 1, status: 1, createdAt: -1 }
  { tenantId: 1, method: 1, createdAt: -1 }
  { providerReference: 1 }                     // Midtrans webhook lookup


PAYMENT_TRANSACTIONS
────────────────────
{
  _id: string,
  tenantId: string,
  paymentId: string,
  type: "sale" | "refund" | "fee",
  amount: number,
  provider: "midtrans" | "cash",
  providerTransactionId: string,
  status: "pending" | "success" | "failed",
  rawResponse: object,          // full Midtrans response for debugging
  createdAt: Date
}
Indexes:
  { tenantId: 1, paymentId: 1 }
  { tenantId: 1, providerTransactionId: 1 }


REFUNDS
───────
{
  _id: string,
  tenantId: string,
  orderId: string,
  paymentId: string,
  amount: number,
  reason: string,
  status: "pending" | "processed" | "failed",
  processedAt: Date | null,
  createdAt: Date,
  updatedAt: Date
}
Indexes:
  { tenantId: 1, orderId: 1 }
  { tenantId: 1, status: 1 }


── CUSTOMER DOMAIN ────────────────────────────────────────────

CUSTOMERS
─────────
{
  _id: string,                // "cst_" + nanoid
  tenantId: string,
  name: string,
  phone: string,              // unique per tenant
  email: string | null,
  address: string | null,
  isMember: boolean,
  isDeleted: boolean,
  deletedAt: Date | null,
  totalVisits: number,
  totalSpent: number,
  lastVisitAt: Date | null,
  tags: string[],
  preferences: {
    notifyVia: "whatsapp" | "email" | "none",
    favoriteProducts: string[]
  },
  notes: string,
  createdAt: Date,
  updatedAt: Date
}
Indexes:
  { tenantId: 1, phone: 1 }             // unique compound
  { tenantId: 1, email: 1 }            // sparse unique
  { tenantId: 1, name: "text", phone: "text" }
  { tenantId: 1, totalSpent: -1 }       // top customers
  { tenantId: 1, lastVisitAt: -1 }      // inactive customers


LOYALTY_POINTS
──────────────
{
  _id: string,
  tenantId: string,
  customerId: string,
  points: number,
  lifetimePoints: number,       // total ever earned (for tier calculation)
  tier: "bronze" | "silver" | "gold" | "platinum",
  pointsExpireAt: Date | null,
  createdAt: Date,
  updatedAt: Date
}
Indexes:
  { tenantId: 1, customerId: 1 }       // unique
  { tenantId: 1, points: -1 }
  { tenantId: 1, tier: 1 }


── NOTIFICATION DOMAIN ────────────────────────────────────────

NOTIFICATIONS
─────────────
{
  _id: string,
  tenantId: string,
  type: "order_confirmation" | "receipt" | "payment_reminder" | "promo" | "alert",
  channel: "whatsapp" | "email" | "push" | "in_app",
  recipient: string,
  subject: string,
  body: string,
  status: "pending" | "sent" | "failed" | "read",
  referenceType: string | null,    // "order", "payment", etc.
  referenceId: string | null,
  errorMessage: string | null,
  sentAt: Date | null,
  readAt: Date | null,
  createdAt: Date
}
Indexes:
  { tenantId: 1, status: 1, createdAt: -1 }
  { tenantId: 1, referenceType: 1, referenceId: 1 }
  { tenantId: 1, createdAt: -1 }
  { status: 1, createdAt: 1 }            // retry worker scanner


── REPORTING DOMAIN ───────────────────────────────────────────

DAILY_METRICS
─────────────
{
  _id: string,
  tenantId: string,
  date: string,                  // "2026-06-30"
  metrics: {
    totalOrders: number,
    totalRevenue: number,
    totalDiscount: number,
    totalTax: number,
    totalCustomers: number,
    newCustomers: number,
    avgOrderValue: number,
    topProducts: [
      { productId: string, name: string, quantity: number, revenue: number }
    ],
    paymentMethodBreakdown: {
      cash: number,
      qris: number,
      transfer: number,
      card: number
    },
    hourlyBreakdown: [           // peak hours analysis
      { hour: number, orders: number, revenue: number }
    ],
    cashierPerformance: [
      { userId: string, name: string, orders: number, revenue: number }
    ]
  },
  createdAt: Date,
  updatedAt: Date
}
Indexes:
  { tenantId: 1, date: -1 }           // unique compound


── AUDIT DOMAIN ───────────────────────────────────────────────

AUDIT_LOGS
──────────
{
  _id: string,
  tenantId: string,
  eventName: string,              // "order.created", "user.role_changed"
  aggregateType: string,          // "Order", "User", "Payment"
  aggregateId: string,
  userId: string | null,
  correlationId: string,          // link events across contexts
  causationId: string | null,     // parent event
  payload: object,                // full event payload
  ipAddress: string,
  userAgent: string,
  createdAt: Date
}
Indexes:
  { tenantId: 1, createdAt: -1 }
  { tenantId: 1, aggregateType: 1, aggregateId: 1, createdAt: -1 }
  { tenantId: 1, eventName: 1, createdAt: -1 }
  { tenantId: 1, correlationId: 1 }           // trace debugging
  { createdAt: -1 }                            // TTL archive

Note: This collection is APPEND-ONLY. Immutable log.


── EVENT STORE (optional — see Section 6) ─────────────────────

DOMAIN_EVENTS
─────────────
{
  _id: string,
  eventId: string,             // UUID
  eventName: string,           // "ordering.order.created"
  aggregateType: string,       // "Order"
  aggregateId: string,         // "ord_abc123"
  tenantId: string,
  correlationId: string,
  causationId: string | null,
  payload: object,
  metadata: object,
  occurredAt: Date
}
Indexes:
  { aggregateType: 1, aggregateId: 1, occurredAt: 1 }
  { eventName: 1, occurredAt: -1 }
  { correlationId: 1 }
  { tenantId: 1, occurredAt: -1 }
  { occurredAt: 1 }             // TTL for auto-archive
```

---

## 2. Multi-Tenant Strategy

### 2.1 Decision: Database-per-Tenant (Isolated)

Every tenant gets their own MongoDB database.

```
Platform Cluster
│
├── posmono_system              # Global data (tenants, plans)
│
├── posmono_tnt_abc123          # Tenant: "Warung Makmur" (retail)
│   ├── users
│   ├── products
│   ├── orders
│   ├── payments
│   └── ...
│
├── posmono_tnt_xyz789          # Tenant: "Cafe Bahari" (restaurant)
│   ├── users
│   ├── products
│   ├── orders
│   ├── restaurant_tables
│   ├── kitchen_orders
│   └── ...
│
└── posmono_tnt_def456          # Tenant: "Villa Indah" (hospitality)
    ├── users
    ├── products
    ├── orders
    ├── hospitality_rooms
    ├── hospitality_bookings
    └── ...
```

### 2.2 Why Database-per-Tenant for This Product

```
CRITERIA                   SHARED DB          DB PER TENANT       HYBRID
─────────────────────  ───────────────────  ─────────────────  ──────────────
Data isolation         ❌ Weak              ✅ Strong          ✅ Strong
Accidental leak risk   ❌ One query away    ✅ Impossible       ✅ Very low
Backup per tenant      ❌ Complex           ✅ db.dump()        ✅ db.dump()
Restore per tenant     ❌ Complex           ✅ db.drop() + restore ✅
Delete tenant          ❌ Messy cleanup     ✅ db.dropDatabase() ✅
Cross-tenant queries   ✅ Easy              ❌ Manual scatter   🟡 Via routing
Schema migration       ✅ One migration     🟡 Per DB loop     🟡 Per DB loop
Connection overhead    ✅ Low               🟡 Medium (pooled)  🟡 Medium
Cost efficiency        ✅ Best              🟡 More storage     🟡 Better
100 tenants            ✅ Fine              ✅ Fine             ✅ Fine
1000 tenants           🟡 Slow queries      ✅ Fine             ✅ Fine
10000 tenants          ❌ Impossible         🟡 Need sharding   ✅ Best
Compliance (BPOM)      ❌ May not satisfy   ✅ Full isolation   ✅ Full isolation
```

**Verdict:** Database-per-tenant from day one. The operational cost of managing many databases is offset by the absolute guarantee of data isolation, independent backup/restore, and the ability to `db.dropDatabase()` on tenant deletion.

### 2.3 Tenant Resolution Flow

```
Request comes in
│
├── Subdomain: warung-makmur.posmono.app
├── Custom domain: pos.warungmakmur.com
├── Header: X-Tenant-Id: tnt_abc123
└── JWT claim: tenant: "tnt_abc123"
        │
        ▼
Lookup tenant → Redis cache (TTL: 5 min)
        │
        ▼
Validate tenant is active (not suspended/cancelled)
        │
        ▼
Resolve database name: "posmono_tnt_abc123"
        │
        ▼
Get/create cached mongoose connection
        │
        ▼
Attach to req: { tenantId, dbConnection, enabledModules }
        │
        ▼
Proceed → every repository uses req.dbConnection
```

### 2.4 Connection Pooling Strategy

```typescript
// Pseudo-code for ConnectionManager behavior

Map<tenantId, { connection: mongoose.Connection, lastUsed: Date }>

getConnection(tenantId):
  if cached AND (now - lastUsed < 30min):
    return cached connection

  if cached AND expired:
    close cached connection
    remove from map

  tenantData = await systemDb.tenants.findOne({ tenantId })
  conn = mongoose.createConnection(`mongodb://.../${tenantData.databaseName}`)
  cache.set(tenantId, { connection: conn, lastUsed: now })
  return conn
```

### 2.5 Shared vs Per-Tenant Data Decision Matrix

```
DATA TYPE                         LOCATION              REASON
─────────────────────────────  ────────────────────  ───────────────────
Tenant registration            posmono_system         Global lookup
Billing plans                  posmono_system         Global catalog
Authentication (login)         posmono_{tenantId}     Per-tenant isolation
User list                      posmono_{tenantId}     Business data
Products                       posmono_{tenantId}     Business data
Orders                         posmono_{tenantId}     Highly sensitive
Payments                       posmono_{tenantId}     Financial data
Inventory                      posmono_{tenantId}     Business data
Customers                      posmono_{tenantId}     Privacy regulated
Audit logs                     posmono_{tenantId}     Per-tenant compliance
Platform admin users           posmono_system         Platform auth
Global templates               posmono_system         Shared content
```

---

## 3. Collection Relationships

### 3.1 Entity Relationship Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        RELATIONSHIP MAP                                    │
│                                                                            │
│  ┌─────────────┐       ┌──────────────┐                                   │
│  │   tenants   │──1:N──│    users     │──N:1──┌─────────┐                 │
│  │ (platform)  │       │              │       │  roles  │                 │
│  └─────────────┘       └──────┬───────┘       └─────────┘                 │
│                               │                                            │
│  ┌─────────────┐              │                                            │
│  │  categories │──1:N──┌──────┴────────┐      ┌──────────────┐            │
│  └─────────────┘       │   products    │──1:N─│   variants   │            │
│                        │               │      └──────────────┘            │
│                        └───────┬───────┘                                   │
│                                │                                           │
│          ┌─────────────────────┼─────────────────────┐                    │
│          ▼                     ▼                     ▼                    │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐              │
│  │  inventory_   │    │  order_items  │    │ product_      │              │
│  │  items        │    │               │    │ pricing       │              │
│  └───────┬───────┘    └───────┬───────┘    └───────────────┘              │
│          │                    │                                            │
│          ▼                    ▼                                            │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐              │
│  │ stock_        │    │    orders     │──1:N│ order_status_ │              │
│  │ movements     │    │               │    │ history       │              │
│  └───────────────┘    └───────┬───────┘    └───────────────┘              │
│                               │                                            │
│                    ┌──────────┼──────────┐                                │
│                    ▼          ▼          ▼                                │
│  ┌────────────┐ ┌────────┐ ┌─────────┐                                    │
│  │ customers  │ │payments│ │ refunds │                                    │
│  └──────┬─────┘ └───┬────┘ └─────────┘                                    │
│         │           │                                                     │
│         ▼           ▼                                                     │
│  ┌────────────┐ ┌───────────────┐     ┌──────────────────┐               │
│  │ loyalty_   │ │ payment_      │     │ notifications   │               │
│  │ points     │ │ transactions  │     └──────────────────┘               │
│  └────────────┘ └───────────────┘                                        │
│                                                                            │
│  ┌────────────────┐    ┌────────────────┐                                │
│  │  daily_metrics │    │  audit_logs    │                                │
│  └────────────────┘    └────────────────┘                                │
│                                                                            │
│  ┌─────────────────────────────────────────────────┐                     │
│  │           EXTENSION COLLECTIONS                 │                     │
│  │                                                 │                     │
│  │  restaurant_tables ─N:1── orders (tableId)     │                     │
│  │  kitchen_orders    ─N:1── orders (orderId)     │                     │
│  │  reservations      ─1:1── orders (bookingId)   │                     │
│  │  hospitality_rooms ─N:1── orders (roomId)      │                     │
│  │  hospitality_bookings                           │                     │
│  └─────────────────────────────────────────────────┘                     │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Reference Integrity Rules

Since MongoDB does not have foreign keys, we enforce integrity at the application layer:

```
RULE                           ENFORCEMENT
─────────────────────────  ─────────────────────────────────────────────
order.customerId → customer  Application: Validate customer exists before create
order.cashierId → user       Application: Validate user exists and has cashier role
order.items[].productId      Application: Validate product exists (reference remains valid
  → product                             even if product is soft-deleted)
payment.orderId → order      Application: Validate order exists, prevent duplicate payments
inventory_items.productId    Application: Cascade delete inventory when product is deleted
  → product                             (or mark inventory for cleanup)
stock_movement.referenceId   No enforcement — kept as informational pointer
restaurant_tables references No direct cross-collection references to core
  core orders via tableId    Extension → Core via string pointer only
```

### 3.3 Embedding vs Referencing Decisions

```
EMBEDDED                      REASON
─────────────────────────  ─────────────────────────────────────────────
items[] inside orders       Orders are always read with items. Avoid joins.
                            Item count per order is small (< 100).
modifiers[] inside items    Always read with item. Small, bounded data.
permissions[] inside roles  Always read with role. Small array (< 200).
metrics{} inside daily_     Always read together. Document model fits well.
  metrics

REFERENCED                   REASON
─────────────────────────  ─────────────────────────────────────────────
productId in order.items    Product details can change; order preserves name snapshot.
customerId in orders        Customer can be updated independently.
paymentId in refunds        Refund references a specific payment.
userId in stock_movements   User can change name; movement preserves userId for audit.
```

---

## 4. Audit & History Strategy

### 4.1 Three-Layer Audit Architecture

```
LAYER 1: EVENT LOG (domain events)
──────────────────────────────────────
Purpose: Trace business event flow across contexts
Storage: DOMAIN_EVENTS collection (optional event store)
Retention: 90 days, then archived to cold storage
Use case: Debugging event flows, replaying events

LAYER 2: AUDIT LOG (user actions)
──────────────────────────────────────
Purpose: Compliance, security, who-did-what-when
Storage: AUDIT_LOGS collection (append-only)
Retention: Permanent (legal requirement)
Use case: Admin investigation, compliance audits

LAYER 3: STATUS HISTORY (state machines)
──────────────────────────────────────
Purpose: Track state transitions of aggregates
Storage: Order: ORDER_STATUS_HISTORY
         Inventory: STOCK_MOVEMENTS
Retention: Permanent
Use case: Order lifecycle debugging, inventory journal
```

### 4.2 What Each Layer Captures

```
EVENT LOG (domain events)
──────────────────────────
Captures: Events from event bus
Example: OrderCreated, PaymentCompleted, StockAdjusted
Format:  Event envelope (eventName, aggregateId, payload, correlationId)
Who:     System-generated (not user actions directly)

AUDIT LOG (user actions)
──────────────────────────
Captures: Direct user actions
Example:
  - User "Budi" changed product "Nasi Goreng" price from 15000 to 18000
  - User "Sari" voided order "ORD-ABC123"
  - User "Admin" added user "Dodi" with role "Cashier"
Format:  { userId, action, resourceType, resourceId, oldValue, newValue }
Who:     Authenticated user

STATUS HISTORY (state machine)
──────────────────────────
Captures: Aggregate state transitions
Example:
  - Order: draft → confirmed → paid → completed
  - Order: draft → cancelled
  - Inventory: stock adjusted from 50 to 45
Format:  { aggregateId, transition: "old→new", by: userId }
Who:     System or user
```

### 4.3 Audit Log Schema Detail

```javascript
AUDIT_LOGS
{
  _id: "aud_" + nanoid,
  tenantId: "tnt_abc123",

  // Who
  userId: "usr_123",
  userEmail: "budi@warung.com",
  userRole: "manager",

  // What
  action: "product.price.updated",
  resourceType: "Product",
  resourceId: "prd_456",

  // Before/After
  changes: {
    oldValue: { basePrice: 15000 },
    newValue: { basePrice: 18000 }
  },

  // Context
  correlationId: "corr_abc",
  ipAddress: "192.168.1.1",
  userAgent: "POSMono/1.0",

  // Metadata
  source: "dashboard" | "pos" | "api",
  severity: "info" | "warning" | "critical",

  createdAt: Date
}
```

### 4.4 What MUST Be Audited

```
CATEGORY              ACTIONS TO AUDIT
─────────────────  ──────────────────────────────────────────────
Authentication      login, failed_login, logout, password_change
User management     create_user, update_user, delete_user,
                    assign_role, revoke_role
Role management     create_role, update_role, delete_role,
                    add_permission, remove_permission
Product changes     create_product, update_product, delete_product,
                    price_change, category_change
Order operations    create_order, cancel_order, refund_order,
                    void_order, discount_override
Payment ops         process_payment, refund_payment, void_payment
Inventory           stock_adjustment, stock_transfer, stock_count
Customer data       create_customer, update_customer, delete_customer
Settings            update_settings, toggle_module, update_tax
Tenant admin        suspend_tenant, activate_tenant, change_plan
```

### 4.5 History Tracking — Stock Movements Example

```javascript
STOCK_MOVEMENTS (append-only journal)

// Initial stock setup
{ type: "in", quantity: 100, previousStock: 0, newStock: 100,
  reason: "Initial stock", referenceType: null }

// Order reserves stock
{ type: "reserve", quantity: -3, previousStock: 100, newStock: 97,
  reason: "Order ORD-ABC123 reserved", referenceType: "order",
  referenceId: "ord_abc" }

// Payment completes — commit reservation
{ type: "out", quantity: -3, previousStock: 97, newStock: 94,
  reason: "Order ORD-ABC123 completed", referenceType: "order",
  referenceId: "ord_abc" }

// Order cancelled — release stock
{ type: "release", quantity: 3, previousStock: 94, newStock: 97,
  reason: "Order ORD-ABC123 cancelled", referenceType: "order",
  referenceId: "ord_abc" }

// Manual adjustment
{ type: "adjustment", quantity: -2, previousStock: 97, newStock: 95,
  reason: "Damaged goods", referenceType: "adjustment",
  referenceId: "adj_001" }
```

---

## 5. Soft Delete Strategy

### 5.1 Where Soft Delete is Used

```
COLLECTION          SOFT DELETE?    RETENTION     REASON
─────────────────  ─────────────  ────────────  ──────────────────────
users               ✅ Yes         Indefinite    Orders reference users
roles               ✅ Yes         Indefinite    Users reference roles
products            ✅ Yes         Indefinite    Historical orders reference products
categories          ✅ Yes         Indefinite    Products reference categories
variants            ✅ Yes         Indefinite    Order items reference variants
customers           ✅ Yes         Indefinite    Loyalty points, order history
warehouses          ✅ Yes         90 days       Inventory items reference
restaurant_tables   ✅ Yes         Indefinite    Order history references tableId
rooms               ✅ Yes         Indefinite    Booking history references roomId

orders              ❌ No          —             Legal/compliance: never delete payments
payments            ❌ No          —             Financial records: never delete
audit_logs          ❌ No          —             Immutable by design
stock_movements     ❌ No          —             Append-only journal
daily_metrics       ❌ No          —             Historical data
```

### 5.2 Soft Delete Schema Pattern

```javascript
// Applied to all soft-deletable collections
{
  // ... normal fields ...
  isDeleted: false,           // boolean flag
  deletedAt: null,            // timestamp
  deletedBy: null,            // userId who deleted
  deletedReason: null,        // optional reason
  restoredAt: null,           // if restored
  restoredBy: null
}
```

### 5.3 Query Patterns

```javascript
// ALL queries must filter out soft-deleted records
// Enforced at the Repository base class level

// Default query filter:
const defaultFilter = { isDeleted: { $ne: true } };

// Example query with soft delete exclusion:
db.products.find({
  tenantId: "tnt_abc123",
  isDeleted: { $ne: true },
  isActive: true
});

// Admin queries to see deleted items:
db.products.find({
  tenantId: "tnt_abc123",
  isDeleted: true
});

// When a product is deleted:
db.products.updateOne(
  { _id: "prd_123" },
  {
    $set: {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: "usr_456",
      deletedReason: "Discontinued"
    }
  }
);
```

### 5.4 Data Integrity During Soft Delete

```javascript
// When soft-deleting a CATEGORY:
// 1. Check if any active products reference this category
const activeProducts = await db.products.countDocuments({
  categoryId: categoryId,
  isDeleted: { $ne: true }
});

// 2. If products exist, either:
//    a. Reassign products to a default category, OR
//    b. Block deletion with message: "Move 5 products first"

// When soft-deleting a USER:
// 1. Check if user has active shifts
const activeShift = await db.shifts.findOne({
  cashierId: userId,
  status: "open"
});

// 2. If active shift exists, block deletion
if (activeShift) {
  throw new Error("Cannot delete user with active shift. Close shift first.");
}
```

---

## 6. Event-Driven Database Design

### 6.1 Event Store — Is It Necessary?

```
QUESTION: Should we persist every domain event in a collection?

ANSWER: Optional for Phase 1. Recommended for Phase 2+.

PHASE 1 (MVP):
  - Events flow through in-memory EventBus only
  - No event persistence
  - Audit trail from AUDIT_LOGS is sufficient
  - Simpler operational overhead

PHASE 2+ (Growth):
  - Add DOMAIN_EVENTS collection
  - Persist every domain event
  - Enables: event replay, debugging, analytics from events
  - Preparation for Event Sourcing if needed
```

### 6.2 Domain Event Collection Schema

```javascript
DOMAIN_EVENTS
─────────────
{
  eventId: "evt_abc123",          // Unique event identifier
  eventName: "ordering.order.created",  // "{context}.{aggregate}.{action}"
  aggregateType: "Order",          // Which aggregate
  aggregateId: "ord_abc123",      // Which instance
  tenantId: "tnt_abc123",
  version: 1,                      // Aggregate version for optimistic concurrency

  // Correlation
  correlationId: "corr_xyz",       // Links all events from same request
  causationId: "evt_parent",       // Links to event that caused this one

  // Data
  payload: {
    orderId: "ord_abc123",
    orderNumber: "ORD-ABC123",
    items: [{ productId: "prd_1", quantity: 2, price: 15000 }],
    total: 30000,
    customerId: "cst_abc"
  },

  // Context
  userId: "usr_456",               // Who triggered it
  source: "pos",                   // Where it came from
  ipAddress: "192.168.1.1",

  // Metadata
  metadata: {
    module: "core",                // Which module produced it
    environment: "production",
    version: "1.0.0"
  },

  occurredAt: ISODate("2026-06-30T10:30:00Z")
}
```

### 6.3 Optimistic Concurrency with Version Field

Every aggregate that can be updated concurrently carries a `version` field:

```javascript
ORDERS
{
  _id: "ord_abc123",
  version: 5,              // starts at 1, incremented on each update
  // ... other fields ...
}

INVENTORY_ITEMS
{
  _id: "inv_abc123",
  version: 12,             // critical for stock operations
  quantity: 95,
  reservedQuantity: 3,
  // ... other fields ...
}

// Update pattern:
const result = await db.orders.findOneAndUpdate(
  {
    _id: "ord_abc123",
    version: 5              // optimistic lock: only update if version matches
  },
  {
    $set: {
      status: "paid",
      paidAt: new Date(),
      updatedAt: new Date()
    },
    $inc: { version: 1 }   // atomic increment
  }
);

if (!result) {
  // Version conflict — retry or throw
  throw new Error("Order was modified by another user. Please retry.");
}
```

### 6.4 Event Flow → Database Impact

```javascript
// When OrderCreated event fires, these DB operations happen:

EVENT: ordering.order.created
───────────────────────────────
1. [Ordering Context] INSERT orders         (the order itself)
2. [Inventory Context] UPDATE inventory_items (reserve stock)
                   { $inc: { reservedQuantity: 3 } }
3. [Customer Context] No DB write — just event listener


EVENT: payment.transaction.completed
──────────────────────────────────────
1. [Payment Context] INSERT payments
2. [Ordering Context] UPDATE orders         (status→paid, paidAt)
3. [Inventory Context] UPDATE inventory_items (convert reserve to out)
                   { $inc: { quantity: -3, reservedQuantity: -3 } }
4. [Customer Context] UPDATE customers      (totalVisits+1, totalSpent+)
5. [Notification Context] INSERT notifications
6. [Reporting Context] UPSERT daily_metrics (increment counters)


EVENT: ordering.order.cancelled
──────────────────────────────────
1. [Ordering Context] UPDATE orders         (status→cancelled)
2. [Inventory Context] UPDATE inventory_items (release reserved stock)
                   { $inc: { reservedQuantity: -3 } }
3. [Payment Context] INSERT refunds (if already paid)
```

### 6.5 Database Operations are NOT in the Event Handler

Critical rule: Event handlers do NOT write to the database directly.
They use Application Services that use Repositories.

```
EventBus.publish(OrderCreated)
        │
        ▼
onOrderCreated handler (in Inventory context)
        │
        ▼
ReserveStockUseCase.execute({ orderId, items })
        │
        ▼
InventoryRepository → MongoDB
        │
        ▼
Domain events from Stock aggregate (StockAdjusted, LowStockAlert)
        │
        ▼
EventBus.publish(StockAdjusted)  // next handler
```

---

## 7. Extension Modules Strategy

### 7.1 Clear Separation Principle

```
CORE DATABASE                     EXTENSION COLLECTIONS
(posmono_{tenantId})              (same database, different prefix)
───────────────────────          ───────────────────────────────────
users                             restaurant_tables
roles                             restaurant_floor_plans
products                          restaurant_kitchen_orders
orders                            restaurant_reservations
payments                          restaurant_split_bills
customers                         restaurant_printer_jobs
                                  hospitality_properties
                                  hospitality_rooms
                                  hospitality_room_types
                                  hospitality_bookings
                                  hospitality_guests
                                  hospitality_stays
                                  hospitality_housekeeping_tasks
                                  retail_purchase_orders
                                  retail_suppliers
```

### 7.2 Extension → Core Connection Pattern

Extensions connect to core through **string references only**. No foreign keys, no cross-collection joins in MongoDB.

```javascript
// RESTAURANT extension references core ORDERS:
restaurant_kitchen_orders: {
  _id: "kco_abc123",
  tenantId: "tnt_abc123",
  orderId: "ord_abc123",        // ← string reference to core orders
  tableId: "tbl_001",
  status: "preparing",
  items: [{
    // Snapshot of order items sent to kitchen
    productId: "prd_001",
    productName: "Nasi Goreng",
    quantity: 2,
    modifiers: [{ name: "Level 3", price: 0 }],
    status: "pending"           // tracked independently from core order
  }],
  priority: "normal",
  preparedBy: [],
  startedAt: Date,
  readyAt: Date,
  createdAt: Date
}


// HOSPITALITY extension references core ORDERS:
hospitality_bookings: {
  _id: "bkg_abc123",
  tenantId: "tnt_abc123",
  orderId: "ord_abc123",       // ← string reference to core order (if booking creates deposit order)
  roomId: "rom_001",
  guestId: "gst_001",
  checkIn: Date,
  checkOut: Date,
  status: "confirmed",
  totalAmount: 1500000,
  // ...
}
```

### 7.3 Module Detection at Query Time

```javascript
// The application layer checks tenant config to filter module data:

class OrderRepository {
  async findById(orderId, tenantId) {
    const order = await db.orders.findOne({ _id: orderId, tenantId });

    // Check if restaurant module is active for this tenant
    if (this.tenantHasModule(tenantId, "restaurant")) {
      order.kitchenOrders = await db.restaurant_kitchen_orders
        .find({ orderId, tenantId })
        .toArray();
    }

    return order;
  }
}
```

### 7.4 Extension Data Lifecycle

```javascript
// When an ORDER is DELETED (rare — only if illegal transaction):
// Core handles cleanup:
db.orders.updateOne({ _id: orderId }, { $set: { status: "cancelled" } });

// Each extension cleans up its own data:
// (triggered by OrderCancelled event)
if (order.tableId) {
  db.restaurant_tables.updateOne(
    { _id: order.tableId },
    { $set: { status: "available" } }
  );
  db.restaurant_kitchen_orders.updateOne(
    { orderId: orderId },
    { $set: { status: "cancelled" } }
  );
}

if (order.roomId) {
  db.hospitality_rooms.updateOne(
    { _id: order.roomId },
    { $set: { status: "available" } }
  );
}
```

---

## 8. Indexing Strategy

### 8.1 Performance-First Index Design

Every index decision is based on actual query patterns.

```
TENANT-LEVEL INDEXES
═══════════════════════════════════════════════════════════════

USERS
─────
Purpose: Login lookup, role filtering
Indexes:
  { tenantId: 1, email: 1 }          // UNIQUE — login query
  { tenantId: 1, roleId: 1 }          // Role-based user listing
  { tenantId: 1, isActive: 1 }        // Active user queries


ROLES
─────
Purpose: Role listing, permission lookup
Indexes:
  { tenantId: 1, name: 1 }            // UNIQUE — role by name


PRODUCTS
────────
Purpose: Catalog browsing, search, category filter
Indexes:
  { tenantId: 1, sku: 1 }             // UNIQUE — SKU lookup (barcode scanner)
  { tenantId: 1, categoryId: 1 }      // Category page
  { tenantId: 1, name: "text" }       // Text search
  { tenantId: 1, isActive: 1 }        // Active product listing
  { tenantId: 1, tags: 1 }            // Tag-based filtering


ORDERS
──────
Purpose: Order listing (most queried collection), reports
Indexes:
  { tenantId: 1, orderNumber: 1 }     // UNIQUE — order lookup
  { tenantId: 1, status: 1, createdAt: -1 }  // Status filter (dashboard)
  { tenantId: 1, customerId: 1, createdAt: -1 }  // Customer history
  { tenantId: 1, cashierId: 1, createdAt: -1 }   // Cashier performance
  { tenantId: 1, createdAt: -1 }       // Date range queries (reports)
  { tenantId: 1, source: 1, createdAt: -1 }  // Source analysis
  { tenantId: 1, "items.productId": 1 }  // Product sales analysis
  { tenantId: 1, tableId: 1, status: 1 }  // Restaurant table tracking


PAYMENTS
────────
Purpose: Payment lookup, webhook processing
Indexes:
  { tenantId: 1, orderId: 1 }          // UNIQUE — payment lookup
  { tenantId: 1, status: 1, createdAt: -1 }  // Payment reconciliation
  { tenantId: 1, method: 1, createdAt: -1 }  // Method breakdown
  { providerReference: 1 }              // Midtrans webhook (NO tenantId — global)


INVENTORY_ITEMS
───────────────
Purpose: Stock lookup, low-stock alerts
Indexes:
  { tenantId: 1, productId: 1, warehouseId: 1 }  // UNIQUE — stock lookup
  { tenantId: 1, quantity: 1 }                     // Low stock scanner
  { tenantId: 1, warehouseId: 1 }                  // Warehouse stock take


STOCK_MOVEMENTS
───────────────
Purpose: Inventory audit trail
Indexes:
  { tenantId: 1, productId: 1, createdAt: -1 }   // Product history
  { tenantId: 1, referenceType: 1, referenceId: 1 }  // Transaction lookup
  { tenantId: 1, createdAt: -1 }                   // Report queries


CUSTOMERS
─────────
Purpose: Customer lookup, search
Indexes:
  { tenantId: 1, phone: 1 }                // UNIQUE — phone lookup
  { tenantId: 1, email: 1 }               // SPARSE UNIQUE — email lookup
  { tenantId: 1, name: "text", phone: "text" }  // Customer search
  { tenantId: 1, totalSpent: -1 }           // Top customers
  { tenantId: 1, lastVisitAt: -1 }          // Inactive customers


AUDIT_LOGS
──────────
Purpose: Audit trail queries
Indexes:
  { tenantId: 1, createdAt: -1 }
  { tenantId: 1, aggregateType: 1, aggregateId: 1, createdAt: -1 }
  { tenantId: 1, eventName: 1, createdAt: -1 }
  { tenantId: 1, correlationId: 1 }


DAILY_METRICS
─────────────
Purpose: Dashboard & reporting
Indexes:
  { tenantId: 1, date: -1 }                // UNIQUE — date range queries


NOTIFICATIONS
─────────────
Purpose: Sending worker, history
Indexes:
  { status: 1, createdAt: 1 }              // Retry worker (global scan)
  { tenantId: 1, status: 1, createdAt: -1 }
  { tenantId: 1, referenceId: 1 }
```

### 8.2 Index Design Principles

```
PRINCIPLE                     WHY
─────────────────────────  ─────────────────────────────────────────
Every query has tenantId   All tenant queries MUST start with tenantId
Compound indexes with      MongoDB uses leftmost prefix; tenantId first
  tenantId as prefix       ensures efficient sharding later
ESR rule (Equality, Sort, Index fields ordered: eq fields first,
  Range)                   then sort, then range
Covering queries           When possible, include all needed fields
                           in the index to avoid document lookup
Use sparse indexes for     email, domain fields are optional
  nullable fields
Avoid over-indexing        Each index slows writes. Only create for
                           identified query patterns.
Monitor with               Remove unused indexes based on real usage
  $indexStats
```

### 8.3 Example ESR Index Application

```javascript
// Query:
db.orders.find({
  tenantId: "tnt_abc123",           // EQUALITY
  status: "paid",                    // EQUALITY
  createdAt: {                       // RANGE
    $gte: ISODate("2026-06-01"),
    $lt: ISODate("2026-07-01")
  }
}).sort({ createdAt: -1 });           // SORT

// Optimal index (ESR order):
{ tenantId: 1, status: 1, createdAt: -1 }
//  [EQUALITY]  [EQUALITY]  [SORT/RANGE]
```

---

## 9. Future Scalability Strategy

### 9.1 Growth Phases

```
PHASE 1: 10-100 tenants
═══════════════════════════
Architecture: Single MongoDB replica set
  - Primary: reads + writes
  - Secondary: analytics queries, backup
Database: Database-per-tenant on same replica set
Connection: Connection pool of 50-200 connections
Storage: < 100GB total
Concern: None

PHASE 2: 100-1000 tenants
═══════════════════════════
Architecture: Single replica set with read preference
  - Some tenants grow large (500MB+ each)
  - Consider: Separate analytics node for reporting queries
Database: Database-per-tenant, but migrate large tenants
  to dedicated replica set
Connection: Connection pooling with TTL (close idle)
Storage: 100GB - 1TB
Concern: Backup time growing. One large tenant can
  impact others (slow query, index build).

PHASE 3: 1000-10000 tenants
═══════════════════════════
Architecture: Sharded cluster
  - Shard key: tenantId (hashed)
  - Each tenant's data stays on one shard (by database-per-tenant
    pattern, but shards distribute databases)
  - Config servers for metadata
  - Mongos routers for query routing
Database: Databases distributed across shards
Connection: Mongos provides unified connection
Storage: > 1TB
Concern: Cross-shard queries (rare). Global admin ops.
```

### 9.2 Sharding Strategy

```javascript
// At scale (10,000+ tenants), enable sharding:

// 1. Enable sharding on the cluster
sh.enableSharding("posmono_system");

// 2. Each tenant database is on a specific shard
//    (not the database itself sharded — each DB stays on one node)
//    This keeps database-per-tenant benefits while distributing load.

// Shard assignment:
// Shard A: posmono_tnt_aaaa through posmono_tnt_mmmm
// Shard B: posmono_tnt_nnnn through posmono_tnt_zzzz

// 3. Use a shard key lookup service:
//    Redis: tenantId → { shard: "shardA", database: "posmono_tnt_abc" }
//    ConnectionManager routes to correct shard's mongos
```

### 9.3 Backup Strategy

```
PHASE                   STRATEGY                              RPO         RTO
─────────────────  ───────────────────────────────────────  ─────────  ──────────
10-100 tenants     mongodump per database (rotating)        Daily      4 hours
                   + oplog tailing for point-in-time
100-1000 tenants   MongoDB Atlas continuous backup          < 1 hour   30 minutes
                   or: volume snapshot + oplog
10000+ tenants     Sharded cluster backup via               < 1 hour   15 minutes
                   Atlas / Percona Operator
```

### 9.4 Database-per-Tenant Operational Checklist

```
DAILY OPERATIONS
─────────────────
✅ Monitor per-tenant DB size (alert > 1GB)
✅ Monitor per-tenant connection count
✅ Monitor slow queries per tenant
✅ Check failed connection attempts (suspended tenant still hitting API?)

WEEKLY OPERATIONS
─────────────────
✅ Review index usage ($indexStats) — drop unused indexes
✅ Review query performance — add missing indexes
✅ Archive old audit_logs (> 90 days) to cold storage
✅ Archive old stock_movements (> 1 year) if needed

MONTHLY OPERATIONS
───────────────────
✅ tenant deletion cleanup (drop databases for cancelled > 30 days)
✅ Review storage growth trends
✅ Test tenant restore from backup
✅ Update connection pool sizing

QUARTERLY OPERATIONS
────────────────────
✅ Review shard distribution if applicable
✅ Load test with projected tenant count
✅ Update scaling plan for next quarter
```

---

## Appendix: Quick Reference

### Collection Count per Tenant

```
CORE COLLECTIONS
─────────────────
users                    1
roles                    1
tenant_settings          1
categories               ~20
products                 ~200
product_variants         ~50
product_pricing          ~200
warehouses               1-3
inventory_items          ~200
stock_movements          ~5000/month
carts                    ~100
orders                   ~1000/month
order_items              ~3000/month
order_status_history     ~3000/month
payments                 ~1000/month
payment_transactions     ~1000/month
refunds                  ~10/month
customers                ~200
loyalty_points           ~50
notifications            ~3000/month
daily_metrics            ~365/year
audit_logs               ~5000/month

EXTENSION COLLECTIONS
──────────────────────
restaurant_tables         ~20
restaurant_kitchen_orders ~1000/month
hospitality_rooms         ~10
hospitality_bookings      ~100/month
```

### Naming Conventions

```
COLLECTION NAMES:  snake_case, plural
FIELD NAMES:       camelCase (JS convention)
IDs:               prefix_nanoid
  User:            usr_
  Role:            rol_
  Product:         prd_
  Order:           ord_
  Payment:         pay_
  Customer:        cst_
  Warehouse:       wh_
  Inventory:       inv_
  Audit:           aud_
  Notification:    not_
  Restaurant:      rst_
  Hospitality:     hos_

DATES:             ISO 8601 (JavaScript Date)
CURRENCY:          Integer (IDR in rupiah, not sen)
                   15000 = Rp 15.000
BOOLEANS:          isActive, isDeleted, isMember, hasModifiers
```

### Anti-Patterns to Avoid

```
❌ DON'T use ObjectId as _id for business entities
   → Use human-readable strings (prd_abc123, ord_xyz789)
   → Debugging is 10x easier

❌ DON'T embed everything
   → Embed only if data is always read together AND bounded
   → Max embedded array size: < 100 items

❌ DON'T skip indexes for "we'll add them later"
   → Every query pattern MUST have a covering index
   → Missing indexes = slow as data grows

❌ DON'T use tenantId as a discriminator in a shared database
   → One bug in a WHERE clause = full data leak
   → Database-per-tenant is the only safe isolation

❌ DON'T hard-delete business data
   → Always soft-delete for compliance and history
   → Hard-delete only for: sessions, temporary carts, failed jobs

❌ DON'T allow cross-tenant queries at the application level
   → Every repository adds tenantId filter automatically
   → If cross-tenant analytics needed, use a separate ETL pipeline
```
