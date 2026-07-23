# POSMono — Modular SaaS Architecture

## Table of Contents

1. [Architecture Philosophy](#1-architecture-philosophy)
2. [Repository Structure](#2-repository-structure)
3. [Backend Structure](#3-backend-structure)
4. [Frontend Structure](#4-frontend-structure)
5. [Shared Packages](#5-shared-packages)
6. [Domain Event Catalog](#6-domain-event-catalog)
7. [Multi-Tenancy Strategy](#7-multi-tenancy-strategy)
8. [Module System](#8-module-system)
9. [Why This Scales](#9-why-this-scales)

---

## 1. Architecture Philosophy

```
┌─────────────────────────────────────────────────────────┐
│                    POSMono Platform                      │
├─────────────────────────────────────────────────────────┤
│   ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │
│   │  Retail   │  │Restaurant│  │    Hospitality       │ │
│   │  Module   │  │  Module  │  │      Module          │ │
│   └────┬─────┘  └────┬─────┘  └──────────┬───────────┘ │
│        │              │                   │             │
│   ┌────┴──────────────┴───────────────────┴──────────┐ │
│   │              Core Bounded Contexts                │ │
│   │  (Identity, Tenant, Catalog, Ordering, Inventory, │ │
│   │   POS, Customer, Payment, Billing, Reporting)     │ │
│   └───────────────────────┬───────────────────────────┘ │
│                           │                             │
│   ┌───────────────────────┴───────────────────────────┐ │
│   │              Shared Kernel                        │ │
│   │  (Base DDD classes, Event Bus, Infrastructure)    │ │
│   └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Key principles:**
- **Modular Monolith** first — microservice extraction later when justified by load/team boundaries
- **Bounded Contexts** with strict internal cohesion and loose coupling via events
- **Tenant-isolated data** at the database level (database-per-tenant strategy)
- **Event-Driven** communication between contexts (never direct imports between domains)
- **Plugin Architecture** — modules register themselves with the core via declarative manifests

---

## 2. Repository Structure

```
POSMono/
│
├── backend/                    # Node.js + Express backend
├── frontend/                   # React + Vite PWA frontend
├── shared/                     # Shared types, validation, constants
│
├── docker/                     # Docker Compose, Dockerfiles
├── docs/                       # Architecture & API documentation
│
├── package.json                # Root workspace config (pnpm workspaces)
├── pnpm-workspace.yaml
├── turbo.json                  # Turborepo config
├── .env.example
└── README.md
```

**Why this top-level split:** Backend, frontend, and shared are separate workspaces with independent build pipelines. `shared` is a compile-time dependency for both — it prevents type drift between API contracts.

---

## 3. Backend Structure

```
backend/
│
├── src/
│   │
│   ├── @shared/                          # Shared Kernel
│   │   ├── domain/                       #   DDD building blocks
│   │   │   ├── AggregateRoot.ts          #   Base aggregate — tracks domain events
│   │   │   ├── Entity.ts                 #   Base entity with identity comparison
│   │   │   ├── ValueObject.ts            #   Immutable value object base
│   │   │   ├── DomainEvent.ts            #   Event envelope with ID, timestamp, metadata
│   │   │   ├── Identifier.ts             #   Typed ID (e.g., TenantId, OrderId)
│   │   │   ├── DomainService.ts          #   Stateless domain logic interface
│   │   │   ├── DomainError.ts            #   Typed domain errors
│   │   │   ├── Guard.ts                  #   Precondition validation
│   │   │   └── Repository.ts             #   Generic repository interface
│   │   │
│   │   ├── application/                  #   Base application patterns
│   │   │   ├── Command.ts                #   CQRS command marker
│   │   │   ├── Query.ts                  #   CQRS query marker
│   │   │   ├── UseCase.ts                #   Abstract use case with error handling
│   │   │   ├── CommandHandler.ts         #   Command handler interface
│   │   │   ├── QueryHandler.ts           #   Query handler interface
│   │   │   ├── EventHandler.ts           #   Event handler interface
│   │   │   └── Result.ts                 #   Discriminated union result type
│   │   │
│   │   ├── infrastructure/               #   Shared infra implementations
│   │   │   ├── database/                 #     MongoDB connection management
│   │   │   │   ├── ConnectionManager.ts  #     Multi-tenant connection pool
│   │   │   │   ├── TenantDatabase.ts     #     Per-tenant DB resolver
│   │   │   │   ├── MongoRepository.ts    #     Base CRUD repository
│   │   │   │   └── migrations/           #     Schema migrations
│   │   │   ├── eventBus/                 #     In-process event bus
│   │   │   │   ├── EventBus.ts           #     Pub/sub implementation
│   │   │   │   └── EventBusMiddleware.ts #     Logging, tracing middleware
│   │   │   ├── messaging/                #     Real-time messaging
│   │   │   │   ├── SocketManager.ts      #     Socket.IO server manager
│   │   │   │   └── room/                 #     Tenant-isolated rooms
│   │   │   ├── queue/                    #     Background job processing
│   │   │   │   ├── QueueManager.ts       #     BullMQ queue factory
│   │   │   │   ├── workers/              #     Worker definitions
│   │   │   │   └── jobs/                 #     Job type definitions
│   │   │   ├── cache/                    #     Redis caching layer
│   │   │   │   ├── CacheManager.ts       #     Typed cache abstraction
│   │   │   │   └── policies/             #     Cache invalidation policies
│   │   │   ├── logger/                   #     Structured logging
│   │   │   │   ├── Logger.ts             #     Pino-based logger
│   │   │   │   └── correlationId.ts      #     Request tracing
│   │   │   ├── monitor/                  #     Observability
│   │   │   │   └── Metrics.ts            #     Prometheus metrics
│   │   │   ├── error/                    #     Error handling infra
│   │   │   │   ├── AppError.ts           #     Base application error
│   │   │   │   └── ErrorMapper.ts        #     Domain→HTTP error mapping
│   │   │   └── validation/               #     Shared validation
│   │   │       └── Validator.ts          #     Zod schema validator
│   │   │
│   │   ├── interfaces/                   #   Shared HTTP layer utilities
│   │   │   ├── BaseController.ts         #     Request/response wrapper
│   │   │   ├── middleware/
│   │   │   │   ├── tenantContext.ts       #     Resolve tenant from request
│   │   │   │   ├── authenticate.ts        #     JWT verification
│   │   │   │   ├── authorize.ts           #     RBAC permission check
│   │   │   │   ├── rateLimiter.ts         #     Per-tenant rate limiting
│   │   │   │   ├── requestLogger.ts       #     HTTP request logging
│   │   │   │   ├── errorHandler.ts        #     Global error handler
│   │   │   │   ├── validate.ts            #     Zod request validation
│   │   │   │   └── asyncHandler.ts        #     Async error wrapper
│   │   │   └── errors.ts                 #     HTTP error classes
│   │   │
│   │   └── config/                       #   Global configuration
│   │       ├── env.ts                    #     Env vars with Zod validation
│   │       ├── database.ts               #     DB connection config
│   │       ├── redis.ts                  #     Redis connection config
│   │       ├── midtrans.ts               #     Payment gateway config
│   │       └── modules.ts                #     Feature flag configuration
│   │
│   ├── core/                             # Core Bounded Contexts
│   │   │
│   │   ├── identity/                     # Bounded Context: Authentication & Authorization
│   │   │   ├── domain/
│   │   │   │   ├── User.ts               #     User aggregate root
│   │   │   │   ├── Role.ts               #     Role entity
│   │   │   │   ├── Permission.ts         #     Permission value object
│   │   │   │   ├── events/
│   │   │   │   │   ├── UserRegistered.ts
│   │   │   │   │   └── UserLoggedIn.ts
│   │   │   │   └── services/
│   │   │   │       └── PasswordService.ts #     Domain password policy
│   │   │   ├── application/
│   │   │   │   ├── commands/
│   │   │   │   │   ├── RegisterUser.ts
│   │   │   │   │   ├── LoginUser.ts
│   │   │   │   │   └── AssignRole.ts
│   │   │   │   ├── queries/
│   │   │   │   │   ├── GetUser.ts
│   │   │   │   │   └── ListUsers.ts
│   │   │   │   ├── eventHandlers/
│   │   │   │   │   └── SendWelcomeNotification.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── AuthService.ts      #     Login/logout orchestration
│   │   │   │   │   └── TokenService.ts     #     JWT generation
│   │   │   │   └── dto/
│   │   │   │       ├── LoginRequest.ts
│   │   │   │       ├── LoginResponse.ts
│   │   │   │       └── UserResponse.ts
│   │   │   ├── infrastructure/
│   │   │   │   ├── persistence/
│   │   │   │   │   ├── MongoUserRepository.ts
│   │   │   │   │   └── schemas/
│   │   │   │   │       ├── UserSchema.ts
│   │   │   │   │       └── RoleSchema.ts
│   │   │   │   └── auth/
│   │   │   │       ├── JwtStrategy.ts
│   │   │   │       └── BcryptHasher.ts
│   │   │   └── interfaces/
│   │   │       ├── http/
│   │   │       │   ├── controllers/
│   │   │       │   │   ├── AuthController.ts
│   │   │       │   │   └── UserController.ts
│   │   │       │   └── routes/
│   │   │       │       ├── auth.routes.ts
│   │   │       │       └── user.routes.ts
│   │   │       └── events/
│   │   │           └── UserEventPublisher.ts  #     Publishes domain events to bus
│   │   │
│   │   ├── tenant/                     # Bounded Context: Multi-Tenant Management
│   │   │   ├── domain/
│   │   │   │   ├── Tenant.ts           #     Tenant aggregate root
│   │   │   │   ├── Subscription.ts     #     Subscription entity
│   │   │   │   ├── TenantConfig.ts     #     Tenant configuration value object
│   │   │   │   └── events/
│   │   │   │       ├── TenantCreated.ts
│   │   │   │       └── TenantSuspended.ts
│   │   │   ├── application/
│   │   │   │   ├── commands/
│   │   │   │   ├── queries/
│   │   │   │   ├── eventHandlers/
│   │   │   │   └── services/
│   │   │   ├── infrastructure/
│   │   │   │   ├── persistence/
│   │   │   │   └── resolvers/          #     Tenant identification strategies
│   │   │   └── interfaces/
│   │   │       ├── http/
│   │   │       └── events/
│   │   │
│   │   ├── catalog/                   # Bounded Context: Product Catalog
│   │   │   ├── domain/
│   │   │   │   ├── Product.ts         #     Product aggregate root
│   │   │   │   ├── Category.ts        #     Category entity
│   │   │   │   ├── Family.ts          #     Family entity (top-level grouping)

│   │   │   │   ├── Variant.ts         #     Variant entity (size, color)
│   │   │   │   ├── Modifier.ts        #     Modifier group (add-ons, extras)
│   │   │   │   └── events/
│   │   │   │       ├── ProductCreated.ts
│   │   │   │       └── ProductUpdated.ts
│   │   │   ├── application/
│   │   │   │   ├── commands/
│   │   │   │   ├── queries/
│   │   │   │   ├── eventHandlers/
│   │   │   │   └── dto/
│   │   │   ├── infrastructure/
│   │   │   │   └── persistence/
│   │   │   └── interfaces/
│   │   │       ├── http/
│   │   │       └── events/
│   │   │
│   │   ├── ordering/                  # Bounded Context: Orders & Cart
│   │   │   ├── domain/
│   │   │   │   ├── Order.ts           #     Order aggregate root
│   │   │   │   ├── OrderItem.ts       #     Order line item entity
│   │   │   │   ├── Cart.ts            #     Shopping cart aggregate
│   │   │   │   ├── OrderStatus.ts     #     Status value object (state machine)
│   │   │   │   └── events/
│   │   │   │       ├── OrderCreated.ts
│   │   │   │       ├── OrderConfirmed.ts
│   │   │   │       └── OrderCancelled.ts
│   │   │   ├── application/
│   │   │   │   ├── commands/
│   │   │   │   ├── queries/
│   │   │   │   ├── eventHandlers/
│   │   │   │   └── dto/
│   │   │   ├── infrastructure/
│   │   │   │   └── persistence/
│   │   │   └── interfaces/
│   │   │       ├── http/
│   │   │       └── events/
│   │   │
│   │   ├── inventory/                 # Bounded Context: Inventory & Stock
│   │   │   ├── domain/
│   │   │   │   ├── Stock.ts           #     Stock aggregate root
│   │   │   │   ├── Warehouse.ts       #     Warehouse entity
│   │   │   │   ├── StockMovement.ts   #     Stock transaction entity
│   │   │   │   └── events/
│   │   │   │       ├── StockAdjusted.ts
│   │   │   │       └── LowStockAlert.ts
│   │   │   ├── application/
│   │   │   ├── infrastructure/
│   │   │   └── interfaces/
│   │   │
│   │   ├── pos/                       # Bounded Context: Point of Sale
│   │   │   ├── domain/
│   │   │   │   ├── Register.ts        #     Cash register entity
│   │   │   │   ├── Shift.ts           #     Cashier shift aggregate
│   │   │   │   ├── PaymentSession.ts  #     Current transaction session
│   │   │   │   └── events/
│   │   │   │       ├── ShiftOpened.ts
│   │   │   │       ├── ShiftClosed.ts
│   │   │   │       └── SaleCompleted.ts
│   │   │   ├── application/
│   │   │   ├── infrastructure/
│   │   │   └── interfaces/
│   │   │
│   │   ├── customer/                  # Bounded Context: Customer Management
│   │   │   ├── domain/
│   │   │   │   ├── Customer.ts
│   │   │   │   ├── Loyalty.ts
│   │   │   │   └── events/
│   │   │   │       └── CustomerCreated.ts
│   │   │   ├── application/
│   │   │   ├── infrastructure/
│   │   │   └── interfaces/
│   │   │
│   │   ├── payment/                   # Bounded Context: Payment Processing
│   │   │   ├── domain/
│   │   │   │   ├── Payment.ts         #     Payment aggregate root
│   │   │   │   ├── PaymentMethod.ts   #     Payment method value object
│   │   │   │   ├── Transaction.ts     #     Payment transaction entity
│   │   │   │   ├── Refund.ts          #     Refund entity
│   │   │   │   └── events/
│   │   │   │       ├── PaymentCompleted.ts
│   │   │   │       ├── PaymentFailed.ts
│   │   │   │       └── RefundProcessed.ts
│   │   │   ├── application/
│   │   │   │   ├── commands/
│   │   │   │   ├── queries/
│   │   │   │   ├── eventHandlers/
│   │   │   │   └── services/
│   │   │   │       └── PaymentGateway.ts    #     Gateway abstraction
│   │   │   ├── infrastructure/
│   │   │   │   ├── persistence/
│   │   │   │   └── midtrans/               #     Midtrans adapter implementation
│   │   │   │       ├── MidtransGateway.ts
│   │   │   │       ├── MidtransWebhook.ts
│   │   │   │       └── eccr/
│   │   │   └── interfaces/
│   │   │       ├── http/
│   │   │       │   ├── controllers/
│   │   │       │   └── webhooks/           #     Payment webhook endpoints
│   │   │       └── events/
│   │   │
│   │   ├── billing/                   # Bounded Context: SaaS Billing & Subscriptions
│   │   │   ├── domain/
│   │   │   │   ├── Plan.ts
│   │   │   │   ├── Subscription.ts
│   │   │   │   ├── Invoice.ts
│   │   │   │   └── events/
│   │   │   │       ├── SubscriptionCreated.ts
│   │   │   │       └── InvoicePaid.ts
│   │   │   ├── application/
│   │   │   ├── infrastructure/
│   │   │   └── interfaces/
│   │   │
│   │   ├── notification/              # Bounded Context: Notifications
│   │   │   ├── domain/
│   │   │   │   ├── Notification.ts
│   │   │   │   ├── Template.ts
│   │   │   │   └── events/
│   │   │   │       └── NotificationSent.ts
│   │   │   ├── application/
│   │   │   │   └── services/
│   │   │   │       ├── NotificationService.ts  #     Orchestrates multi-channel
│   │   │   │       └── TemplateRenderer.ts
│   │   │   ├── infrastructure/
│   │   │   │   ├── channels/
│   │   │   │   │   ├── EmailProvider.ts
│   │   │   │   │   ├── WhatsAppProvider.ts     #     n8n webhook integration
│   │   │   │   │   └── PushProvider.ts
│   │   │   │   └── persistence/
│   │   │   └── interfaces/
│   │   │       └── events/
│   │   │
│   │   └── reporting/                 # Bounded Context: Analytics & Reports
│   │       ├── domain/
│   │       │   ├── Report.ts
│   │       │   ├── Metric.ts
│   │       │   └── Dashboard.ts
│   │       ├── application/
│   │       │   ├── queries/
│   │       │   └── services/
│   │       │       ├── SalesReportService.ts
│   │       │       ├── InventoryReportService.ts
│   │       │       └── DashboardService.ts
│   │       ├── infrastructure/
│   │       │   ├── persistence/
│   │       │   └── aggregation/            #     MongoDB aggregation pipelines
│   │       └── interfaces/
│   │           └── http/
│   │               ├── controllers/
│   │               └── routes/
│   │
│   ├── modules/                          # Optional Business-Type Modules
│   │   │
│   │   ├── restaurant/                   # Module: Restaurant Operations
│   │   │   ├── domain/
│   │   │   │   ├── DiningTable.ts        #     Table aggregate root
│   │   │   │   ├── Reservation.ts        #     Table reservation entity
│   │   │   │   ├── KitchenOrder.ts       #     Kitchen ticket aggregate
│   │   │   │   ├── SplitBill.ts          #     Split bill aggregate
│   │   │   │   ├── WaiterSession.ts      #     Waiter assignment entity
│   │   │   │   ├── FloorPlan.ts          #     Restaurant layout config
│   │   │   │   └── events/
│   │   │   │       ├── TableOccupied.ts
│   │   │   │       ├── OrderSentToKitchen.ts
│   │   │   │       └── OrderReady.ts
│   │   │   ├── application/
│   │   │   │   ├── commands/
│   │   │   │   │   ├── AssignTable.ts
│   │   │   │   │   ├── SendToKitchen.ts
│   │   │   │   │   └── SplitOrder.ts
│   │   │   │   ├── queries/
│   │   │   │   ├── eventHandlers/
│   │   │   │   └── services/
│   │   │   │       └── KitchenDisplayService.ts
│   │   │   ├── infrastructure/
│   │   │   │   ├── persistence/
│   │   │   │   └── printer/              #     ESC/POS thermal printer
│   │   │   │       ├── PrinterAdapter.ts
│   │   │   │       ├── EscPosEncoder.ts
│   │   │   │       └── NetworkPrinter.ts
│   │   │   └── interfaces/
│   │   │       ├── http/
│   │   │       │   ├── controllers/
│   │   │       │   └── routes/
│   │   │       └── socket/               #     Real-time KDS updates
│   │   │           └── KitchenSocket.ts
│   │   │
│   │   ├── hospitality/                  # Module: Hospitality (Villa/Hotel)
│   │   │   ├── domain/
│   │   │   │   ├── Property.ts           #     Villa/Hotel aggregate root
│   │   │   │   ├── Room.ts               #     Room/unit entity
│   │   │   │   ├── RoomType.ts           #     Room category
│   │   │   │   ├── Booking.ts            #     Booking aggregate root
│   │   │   │   ├── Reservation.ts        #     Reservation entity
│   │   │   │   ├── Stay.ts               #     Check-in/check-out aggregate
│   │   │   │   ├── Guest.ts              #     Guest profile entity
│   │   │   │   ├── Housekeeping.ts       #     Housekeeping task aggregate
│   │   │   │   ├── Amenity.ts            #     Amenity value object
│   │   │   │   └── events/
│   │   │   │       ├── BookingConfirmed.ts
│   │   │   │       ├── GuestCheckedIn.ts
│   │   │   │       ├── GuestCheckedOut.ts
│   │   │   │       └── HousekeepingTaskCreated.ts
│   │   │   ├── application/
│   │   │   │   ├── commands/
│   │   │   │   │   ├── CreateBooking.ts
│   │   │   │   │   ├── CheckIn.ts
│   │   │   │   │   ├── CheckOut.ts
│   │   │   │   │   └── AssignHousekeeping.ts
│   │   │   │   ├── queries/
│   │   │   │   │   ├── GetAvailability.ts
│   │   │   │   │   └── GetBookingCalendar.ts
│   │   │   │   ├── eventHandlers/
│   │   │   │   └── services/
│   │   │   │       ├── BookingEngine.ts         #     Availability & pricing
│   │   │   │       ├── RevenueManagement.ts     #     Dynamic pricing
│   │   │   │       └── HousekeepingScheduler.ts
│   │   │   ├── infrastructure/
│   │   │   │   ├── persistence/
│   │   │   │   └── calendar/                   #     iCal sync, rate calendar
│   │   │   └── interfaces/
│   │   │       ├── http/
│   │   │       │   ├── controllers/
│   │   │       │   ├── routes/
│   │   │       │   └── webhooks/               #     OTA channel manager webhooks
│   │   │       └── socket/
│   │   │           └── HousekeepingSocket.ts
│   │   │
│   │   └── retail/                            # Module: Retail-Specific Extensions
│   │       ├── domain/
│   │       │   ├── Barcode.ts
│   │       │   ├── Supplier.ts
│   │       │   ├── PurchaseOrder.ts
│   │       │   └── events/
│   │       ├── application/
│   │       ├── infrastructure/
│   │       │   └── barcode/                   #     Barcode scanner support
│   │       └── interfaces/
│   │
│   └── bootstrap/                               # Application Composition Root
│       ├── container.ts                         #   DI container setup (Awilix)
│       ├── eventBus.ts                          #   Wire domain events → handlers
│       ├── moduleLoader.ts                      #   Scan & load enabled modules
│       ├── routes.ts                            #   Aggregate all module routes
│       ├── server.ts                            #   Express app factory
│       └── app.ts                               #   Entry point
│
├── tests/
│   ├── unit/                                     # Pure domain logic tests
│   │   ├── @shared/
│   │   ├── core/
│   │   └── modules/
│   ├── integration/                              # Repository + infra tests (with real DB)
│   │   ├── core/
│   │   └── modules/
│   └── e2e/                                      # API endpoint tests
│       └── api/
│
├── scripts/
│   ├── seed/                                     # Tenant demo data seeding
│   │   ├── retail-seed.ts
│   │   ├── restaurant-seed.ts
│   │   └── hospitality-seed.ts
│   ├── migration/                                # MongoDB migration scripts
│   └── dev/                                      # Dev helper scripts
│
├── docker/
│   ├── Dockerfile                                # Multi-stage production build
│   ├── Dockerfile.dev
│   ├── docker-compose.yml                        # Production stack
│   └── docker-compose.dev.yml                    # Dev stack with hot-reload
│
├── docs/
│   ├── architecture/
│   │   ├── domain-model.md
│   │   ├── event-catalog.md
│   │   └── decisions.md                          # Architecture Decision Records
│   ├── api/
│   │   ├── openapi.yaml
│   │   └── modules/
│   └── deployment/
│       ├── infrastructure.md
│       └── scaling.md
│
├── .env.example
├── package.json
├── tsconfig.json
├── tsconfig.paths.json
├── jest.config.ts
├── nodemon.json
└── .eslintrc.js
```

---

## 4. Frontend Structure

```
frontend/
│
├── src/
│   │
│   ├── @shared/                            # Shared UI Kernel
│   │   ├── components/                     #   Design System (Atomic Design)
│   │   │   ├── atoms/                      #     Button, Input, Badge, Icon, Typography
│   │   │   ├── molecules/                  #     Card, Modal, FormField, DataTable
│   │   │   └── organisms/                  #     Sidebar, Navbar, PageHeader, DataGrid
│   │   ├── hooks/                          #   Shared React hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useTenant.ts
│   │   │   ├── useSocket.ts
│   │   │   ├── usePagination.ts
│   │   │   └── useDebounce.ts
│   │   ├── utils/                          #   Utility functions
│   │   │   ├── formatters.ts               #     Currency, date, phone formatters
│   │   │   └── validators.ts
│   │   ├── types/                          #   Shared frontend types
│   │   │   ├── api.ts                      #     API response/request types
│   │   │   ├── ui.ts                       #     UI state types
│   │   │   └── domain.ts                   #     Domain type mirrors (from shared pkg)
│   │   ├── constants/                      #   App-wide constants
│   │   │   ├── routes.ts
│   │   │   └── permissions.ts
│   │   ├── services/                       #   API client layer
│   │   │   ├── api.ts                      #     Axios instance with interceptors
│   │   │   ├── socket.ts                   #     Socket.IO client
│   │   │   └── queryClient.ts              #     React Query / TanStack Query config
│   │   └── styles/                         #   Global styles & theme
│   │       ├── globals.css
│   │       └── theme.ts
│   │
│   ├── core/                               # Core Feature Modules
│   │   │
│   │   ├── auth/                           # Feature: Authentication
│   │   │   ├── components/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   ├── RegisterForm.tsx
│   │   │   │   └── ProtectedRoute.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useAuth.ts
│   │   │   ├── services/
│   │   │   │   └── authApi.ts
│   │   │   ├── pages/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   ├── RegisterPage.tsx
│   │   │   │   └── ForgotPasswordPage.tsx
│   │   │   └── store/
│   │   │       └── authStore.ts            #     Zustand slice
│   │   │
│   │   ├── dashboard/                      # Feature: Main Dashboard
│   │   │   ├── components/
│   │   │   │   ├── SalesChart.tsx
│   │   │   │   ├── KpiCards.tsx
│   │   │   │   └── RecentOrders.tsx
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── pages/
│   │   │       ├── DashboardPage.tsx
│   │   │       └── AnalyticsPage.tsx
│   │   │
│   │   ├── pos/                            # Feature: POS Terminal
│   │   │   ├── components/
│   │   │   │   ├── ProductGrid.tsx
│   │   │   │   ├── CartPanel.tsx
│   │   │   │   ├── PaymentModal.tsx
│   │   │   │   ├── Numpad.tsx
│   │   │   │   ├── BarcodeInput.tsx
│   │   │   │   └── ReceiptPreview.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useCart.ts
│   │   │   │   └── usePayment.ts
│   │   │   ├── services/
│   │   │   ├── pages/
│   │   │   │   └── PosPage.tsx
│   │   │   └── store/
│   │   │       └── posStore.ts
│   │   │
│   │   ├── orders/                         # Feature: Order Management
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── pages/
│   │   │       ├── OrderListPage.tsx
│   │   │       └── OrderDetailPage.tsx
│   │   │
│   │   ├── inventory/                      # Feature: Inventory Management
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── pages/
│   │   │       ├── StockListPage.tsx
│   │   │       └── StockAdjustmentPage.tsx
│   │   │
│   │   ├── products/                       # Feature: Product Catalog
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   │   └── useProducts.ts           #     Shared hooks: useProductList, useCategoryList, useFamilyList, useCreateProduct, useUpdateProduct, useDeleteProduct, useUpload
│   │   │   ├── services/
│   │   │   └── pages/
│   │   │       └── ProductListPage.tsx      #     Full CRUD: search, 3-level filter, pagination, image upload, tags
│   │   │
│   │   ├── families/                        # Feature: Menu Type Families
│   │   │   ├── pages/
│   │   │   │   └── FamilyListPage.tsx       #     CRUD with Food/Beverage tabs
│   │   │   └── hooks/
│   │   │
│   │   ├── customers/                      # Feature: Customer Management
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── pages/
│   │   │
│   │   ├── payments/                       # Feature: Payment Management
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── pages/
│   │   │
│   │   ├── payment-methods/                # Feature: Payment Method Management
│   │   │   ├── hooks/
│   │   │   │   └── usePaymentMethods.ts    #     Shared hooks: usePaymentMethodList, useCreatePaymentMethod, etc.
│   │   │   └── pages/
│   │   │       └── PaymentMethodListPage.tsx  # CRUD with preset buttons, color picker
│   │   │
│   │   │
│   │   ├── reports/                        # Feature: Reporting
│   │   │   ├── components/
│   │   │   │   ├── ReportFilters.tsx
│   │   │   │   └── ReportChart.tsx
│   │   │   ├── hooks/
│   │   │   ├── pages/
│   │   │   │   ├── SalesReportPage.tsx
│   │   │   │   └── InventoryReportPage.tsx
│   │   │   └── store/
│   │   │
│   │   ├── settings/                       # Feature: Tenant Settings
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   │   ├── GeneralSettingsPage.tsx
│   │   │   │   ├── PaymentSettingsPage.tsx
│   │   │   │   ├── UsersPage.tsx
│   │   │   │   └── BillingPage.tsx
│   │   │   └── store/
│   │   │
│   │   └── tenant/                         # Feature: Tenant Onboarding
│   │       ├── components/
│   │       ├── hooks/
│   │       └── pages/
│   │           └── OnboardingWizardPage.tsx
│   │
│   ├── modules/                            # Optional Business-Type Modules
│   │   │
│   │   ├── restaurant/                     # Module: Restaurant UI
│   │   │   ├── components/
│   │   │   │   ├── FloorPlan.tsx           #     Interactive table map
│   │   │   │   ├── TableCard.tsx
│   │   │   │   ├── KitchenDisplay.tsx      #     KDS screen
│   │   │   │   ├── WaiterOrderPad.tsx
│   │   │   │   └── SplitBillModal.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useTables.ts
│   │   │   │   └── useKitchenOrders.ts
│   │   │   ├── pages/
│   │   │   │   ├── FloorPlanPage.tsx
│   │   │   │   ├── KitchenDisplayPage.tsx
│   │   │   │   └── WaiterOrderPage.tsx
│   │   │   ├── services/
│   │   │   └── store/
│   │   │       └── restaurantStore.ts
│   │   │
│   │   ├── hospitality/                    # Module: Hospitality UI
│   │   │   ├── components/
│   │   │   │   ├── BookingCalendar.tsx
│   │   │   │   ├── RoomGrid.tsx
│   │   │   │   ├── CheckInWizard.tsx
│   │   │   │   ├── CheckOutWizard.tsx
│   │   │   │   ├── GuestProfile.tsx
│   │   │   │   └── HousekeepingBoard.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useAvailability.ts
│   │   │   │   └── useBookings.ts
│   │   │   ├── pages/
│   │   │   │   ├── BookingPage.tsx
│   │   │   │   ├── ReservationCalendarPage.tsx
│   │   │   │   ├── CheckInPage.tsx
│   │   │   │   ├── CheckOutPage.tsx
│   │   │   │   └── HousekeepingPage.tsx
│   │   │   ├── services/
│   │   │   └── store/
│   │   │       └── hospitalityStore.ts
│   │   │
│   │   └── retail/                         # Module: Retail UI
│   │       ├── components/
│   │       │   ├── SupplierList.tsx
│   │       │   └── PurchaseOrderForm.tsx
│   │       ├── hooks/
│   │       ├── pages/
│   │       └── services/
│   │
│   ├── app/                                # App Shell & Configuration
│   │   ├── App.tsx
│   │   ├── router.tsx                      #   Route definitions (lazy-loaded)
│   │   ├── store.ts                        #   Root store setup
│   │   └── providers.tsx                   #   Context providers composition
│   │
│   ├── layouts/                            # Page Layouts
│   │   ├── AuthLayout.tsx
│   │   ├── DashboardLayout.tsx
│   │   ├── PosLayout.tsx
│   │   └── RestaurantLayout.tsx
│   │
│   └── main.tsx                            # Entry point
│
├── public/
│   ├── manifest.json                       # PWA manifest
│   ├── sw.js                               # Service worker
│   ├── icons/                              # App icons (all sizes)
│   └── offline.html                        # Offline fallback
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/                                # Playwright / Cypress
│       └── specs/
│
├── capacitor/                              # Capacitor mobile configuration
│   ├── config.json
│   └── hooks/
│
├── electron/                               # Electron desktop configuration
│   ├── main.ts
│   └── preload.ts
│
├── .env.example
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.ts
├── postcss.config.js
└── .eslintrc.cjs
```

---

## 5. Shared Packages

```
shared/                                              # Cross-platform shared code (TS package)
│
├── types/                                            # TypeScript type definitions
│   ├── domain/                                       #   Domain model types
│   │   ├── identity.ts                               #     User, Role, Permission
│   │   ├── tenant.ts                                 #     Tenant, Subscription
│   │   ├── catalog.ts                                #     Product, Category, Variant
│   │   ├── ordering.ts                               #     Order, OrderItem, OrderStatus
│   │   ├── inventory.ts                              #     Stock, StockMovement
│   │   ├── pos.ts                                    #     Register, Shift
│   │   ├── customer.ts                               #     Customer, Loyalty
│   │   ├── payment.ts                                #     Payment, Transaction, Refund
│   │   └── billing.ts                                #     Plan, Invoice, Subscription
│   ├── events/                                       #   Domain event type definitions
│   │   ├── order-events.ts
│   │   ├── payment-events.ts
│   │   ├── inventory-events.ts
│   │   ├── tenant-events.ts
│   │   └── module-events.ts                          #     Restaurant, hospitality events
│   ├── dto/                                          #   Data Transfer Object types
│   │   ├── api-response.ts                           #     Standardized API response envelope
│   │   ├── pagination.ts
│   │   └── error.ts
│   └── api/                                          #   API contract types
│       ├── requests/
│       └── responses/
│
├── validation/                                       # Shared validation schemas (Zod)
│   ├── schemas/
│   │   ├── auth-schemas.ts
│   │   ├── product-schemas.ts
│   │   ├── order-schemas.ts
│   │   ├── tenant-schemas.ts
│   │   └── module-schemas/                           #     Module-specific schemas
│   │       ├── restaurant-schemas.ts
│   │       └── hospitality-schemas.ts
│   └── rules/                                        #     Reusable validation rules
│       ├── phone.ts
│       └── currency.ts
│
├── constants/                                        # Shared constants
│   ├── permissions.ts                                #   Permission strings enum
│   ├── events.ts                                     #   Event name constants
│   ├── errors.ts                                     #   Error code constants
│   ├── modules.ts                                    #   Module identifiers
│   └── business-types.ts                             #   Retail | Restaurant | Hospitality
│
├── utils/                                            # Cross-platform utilities
│   ├── money.ts                                      #   Currency formatting, tax calc
│   ├── date.ts                                       #   Date/timezone utilities
│   ├── string.ts                                     #   Slug generation, truncation
│   └── permissions.ts                                #   Permission checking helpers
│
├── tsconfig.json                                     # Shared TypeScript configuration
├── package.json
└── index.ts                                          # Barrel exports
```

---

## 6. Domain Event Catalog

Events are the backbone of inter-context communication. Each domain publishes events that other domains (or modules) subscribe to.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DOMAIN EVENTS FLOW                          │
│                                                                     │
│   identity ───► UserRegistered ────────────────► notification      │
│                                                                     │
│   ordering ───► OrderCreated ──┬────────────────► inventory        │
│                │                │                (reserve stock)    │
│                ├────────────────┼────────────────► notification     │
│                │                              │  (order confirmation)│
│                ├────────────────┼────────────────► pos              │
│                │                              │  (update register)  │
│                ├────────────────┼────────────────► restaurant       │
│                │                              │  (send to kitchen) │
│                ▼                              ▼                     │
│              OrderConfirmed ──► payment (process payment)           │
│                                                                     │
│   payment ────► PaymentCompleted ─┬───────────► ordering            │
│                                    │             (mark paid)        │
│                                    ├───────────► billing            │
│                                    │             (if SaaS invoice)  │
│                                    ├───────────► notification       │
│                                    │             (receipt)          │
│                                    ├───────────► reporting          │
│                                    │             (sale metric)      │
│                                    ▼                                │
│                  PaymentFailed ────► ordering (mark failed)         │
│                                                                     │
│   inventory ──► StockAdjusted ────► catalog (update availability)  │
│                ► LowStockAlert ───► notification (reorder alert)   │
│                                                                     │
│   tenant ─────► TenantCreated ────► billing (create subscription)  │
│                                                                     │
│   restaurant ─► OrderSentToKitchen ─► notification (KDS update)    │
│                ► OrderReady ────────► pos (waiter notification)     │
│                                                                     │
│   hospitality ► BookingConfirmed ──► payment (deposit)              │
│               ► GuestCheckedIn ────► housekeeping (clean room)      │
│               ► GuestCheckedOut ───► billing (final invoice)        │
└─────────────────────────────────────────────────────────────────────┘
```

Event schema:

```typescript
interface DomainEvent {
  eventId: string;          // UUID
  eventName: string;        // "ordering.order.created"
  aggregateId: string;      // ID of the aggregate that raised it
  aggregateType: string;    // "Order"
  tenantId: string;         // Tenant isolation
  correlationId: string;    // Trace across contexts
  causationId: string;      // Parent event for causality chain
  occurredAt: Date;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
```

---

## 7. Multi-Tenancy Strategy

```
┌──────────────────────────────────────────────┐
│              Connection Manager               │
│  ┌────────────────────────────────────────┐  │
│  │  Tenant → Database Mapping (in Redis)  │  │
│  │  tenant_abc → mongo://.../posmono_abc  │  │
│  │  tenant_xyz → mongo://.../posmono_xyz  │  │
│  └────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  posmono_abc  │ │  posmono_xyz │ │  posmono_123 │
│  - users      │ │  - users     │ │  - users     │
│  - products   │ │  - products  │ │  - products  │
│  - orders     │ │  - orders    │ │  - orders    │
│  - ...        │ │  - ...       │ │  - ...       │
└──────────────┘ └──────────────┘ └──────────────┘
      (Retail)       (Restaurant)     (Hospitality)
```

**Strategy: Database-per-tenant**

- **Why MongoDB:** Each tenant gets its own database (`posmono_{tenantId}`). This provides:
  - Complete data isolation — no risk of cross-tenant leaks
  - Independent backup/restore per tenant
  - Easy tenant deletion (drop database)
  - No schema pollution between business types
  - Future sharding per tenant if needed

- **Connection pooling:** Use `mongoose.createConnection()` per tenant, cached in a Map with TTL. Redis stores the tenant→database mapping.

- **Shared collections:** System-wide data (platform config, global templates) lives in a `posmono_system` database.

- **Middleware:** The `tenantContext.ts` middleware resolves the tenant from subdomain/header/JWT and attaches it to `req.tenant`. All repository implementations use this to route to the correct database.

- **Module activation:** Each tenant has a `modules.enabled` field in their config (e.g., `["restaurant", "retail"]`). The module loader checks this before registering routes/event handlers.

---

## 8. Module System

Modules are optional, tenant-gated feature packs. They follow the same DDD structure as core contexts.

**Module registration:**

```typescript
// modules/restaurant/index.ts
import { ModuleManifest } from '@shared/types';

const manifest: ModuleManifest = {
  name: 'restaurant',
  version: '1.0.0',
  dependencies: ['ordering', 'inventory', 'pos'],  // Core contexts it extends
  permissions: [
    'restaurant.table.manage',
    'restaurant.kitchen.view',
  ],
  routes: './interfaces/http/routes',
  eventHandlers: {
    'ordering.order.created': './application/eventHandlers/OnOrderCreated',
  },
  socketNamespaces: ['/kitchen'],
};

export default manifest;
```

**Module loader (in bootstrap/moduleLoader.ts):**

1. Reads tenant config → gets `enabledModules`
2. Loads each module's manifest
3. Registers routes in Express
4. Subscribes event handlers to the bus
5. Initializes socket namespaces
6. Registers permissions in RBAC system
7. Registers any queue workers (BullMQ)

This makes each module fully pluggable — you can drop a new business type by adding a directory under `modules/`.

---

## 9. Why This Architecture Scales

### Immediate benefits (team of 2-5)

| Property | How it's achieved |
|---|---|
| **Parallel development** | DDD bounded contexts = independent work streams. One dev works on `payment`, another on `inventory`. Zero merge conflicts on domain code. |
| **Testability** | Domain layer has zero infrastructure dependencies. Pure unit tests, no mocks needed. Repositories are tested with real MongoDB via testcontainers. |
| **Easy onboarding** | New dev reads one bounded context → understands it fully. No sprawling service classes. |
| **Refactoring safety** | Contexts communicate only via events. Changing `ordering` internals won't break `payment`. |
| **Multi-tenant by default** | Every query flows through tenant resolver. Impossible to accidentally leak data. |

### Growth phase (team of 10-20)

| Property | How it's achieved |
|---|---|
| **Context → Microservice** | When `payment` needs its own deployment (PCI compliance, high load), extract the folder into a standalone service. The event bus becomes a message queue (RabbitMQ/NATS). The interface layer becomes an HTTP/gRPC API. |
| **Module → Product SKU** | Sell `restaurant-module` as an add-on. A tenant without it doesn't even load the code. |
| **Read models** | Reporting context can build denormalized read models from events without touching source systems. |
| **Feature flags** | `@shared/config/modules.ts` lets you gate new contexts behind environment variables during rollout. |

### Enterprise phase (team of 50+)

| Property | How it's achieved |
|---|---|
| **Bounded Context → Team** | Each context becomes a team's ownership boundary. `payments-team`, `ordering-team`, `catalog-team`. |
| **Event Sourcing** | Domain events already have the right shape. Swap the event bus for EventStoreDB. |
| **CQRS** | Command and query separation is built into the folder structure. Split read/write databases when needed. |
| **Global scale** | Tenant-per-database means you can shard tenants across MongoDB clusters. No single point of contention. |

### What prevents this from becoming a Big Ball of Mud

1. **The Dependency Rule:** Domain layer NEVER imports from infrastructure or interfaces. Application layer only imports from domain. Infrastructure implements domain interfaces. This is enforced at CI via ESLint import rules.

2. **No cross-context direct imports:** `ordering` never does `import { Payment } from '@core/payment'`. If it needs payment data, it subscribes to `PaymentCompleted` and builds a local read model.

3. **Aggregate boundaries:** Each aggregate root is a consistency boundary. Changes to an aggregate are transactional within that aggregate only. Cross-aggregate consistency is eventual via events.

4. **Tenant isolation is not an afterthought:** It's in the base `Repository` class, in every MongoDB query, in every Socket.IO room, and in every BullMQ job queue (namespaced by tenant).

5. **Module isolation:** Modules extend the system through declared hooks (events, routes, permissions) — they never monkey-patch core entities.

---

## 10. Technology Decisions

```
┌──────────────┬────────────────────────────────────────────────────┐
│ Concern       │ Choice & Rationale                                │
├──────────────┼────────────────────────────────────────────────────┤
│ DI Container  │ Awilix — lightweight, TS-native, no decorators    │
│ Validation    │ Zod — compile-time inference, shared with frontend│
│ Event Bus     │ In-process EventEmitter — simple, fast. Swap to   │
│               │ RabbitMQ when extracting microservices            │
│ Queue         │ BullMQ — Redis-backed, delayed jobs, rate limits  │
│ Real-time     │ Socket.IO — rooms per tenant, per context         │
│ Auth          │ JWT (access) + Refresh token (httpOnly cookie)    │
│ ORM/ODM       │ Mongoose — mature, middleware for tenant isolation│
│ State mgmt    │ Zustand — minimal boilerplate, no providers       │
│ API client    │ TanStack Query — caching, pagination, optimistic  │
│ Styling       │ Tailwind CSS + Radix UI (headless primitives)     │
│ Testing       │ Vitest (unit), Supertest (integration),           │
│               │ Playwright (e2e), Testcontainers (DB tests)       │
│ Monorepo      │ pnpm workspaces + Turborepo                       │
│ PWA           │ Vite PWA plugin + Workbox                         │
│ Mobile        │ Capacitor — access native APIs (camera, printer)  │
│ Desktop       │ Electron — local printer, offline mode            │
└──────────────┴────────────────────────────────────────────────────┘
```
