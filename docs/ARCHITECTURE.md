# ARCHITECTURE

> POSMono — System Architecture Documentation

---

## 1. HIGH-LEVEL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │   React  │  │  Mobile  │  │  Desktop │              │
│  │   (PWA)  │  │(Capacitor)│  │ (Electron)│             │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │              │                    │
│       └──────────────┴──────────────┘                    │
│                        │  HTTP / Socket.io               │
└────────────────────────┼────────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────────┐
│              API GATEWAY (Express)                       │
│  ┌──────────────────────────────────────────────┐       │
│  │         MIDDLEWARE CHAIN                      │       │
│  │  Auth → Tenant → RBAC → Validation → Cache   │       │
│  └──────────────────────────────────────────────┘       │
│                         │                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │              MODULAR MONOLITH                     │   │
│  │                                                   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐          │   │
│  │  │ Identity │ │ Catalog  │ │ Ordering │          │   │
│  │  │  Module  │ │  Module  │ │  Module  │          │   │
│  │  └──────────┘ └──────────┘ └──────────┘          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐          │   │
│  │  │ Payment  │ │Inventory │ │  POS     │          │   │
│  │  │  Module  │ │  Module  │ │  Module  │          │   │
│  │  └──────────┘ └──────────┘ └──────────┘          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐          │   │
│  │  │ Customer │ │ Report   │ │ Billing  │          │   │
│  │  │  Module  │ │  Module  │ │  Module  │          │   │
│  │  └──────────┘ └──────────┘ └──────────┘          │   │
│  │                                                   │   │
│  │  ┌────────────────────────────────────────────┐   │   │
│  │  │         BUSINESS MODULES                    │   │   │
│  │  │  Retail ◄── Restaurant ◄── Hospitality      │   │   │
│  │  └────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
│                         │                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │           INFRASTRUCTURE SERVICES                 │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐          │   │
│  │  │  Event   │ │  Queue   │ │  Cache   │          │   │
│  │  │   Bus    │ │ (BullMQ) │ │ (Redis)  │          │   │
│  │  └──────────┘ └──────────┘ └──────────┘          │   │
│  │  ┌──────────┐ ┌──────────┐                        │   │
│  │  │  Logger  │ │  Multi-  │                        │   │
│  │  │ (Pino)   │ │  Tenant  │                        │   │
│  │  │          │ │  DB Con  │                        │   │
│  │  └──────────┘ └──────────┘                        │   │
│  └──────────────────────────────────────────────────┘   │
│                         │                                │
└────────────────────────┼────────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────────┐
│          DATA LAYER                                      │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │   MongoDB     │  │    Redis     │                     │
│  │  (Primary DB) │  │  (Cache/Q)   │                     │
│  └──────────────┘  └──────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

---

## 2. FOLDER STRUCTURE

```
/workspace/
├── backend/
│   └── src/
│       ├── @shared/                    # DDD building blocks
│       │   ├── domain/                 # AggregateRoot, Entity, ValueObject
│       │   ├── application/            # UseCase, Command, Query, Result
│       │   └── infrastructure/         # MongoRepo, EventBus, Logger
│       ├── bootstrap/                  # App entry, DI container, routes
│       ├── core/                       # Core domain modules
│       │   ├── identity/               # Auth, users, roles, permissions
│       │   ├── tenant/                 # Multi-tenant management
│       │   ├── catalog/                # Products, categories, variants
│       │   ├── ordering/               # Orders, cart, checkout
│       │   ├── payment/                # Payments, Midtrans gateway
│       │   ├── inventory/              # Stock, movements, adjustments
│       │   ├── pos/                    # Shift management
│       │   ├── customer/               # Customer profiles
│       │   ├── notification/           # WhatsApp, email
│       │   ├── reporting/              # Daily metrics, aggregation
│       │   └── billing/                # Subscription (post-MVP)
│       ├── modules/                    # Business-specific logic
│       │   ├── retail/
│       │   ├── restaurant/
│       │   └── hospitality/
│       └── seed.ts                     # Demo data seeder
├── frontend/
│   └── src/
│       ├── @shared/                    # API client, stores, types
│       ├── app/                        # Router, layouts
│       ├── core/                       # Feature modules
│       │   ├── auth/
│       │   ├── pos/
│       │   ├── dashboard/
│       │   ├── orders/
│       │   ├── products/
│       │   ├── inventory/
│       │   ├── customers/
│       │   ├── payments/
│       │   ├── reports/
│       │   ├── settings/
│       │   └── tenant/
│       └── shell/                      # Capacitor/Electron entrypoints
├── shared/                             # Shared package
│   └── src/
│       ├── types/                      # Domain types, DTOs, API, events
│       ├── validation/                 # Zod schemas
│       └── constants/                  # Events, permissions, errors
└── docker/                             # Docker configs
```

