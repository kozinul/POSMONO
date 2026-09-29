# POSMono — Arsitektur SaaS Modular

## Daftar Isi

1. [Filosofi Arsitektur](#1-filosofi-arsitektur)
2. [Struktur Repository](#2-struktur-repository)
3. [Struktur Backend](#3-struktur-backend)
4. [Struktur Frontend](#4-struktur-frontend)
5. [Paket Bersama (Shared)](#5-paket-bersama-shared)
6. [Katalog Domain Event](#6-katalog-domain-event)
7. [Strategi Multi-Tenancy](#7-strategi-multi-tenancy)
8. [Sistem Modul](#8-sistem-modul)
9. [Mengapa Arsitektur Ini Skalabel](#9-mengapa-arsitektur-ini-skalabel)
10. [Keputusan Teknologi](#10-keputusan-teknologi)

---

## 1. Filosofi Arsitektur

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

**Prinsip utama:**
- **Modular Monolith** terlebih dahulu — ekstraksi ke microservice dilakukan nanti jika sudah dijustifikasi oleh beban/batas tim
- **Bounded Contexts** dengan kohesi internal ketat dan kopling longgar melalui event
- **Data terisolasi per tenant** di level database (strategi database-per-tenant)
- **Event-Driven** communication antar context (tidak pernah ada import langsung antar domain)
- **Plugin Architecture** — modul mendaftarkan diri ke core melalui manifest deklaratif

---

## 2. Struktur Repository

```
POSMono/
│
├── backend/                    # Backend Node.js + Express
├── frontend/                   # Frontend React + Vite PWA
├── shared/                     # Tipe bersama, validasi, konstanta
│
├── docker/                     # Docker Compose, Dockerfiles
├── docs/                       # Dokumentasi arsitektur & API
│
├── package.json                # Konfigurasi workspace root (pnpm workspaces)
├── pnpm-workspace.yaml
├── turbo.json                  # Konfigurasi Turborepo
├── .env.example
└── README.md
```

**Mengapa split tingkat atas ini:** Backend, frontend, dan shared adalah workspace terpisah dengan pipeline build independen. `shared` adalah dependensi waktu-kompilasi untuk keduanya — mencegah drift tipe antar kontrak API.

---

## 3. Struktur Backend

```
backend/
│
├── src/
│   │
│   ├── @shared/                          # Shared Kernel
│   │   ├── domain/                       #   Blok bangunan DDD
│   │   │   ├── AggregateRoot.ts          #   Base aggregate — melacak domain events
│   │   │   ├── Entity.ts                 #   Base entity dengan perbandingan identitas
│   │   │   ├── ValueObject.ts            #   Base value object yang immutable
│   │   │   ├── DomainEvent.ts            #   Envelope event dengan ID, timestamp, metadata
│   │   │   ├── Identifier.ts             #   ID yang diketik (misal: TenantId, OrderId)
│   │   │   ├── DomainService.ts          #   Interface logika domain tanpa state
│   │   │   ├── DomainError.ts            #   Error domain yang diketik
│   │   │   ├── Guard.ts                  #   Validasi prasyarat
│   │   │   └── Repository.ts             #   Interface repository generik
│   │   │
│   │   ├── application/                  #   Pola aplikasi dasar
│   │   │   ├── Command.ts                #   Marker command CQRS
│   │   │   ├── Query.ts                  #   Marker query CQRS
│   │   │   ├── UseCase.ts                #   Use case abstrak dengan penanganan error
│   │   │   ├── CommandHandler.ts         #   Interface command handler
│   │   │   ├── QueryHandler.ts           #   Interface query handler
│   │   │   ├── EventHandler.ts           #   Interface event handler
│   │   │   └── Result.ts                 #   Tipe hasil union yang didiskriminasi
│   │   │
│   │   ├── infrastructure/               #   Implementasi infrastruktur bersama
│   │   │   ├── database/                 #     Manajemen koneksi MongoDB
│   │   │   │   ├── ConnectionManager.ts  #     Connection pool multi-tenant
│   │   │   │   ├── TenantDatabase.ts     #     Resolver DB per-tenant
│   │   │   │   ├── MongoRepository.ts    #     Repository CRUD dasar
│   │   │   │   └── migrations/           #     Migrasi skema
│   │   │   ├── eventBus/                 #     Event bus dalam proses
│   │   │   │   ├── EventBus.ts           #     Implementasi pub/sub
│   │   │   │   └── EventBusMiddleware.ts #     Middleware logging, tracing
│   │   │   ├── messaging/                #     Messaging real-time
│   │   │   │   ├── SocketManager.ts      #     Manager server Socket.IO
│   │   │   │   └── room/                 #     Room yang terisolasi per tenant
│   │   │   ├── queue/                    #     Pemrosesan job background
│   │   │   │   ├── QueueManager.ts       #     Factory queue BullMQ
│   │   │   │   ├── workers/              #     Definisi worker
│   │   │   │   └── jobs/                 #     Definisi tipe job
│   │   │   ├── cache/                    #     Layer caching Redis
│   │   │   │   ├── CacheManager.ts       #     Abstraksi cache yang diketik
│   │   │   │   └── policies/             #     Kebijakan invalidasi cache
│   │   │   ├── logger/                   #     Logging terstruktur
│   │   │   │   ├── Logger.ts             #     Logger berbasis Pino
│   │   │   │   └── correlationId.ts      #     Tracing request
│   │   │   ├── monitor/                  #     Observability
│   │   │   │   └── Metrics.ts            #     Metrik Prometheus
│   │   │   ├── error/                    #     Infrastruktur penanganan error
│   │   │   │   ├── AppError.ts           #     Error aplikasi dasar
│   │   │   │   └── ErrorMapper.ts        #     Pemetaan error Domain→HTTP
│   │   │   └── validation/               #     Validasi bersama
│   │   │       └── Validator.ts          #     Validator skema Zod
│   │   │
│   │   ├── interfaces/                   #   Utilitas HTTP layer bersama
│   │   │   ├── BaseController.ts         #     Pembungkus request/response
│   │   │   ├── middleware/
│   │   │   │   ├── tenantContext.ts       #     Resolve tenant dari request
│   │   │   │   ├── authenticate.ts        #     Verifikasi JWT
│   │   │   │   ├── authorize.ts           #     Cek izin RBAC
│   │   │   │   ├── rateLimiter.ts         #     Rate limiting per-tenant
│   │   │   │   ├── requestLogger.ts       #     Logging request HTTP
│   │   │   │   ├── errorHandler.ts        #     Penanganan error global
│   │   │   │   ├── validate.ts            #     Validasi request Zod
│   │   │   │   └── asyncHandler.ts        #     Pembungkus error async
│   │   │   └── errors.ts                 #     Kelas error HTTP
│   │   │
│   │   └── config/                       #   Konfigurasi global
│   │       ├── env.ts                    #     Variabel env dengan validasi Zod
│   │       ├── database.ts               #     Konfigurasi koneksi DB
│   │       ├── redis.ts                  #     Konfigurasi koneksi Redis
│   │       ├── midtrans.ts               #     Konfigurasi payment gateway
│   │       └── modules.ts                #     Konfigurasi feature flag
│   │
│   ├── core/                             # Core Bounded Contexts
│   │   │
│   │   ├── identity/                     # Bounded Context: Autentikasi & Otorisasi
│   │   │   ├── domain/
│   │   │   │   ├── User.ts               #     Aggregate root User
│   │   │   │   ├── Role.ts               #     Entity Role
│   │   │   │   ├── Permission.ts         #     Value object Permission
│   │   │   │   ├── events/
│   │   │   │   │   ├── UserRegistered.ts
│   │   │   │   │   └── UserLoggedIn.ts
│   │   │   │   └── services/
│   │   │   │       └── PasswordService.ts #     Kebijakan password domain
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
│   │   │   │   │   ├── AuthService.ts      #     Orkestrasi login/logout
│   │   │   │   │   └── TokenService.ts     #     Generasi JWT
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
│   │   │           └── UserEventPublisher.ts  #     Mempublikasikan domain events ke bus
│   │   │
│   │   ├── tenant/                     # Bounded Context: Manajemen Multi-Tenant
│   │   │   ├── domain/
│   │   │   │   ├── Tenant.ts           #     Aggregate root Tenant
│   │   │   │   ├── Subscription.ts     #     Entity Subscription
│   │   │   │   ├── TenantConfig.ts     #     Value object konfigurasi Tenant
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
│   │   │   │   └── resolvers/          #     Strategi identifikasi tenant
│   │   │   └── interfaces/
│   │   │       ├── http/
│   │   │       └── events/
│   │   │
│   │   ├── catalog/                   # Bounded Context: Katalog Produk
│   │   │   ├── domain/
│   │   │   │   ├── Product.ts         #     Aggregate root Product
│   │   │   │   ├── Category.ts        #     Entity Category
│   │   │   │   ├── Variant.ts         #     Entity Variant (ukuran, warna)
│   │   │   │   ├── Modifier.ts        #     Grup Modifier (add-on, ekstra)
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
│   │   ├── ordering/                  # Bounded Context: Pesanan & Keranjang
│   │   │   ├── domain/
│   │   │   │   ├── Order.ts           #     Aggregate root Order
│   │   │   │   ├── OrderItem.ts       #     Entity item baris pesanan
│   │   │   │   ├── Cart.ts            #     Aggregate Keranjang Belanja
│   │   │   │   ├── OrderStatus.ts     #     Value object Status (state machine)
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
│   │   ├── inventory/                 # Bounded Context: Inventaris & Stok
│   │   │   ├── domain/
│   │   │   │   ├── Stock.ts           #     Aggregate root Stock
│   │   │   │   ├── Warehouse.ts       #     Entity Warehouse
│   │   │   │   ├── StockMovement.ts   #     Entity transaksi stok
│   │   │   │   └── events/
│   │   │   │       ├── StockAdjusted.ts
│   │   │   │       └── LowStockAlert.ts
│   │   │   ├── application/
│   │   │   ├── infrastructure/
│   │   │   └── interfaces/
│   │   │
│   │   ├── pos/                       # Bounded Context: Point of Sale
│   │   │   ├── domain/
│   │   │   │   ├── Register.ts        #     Entity mesin kasir
│   │   │   │   ├── Shift.ts           #     Aggregate shift kasir
│   │   │   │   ├── PaymentSession.ts  #     Sesi transaksi saat ini
│   │   │   │   └── events/
│   │   │   │       ├── ShiftOpened.ts
│   │   │   │       ├── ShiftClosed.ts
│   │   │   │       └── SaleCompleted.ts
│   │   │   ├── application/
│   │   │   ├── infrastructure/
│   │   │   └── interfaces/
│   │   │
│   │   ├── customer/                  # Bounded Context: Manajemen Pelanggan
│   │   │   ├── domain/
│   │   │   │   ├── Customer.ts
│   │   │   │   ├── Loyalty.ts
│   │   │   │   └── events/
│   │   │   │       └── CustomerCreated.ts
│   │   │   ├── application/
│   │   │   ├── infrastructure/
│   │   │   └── interfaces/
│   │   │
│   │   ├── payment/                   # Bounded Context: Pemrosesan Pembayaran
│   │   │   ├── domain/
│   │   │   │   ├── Payment.ts         #     Aggregate root Payment
│   │   │   │   ├── PaymentMethod.ts   #     Value object metode pembayaran
│   │   │   │   ├── Transaction.ts     #     Entity transaksi pembayaran
│   │   │   │   ├── Refund.ts          #     Entity Refund
│   │   │   │   └── events/
│   │   │   │       ├── PaymentCompleted.ts
│   │   │   │       ├── PaymentFailed.ts
│   │   │   │       └── RefundProcessed.ts
│   │   │   ├── application/
│   │   │   │   ├── commands/
│   │   │   │   ├── queries/
│   │   │   │   ├── eventHandlers/
│   │   │   │   └── services/
│   │   │   │       └── PaymentGateway.ts    #     Abstraksi gateway
│   │   │   ├── infrastructure/
│   │   │   │   ├── persistence/
│   │   │   │   └── midtrans/               #     Implementasi adapter Midtrans
│   │   │   │       ├── MidtransGateway.ts
│   │   │   │       ├── MidtransWebhook.ts
│   │   │   │       └── eccr/
│   │   │   └── interfaces/
│   │   │       ├── http/
│   │   │       │   ├── controllers/
│   │   │       │   └── webhooks/           #     Endpoint webhook pembayaran
│   │   │       └── events/
│   │   │
│   │   ├── billing/                   # Bounded Context: Tagihan SaaS & Subscription
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
│   │   ├── notification/              # Bounded Context: Notifikasi
│   │   │   ├── domain/
│   │   │   │   ├── Notification.ts
│   │   │   │   ├── Template.ts
│   │   │   │   └── events/
│   │   │   │       └── NotificationSent.ts
│   │   │   ├── application/
│   │   │   │   └── services/
│   │   │   │       ├── NotificationService.ts  #     Mengorkestrasi multi-channel
│   │   │   │       └── TemplateRenderer.ts
│   │   │   ├── infrastructure/
│   │   │   │   ├── channels/
│   │   │   │   │   ├── EmailProvider.ts
│   │   │   │   │   ├── WhatsAppProvider.ts     #     Integrasi webhook n8n
│   │   │   │   │   └── PushProvider.ts
│   │   │   │   └── persistence/
│   │   │   └── interfaces/
│   │   │       └── events/
│   │   │
│   │   └── reporting/                 # Bounded Context: Analitik & Laporan
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
│   │       │   └── aggregation/            #     Pipeline agregasi MongoDB
│   │       └── interfaces/
│   │           └── http/
│   │               ├── controllers/
│   │               └── routes/
│   │
│   ├── modules/                          # Modul Opsional Berdasarkan Tipe Bisnis
│   │   │
│   │   ├── restaurant/                   # Modul: Operasional Restoran
│   │   │   ├── domain/
│   │   │   │   ├── DiningTable.ts        #     Aggregate root Table
│   │   │   │   ├── Reservation.ts        #     Entity reservasi meja
│   │   │   │   ├── KitchenOrder.ts       #     Aggregate tiket dapur
│   │   │   │   ├── SplitBill.ts          #     Aggregate split bill
│   │   │   │   ├── WaiterSession.ts      #     Entity penugasan waiter
│   │   │   │   ├── FloorPlan.ts          #     Konfigurasi tata letak restoran
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
│   │   │   │   └── printer/              #     Printer termal ESC/POS
│   │   │   │       ├── PrinterAdapter.ts
│   │   │   │       ├── EscPosEncoder.ts
│   │   │   │       └── NetworkPrinter.ts
│   │   │   └── interfaces/
│   │   │       ├── http/
│   │   │       │   ├── controllers/
│   │   │       │   └── routes/
│   │   │       └── socket/               #     Update KDS real-time
│   │   │           └── KitchenSocket.ts
│   │   │
│   │   ├── hospitality/                  # Modul: Hospitality (Villa/Hotel)
│   │   │   ├── domain/
│   │   │   │   ├── Property.ts           #     Aggregate root Villa/Hotel
│   │   │   │   ├── Room.ts               #     Entity kamar/unit
│   │   │   │   ├── RoomType.ts           #     Kategori kamar
│   │   │   │   ├── Booking.ts            #     Aggregate root Booking
│   │   │   │   ├── Reservation.ts        #     Entity Reservasi
│   │   │   │   ├── Stay.ts               #     Aggregate check-in/check-out
│   │   │   │   ├── Guest.ts              #     Entity profil tamu
│   │   │   │   ├── Housekeeping.ts       #     Aggregate tugas housekeeping
│   │   │   │   ├── Amenity.ts            #     Value object Amenitas
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
│   │   │   │       ├── BookingEngine.ts         #     Ketersediaan & harga
│   │   │   │       ├── RevenueManagement.ts     #     Harga dinamis
│   │   │   │       └── HousekeepingScheduler.ts
│   │   │   ├── infrastructure/
│   │   │   │   ├── persistence/
│   │   │   │   └── calendar/                   #     Sinkronisasi iCal, kalender harga
│   │   │   └── interfaces/
│   │   │       ├── http/
│   │   │       │   ├── controllers/
│   │   │       │   ├── routes/
│   │   │       │   └── webhooks/               #     Webhook channel manager OTA
│   │   │       └── socket/
│   │   │           └── HousekeepingSocket.ts
│   │   │
│   │   └── retail/                            # Modul: Ekstensi Khusus Retail
│   │       ├── domain/
│   │       │   ├── Barcode.ts
│   │       │   ├── Supplier.ts
│   │       │   ├── PurchaseOrder.ts
│   │       │   └── events/
│   │       ├── application/
│   │       ├── infrastructure/
│   │       │   └── barcode/                   #     Dukungan scanner barcode
│   │       └── interfaces/
│   │
│   └── bootstrap/                               # Composition Root Aplikasi
│       ├── container.ts                         #   Setup DI container (Awilix)
│       ├── eventBus.ts                          #   Hubungkan domain events → handlers
│       ├── moduleLoader.ts                      #   Pindai & muat modul yang diaktifkan
│       ├── routes.ts                            #   Gabungkan semua route modul
│       ├── server.ts                            #   Factory aplikasi Express
│       └── app.ts                               #   Entry point
│
├── tests/
│   ├── unit/                                     # Tes logika domain murni
│   │   ├── @shared/
│   │   ├── core/
│   │   └── modules/
│   ├── integration/                              # Tes repository + infra (dengan DB nyata)
│   │   ├── core/
│   │   └── modules/
│   └── e2e/                                      # Tes endpoint API
│       └── api/
│
├── scripts/
│   ├── seed/                                     # Seeding data demo tenant
│   │   ├── retail-seed.ts
│   │   ├── restaurant-seed.ts
│   │   └── hospitality-seed.ts
│   ├── migration/                                # Skrip migrasi MongoDB
│   └── dev/                                      # Skrip bantuan development
│
├── docker/
│   ├── Dockerfile                                # Build produksi multi-stage
│   ├── Dockerfile.dev
│   ├── docker-compose.yml                        # Stack produksi
│   └── docker-compose.dev.yml                    # Stack dev dengan hot-reload
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

## 4. Struktur Frontend

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
│   │   ├── utils/                          #   Fungsi utilitas
│   │   │   ├── formatters.ts               #     Format mata uang, tanggal, telepon
│   │   │   └── validators.ts
│   │   ├── types/                          #   Tipe frontend bersama
│   │   │   ├── api.ts                      #     Tipe response/request API
│   │   │   ├── ui.ts                       #     Tipe state UI
│   │   │   └── domain.ts                   #     Mirror tipe domain (dari shared pkg)
│   │   ├── constants/                      #   Konstanta seluruh app
│   │   │   ├── routes.ts
│   │   │   └── permissions.ts
│   │   ├── services/                       #   Layer klien API
│   │   │   ├── api.ts                      #     Instance Axios dengan interceptor
│   │   │   ├── socket.ts                   #     Klien Socket.IO
│   │   │   └── queryClient.ts              #     Konfigurasi React Query / TanStack Query
│   │   └── styles/                         #   Style global & tema
│   │       ├── globals.css
│   │       └── theme.ts
│   │
│   ├── core/                               # Modul Fitur Core
│   │   │
│   │   ├── auth/                           # Fitur: Autentikasi
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
│   │   │       └── authStore.ts            #     Slice Zustand
│   │   │
│   │   ├── dashboard/                      # Fitur: Dashboard Utama
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
│   │   ├── pos/                            # Fitur: Terminal POS
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
│   │   ├── orders/                         # Fitur: Manajemen Pesanan
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── pages/
│   │   │       ├── OrderListPage.tsx
│   │   │       └── OrderDetailPage.tsx
│   │   │
│   │   ├── inventory/                      # Fitur: Manajemen Inventaris
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── pages/
│   │   │       ├── StockListPage.tsx
│   │   │       └── StockAdjustmentPage.tsx
│   │   │
│   │   ├── products/                       # Fitur: Katalog Produk
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── pages/
│   │   │       ├── ProductListPage.tsx
│   │   │       └── ProductFormPage.tsx
│   │   │
│   │   ├── customers/                      # Fitur: Manajemen Pelanggan
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── pages/
│   │   │
│   │   ├── payments/                       # Fitur: Manajemen Pembayaran
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── pages/
│   │   │
│   │   ├── reports/                        # Fitur: Pelaporan
│   │   │   ├── components/
│   │   │   │   ├── ReportFilters.tsx
│   │   │   │   └── ReportChart.tsx
│   │   │   ├── hooks/
│   │   │   ├── pages/
│   │   │   │   ├── SalesReportPage.tsx
│   │   │   │   └── InventoryReportPage.tsx
│   │   │   └── store/
│   │   │
│   │   ├── settings/                       # Fitur: Pengaturan Tenant
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   │   ├── GeneralSettingsPage.tsx
│   │   │   │   ├── PaymentSettingsPage.tsx
│   │   │   │   ├── UsersPage.tsx
│   │   │   │   └── BillingPage.tsx
│   │   │   └── store/
│   │   │
│   │   └── tenant/                         # Fitur: Onboarding Tenant
│   │       ├── components/
│   │       ├── hooks/
│   │       └── pages/
│   │           └── OnboardingWizardPage.tsx
│   │
│   ├── modules/                            # Modul Opsional Berdasarkan Tipe Bisnis
│   │   │
│   │   ├── restaurant/                     # Modul: UI Restoran
│   │   │   ├── components/
│   │   │   │   ├── FloorPlan.tsx           #     Peta meja interaktif
│   │   │   │   ├── TableCard.tsx
│   │   │   │   ├── KitchenDisplay.tsx      #     Layar KDS
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
│   │   ├── hospitality/                    # Modul: UI Hospitality
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
│   │   └── retail/                         # Modul: UI Retail
│   │       ├── components/
│   │       │   ├── SupplierList.tsx
│   │       │   └── PurchaseOrderForm.tsx
│   │       ├── hooks/
│   │       ├── pages/
│   │       └── services/
│   │
│   ├── app/                                # Shell Aplikasi & Konfigurasi
│   │   ├── App.tsx
│   │   ├── router.tsx                      #   Definisi route (lazy-loaded)
│   │   ├── store.ts                        #   Setup root store
│   │   └── providers.tsx                   #   Komposisi context providers
│   │
│   ├── layouts/                            # Layout Halaman
│   │   ├── AuthLayout.tsx
│   │   ├── DashboardLayout.tsx
│   │   ├── PosLayout.tsx
│   │   └── RestaurantLayout.tsx
│   │
│   └── main.tsx                            # Entry point
│
├── public/
│   ├── manifest.json                       # Manifest PWA
│   ├── sw.js                               # Service worker
│   ├── icons/                              # Ikon aplikasi (semua ukuran)
│   └── offline.html                        # Fallback offline
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/                                # Playwright / Cypress
│       └── specs/
│
├── capacitor/                              # Konfigurasi mobile Capacitor
│   ├── config.json
│   └── hooks/
│
├── electron/                               # Konfigurasi desktop Electron
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

## 5. Paket Bersama (Shared)

```
shared/                                              # Kode bersama lintas platform (paket TS)
│
├── types/                                            # Definisi tipe TypeScript
│   ├── domain/                                       #   Tipe model domain
│   │   ├── identity.ts                               #     User, Role, Permission
│   │   ├── tenant.ts                                 #     Tenant, Subscription
│   │   ├── catalog.ts                                #     Product, Category, Variant
│   │   ├── ordering.ts                               #     Order, OrderItem, OrderStatus
│   │   ├── inventory.ts                              #     Stock, StockMovement
│   │   ├── pos.ts                                    #     Register, Shift
│   │   ├── customer.ts                               #     Customer, Loyalty
│   │   ├── payment.ts                                #     Payment, Transaction, Refund
│   │   └── billing.ts                                #     Plan, Invoice, Subscription
│   ├── events/                                       #   Definisi tipe domain event
│   │   ├── order-events.ts
│   │   ├── payment-events.ts
│   │   ├── inventory-events.ts
│   │   ├── tenant-events.ts
│   │   └── module-events.ts                          #     Event restaurant, hospitality
│   ├── dto/                                          #   Tipe Data Transfer Object
│   │   ├── api-response.ts                           #     Envelope response API standar
│   │   ├── pagination.ts
│   │   └── error.ts
│   └── api/                                          #   Tipe kontrak API
│       ├── requests/
│       └── responses/
│
├── validation/                                       # Skema validasi bersama (Zod)
│   ├── schemas/
│   │   ├── auth-schemas.ts
│   │   ├── product-schemas.ts
│   │   ├── order-schemas.ts
│   │   ├── tenant-schemas.ts
│   │   └── module-schemas/                           #     Skema khusus modul
│   │       ├── restaurant-schemas.ts
│   │       └── hospitality-schemas.ts
│   └── rules/                                        #     Aturan validasi yang dapat digunakan ulang
│       ├── phone.ts
│       └── currency.ts
│
├── constants/                                        # Konstanta bersama
│   ├── permissions.ts                                #   Enum string permission
│   ├── events.ts                                     #   Konstanta nama event
│   ├── errors.ts                                     #   Konstanta kode error
│   ├── modules.ts                                    #   Identifier modul
│   └── business-types.ts                             #   Retail | Restaurant | Hospitality
│
├── utils/                                            # Utilitas lintas platform
│   ├── money.ts                                      #   Format mata uang, kalkulasi pajak
│   ├── date.ts                                       #   Utilitas tanggal/timezone
│   ├── string.ts                                     #   Generasi slug, truncation
│   └── permissions.ts                                #   Helper pengecekan permission
│
├── tsconfig.json                                     # Konfigurasi TypeScript bersama
├── package.json
└── index.ts                                          # Barrel exports
```

---

## 6. Katalog Domain Event

Event adalah tulang punggung komunikasi antar-context. Setiap domain mempublikasikan event yang di-subscribe oleh domain lain (atau modul).

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ALIRAN DOMAIN EVENTS                        │
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

Skema event:

```typescript
interface DomainEvent {
  eventId: string;          // UUID
  eventName: string;        // "ordering.order.created"
  aggregateId: string;      // ID aggregate yang memicu event
  aggregateType: string;    // "Order"
  tenantId: string;         // Isolasi tenant
  correlationId: string;    // Lacak antar context
  causationId: string;      // Event induk untuk rantai kausalitas
  occurredAt: Date;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
```

---

## 7. Strategi Multi-Tenancy

```
┌──────────────────────────────────────────────┐
│              Connection Manager               │
│  ┌────────────────────────────────────────┐  │
│  │  Pemetaan Tenant → Database (di Redis) │  │
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

**Strategi: Database-per-tenant**

- **Mengapa MongoDB:** Setiap tenant mendapatkan database sendiri (`posmono_{tenantId}`). Ini memberikan:
  - Isolasi data lengkap — tidak ada risiko kebocoran antar-tenant
  - Backup/restore independen per tenant
  - Penghapusan tenant mudah (drop database)
  - Tidak ada polusi skema antar tipe bisnis
  - Sharding per tenant di masa depan jika diperlukan

- **Connection pooling:** Gunakan `mongoose.createConnection()` per tenant, di-cache dalam Map dengan TTL. Redis menyimpan pemetaan tenant→database.

- **Koleksi bersama:** Data seluruh sistem (konfigurasi platform, template global) berada di database `posmono_system`.

- **Middleware:** Middleware `tenantContext.ts` me-resolve tenant dari subdomain/header/JWT dan melampirkannya ke `req.tenant`. Semua implementasi repository menggunakan ini untuk merutekan ke database yang benar.

- **Aktivasi modul:** Setiap tenant memiliki field `modules.enabled` di konfigurasi mereka (misal: `["restaurant", "retail"]`). Module loader memeriksa ini sebelum mendaftarkan route/event handler.

---

## 8. Sistem Modul

Modul adalah paket fitur opsional yang digerbang oleh tenant. Mereka mengikuti struktur DDD yang sama dengan core contexts.

**Pendaftaran modul:**

```typescript
// modules/restaurant/index.ts
import { ModuleManifest } from '@shared/types';

const manifest: ModuleManifest = {
  name: 'restaurant',
  version: '1.0.0',
  dependencies: ['ordering', 'inventory', 'pos'],  // Core contexts yang diperluas
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

**Module loader (di bootstrap/moduleLoader.ts):**

1. Membaca konfigurasi tenant → mendapatkan `enabledModules`
2. Memuat manifest setiap modul
3. Mendaftarkan route di Express
4. Men-subscribe event handlers ke bus
5. Menginisialisasi namespace socket
6. Mendaftarkan permission di sistem RBAC
7. Mendaftarkan queue workers (BullMQ)

Ini membuat setiap modul sepenuhnya pluggable — Anda bisa menambahkan tipe bisnis baru dengan menambahkan direktori di bawah `modules/`.

---

## 9. Mengapa Arsitektur Ini Skalabel

### Manfaat langsung (tim 2-5 orang)

| Properti | Bagaimana dicapai |
|---|---|
| **Pengembangan paralel** | DDD bounded contexts = alur kerja independen. Satu dev mengerjakan `payment`, yang lain `inventory`. Nol konflik merge di kode domain. |
| **Testability** | Layer domain memiliki nol dependensi infrastruktur. Unit test murni, tanpa mock. Repository diuji dengan MongoDB nyata via testcontainers. |
| **Onboarding mudah** | Dev baru membaca satu bounded context → memahaminya sepenuhnya. Tidak ada kelas service yang melebar. |
| **Keamanan refactoring** | Context berkomunikasi hanya melalui event. Mengubah internal `ordering` tidak akan merusak `payment`. |
| **Multi-tenant secara default** | Setiap query mengalir melalui tenant resolver. Tidak mungkin secara tidak sengaja membocorkan data. |

### Fase pertumbuhan (tim 10-20 orang)

| Properti | Bagaimana dicapai |
|---|---|
| **Context → Microservice** | Ketika `payment` membutuhkan deployment sendiri (kepatuhan PCI, beban tinggi), ekstrak folder menjadi service mandiri. Event bus menjadi message queue (RabbitMQ/NATS). Layer interface menjadi API HTTP/gRPC. |
| **Module → SKU Produk** | Jual `restaurant-module` sebagai add-on. Tenant yang tidak memilikinya tidak akan memuat kode tersebut sama sekali. |
| **Read models** | Context reporting dapat membangun read model yang didenormalisasi dari event tanpa menyentuh sistem sumber. |
| **Feature flags** | `@shared/config/modules.ts` memungkinkan Anda menggembok context baru di belakang variabel lingkungan selama peluncuran. |

### Fase enterprise (tim 50+ orang)

| Properti | Bagaimana dicapai |
|---|---|
| **Bounded Context → Tim** | Setiap context menjadi batas kepemilikan tim. `tim-pembayaran`, `tim-pesanan`, `tim-katalog`. |
| **Event Sourcing** | Domain events sudah memiliki bentuk yang tepat. Tukar event bus dengan EventStoreDB. |
| **CQRS** | Pemisahan command dan query sudah terbangun di struktur folder. Pisahkan database read/write jika diperlukan. |
| **Skala global** | Tenant-per-database berarti Anda dapat melakukan sharding tenant di seluruh cluster MongoDB. Tidak ada satu titik kontensi. |

### Apa yang mencegah ini menjadi Big Ball of Mud

1. **The Dependency Rule:** Domain layer TIDAK PERNAH mengimpor dari infrastructure atau interfaces. Application layer hanya mengimpor dari domain. Infrastructure mengimplementasikan interface domain. Ini ditegakkan di CI melalui aturan import ESLint.

2. **Tidak ada import langsung antar-context:** `ordering` tidak pernah melakukan `import { Payment } from '@core/payment'`. Jika membutuhkan data pembayaran, ia berlangganan ke `PaymentCompleted` dan membangun read model lokal.

3. **Batas agregat:** Setiap aggregate root adalah batas konsistensi. Perubahan pada suatu agregat bersifat transaksional hanya dalam agregat itu saja. Konsistensi antar-agregat bersifat eventual melalui event.

4. **Isolasi tenant bukan pemikiran kedua:** Ini ada di kelas dasar `Repository`, di setiap query MongoDB, di setiap ruang Socket.IO, dan di setiap antrian job BullMQ (namespaced oleh tenant).

5. **Isolasi modul:** Modul memperluas sistem melalui hook yang dideklarasikan (events, routes, permissions) — mereka tidak pernah melakukan monkey-patch pada entitas core.

---

## 10. Keputusan Teknologi

```
┌──────────────┬────────────────────────────────────────────────────┐
│ Concern       │ Pilihan & Alasan                                  │
├──────────────┼────────────────────────────────────────────────────┤
│ DI Container  │ Awilix — ringan, native TS, tanpa decorator       │
│ Validation    │ Zod — inferensi waktu kompilasi, dibagi dg frontend│
│ Event Bus     │ EventEmitter dalam proses — sederhana, cepat.     │
│               │ Ganti ke RabbitMQ saat ekstrak microservice       │
│ Queue         │ BullMQ — berbasis Redis, job tertunda, rate limit │
│ Real-time     │ Socket.IO — room per tenant, per context          │
│ Auth          │ JWT (access) + Refresh token (httpOnly cookie)    │
│ ORM/ODM       │ Mongoose — matang, middleware untuk isolasi tenant│
│ State mgmt    │ Zustand — boilerplate minimal, tanpa provider     │
│ API client    │ TanStack Query — caching, pagination, optimistic  │
│ Styling       │ Tailwind CSS + Radix UI (primitif headless)       │
│ Testing       │ Vitest (unit), Supertest (integration),           │
│               │ Playwright (e2e), Testcontainers (tes DB)         │
│ Monorepo      │ pnpm workspaces + Turborepo                       │
│ PWA           │ Vite PWA plugin + Workbox                         │
│ Mobile        │ Capacitor — akses API native (kamera, printer)    │
│ Desktop       │ Electron — printer lokal, mode offline            │
└──────────────┴────────────────────────────────────────────────────┘
```