---

## 3. DOMAIN-DRIVEN DESIGN (DDD)

### 3.1 Building Blocks

Each core module follows the same DDD structure:

```
module/
├── domain/
│   ├── {Entity}.ts           # Rich domain model
│   ├── {Entity}Id.ts         # Typed identifier
│   ├── events/               # Domain events
│   └── repositories/         # Repository interfaces
├── application/
│   ├── commands/             # Command handlers
│   ├── queries/              # Query handlers
│   ├── services/             # Application services
│   ├── dto/                  # Data transfer objects
│   └── eventHandlers/        # Event subscribers
├── infrastructure/
│   ├── persistence/          # Mongo schemas + repositories
│   └── services/             # External service adapters
└── interfaces/
    └── http/
        ├── controller.ts     # Request handlers
        └── routes.ts         # Route definitions
```

### 3.2 Domain Modules Overview

| Module | Aggregate Root | Key Entities | Status |
|--------|---------------|--------------|--------|
| Identity | User | User, Role, Permission | ✅ Domain + Application + HTTP |
| Tenant | Tenant | Tenant | ✅ Domain + Infrastructure |
| Catalog | Product | Product, Category, Variant | ✅ Domain, ⚠️ No HTTP |
| Ordering | Order | Order, OrderItem | ✅ Domain, ⚠️ No HTTP |
| Payment | Payment | Payment, Transaction | ✅ Domain, ⚠️ No HTTP |
| Inventory | Stock | Stock | ✅ Domain, ⚠️ No HTTP |
| POS | Shift | Shift | ✅ Domain only |
| Customer | Customer | Customer | ✅ Domain only |
| Notification | Notification | Notification | ✅ Domain + Service |
| Reporting | Report | DailyMetric | ✅ Domain only |
| Billing | — | — | ❌ Stub |

---

## 4. DATABASE ARCHITECTURE

### 4.1 Multi-Tenant Strategy

**Chosen: Shared database with tenant-scoped collections.**

Every document has a `tenantId` field. Queries always include `tenantId` filter via middleware.

```
Database: posmono
├── users        [{ tenantId, email, role, ... }]
├── roles        [{ tenantId, name, permissions, ... }]
├── tenants      [{ slug, name, domain, config, ... }]
├── products     [{ tenantId, sku, name, price, ... }]
├── categories   [{ tenantId, name, parent, ... }]
├── orders       [{ tenantId, number, items, total, ... }]
├── payments     [{ tenantId, amount, method, status, ... }]
├── stocks       [{ tenantId, productId, quantity, ... }]
├── shifts       [{ tenantId, openedAt, closedAt, ... }]
├── customers    [{ tenantId, name, phone, ... }]
├── notifications[{ tenantId, type, status, ... }]
└── dailyMetrics [{ tenantId, date, revenue, orders, ... }]
```

### 4.2 Key Indexes

```javascript
// Tenant-scoped unique indexes
users.createIndex({ tenantId: 1, email: 1 }, { unique: true })
products.createIndex({ tenantId: 1, sku: 1 }, { unique: true })
orders.createIndex({ tenantId: 1, number: 1 }, { unique: true })

// Query indexes
products.createIndex({ tenantId: 1, name: 'text', sku: 1 })
orders.createIndex({ tenantId: 1, createdAt: -1 })
stocks.createIndex({ tenantId: 1, productId: 1 }, { unique: true })
```

---

## 5. EVENT-DRIVEN ARCHITECTURE

### 5.1 Event Bus

In-process event bus using `EventEmitter` (replacable with Redis/BullMQ post-MVP).

```
Publish ──→ EventBus ──→ Subscriber 1
                    ──→ Subscriber 2
                    ──→ Subscriber 3
```

### 5.2 Domain Events

| Event | Publisher | Subscribers |
|-------|-----------|-------------|
| `UserRegistered` | Identity | Notification (send welcome) |
| `UserLoggedIn` | Identity | — |
| `TenantCreated` | Tenant | — |
| `ProductCreated` | Catalog | Inventory (init stock) |
| `ProductUpdated` | Catalog | — |
| `OrderCreated` | Ordering | Inventory (reserve stock), Payment (process) |
| `OrderConfirmed` | Ordering | Reporting (update metrics) |
| `PaymentCompleted` | Payment | Ordering (mark paid), Reporting |
| `PaymentFailed` | Payment | Ordering (mark failed) |
| `StockAdjusted` | Inventory | Notification (low stock alert) |
| `StockLow` | Inventory | Notification (alert) |

---

## 6. AUTHENTICATION FLOW

```
Login Request
     │
     ▼
  POST /api/auth/login ──→ authenticate middleware
     │                         │
     │                    ┌─────┴──────┐
     │                    │            │
     ▼                    ▼            ▼
  AuthService.authenticate()     TenantContext middleware
     │                              │
     ├─ Find user by email          ├─ Extract X-Tenant-Id header
     ├─ Verify password (bcrypt)    ├─ Verify tenant exists
     ├─ Generate accessToken (JWT)  ├─ Inject tenantId into req
     └─ Return tokens + user        └─ Continue to controller
```

JWT Payload:

```json
{
  "sub": "userId",
  "tenantId": "tenantId",
  "role": "admin",
  "permissions": ["product:create", "order:read", "..."],
  "iat": 1680000000,
  "exp": 1680086400
}
```

---

## 7. API STRUCTURE

All routes prefixed with `/api/`.

| Method | Path | Auth | Permission | Description |
|--------|------|------|------------|-------------|
| POST | `/auth/login` | No | — | Login |
| POST | `/auth/register` | No | — | Register |
| POST | `/auth/refresh` | Yes | — | Refresh token |
| GET | `/products` | Yes | `product:read` | List products |
| POST | `/products` | Yes | `product:create` | Create product |
| GET | `/products/:id` | Yes | `product:read` | Get product |
| PUT | `/products/:id` | Yes | `product:update` | Update product |
| DELETE | `/products/:id` | Yes | `product:delete` | Delete product |
| GET | `/orders` | Yes | `order:read` | List orders |
| POST | `/orders` | Yes | `order:create` | Create order |
| GET | `/orders/:id` | Yes | `order:read` | Get order |
| POST | `/payments` | Yes | `payment:create` | Process payment |
| GET | `/inventory` | Yes | `inventory:read` | Get stock levels |
| POST | `/inventory/adjust` | Yes | `inventory:adjust` | Adjust stock |
| GET | `/customers` | Yes | `customer:read` | List customers |
| GET | `/reports/daily` | Yes | `report:read` | Daily sales report |
| POST | `/tenants` | Yes | `admin` | Create tenant |

---

## 8. INFRASTRUCTURE

### Docker Setup

```yaml
services:
  mongodb:  # mongo:7 — primary database
  redis:    # redis:7-alpine — cache + queue
  app:      # multi-stage Node.js build
```

### Ports

| Service | Port |
|---------|------|
| App (backend) | 3000 |
| MongoDB | 27017 |
| Redis | 6379 |
| Mongo Express (dev) | 8081 |

### CI/CD Pipeline (planned)

```
Git Push → GitHub Actions → Build → Test → Docker Build → Deploy to VPS
```
