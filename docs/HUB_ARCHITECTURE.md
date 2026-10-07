# PLAN — Optional Business Group (Hub) Architecture

> Dokumen rencana implementasi. Dibuat 2026-08-13.
> Merevisi arah multi-outlet dari `docs/ROLE_ACCESS_PLAN.md` §3.5–3.6: Hub kini **di atas Tenant**, bukan anak Tenant.
>
> **Refresh 2026-09-22:** angka test terkini berdasarkan full suite run adalah backend **1126 test cases / 97 files**, frontend **90 tests / 13 files**. Angka lama di detail fase dipertahankan sebagai histori verifikasi saat fase tersebut selesai.
>
> **Status: Fase 1–14 SELESAI & TERVERIFIKASI 2026-09-14** — modul Hub/Outlet + scope transaksi (outletId), provisioning boot, User `outletIds` + JWT + middleware `resolveOutlet` (dimount ke route transaksi POS), frontend: `activeOutletId`/`X-Outlet-Id`, outlet switcher, halaman Outlet, POS stock ter-scope per outlet, receipt/OpenShiftModal tampil outlet, `useTenant` +`hubId`/`hubName`; **Terminal Center**: auth platform terpisah (`platformAuthenticate`), `/api/platform` (health, hub/tenant/outlet lists, shift & payment summaries, hub consolidated report), provision Hub/tenant via `hub:manage`; **ProvisionTenantService** baru (`POST /api/platform/provision/tenant`): buat Tenant + Owner + Outlet Utama + Warehouse Utama atomik + UI "+ New Tenant" di tab Tenants (Fase 11); **Outlet Platform-Only (Fase 12)**: owner/tenant tidak bisa membuat/menghapus outlet — create/delete via Terminal Center `POST /api/platform/outlets` (`OutletService.createWithWarehouse` buat Outlet + Warehouse 1:1), route tenant tinggal `GET`/`PUT`, `OutletListPage` banner "Hubungi sales/support", UI `+ Tambah Outlet` di tab Outlet; **HubMembership**: user lintas-tenant (`HubMembership {hubId, userId, role}`), session lintas-tenant (`/auth/switch-tenant` + `activeTenantId` + tenant switcher di top bar), UI admin halaman Terminal Center (`/terminal-center`, tabs Hub & Anggota / Tenants / Outlet / Ringkasan / Konsolidasi / Plans / Devices) di layout sendiri (`TerminalLayout` + `PlatformRoute`), login khusus di `/terminal/login` (langsung `X-Tenant-Id: platform`, tanpa checkbox); **Billing & Plan Management (Fase 14)**: modul `core/billing` (Plan/Subscription/Entitlement, string `_id` schema), default plans (Trial/Starter/Pro/Enterprise), tab **Plans** Terminal Center (`PlansSection` CRUD) + assign/ganti/batalkan plan di `TenantDetailModal`, `Tenant.planId` + `EntitlementService` per-permission, merchant `GET /api/tenants/current/entitlement`; **Terminal Center Logging + Control Plane (2026-09-22)**: modul `core/platform/audit/` (`PlatformAuditLog` + `GET /api/platform/audit` dengan permission baru `platform.audit.read`, rekam eksplisit best-effort tanpa menggagalkan operasi utama), Subscription History ledger (`SubscriptionHistory` di `subscription_histories` + `SubscriptionService.recordHistory`, extend ter-unifikasi), Provisioning History + idempotency DB (`ProvisioningRun` di `provisioning_runs`, index unique sparse `idempotencyKey`), Tenant 360° `GET /api/platform/tenants/:id` (hubName/owner/users/outlets/warehouse/subscription/recentActivity/provisioningRuns). Backend tsc bersih (1126/1126 tests, 97 files), frontend tsc + vite build OK (90/90), shared dist dibangun ulang.

---

## 1. Konsep

Memisahkan tiga boundary yang selama ini bercampur:

| Boundary | Peran | Contoh |
|---|---|---|
| **`tenantId`** | Legal / bisnis / akun | "Kopi ABC", "ABC Restaurant" |
| **`outletId`** | Lokasi operasional | Outlet Sanur, Outlet Renon |
| **`hubId`** | Pengelompokan / manajemen | "ABC Hospitality" (grup beberapa tenant) |

**Hub adalah layer manajemen OPTIONAL di atas Tenant.** Tenant tetap bisa berdiri sendiri tanpa Hub (standalone).

### Hierarki final

```
                         KUIRE
                           │
              ┌────────────┴────────────┐
              │                         │
       TERMINAL CENTER            CLIENT DOMAIN
       (internal Kuire)                │
              │                  ┌─────┴─────┐
              │                  │           │
              │                 HUB       TENANT
              │              (optional)  standalone
              │                  │           │
              │             ┌────┴─────┐     │
              │             │          │     │
              │          TENANT      TENANT  OUTLET
              │             │          │      │
              │          OUTLET       OUTLET WAREHOUSE
              │             │          │
              │          WAREHOUSE   WAREHOUSE
```

- **Tenant = legal/business/account boundary** (tidak berubah dari sekarang).
- **Hub = management/operational grouping** (hanya mengelompokkan tenant; **tidak memiliki bisnis**).
- **Outlet = physical operational location** (POS, shift, kasir, warehouse, stock, transaksi).
- **Terminal Center = layer internal Kuire** (bukan bagian hierarki data customer): view Hub/Tenant/Outlet/Terminal/Device/Shift/Payment/Health; operate Support/Provision/Diagnose/Monitor/Audit.

### Prinsip

> **Single outlet → invisible complexity.**
> **Multi outlet → activate Hub.**

- Tenant 1-outlet: tidak ada Hub, tidak ada outlet switcher, POS langsung jalan.
- Tenant multi-outlet: baru muncul outlet management + switcher.
- Hub mengelompokkan outlet-tenant, bukan memiliki data bisnis. Product/User/Tax/Discount tetap di level Tenant.

---

## 2. Model Data

```
Hub { id, name, description?, isActive, createdAt, updatedAt }   // TANPA tenantId

Tenant { id, ..., hubId: string | null, ... }                     // null = standalone

Outlet { id, tenantId, name, address, phone,
         warehouseId, isActive, createdAt, updatedAt }            // 1:1 ke Warehouse

Warehouse { id, tenantId, outletId, ... }                         // 1:1 (baru)

User { tenantId, roleId, outletIds: string[], ... }               // [] = semua outlet tenant
```

Relasi:

```
Hub 1 ───────< Tenant.hubId        (satu Tenant maksimal satu Hub)
Tenant 1 ────< Outlet[]            (outlet milik tenant)
Outlet 1 ────1 Warehouse           (satu outlet = satu gudang)
```

Semantik `Tenant.hubId`:

- `hubId = null` + `outlets = [A]` → tenant standalone, 1 outlet (valid).
- `hubId = null` + `outlets = [A, B, C]` → tenant standalone, multi outlet (valid).
- `hubId = HUB-1` + `outlets = [A, B, C]` → tenant anggota Hub (valid).

**Tidak ada `outletMode`.** Jumlah outlet & keanggotaan Hub bisa diketahui dari data (`Tenant.outlets.length`, `Tenant.hubId`).

### HubMembership (DI-IMPLEMENTASIKAN 2026-09-12, tadinya "bukan MVP")

```
HubMembership { userId, hubId, role: 'owner' | 'admin' | 'viewer' }
```

Dibutuhkan untuk user lintas-tenant (Group Admin) dan Hub Consolidated Report.
- **Kepemilikan & CRUD**: `hub:manage` (platform) via `POST/PUT/DELETE /api/hub-memberships`, `GET /api/hub-memberships/hub/:hubId` (list member + nama user); `GET /api/hub-memberships/me` + `GET /api/hub-memberships/me/tenants` untuk owner user.
- **Session lintas-tenant**: user memegang JWT tenant sendiri, lalu `POST /auth/switch-tenant {tenantId}` → token baru ber-`role: hub-{owner|admin|manager|viewer}`, `permissions` dari `HUB_MEMBER_ROLE_PERMS` (owner = FULL Owner, admin = Manager-level + `users:read`, manager = Manager-level tanpa user management, viewer = read-only), `outletIds: []`; `GET /auth/me` pada token lintas-tenant otomatis resolve lewat membership (bukan role tenant). Frontend top bar menampilkan tenant switcher dari `GET /auth/accessible-tenants`; ganti tenant → `switchTenant` store + `queryClient.clear()`.
- **Hub Consolidated Report**: `GET /api/platform/hubs/:hubId/consolidated?dateFrom=&dateTo=` (guard `platform.reports.read`) — breakdown `Tenant → Outlet` dari shift summary + payment consolidation per outlet (`PaymentService.getPlatformPaymentsConsolidationByOutlet`), plus totals. UI di tab Konsolidasi halaman Terminal Center.

---

## 3. Fakta Arsitektur Saat Ini (recon 2026-08-13)

- **Satu database bersama**: semua model di-register di `systemConnection` (`backend/src/bootstrap/container.ts:151-188`, `mongoose.connection`), dipisah oleh field `tenantId`. `ConnectionManager.getTenantConnection` ada tapi **tidak dipakai** di bootstrap.
  - Implikasi: `Hub → Tenant[]` = `Tenant.find({ hubId })`; Hub Consolidated Report lintas tenant = `tenantId: { $in: hubTenantIds }` (murah, tanpa ETL).
- **Tenant** (`backend/src/core/tenant/domain/Tenant.ts`) = 1 bisnis; sudah ada `ownerId`, `config`, `modules`, `businessType`. **Belum ada `hubId`.**
- **Warehouse** (`backend/src/core/inventory/domain/Warehouse.ts`) sudah tenant-scoped; stock per warehouse (`StockSchema` index `{tenantId, productId, variantId, warehouseId}`). `InventoryService.resolveWarehouseId()` (`InventoryService.ts:23`) fallback ke warehouse pertama / `'utama'`. **Belum terhubung outlet.**
- **Order** dibuat di `CreateOrderService.execute` (`OrderService.ts:217`); sudah ada `source='pos'` + shift wajib. **Belum ada `outletId`.**
- **Payment** (`PaymentSchema`) sudah punya `shiftId`, `tenantId`. **Belum ada `outletId`.**
- **Shift** (`Shift.ts`, `ShiftSchema.ts`) sudah punya `registerId` (default `'register-default'`) + index `one_open_shift_per_cashier` (`{tenantId, cashierId, status}`). **Belum ada `outletId`.**
- **RBAC** sudah lengkap: permissions di JWT, `authorize()` berfungsi, `authenticate` isi `req.userId/tenantId/userRole/userRoleName/userPermissions`. Cashier dibatasi ke `/pos`.
- **Frontend**: `api.ts` kirim `X-Tenant-Id` + Bearer; `AuthUser` di-persist (`localStorage.authUser`). **Belum ada `outletIds`/`activeOutletId`/`X-Outlet-Id`.**
- **Bug stock POS yang sudah ada**: `useStockList()` (`PosPage.tsx:101`) ambil semua stock tanpa filter warehouse — akan ter-benefit dari scoping outlet.

---

## 4. Keputusan

| # | Topik | Keputusan |
|---|---|---|
| 1 | Relasi Outlet–Warehouse | **1:1** — `outletId` di Warehouse |
| 2 | Backfill data lama | **Assign semua** order/payment/shift lama ke Outlet Utama |
| 3 | Resolusi `outletIds` | **Embed di JWT** (konsisten dengan permissions) |
| 4 | Downgrade multi→single | **Tidak didukung** di MVP |
| 5 | Otoritas kelola Hub | **Platform / Terminal Center saja** (`hub:manage`) — tenant hanya lihat `hubId` read-only |
| 6 | Hub Consolidated Report | **Nanti**, setelah HubMembership |
| 7 | Scope Terminal Center | **Provision + diagnostik read-only** |
| 8 | `outletMode` | **Dihapus** — disimpulkan dari `Tenant.outlets.length` + `Tenant.hubId` |
| 9 | `Hub.tenantId` | **Dihapus** — Hub di atas Tenant; relasi via `Tenant.hubId` |

---

## 5. Fase Implementasi

### Fase 1 — Shared & permission
- [x] `shared/src/constants/permissions.ts`: `outlet:manage` (tenant), `hub:manage` (platform)
- [x] `shared/src/types/domain/tenant.ts`: `Tenant.hubId: string | null`
- [x] `backend/src/core/tenant/domain/Tenant.ts` + `TenantSchema.ts`: field `hubId` (default `null`, index)
  - Tambahan: `Tenant.assignHub(hubId)` / `unassignHub()`, `MongoTenantRepository.findByHubId()`

### Fase 2 — Modul Hub (backend, baru) `backend/src/core/hub/`
- [x] `domain/Hub.ts` (id, name, description, isActive — **tanpa tenantId**), `HubSchema.ts`, `MongoHubRepository.ts` (index unik `{name}`)
- [x] `application/services/HubService.ts`: CRUD + `assignTenant`/`unassignTenant` (via TenantRepository), `listTenants` (via `findByHubId`), guard delete saat masih ada tenant
- [x] `interfaces/.../HubController.ts` + `hub.routes.ts`: `GET/POST/PUT/DELETE /api/hubs`, `POST/DELETE /api/hubs/:hubId/tenants/:tenantId`, `GET /api/hubs/:hubId/tenants` — guarded `hub:manage` (platform)
- [~] `TenantService` + `tenant.routes.ts`: `PATCH /api/tenants/:id { hubId }` (platform) — **di-skip (redundan)**: set/clear hubId sudah dilayani `POST/DELETE /api/hubs/:hubId/tenants/:tenantId`
- [x] Register DI di `container.ts` (model `Hub` → `hubRepository`/`hubService`/`hubController` singleton) + mount `/api/hubs` di `routes.ts`

### Fase 3 — Modul Outlet (backend, baru) `backend/src/core/outlet/`
- [x] `domain/Outlet.ts` (id, tenantId, name, address, phone, warehouseId, isActive), `OutletSchema.ts` (index `{tenantId, name}` unique), `MongoOutletRepository.ts`
- [~] `OutletService.ts`: CRUD + `ensureDefault(tenantId)` + `getByWarehouse(warehouseId)`; `listScoped(tenantId, outletIds)` belum dibuat (dipakai nanti Fase 6)
- [x] `OutletController.ts` + `outlet.routes.ts`: `GET /api/outlets`/`/:id` (scoped) semua role terautentikasi; `PUT` `outlet:manage`. **Sejak Fase 12** create/del hanya via platform (`POST /api/platform/outlets`)
- [x] DI (model `Outlet` → repo/service/controller; inject `warehouseRepository`) + mount `/api/outlets` di `routes.ts`

### Fase 4 — Scope transaksi
- [x] **Order** (`Order.ts`, `OrderSchema.ts`, `MongoOrderRepository`): `outletId` (default `null`, index + `{tenantId, outletId, createdAt}`); stamp di `Order.create` + `CreateOrderService.execute` (prioritas: `input.outletId` → outlet shift terbuka → `null`; `source='pos'` wajib shift)
- [x] **Payment** (`Payment.ts`, `PaymentSchema`): `outletId` (default `null`, index); `assertOpenShift` kini return `{shiftId, outletId}`; stamp di `payCash`/`processByOrderId` (fallback `order.outletId`)/`splitBill`
- [x] **Shift** (`Shift.ts`, `ShiftSchema`): `outletId` (default `null`, index); `ShiftService.open` terima `outletId` (skema zod `POST /shifts/open` + field opsional); index partial unique **diganti nama** `one_open_shift_per_cashier_per_outlet` (key `{tenantId, cashierId, outletId}`, `syncIndexes()` di boot migrasi otomatis); `findOpenShift(tenantId, cashierId, outletId?)`
- [x] **Warehouse** (`Warehouse.ts`, `WarehouseSchema`): `outletId` (default `null`, index); repo baru `findActiveByOutlet(tenantId, outletId)` (+ interface); `InventoryService.resolveWarehouseId(tenantId, warehouseId?, outletId?)` → warehouse outlet aktif → fallback warehouse pertama → `'utama'`; `stockIn`/`adjust` terima `outletId` opsional
- [x] **Reports** (`ReportAggregation.ts`, `ReportService.ts`): param opsional `outletId` (filter) untuk `getDailySalesAggregation`/`getShiftSalesAggregation`/`getFinanceAggregation` + `MongoOrderRepository.getDailySales`/`findByTenant`; `getDailyReport`/`getSalesReport`/`getShiftReport`/`getFinanceReport` terima `outletId`; controller baca `?outletId=` dari query. **Catatan**: "tenant consolidated = jumlah outlets tanpa Hub" belum via backend khusus — peta outlet per tenant tersedia di `GET /api/outlets` (di-provider Fase 7/8)
- **Status**: verifikasi 2026-08-30 — shared build + backend tsc + frontend tsc bersih; backend 950/950 tests (test `ReportService` di-update ke argumen baru `outletId`)

### Fase 5 — Backfill & boot
- [x] `ensureDefaultOutlet(tenantId)` saat boot: **Outlet Utama** + **Warehouse Utama** (id `'utama'` — literal legacy/konsisten dengan stock lama) dibuat bila belum ada, lalu di-link 1:1 (`Outlet.warehouseId` ↔ `Warehouse.outletId`); idempotent; `'utama'` milik tenant lain tidak di-reuse
- [x] Backfill boot-time (`bootstrap/provisioning.ts` → `provisionDefaults(container)`, dipanggil di `app.ts` & `dev.ts`): untuk tiap tenant, order/payment/shift dengan `outletId null`/missing → di-set ke Outlet Utama (`updateMany`, best-effort via try/catch log); `MongoTenantRepository.findAll()` ditambahkan
- [x] Seed role platform (**Platform Super Admin**, tenantId `'platform'`) dengan `hub:manage` + `outlet:manage` + `platform.*`; kredensial `platform@demo.com`/`admin123` (login pakai header `X-Tenant-Id: platform`); di-seed di `seed.ts` & `dev.ts` (idempotent sync)
- **Status**: verifikasi 2026-08-30 — backend tsc bersih; 956/956 tests (+4 `OutletService.ensureDefault`, +2 `provisionDefaults` integrasi); frontend tsc bersih

### Fase 6 — User & auth
- [x] `User.ts` + `UserSchema` + `MongoUserRepository` + shared `identity.ts`: `outletIds: string[]` (default `[]`, di-persist & serialisasi di semua jalur)
- [x] `AuthService`/`TokenService`/`AuthController`: `login`/`me` + JWT (access & refresh) menyertakan `outletIds` (payload `TokenPayload.outletIds`)
- [x] `authenticate.ts`: isi `req.outletIds` dari JWT (`payload.outletIds ?? []`) + deklarasi `Express.Request.outletIds`/`outletId`
- [x] Middleware `resolveOutlet` (`src/@shared/interfaces/middleware/resolveOutlet.ts`) + helper `scopeOutletIds(req)`: validasi `X-Outlet-Id` ∈ `req.outletIds`; `[]` = semua outlet tenant; `requireOutlet` untuk endpoint yang wajib outlet
- [x] `UserService` (inject `roleRepository` via `container.ts`): create/update terima `outletIds`, validasi per role via `outletPolicyForRole`/`validateOutletIds` (cashier=1, manager/supervisor≥1, owner/admin=`[]`); `UserController` zod `createSchema`/`updateSchema` + serialisasi `outletIds` (list/getById/create/update); `AuthService.register`/`OnboardingService` menciptakan owner dengan `outletIds: []`
- [x] Halaman Users: kolom Outlet (nama outlet / "Semua outlet"), form assign outlet per-role (owner/admin = info "semua", kasir = single-select, lain = multi-checkbox dari `GET /outlets`), validasi client
- **Status**: verifikasi 2026-08-30 — backend 964/964 tests (+8 `UserService` outlet policy), frontend 76/76, tsc backend & frontend bersih, shared dist dibangun ulang. `resolveOutlet`/`scopeOutletIds` belum di-mount ke route transaksi (di-wire Fase 7).

### Fase 7 — Frontend
- [x] `useAuth.ts`: `AuthUser` + `outletIds`; store + `activeOutletId` (persist `localStorage.activeOutletId`, auto-pick 1 outlet bila user hanya punya 1, cleared saat logout/tak lagi dalam scope user)
- [x] `api.ts`: header `X-Outlet-Id` dari `activeOutletId`
- [x] Hooks `useOutlets` (pindah ke `@shared/hooks/useOutlets.ts` + CRUD) / hub — **Catatan 2026-09-28**: tidak ada file `useHubs.ts`; hook hub ada di `@shared/hooks/usePlatform.ts` (`usePlatformHubs`, `usePlatformHub`, mutasi create/update/delete/assign/unassign) + `@shared/hooks/useHubMemberships.ts` (`useHubMembers`, `useMyHubMemberships`, `useAccessibleTenants`); `useTenant` membaca `hubId` + `hubName` (read-only dari `GET /tenants/current`); backend `TenantController.getCurrent` +`hubId`/`hubName` (inject `hubRepository`)
- [x] `DashboardLayout.tsx`: outlet switcher saat user punya >1 outlet (data-driven, tanpa flag mode; pilihan outlet dari `useOutlets` dibatasi `user.outletIds`; akses semua outlet `[]` → semua); ganti outlet → invalidate `inventory/products/orders/shifts/daily-report/sales-report/best-sellers`
- [x] `frontend/src/core/outlets/pages/OutletListPage.tsx` (`/outlets`, nav "Outlet" guarded `outlet:manage`, CRUD via `OutletController` `outlet:manage`)
- [x] Halaman Users: assign outlet (Fase 6); POS: `useStockList()` di-scope warehouse outlet aktif (`PosPage.stockMap` filter `activeWarehouseId` → `Outlet.warehouseId`); `ReceiptDisplay` fallback struk + nama outlet aktif; `OpenShiftModal` menampilkan "Outlet: {nama}"
- [x] Backend `resolveOutlet` di-mount ke route transaksi POS: payment (`pay-cash`/`process`/`split`/`refund`/transfer confirm+cancel/`qris` initiate+confirm+cancel), order (semua mutasi), shift (`open`/`close`/`pickup`/`sales`) — validasi `X-Outlet-Id` ∈ `req.outletIds` (tanpa header / `[]` tetap jalan)
- **Status**: verifikasi 2026-08-30 — backend tsc bersih + 964/964, frontend tsc bersih + 83/83 (+7 `useAuth.test` outlet), vite build OK. **`req.outletId` kini dibaca service (2026-09-23)**: middleware `resolveOutlet` di-mount juga ke `GET /shifts/current`; `PaymentService.assertOpenShift`/`CreateOrderService`/`ShiftService.getCurrent` menerima `outletId` dan memfilter `findOpenShift` per outlet (null → tanpa filter, backward-compatible); controller payment/order/shift-open meneruskan `req.outletId` ke service; body `outletId` dihapus dari `POST /shifts/open`; `SplitItemService` mewarisi outletId order sumber; frontend `OUTLET_SCOPE_KEYS` + `open-shift`/`shift-report`.

### Fase 8 — Terminal Center (layer platform, terpisah dari auth tenant)
- [x] **Auth platform terpisah** (`backend/src/core/platform/`): middleware `platformAuthenticate`/`platformAuthorize` (validasi JWT `tenant === 'platform'`, isi `req.platformUserId/…Permissions`); grup route `/api/platform` di-mount terpisah dari `/api/*` tenant (`platform.routes.ts`). Super-admin login lewat `POST /auth/login` dengan `X-Tenant-Id: platform` (user seeded `platform@demo.com`/`admin123`, kredensial didokumentasikan seed/dev); token tenant biasa **ditolak 401** di semua route platform
- [x] **Provision**: CRUD Hub + assign/unassign tenant lewat `/api/hubs` (`hub:manage`, dimiliki Platform Super Admin); list lintas-tenant via `/api/platform/hubs`, `/api/platform/hubs/:hubId` (+`tenants`+`tenantCount`), `/api/platform/tenants` (filter `hubId`/`search`, pagination), `/api/platform/tenants/:tenantId` (+`hubName`), `/api/platform/outlets` (filter `tenantId`/`hubId`/`isActive` + `tenantName`) — semua read-only dari scope Hub/platform
- [x] **Diagnostik read-only**: `GET /api/platform/health`, `GET /api/platform/shifts/summary` (`ShiftService.getPlatformShiftsSummary` + `MongoShiftRepository.findByTenantIds` → per tenant + per outlet), `GET /api/platform/payments/summary` (`PaymentService.getPlatformPaymentsSummary` + `MongoPaymentRepository.findCompletedByTenantIds` → total + metode)
- [x] **Scope resolver** `resolvePlatformScope.ts` (tenantId → 1 tenant; hubId → tenant2 hub; tanpa → semua tenant; sertakan `tenantNameById`)
- [x] DI container: `platformController` singleton (hub/tenant/outlet/shift/payment service + repo), `TenantController` +`hubRepository` untuk `hubName`; `OnboardingService` dipindah ke `core/platform/application/services`
- **Status**: verifikasi 2026-09-12 — backend tsc bersih + **991/991** tests (+14 `PlatformSummaries`, +7 `platform-terminal` integration, +8 repo `findByTenantIds`/`findCompletedByTenantIds`/`list`), frontend tsc + vite build OK (83/83), shared dist dibangun ulang. Frontend halaman Terminal Center admin di-wire Fase 9 (Bersama HubMembership).

### Fase 9 — HubMembership + Terminal Center UI (SELESAI 2026-09-12)
- [x] **Data & CRUD**: `HubMembership {userId, hubId, role}` (domain + `HubMembershipSchema` unique `{hubId, userId}` + `MongoHubMembershipRepository`); `HubMembershipService` (add/updateRole/remove/listMembers/listByUser/findAccessibleTenants/resolveRoleForTenant); route `/api/hub-memberships` guard `hub:manage` (mutasi & list per hub) + `authenticate`-only untuk `/me` & `/me/tenants`
- [x] **Session lintas-tenant**: `AuthService.switchTenant(userId, tenantId)` → token baru scope target tenant dengan `role: hub-*`, permissions `HUB_MEMBER_ROLE_PERMS` (owner = `OWNER_PERMS`, admin = `MANAGER_PERMS + users:read + reports:read`, viewer = read-only), `outletIds: []`; `listAccessibleTenants` via membership; `getCurrentUser` fallback ke `resolveHubMemberContext` bila user bukan anggota tenant; routes `GET /auth/accessible-tenants` + `POST /auth/switch-tenant`; DI `hubMembershipService` di-inject ke `AuthService` (`container.ts` registrasi `authService` diubah ke `asClass` + injector lazy)
- [x] **Hub Consolidated Report**: `GET /api/platform/hubs/:hubId/consolidated` (`platform.reports.read`) — gabung `ShiftService.getPlatformShiftsSummary` + `PaymentService.getPlatformPaymentsConsolidationByOutlet` (baru, breakdown per outlet) → `{hub, tenants[{tenantId, tenantName, totals, outlets[{outletId, outletName, shifts, payments}]}], totals}`; nama outlet dari `OutletService.listAllForPlatform`
- [x] **Frontend**: halaman `/terminal-center` (`TerminalCenterPage.tsx`) di layout terpisah `TerminalLayout` + guard `PlatformRoute` (khusus `tenantId === 'platform'`; belum login → `/terminal/login`; user non-platform → `/dashboard`; `DashboardLayout` redirect platform user ke `/terminal-center`), tab Hub & Anggota (CRUD hub + assign tenant + kelola anggota add/role/remove) / Tenants (search+paginate) / Outlet (filter hub) / Ringkasan (shift & payment summary) / Konsolidasi (hub → tenant → outlet + tanggal); hooks `usePlatform.*` (`usePlatform.ts`) + `useHubMembers`/`useAddHubMembership`/`useUpdateHubMembership`/`useRemoveHubMembership`/`useAccessibleTenants` (`useHubMemberships.ts`); store `useAuth` +`activeTenantId` + `switchTenant` (persist token/tenant baru); `DashboardLayout` tenant switcher saat `accessibleTenants.length > 0` (switch → `switchTenant` + `queryClient.clear()`); **login Terminal Center di URL terpisah `/terminal/login`** (`TerminalLoginPage.tsx` selalu kirim header `X-Tenant-Id: platform` → mendarat `/terminal-center`; `LoginPage` tanpa checkbox, hanya link)
- **Status**: verifikasi 2026-09-12 — backend tsc bersih + **1021/1021** tests (+12 `HubMembershipService`, +7 `hub-fase9` integration HTTP penuh: CRUD/409/404/403, accessible-tenants, switch-tenant JWT scope + me, consolidated report, guard `platform.reports.read` & 401 non-platform; +6 `AuthService` cross-tenant), frontend **85/85** + tsc + vite build OK

### Fase 10 — Uji & dokumentasi
- [x] Unit: `HubMembership` domain + `HubMembershipService` (CRUD, validasi role, decorasi member, accessible tenants), `AuthService.switchTenant` (JWT scope, guard, `getCurrentUser` fallback), repository `MongoHubMembershipRepository`, konsolidasi per outlet (`PaymentService`)
- [x] Integrasi: `hub-fase9.test.ts` (HTTP penuh: member CRUD RBAC, session lintas-tenant, consolidated report per outlet dengan nama outlet)
- [x] Typecheck backend + frontend; docs sync: `HUB_ARCHITECTURE.md` ini, `PROJECT_ROADMAP.md`, `POS_CURRENT_FEATURES.md`, `DAILY_LOG.md`, `API_REFERENCE.md`, `ROLE_ACCESS_PLAN.md`

### Fase 11 — Provision Tenant dari Terminal Center (SELESAI 2026-09-13)
- [x] **`ProvisionTenantService`** (`core/platform/application/services/`): buat Tenant + Owner User + default Outlet + default Warehouse secara **atomik** (`mongoose.startSession().withTransaction`; fallback non-transaction pada DB standalone non-replicaset) memakai `OutletService.ensureDefault(tenantId, outletData?, session?)` yang **sama** dengan boot provisioning → tanpa duplikasi logic Outlet/Warehouse. Validasi pre-transaction: nama tenant/owner/outlet tidak boleh kosong, email owner (normalize `trim().toLowerCase()` + format + uniqueness **global** via `MongoUserRepository.findByEmailGlobal`), Hub existence (`hubRepository.findById` → 404 bila tidak ada). ID owner di-generate **sebelum** `Tenant.create` sehingga `Tenant.ownerId` konsisten dengan user owner. Roles default (Owner/Manager/Cashier) dibuat sekali per tenant. Owner memakai role **Owner** dan `outletIds: []` (semua outlet)
- [x] **MongoDB session support**: optional `options?: { session?: ClientSession }` di `save(...)` `MongoRepository` base + semua repo yang dipakai provisioning (Tenant, User, Role, Outlet, Warehouse, Hub); interface domain `OutletRepository`/`WarehouseRepository` di-update; hook/rollback seluruh provisioning bila salah satu langkah gagal (tidak ada orphan Tenant/Outlet/Warehouse/User)
- [x] **Endpoint** `POST /api/platform/provision/tenant` (guard `platformAuthenticate` + `platformAuthorize('hub:manage')`; controller `PlatformController.provisionTenant` delegasi ke service; dukung header `Idempotency-Key` → result di-cache per key, request ulang tidak membuat tenant kedua; response `201 Created`), DI `provisionTenantService` singleton di `container.ts`
- [x] **Frontend**: hook `usePlatformProvisionTenant` (`@shared/hooks/usePlatform.ts`, invalidate `platform-tenants`/`platform-outlets`/`platform-hubs`); `CreateTenantModal` di `TerminalCenterPage.tsx` tab Tenants (business name/type, owner name/email/password, outlet name/address/phone, hub dropdown `Standalone` default; button disable saat `isPending` "Creating Tenant...", error mapping friendly — tidak menampilkan MongoServerError mentah), tombol `+ New Tenant`
- **Status**: verifikasi 2026-09-13 — backend tsc bersih + **1035/1035** tests (86 files; +6 `ProvisionTenantService` unit, +8 `platform-provision-tenant` integrasi HTTP penuh), frontend tsc + vite build OK (85/85), shared dist dibangun ulang

### Fase 12 — Outlet Platform-Only (SELESAI 2026-09-13)
> **Keputusan produk**: pembuatan & penghapusan outlet dipegang **platform saja** (lisensi per cabang / eksklusivitas). Owner/tenant hanya bisa update info & status outlet; create/delete via Terminal Center (`POST /api/platform/outlets`).
- [x] **Backend**: `OutletService.createWithWarehouse(tenantId, data, session?)` — buat Outlet + **Warehouse 1:1** ("Warehouse {name}") lalu link `outlet.warehouseId`; duplikat nama per tenant → `ConflictError` (409). `PlatformController.createOutlet` (`POST /api/platform/outlets`, guard `platformAuthenticate` + `platformAuthorize('outlet:manage')`): validasi `tenantId`/`name`, cek tenant exist (404), return outlet + `tenantName`. Route tenant **diramping**: `POST /api/outlets` & `DELETE /api/outlets/:id` **dihapus** (`outlet.routes.ts` hanya `GET /`, `GET /:id`, `PUT /:id`); `OutletController.create`/`delete` tak lagi di-route (method tetap di service utk batch/backfill)
- [x] **Frontend**: hook `usePlatformCreateOutlet` (`usePlatform.ts`, invalidate `platform-outlets`/`platform-tenants`); `CreateOutletModal` di tab Outlet Terminal Center (dropdown tenant dari `usePlatformTenants`, form nama/alamat/telepon, banner amber bahwa warehouse dibuat otomatis & pembuatan outlet platform-only, success card); tombol `+ Tambah Outlet`. `OutletListPage` tenant: tombol create & aksi Hapus dihapus, banner amber "Butuh cabang tambahan? Hubungi tim sales/support kami", hanya Edit + toggle status; `useCreateOutlet`/`useDeleteOutlet` dihapus dari `useOutlets.ts`
- [x] **Tests**: `OutletService.test.ts` +3 (`createWithWarehouse`: link 1:1, ConflictError, session forwarding); `platform-create-outlet.test.ts` (10 test, integration HTTP penuh: 201 + warehouse linked, 404 tenant, 400 validasi, 409 duplikat, 401 tenant/non-auth, 403 tanpa `outlet:manage`, tenant-level POST/DELETE 404 & GET tetap jalan)
- **Status**: verifikasi 2026-09-13 — backend tsc bersih + **1048/1048** tests (87 files), frontend tsc + vite build OK + **85/85**

### Fase 13 — Tenant Lifecycle & Merchant Client Portal (Sep 2026)
- [x] **Tenant Lifecycle (Terminal Center)**: Status `active`, `suspended`, `frozen`, `deactivated`, `trial`. Endpoint `POST /api/platform/tenants/:tenantId/status` & `POST /api/platform/tenants/:tenantId/extend` (`hub:manage`) agar tim Kuire dapat membekukan, menangguhkan, mengaktifkan, atau memperpanjang masa aktif tenant secara manual.
- [x] **Merchant Client Portal API**: Endpoint `GET /api/tenants/current/subscription` & `POST /api/tenants/current/subscription/renew` bagi owner/tenant untuk memantau sisa masa aktif langganan dan melakukan perpanjangan mandiri.
- [x] **Domain & Schema**: Field `subscriptionExpiresAt` di `Tenant` domain dan `TenantSchema`, beserta metode `freeze()`, `unfreeze()`, `deactivate()`, `extendSubscription()`.

### Fase 14 — Billing & Plan Management (SELESAI 2026-09-14) `backend/src/core/billing/`

> Keputusan produk: **self-service TIDAK aktif** — hanya Platform Super Admin (Terminal Center) yang membuat/mengubah plan dan menetapkan plan ke tenant. Monetisasi modular: `basePrice` + `addOns[]` (module/limit) + `limits` per plan.

- [x] **Domain**: `Plan` (basePrice, billingCycle `monthly|annual|custom`, `isActive/isPublic/isDefault`, `sortOrder`, `modules[]`, `limits`, `addOns[]`) + `Subscription` (tenantId, planId, status `active|past_due|cancelled|expired|trial`, cycle, currentPeriodStart/End, cancelledAt). `PlanId`/`SubscriptionId` identifier. Shared types `Plan/PlanLimits/PlanAddOn/Subscription/Invoice` di `shared/src/types/domain/billing.ts`.
- [x] **Persistence**: `PlanSchema`/`SubscriptionSchema` pakai `_id` **string** + subdoc schema `PlanLimitsSchema`/`PlanAddOnSchema` (pola untyped `new Schema(...)` seperti `TenantSchema` — repos `toPersistence` menulis `_id: data.id`); `MongoPlanRepository.toDomain` memakai `doc.toObject()` + deep-copy `limits`/`addOns`/`modules` (menghindari subdocument wrapper Mongoose yang bikin `limits.maxUsers` undefined saat JSON-serialize).
- [x] **Service**: `PlanService` (CRUD, duplikat nama → 400, default plan tak boleh dihapus), `SubscriptionService` (`assignPlan(tenantId, planId, …)` **wajib explicit planId**, change pada existing subscription, `cancelSubscription` → `tenant.deactivate()` status `deactivated` — BUKAN downgrade ke Trial), `EntitlementService` (cek module dengan OR-add-on, limit dengan OR-add-on, tanpa subscription → fallback entitlement Trial hardcoded).
- [x] **API platform**: `GET/POST /api/platform/plans`, `GET/PUT/DELETE /api/platform/plans/:id` (`platform.plans.read`/`platform.plans.manage`); `GET /api/platform/tenants/:tenantId/subscription` (`platform.tenants.read`), `POST /api/platform/tenants/:tenantId/subscription` & `POST .../subscription/cancel` (`platform.tenants.manage`), `GET /api/platform/tenants/:tenantId/entitlement`.
- [x] **API merchant**: `GET /api/tenants/current/entitlement` (`authenticate` saja) — `EntitlementService` resolusi plan berjalan: subscription → plan; tanpa subscription → fallback Trial default.
- [x] **Default plans & seed**: `core/billing/defaults/plans.ts` — **Trial** (gratis), **Starter** (Rp199.000/bln), **Pro** (Rp499.000/bln), **Enterprise** (Rp999.000/bln), masing-masing `isDefault`+`isPublic` di-seed idempotent dari `dev.ts`/`seed.ts`.
- [x] **RBAC platform**: `platform.plans.read` & `platform.plans.manage` + `platform.tenants.manage` di `PLATFORM_ROLE_PERMS` (`DefaultPlatformRole`), sudah existing sejak Fase 8.
- [x] **Frontend hooks** (`frontend/src/@shared/hooks/usePlatform.ts`): `usePlatformPlans(activeOnly)`, `usePlatformPlan(id)`, `PlanInput`, `usePlatformCreatePlan`, `usePlatformUpdatePlan`, `usePlatformDeletePlan`, `usePlatformTenantSubscription(tenantId)`, `usePlatformAssignPlan`, `usePlatformCancelSubscription`, `usePlatformTenantEntitlement`.
- [x] **UI Terminal Center**: tab **Plans** (`PlansSection.tsx`) — grid plan card + modal create/edit/delete (checkbox modules `PLAN_MODULE_LABELS`, limits editor dengan −1 = unlimited, protect delete plan default); `TenantDetailModal` → section **Plan & Langganan** (plan aktif, status, siklus, periode, badges module, dropdown Assign/Ganti plan, tombol Batalkan — konfirmasi "tenant menjadi deactivated").
- [x] **Tenant link**: `Tenant.planId: string | null` + metode `assignPlan(planId)` di `Tenant.ts`; `TenantSchema.planId`; `MongoTenantRepository` menyimpan/membaca field.
- [x] **Tests**: `billing-plans.test.ts` 25 integrasi HTTP penuh (CRUD plan 201/list/404/duplicate 400/delete-default 400; RBAC 401 non-platform/403 read-only; assign explicit planId; change plan; cancel → deactivated; entitlement fallback Trial tanpa subscription + refleksikan plan ter-assign). Backend 1073/1073 (88 files), frontend 85/85 + tsc + vite build OK.

---

## 6. Catatan Kunci

- `X-Outlet-Id` **tidak pernah dipercaya mentah** — selalu divalidasi `resolveOutlet` terhadap `req.outletIds`.
- Tenant standalone memakai Outlet Utama **tanpa header**.
- Hub **tidak menyentuh Order/Payment** — `tenantId` tetap isolation boundary, `outletId` operational boundary, `hubId` murni grouping.
- Perubahan assign outlet butuh re-login (karena `outletIds` di JWT).

---

## 7. Risiko

- **Backfill**: data lama harus di-assign ke Outlet Utama agar laporan per outlet konsisten dari awal.
- **Bug stock POS yang sudah ada**: `useStockList()` lintas-warehouse — ter-benefit dari scoping outlet (Fase 7).
- **Hub tanpa pemilik tenant**: karena Hub tak ber-`tenantId`, pengelolaannya dikunci ke platform (`hub:manage`) sampai HubMembership hadir.
- **Perf**: embed `outletIds` di JWT menghindari +1 query/request; konsekuensi re-login saat assign berubah.

---

## 8. Referensi

- `docs/ROLE_ACCESS_PLAN.md` — RBAC + scoping outlet (di-revisi oleh dokumen ini untuk Hub)
- `docs/POS_CURRENT_FEATURES.md` — spec fitur (outlet di baris 141–160, 619–750)
- `docs/REPORT_REQUIREMENTS.md` — laporan (filter `outletId` di aggregation)
- `docs/DAILY_LOG.md` — log harian

---

## Catatan 2026-09-28 — Fase 15: Frontend Hub & Anggota

Rencana & status rinci: **`docs/HUB_FRONTEND_PLAN.md`** (temuan audit F1–F9, matriks invalidasi cache, test plan).

Backend Hub/keanggotaan **tidak diubah** pada fase ini — yang ditambahkan hanya `PlatformController.withHubNames` sehingga `GET /api/platform/tenants` menyertakan `hubName` (F8, menggantikan `hubId` mentah di UI).

Frontend Terminal Center sekarang punya tab **Hub & Anggota** yang utuh: buat/edit/hapus hub (toggle `isActive` dengan peringatan cabut akses lintas-tenant), assign/unassign tenant per hub, serta kelola anggota — semuanya lewat React Query dengan invalidasi cache, konfirmasi Swal2, error berbahasa Indonesia, dan tab yang visibility-gated per permission (`hub:manage`).

**Fase 4 (pencarian user lintas-tenant)**: endpoint baru `GET /api/platform/users?search=&tenantId=&hubId=&isActive=&page=&limit=` (`platform.tenants.read`, `PlatformController.listUsers` + `MongoUserRepository.searchAcrossTenants`) membuat picker anggota jadi **satu kolom pencarian** — regex search di-escape, `roleName` di-dekorasi satu lookup per role unik, dan `isHubMember` terisi bila pencarian di-scope ke sebuah hub. `HubMembershipService.listMembers` kini mengembalikan `userTenantName` (nama tenant asal anggota) sehingga tabel anggota tak perlu menebak nama tenant di frontend.

---

## Fase 16–20 — Hub Next (rencana 2026-09-28)

> Keputusan arsitektur yang mengunci fase-fase ini: **[`HUB_V2_DECISIONS.md`](HUB_V2_DECISIONS.md)** (D1–D4 + opsi yang ditolak).
> Rencana frontend: **[`HUB_V2_FRONTEND_PLAN.md`](HUB_V2_FRONTEND_PLAN.md)**.
> Status: **Fase 16 & 17 selesai 2026-09-29**; **Fase 18 selesai 2026-09-30**; **Fase 19 selesai 2026-10-01**; **Fase 20 selesai 2026-10-02** (gate debt pass T0–T9 terpenuhi). Fase 16–20 beres.
>
> **Fase 21 (backend, selesai 2026-10-02) + Fase 22 (frontend)** adalah lanjutan D1 tahap 2: permukaan baca milik anggota hub. Rencana UI-nya ada di `HUB_V2_FRONTEND_PLAN.md` (dibekukan); lihat §Fase 21 di bawah.
> Fase 1–15 tetap utuh; Fase 16 tidak mengubah perilaku apa pun.

### Konteks (recon 2026-09-28)

Semua yang sudah ada hasil Fase 1–15 **tetap dipakai**, tidak ditulis ulang:

```
Hub { id, name, description?, isActive }                 # tanpa tenantId
Tenant.hubId                                             # 1 tenant maksimal 1 hub (keputusan #9)
HubMembership { hubId, userId, role: owner|admin|manager|viewer }
Tenant switcher (POST /auth/switch-tenant + /hub-memberships/me/tenants)
Hub Consolidated Report (shift sales + payments per tenant→outlet)
Terminal Center: tab "Hub & Anggota" (Fase 15, UI lengkap)
```

**Temuan yang jadi alasan utama fase ini**: `AuthService.switchTenant` menerbitkan token lintas-tenant
dengan `permissions: HUB_MEMBER_ROLE_PERMS[role]` (`owner → OWNER_PERMS`) dan `outletIds: []`
(= semua outlet), sementara `findAccessibleTenants` memberi **seluruh tenant dalam hub** ke setiap
anggota. Artinya anggota hub role `owner` otomatis **Owner penuh di semua tenant** — tidak ada cara
menyatakan "hanya tenant C, outlet Jakarta saja". Ini **lubang otorisasi yang aktif**, bukan fitur
masa depan, karena itu access model (Fase 17) didahulukan.

### Fase 16 — Namespace permission & matriks role hub ✅ (2026-09-29)
- [x] `shared/src/constants/permissions.ts`: tambah `PLATFORM_HUBS_MANAGE`, `HUB_READ`, `HUB_MEMBERS_READ/MANAGE`, `HUB_TENANTS_READ/MANAGE`, `HUB_REPORTS_READ/EXPORT`.
- [x] **Rename** permission platform `hub:manage` → `platform.hubs.manage` (`PLATFORM_ROLE_PERMS`) + **migrasi dokumen `Role` di DB** (permission tersimpan di collection, bukan hanya di kode).
- [x] Namespace `hub:*` **didefinisikan sekarang, dipakai nanti** (D1 tahap 2) — statusnya "reserved" supaya tidak ada permission mati tanpa penjelasan.
- [x] Matriks role hub 4 (`owner`/`admin`/`manager`/`viewer`) → permission, sebagai konstanta yang dapat di-seed (bukan hardcode di `AuthService`).
- ⚠️ **JWT embed permission → seluruh super admin wajib re-login setelah deploy.** Release note wajib.
- [x] Test: permission baru ada di `PERMISSIONS`, `PLATFORM_ROLE_PERMS` tidak lagi memuat `hub:manage`, route hub memakai nama baru.

#### Catatan implementasi Fase 16 (2026-09-29)
- **Rename berlaku penuh**: `PLATFORM_ROLE_PERMS`, 21 route guard (`platform.routes.ts` 9, `hub.routes.ts` 8, `hubmembership.routes.ts` 4) & tab `Hub & Anggota` di `TerminalCenterPage` kini memakai `PERMISSIONS.PLATFORM_HUBS_MANAGE`. `PERMISSIONS.HUB_MANAGE` dihapus, bukan di-backward-compatible-kan: satu permission satu nama.
- **Migrasi DB otomatis saat boot**: `migratePlatformHubPermissions(RoleModel)` dipanggil di `bootstrap/container.ts` (fire-and-forget, seperti `syncIndexes()`) → `updateMany({ permissions: 'hub:manage' }, [aggregation pipeline])` yang menulis ulang array: buang `hub:manage`, lalu `$setUnion` dengan `platform.hubs.manage` (aman bila keduanya sudah ada, tetap idempotent). Tidak ada langkah manual/SQL.
  - Jebakan yang perlu diwaspadai: `$pull` + `$addToSet` pada field yang sama **ditolak MongoDB** (`code 40: Updating the path 'permissions' would create a conflict`) — harus aggregation pipeline update.
  - Cakupannya **semua tenant** (`updateMany` tanpa filter `tenantId`), bukan hanya role platform: kalau ada role kustom yang memegang `hub:manage`, role itu ikut kehilangan akses tanpa disadari.
- **Role `manager` ditambahkan** (4 role: `owner`/`admin`/`manager`/`viewer`) di domain `HUB_MEMBER_ROLES`, `HUB_MEMBER_ROLE_PERMS.manager` (= `MANAGER_PERMS` + `reports:read`, **tanpa** `users:read`), label backend `Hub Manager`, dan `useHubMemberships` (label `Manager` + hint). Role existing tidak berubah → nol anggota kehilangan akses.
- **Matriks reserved** `HUB_ROLE_PERMISSION_MATRIX` (hub role → `hub.*`) ditambahkan di `platform/defaults/roles.ts` sebagai data, bukan rantai ternary, supaya bisa di-seed saat hub-side admin (D1 tahap 2) tiba. Belum ada route yang menegakkan `hub.*` — itu sebabnya ditandai *reserved*, bukan *unused*.
- **Tidak ada perubahan perilaku**: `AuthService.switchTenant` masih membaca `HUB_MEMBER_ROLE_PERMS` persis seperti sebelumnya (Fase 17 yang menggantinya dengan grant per-tenant, dengan constant ini sebagai fallback).
- ⚠️ **Release note — super admin WAJIB re-login.** Permission di-embed di access+refresh JWT, jadi token yang sudah terbit masih membawa `hub:manage` dan akan kena 403 di `/api/hubs*`, `/api/hub-memberships*`, dan sebagian `/api/platform/*` sampai login ulang (DB sudah dimigrasi otomatis; yang stale cuma token).

### Fase 17 — Access model per tenant/outlet ★ (menutup temuan otorisasi)
> Status: **Fase 17 selesai 2026-09-29**. Koleksi `hubmembertenantaccesses`.

- [x] Domain `HubMemberTenantAccess { id, hubId, userId, tenantId, tenantRole, outletIds[], status }` — `tenantRole` adalah role **tenant** (`owner|admin|manager|cashier|viewer`), bukan role hub. Matriks permission di `platform/defaults/roles.ts` (`TENANT_ACCESS_ROLES` / `TENANT_ACCESS_ROLE_PERMS`).
- [x] `HubMemberTenantAccessSchema`: index unik `{hubId, userId, tenantId}`, lookup `{userId, tenantId}`; repo + wiring `container.ts` (+ `syncIndexes`).
- [x] Service: `listGrantsForMember/listGrantsForUser`, `grantAccess`, `setAccess` (upsert), `updateAccess`, `setOutlets`, `revokeAccess`, `syncDefaultGrantsForMember`, `suspendAllGrantsForMember`, `resolveSessionFor`, `findAccessibleTenants`, `getContext`.
- [x] `AuthService.switchTenant` **baca grant dulu** → `{ tenantRole, outletIds }`; **fallback** ke perilaku lama (`HUB_MEMBER_ROLE_PERMS`, `outletIds: []`, semua tenant) bila tabel grant kosong untuk user tsb → **nol anggota existing kehilangan akses** (D3).
- [x] `HubMembershipService.findAccessibleTenants` di-intersect dengan grant → tenant switcher hanya menampilkan tenant ber-grant.
- [x] `HubMemberTenantAccess.status`: `active`/`suspended` per tenant.
- [x] API: `GET /api/hub-context/me` (`hubs[]`, `grants[]`, `tenants[]`, `effectivePermissions[]`), `GET/PUT/DELETE /api/hub-memberships/hub/:hubId/:userId/access` (sementara `platformAuthenticate` — D1 tahap 1).
- [x] **Test DENY wajib**: tenant tanpa grant / suspended → `POST /auth/switch-tenant` 403, tenant tak muncul di switcher, outlet di luar `outletIds` → 403.
- [x] Frontend: tombol "Akses" per anggota (`HubMemberAccessModal`) + `useHubMemberAccess`/`useSaveHubMemberAccess`/`useRevokeHubMemberAccess`/`useHubContext`.

#### Keputusan runtime Fase 17 (penting saat membaca kode)

| Aturan | Kenapa |
|---|---|
| **Grant mode** = user punya ≥1 baris grant (status apa pun). Nol baris = **fallback** legacy. | Nol anggota existing kehilangan akses (D3). |
| **Revoke = `suspended`, bukan delete.** | Hard delete baris terakhir akan mengembalikan user ke fallback → akses owner-like come back sendiri. Baris yang disuspend jadi *tombstone*. |
| **Anggota baru langsung di-seed grant `viewer` untuk semua tenant hub** (`syncDefaultGrantsForMember`). | Tanpa ini anggota baru dengan role hub `owner` mewarisi fallback dan jadi **Owner di setiap tenant** — persislubang yang fase ini tutup. |
| **Hapus anggota → suspend semua grant-nya** (`suspendAllGrantsForMember`). | Baris grant tidak boleh hidup lebih lama dari membership. |
| **Re-add anggota → grant suspended diaktifkan lagi** dengan role/outlet yang sudah ada. | Tidak menghapus hasil narrowing yang memang disengaja. |
| Grant divalidasi di **kedua** cabang `setAccess` (upsert). | Cabang create pernah melewati validasi → `PUT` bisa memberi tenant milik hub lain / outlet milik tenant lain. |
| Resolusi grant re-cek **`isGrantStillLinked`**: hub aktif + membership masih ada + tenant masih milik hub itu. | Defence in depth: baris yang diedit manual / warisan tidak bisa jadi pintu belakang. |
| `PUT` tanpa `status` menghidupkan kembali grant suspended. | Menangguhkan selalu eksplisit di body; `PUT` berarti "ini konfigurasi yang saya mau". |
| **Batasan diketahui**: hub yang **belum punya tenant** saat anggota ditambahkan → nol baris grant → anggota tetap di mode fallback sampai grant pertama ditulis. | Diperbaiki di Fase 18/20 (status hub + seeding saat tenant masuk hub), tidak diperluas di fase ini. |

> ✅ **Gate terpenuhi 2026-09-30.** Fase 18 **tidak lagi terblokir**: T0–T9 di
> [`TECH_DEBT_PLAN.md`](TECH_DEBT_PLAN.md) selesai — pagar regresi CI benar-benar jalan
> (`pnpm run test` + `pnpm run lint` + `pnpm budget` di `.github/workflows/ci.yml`),
> `PaymentService`/`OrderController`/`DatabaseService` jadi named deps object, tiga god page
> dipecah, dan 1.249+147 test hijau di commit bersih.
>
> Alasan pemblokiran itu (§1 `TECH_DEBT_PLAN.md` — composition root adalah tempat semua
> salah-urut terjadi) **tidak kedaluwarsa**, hanya syaratnya yang sudah terpenuhi. Yang menggantikan
> gate sebagai syarat ke depan: Fase 18 mengubah `isActive` → `status`, dan `isActive` itu sedang
> dipakai `HubsSection.test.tsx` & `HubMemberPanel` — jadi test wajib fase ini harus ditulis
> **bersamaan** dengan perubahan field, bukan sesudahnya.

### Fase 18 — Hub identity — ✅ selesai 2026-09-30
- [x] `Hub`: `code` (unique, uppercase, backfill dari `name`), `status: 'active'|'suspended'|'archived'` (menggantikan `isActive`; `isActive` jadi field derived sementara agar UI lama tidak rusak), `ownerUserId` (**display only** — otoritas tetap `HubMembership.role`). Normalisasi kode di `hubCode.ts` (NFKD, uppercase, dash collapse, maks 24).
- [x] `status: suspended|archived` → `findAccessibleTenants` kosong untuk anggotanya, `switch-tenant` **403**, dan hub ikut hilang dari `/hub-context/me` (`getContext` menyaring non-operasional) — Terminal Center tetap bisa melihat detail hub (diagnostics), konfirmasi menyebut jumlah anggota terdampak.
- [x] **`archived` = tombstone read-only**: profil/tenant/anggota/grant dikunci, tapi `status` sendiri tetap bisa diubah (satu-satunya jalan keluar). `suspended` masih bisa diedit & direvoke — itu lever yang lebih murah daripada menghapus baris grant.
- [x] Migration `migrateHubIdentity()` (idempotent, jalan sebelum `HubModel.syncIndexes()`): backfill `code` (suffix `-2`,`-3` untuk collision, fallback `HUB-<id>`) + `status` dari legacy `isActive`. **Tanpa default di schema** untuk `code`/`status` — kalau `status` punya `default:'active'`, hub legacy yang `isActive:false` akan aktif lagi diam-diam.
- [x] `logo`/`contact`/`settings` **ditunda** (D4 & opsi ditolak) — jebakan config-bag yang sama seperti `TenantConfig`/QRIS.
- [x] Frontend: `HubProfileCard` (field `code`, dropdown `status`, baris owner read-only + fallback ke anggota ber-role `owner`), badge 3 warna + chip `code` di daftar hub, pencarian by kode, panel Tenant/Anggota terkunci + banner saat archived.

> **Jebakan yang dibayar mahal di Fase 18 (frontend).** `isActive` sengaja **tetap ada** di payload API sebagai mirror derived, tapi ia **read-only** — `HubController.update` membaca `status`. Checkbox "Aktif" yang masih mengirim `isActive` karena itu jadi **no-op senyap**: toast sukses tampil, tidak ada yang berubah. Jadi: UI membaca `status`, dan `isActive` tidak boleh pernah dikirim sebagai mutasi. Ada regression test-nya (`HubsSection.test.tsx`, `usePlatformHubs.test.tsx`).
>
> **Keputusan yang diambil tanpa ditanyakan (bisakah direview):** `archived` diperlakukan read-only, dan `delete` tetap boleh selama tidak ada tenant. Batasan diketahui: belum ada bulk endpoint grant, jadi tabel anggota tidak menampilkan ringkasan "N dari M tenant" (satu query per anggota = N+1).

### Fase 19 — Hub Overview (read model) ✅ (2026-10-01)
- [x] `ReportService.getPlatformSalesByTenant(tenantIds, { dateFrom, dateTo })` mengikuti pola `getPlatformShiftsSummary` (**satu** agregasi grouped `tenantId` — bukan `getFinanceAggregation` per tenant yang N+1), sumber **`orders`** (bukan shift sales). Default range 30 hari terakhir.
- [x] `GET /api/platform/hubs/:hubId/overview` (`platform.reports.read`) → `{ hub, dateFrom, dateTo, generatedAt, counts, operational, sales.byTenant[], subscription[] }`.
- [x] **Tanpa koleksi baru** — Hub tidak menyimpan data bisnis; semua agregasi dari `orders`/`shifts`/`outlets`/`subscriptions` yang sudah tenant-scoped (`tenantId: {$in: [...]}`).
- [x] Frontend: sub-tab "Overview" (`HubOverviewPanel`) di dalam tab Hub & Anggota — kartu ringkas, penjualan per tenant, status outlet (open shift/stale), rollup langganan. Nol → `Rp 0`; tidak ada data → `—`.

**Bentuk response**
```
counts:      { tenants, outlets, activeOutlets, members }
operational: { staleHours, outletsWithOpenShift, outletsStale, outletsWithoutShift,
               outlets[]: { outletId, outletName, tenantId, tenantName, isActive,
                             openShifts, lastShiftAt, hasOpenShift, isStale, idleHours } }
sales:       { currency: 'IDR', total, transactions, byTenant[]: { tenantId, tenantName, total, transactions } }
subscription:[ { tenantId, tenantName, planName, status, daysRemaining } ]
```
`pendingInvitations` **sengaja tidak ada** di Fase 19 (butuh domain `HubInvitation`, Fase 20).

**Tiga keputusan yang dibayar mahal di Fase 19**
1. **Baris outlet_supply dari daftar outlet, bukan dari aktivitas shift.** `findOutletActivityByTenantIds` hanya menghasilkan row untuk outlet yang **punya** shift; kalau baris dibangun dari sana, outlet yang belum pernah buka shift **tidak akan muncul sama sekali** — persis kasus yang paling perlu dilihat operator. `outletsWithoutShift` pun jadi kode mati. Jadi `buildHubOverview` melakukan union: semua dokumen outlet + row aktivitas tanpa dokumen outlet (outlet dihapus / shift legacy tanpa `outletId`).
2. **Aturan stale punya satu pemilik.** `ShiftService.getPlatformOutletOperationalStatus` sebelumnya ikut menghitung `isStale`, padahal keputusan itu butuh daftar outlet lengkap yang hanya dimiliki pemanggil. Dua pemilik = aturan bisa melenceng. Sekarang service mengembalikan **aktivitas mentah** (`openShifts`, `lastShiftAt`, `hasOpenShift`) dan `buildHubOverview` satu-satunya yang menetapkan `isStale` (`!hasOpenShift && (idle > staleHours || belum pernah)`).
3. **Read model dipisah dari controller** (`core/platform/application/read-models/HubOverviewReadModel.ts`). `PlatformController` sempat melewati batas 1.000 baris & Budget kompleksitas merah; komposisi ini aturan bisnis (outlet mana yang muncul, kapan dianggap stale, tenant nol penjualan ditampilkan sebagai apa) dan harus bisa diuji tanpa Express. Modul ini mendeklarasikan kebutuhannya secara struktural (`OutletSource`, `ActivitySource`, …), bukan mengimpor 4 kelas konkret.

**Batas yang diketahui (sengaja ditunda)**
- ~~`counts.members` masih lewat `hubMembershipService.listMembers()` (N+1 `findById` user per anggota).~~ **Ditutup Fase 21** — `HubMembershipRepository.countByHub()` + `countMembers()` dipakai lewat `HubOverviewPrimitives.countHubMembers`. Lihat § Fase 21.
- Overview read-only: tidak ada export/scheduled report (di luar scope, terkunci di `HUB_V2_DECISIONS.md`).

### Fase 20 — Hub Invitation & suspend member ✅ (2026-10-02)

**Domain & persistence**
- `HubInvitation { id, hubId, email, role, tokenHash, expiresAt, invitedBy, status: pending|accepted|expired|revoked, acceptedBy, acceptedAt, revokedAt }` (`core/hub/domain/`), `invitationToken.ts` (32 byte `base64url` + SHA-256), repo/schema/Mongo adapter, TTL default 7 hari (clamp 1 jam … 30 hari). Index unik parsial `{hubId, email}` untuk `status:'pending'` — inilah yang membuat "satu undangan terbuka per alamat" ditegakkan di database, bukan hanya di service.
- `HubMembership.status: 'active'|'suspended'` + `suspendedAt`, `suspend()`, `reactivate()`, `isActive()` **absent-tolerant** (dokumen pre-Fase-20 tidak punya field ini dan semuanya aktif secara definisi).

**API**
| Endpoint | Guard | Guna |
| --- | --- | --- |
| `GET /api/hubs/:hubId/invitations` | `platform.hubs.manage` | daftar undangan + status efektif |
| `POST /api/hubs/:hubId/invitations` | `platform.hubs.manage` | buat undangan, **201** + token mentah sekali |
| `DELETE /api/hubs/:hubId/invitations/:invitationId` | `platform.hubs.manage` | cabut (hanya yang masih `pending`) |
| `GET /api/hub-invitations/:token` | `authenticate` | preview untuk penerima |
| `POST /api/hub-invitations/:token/accept` | `authenticate` | terima undangan |
| `PUT /api/hub-memberships/:hubId/:userId/status` | `platform.hubs.manage` | `{ "status": "active" \| "suspended" }` |

Audit: `INVITATION_SENT`, `INVITATION_REVOKED`, `INVITATION_ACCEPTED`, `MEMBER_SUSPENDED`, `MEMBER_REACTIVATED`.

**Frontend**: sub-tab **Undangan** di Terminal Center (`HubInvitationPanel.tsx`), badge + tombol **Tangguhkan/Aktifkan** di `HubMemberPanel.tsx`, halaman terima `/hub-invitations/:token` (`core/hub/pages/HubInvitationPage.tsx`, layout minimal di luar `DashboardLayout`), hook `useHubInvitations.ts`, `useSetHubMembershipStatus()`.

**Lima keputusan yang dibayar mahal di Fase 20**
1. **Token mentah hanya sekali, dan tidak masuk audit.** Server menyimpan SHA-256; respons create mengembalikan `token` mentah, respons list/preview tidak pernah memuat `tokenHash` (hash di respons API satu langkah dari jadi kredensial), dan `PlatformAuditService` menerima `after` tanpa token — audit dibaca orang lebih banyak daripada penerima undangan.
2. **Two audiences, two routers.** Administrasi (`platform.hubs.manage`) dan penredepsi (`authenticate` biasa) **tidak** berbagi file route: menggabungkannya membuat batas permission bergantung pada route mana yang cocok duluan. Rute admin juga tetap di router hub yang sudah dijaga.
3. **Accept tidak pernah mempercayai body.** `hubId`, `email`, dan `role` semuanya berasal dari baris undangan; body hanya boleh kosong. Caller tidak bisa bergabung ke hub pilihan sendiri atau naik role di luar apa yang ditulis admin.
4. **Email penerima harus sama dengan akun yang masuk** (403 + preview menjelaskan kedua alamat). Tautan yang bocor saja tidak cukup untuk ditebus; memindahkan grant ke akun lain butuh server yang sama.
5. **Suspend = tombstone, dan grant sengaja tidak disentuh.** Menghapus baris membership akan mengembalikan user ke fallback ADR D3 (nol grant → akses `owner`-like di seluruh tenant hub), jadi suspend hanya memasang flag yang dibaca setiap jalur akses. Grant dibiarkan aktif agar `reactivate` memulihkan matriks persis seperti sebelumnya, tanpa jalur tulis kedua yang bisa melenceng. Konsekuensi yang harus diterima: **`addMembership` terhadap baris suspended = reaktivasi** (role dari pemanggil), bukan 409 — kalau tidak, satu-satunya jalan kembali adalah endpoint khusus.

**Deviasi dari rencana**: halaman terima ada di `/hub-invitations/:token`, bukan `/hub-invitations/accept` — token adalah kredensialnya, jadi URL per undangan bisa dibagikan/dibookmark dan tidak ada token yang terselip ke POST body. `ProtectedRoute` mendapat pengecualian kasir untuk path ini (kasir sah jadi anggota `viewer` di hub).

**Batas yang diketahui (sengaja ditunda)**
- Tidak ada mailer: admin menyalin tautan dari panel (ada fallback select-manual bila clipboard ditolak browser).
- Kolom anggota belum menampilkan ringkasan grant ("N dari M tenant") — endpoint bulk belum ada (sama seperti batas Fase 19).
- `HubInvitation` tidak punya indeks kedaluwarsa: baris `pending` yang lewat tenggat hanya di-*stamp* `expired` saat dibaca (create/list/preview/accept), jadi satu filter TTL opsional bisa ditambahkan tanpa perubahan kontrak.

### Fase 21 — Member-facing hub API (tahap 2 D1, read-only) ✅ (2026-10-02)

Sebelum fase ini, "being in a hub" hanya berarti **bisa pindah tenant**: satu baris `HubMembership` + grant Fase 17, lalu `/api/hub-context/me`. Tidak ada hub yang bisa dibaca oleh anggotanya sendiri, dan permission `hub.*` (Fase 16) belum ditegakkan. Fase 21 menutup itu dengan permukaan baca yang **read-only** — administrasi hub tetap milik platform/Terminal Center (D1 tahap 1).

**API** (`authenticate` + `requireHubPermission`, bukan `platformAuthenticate`/`authorize`)
| Endpoint | Permission | Guna |
| --- | --- | --- |
| `GET /api/hub/me/hubs` | — (self-scoped) | hub aktif yang dianggotai + role + permission role itu |
| `GET /api/hub/:hubId` | `hub.read` | profil hub (+ role pemanggil) |
| `GET /api/hub/:hubId/tenants` | `hub.tenants.read` | tenant dalam hub, **tanpa `config`** |
| `GET /api/hub/:hubId/members` | `hub.members.read` | anggota + status |
| `GET /api/hub/:hubId/overview` | `hub.reports.read` | read model Fase 19 yang sama |

**Kenapa guard baru (`requireHubPermission`), bukan `authorize()`**: permission `hub.*` sengaja tidak ada di JWT — token membawa permission **tenant**. Kalau `authorize(HUB_READ)` dipakai, setiap anggota mendapat 403 apa pun role-nya; kalau `hub.*` ditambahkan ke token, lapisan hub ikut menumpang di session tenant._Otoritasnya membership, dibaca per request dari baris membership.

**Lima keputusan yang dibayar mahal di Fase 21**
1. **Matriks `viewer` dipersempit.** `viewer` memegang `hub.reports.read` sejak Fase 16 — artinya anggota yang ditolak bahkan untuk melihat *daftar* tenant bisa membaca pendapatan semua tenant yang angkanya tidak bernama. Sekarang `viewer: [HUB_READ]` saja, dan tes `HubPermissionNamespace.test.ts` mengunci subset-ness antar role (`viewer ⊆ manager ⊆ admin ⊆ owner`) supaya matriks tidak bisa lagi tidak monoton.
2. **Tidak ada bypass untuk platform admin.** `platform.hubs.manage` menjalankan hub dari Terminal Center; `/api/hub/*` adalah permukaan anggota. Admin platform tanpa membership mendapat **403**, bukan melihat segalanya — dibuktikan tes (token platform non-member 403, platform yang *juga* anggota 200).
3. **404 sebelum 403.** `assertHubPermission` memeriksa keberadaan hub dulu, baru keanggotaan, baru permission, sehingga "hub tidak ada" tidak berubah jadi "kamu tidak berhak" yang menyesatkan.
4. **Baca hub ≠ grant tenant.** `/api/hub/*` mencakup **seluruh tenant dalam hub**, bukan hanya tenant hasil grant Fase 17. Itu dua pertanyaan berbeda: "tenant mana yang boleh saya buka" (grant, ditegakkan di `switch-tenant`) versus "kelompok bisnis ini bagaimana" (API ini, ditegakkan `hub.tenants.read`). Irisannya akan mengembalikan Fase 17 sebagai bug: anggota tak bisa menyebut nama tenant yang muncul di baris pendapatan hubnya.
5. **Proyeksi tenant eksplisit, bukan `serialize()`.** `Tenant.serialize()` membawa `config`, dan `config` memuat `qrisGatewayApiKey`/`qrisGatewayBaseUrl`/`qrisGatewayMerchantId` milik tenant lain. `MyHubController.tenantRows` memetakan field per field; tes asserting `rahasia-tenant-alpha` tidak muncul di respons. (Platform `/tenants` masih mengembalikan `serialize()` penuh — itu permukaan platform dan belum disentuh.)

**Utang yang dibayar sambil jalan**: batas Fase 19 "`counts.members` masih N+1" ditutup — `HubMembershipRepository.countByHub()` + `HubMembershipService.countMembers()` + `MemberSource.countMembers?` opsional pada read model (tetap jalan kalau sumber hanya bisa `listMembers`).

**Pemindahan file**: `HubOverviewReadModel.ts` pindah `core/platform/application/read-models/` → `core/hub/application/read-models/` — sejak Fase 21 read model itu punya **dua** pemanggil (Terminal Center dan anggota hub), dan tempat alamatnya adalah domain hub, bukan platform.

**Batas yang diketahui (sengaja ditunda)**
- Belum ada mutasi dari sisi anggota (ubah role, suspend anggota, grant per tenant, undangan) — semuanya masih `platform.hubs.manage`.
- Belum ada `switch-hub`: memilih hub terjadi lewat halaman `/hub` (Fase 22), bukan lewat pergantian session.
- Ringkasan grant per anggota ("N dari M tenant") masih butuh endpoint bulk (sama seperti batas Fase 19/Fase 20).
### Fase 22 — Halaman anggota `/hub` ✅ (2026-10-03, dib superseded oleh Fase 24)

Fase 21 memberi permukaannya; fase ini membuatnya bisa dipakai orang. Awalnya `/hub` hidup **di dalam dashboard** dengan tab permission-gated (`hub.read` profil, `hub.tenants.read`, `hub.members.read`, `hub.reports.read` overview) — tab yang tak terlihat tidak pernah menembak endpoint-nya.

> **Fase 24 membongkar premis "di dalam dashboard".** Lihat §Fase 24: `/hub` kini console sendiri (`/hub/login` + `HubLayout`), bukan lagi halaman dashboard.

**Ekstraksi yang menjaga dua tampilan tetap sama** (masih berlaku di Fase 24): `HubOverviewBody`, `useHubOverviewRange`, `HubOverviewRangeBar` berasal dari `HubOverviewPanel` (Terminal Center). Tampilan grup perlu `hubName` yang bentuknya berbeda di dua pemanggil, jadi `HubOverviewSections = Omit<HubOverview, 'hub'>` — header-nya disediakan oleh halaman.

Batas yang diketahui: hook-nya masih di `core/platform/components`, jadi `core/hub` mengimpor dari `core/platform` — tidak ideal, tetapi tidak menyakitkan selama platform dan hub memang satu feature area.

### Fase 23 — Dashboard hub per outlet (`/hub/outlet`) ❌ **DIREVERT 2026-10-04**

Dihapus seluruhnya (backend + frontend + test + docs) pada 2026-10-04. Alasan produk: **hub hanya dipakai client yang punya banyak tenant**, jadi layar per outlet tidak punya pemanggil. Angka per outlet tidak benar-benar hilang — `ReportController` sudah meneruskan `?outletId=` ke daily/sales/finance/shift report; yang belum ada hanya **filter outlet di UI `/reports`**.

Yang tetap dipertahankan karena dipakai jalur grup: `HubOverviewPrimitives` (`OVERVIEW_STALE_HOURS`, `buildOutletRows`, `countHubMembers`) dan `PlatformSalesAggregation` (`getSalesByTenant` dari Fase 19). Yang hilang bersama fase ini: `GET /api/hub/outlet/overview`, guard `requireHubPermissionForOutlet`, `HubOutletOverviewReadModel`, `ReportService.getPlatformSalesByOutlet`, `PlatformSalesAggregation.getSalesByOutlet`, hook `useMyHubOutletOverview`, halaman `/hub/outlet` + nav `Hub Outlet`.

Keputusan yang hilang bersama kodenya, tapi belum kontroversial — simpan kalau fiturnya dihidupkan lagi: outlet adalah sumber konteks (header `X-Outlet-Id` → outlet → tenant → `tenant.hubId` → membership), bukan parameter path; tanpa header = **400**, bukan fallback outlet default; dan penjualan harus dihitung per outlet (`$group` per `tenantId + outletId`), bukan total tenant yang difilter di tampilan.

### Fase 24 — Hub Center console + mutasi sisi anggota ✅ (2026-10-04)

Fase 21/22 memberi **baca**; fase ini menutup dua lubang produk sekaligus: (1) `/hub` tidak bisa menjadi halaman dashboard — anggota hub bisa jadi orang yang tidak punya posisi tenant sama sekali, dan menu POS tidak punya apa pun untuk ditampilkan; (2) satu-satunya cara mengelola anggota adalah Terminal Center, padahal target penggunanya justru **klien dengan banyak tenant**, yang tidak punya waktu masuk ke console platform.

**Pemisahan console, bukan sekadar halaman baru.** `/hub/login` punya form sendiri dan `HubLayout`-nya sendiri, sibling dari `TerminalLayout`. Alasannya konsekuensi, bukan selera: `ProtectedRoute` melempar `Cashier` ke `/pos`, dan kasir adalah anggota `viewer` yang sah — jadi rute `/hub` **harus** di luar `ProtectedRoute` **dan** di luar `DashboardLayout`. Login memakai `/auth/login` tanpa `X-Tenant-Id`, persis fallback global-email yang dipakai login tenant hasil provisioning; header `platform` milik `TerminalLoginPage` justru akan membuat anggota hub mustahil masuk.

**Aturan role satu pemilik, ditulis sekali** (`hubRoleRules.ts`, 16 unit test):
- Yang boleh dikelola **hanya** role di bawah diri secara ketat (`admin` tidak bisa menyentuh `admin` lain, `owner` tidak menyentuh siapa pun termasuk owner lain) → **baris owner immutable dari layar anggota**, dan itu yang menjaga hub selalu punya pengelola. Takeaway: jangan "perbaiki" ini dengan guard owner-terakhir; guard itu tidak terjangkau selama aturannya strict-rank, jadi menambahkannya hanya mengarang input yang tidak bisa terjadi.
- Role yang boleh diberikan tidak melebihi rank actor (owner boleh memberi owner; admin tidak boleh memberi owner).
- Cap grant tenant: `owner→owner`, `admin→admin`, `manager→manager`, `viewer→tidak boleh grant`; revoke tetap `suspended`, bukan delete (Fase 17).

**Yang FE terima dari server, bukan hasil tebakan sendiri**: UI tidak membaca role-rank; ia menerima `permissions[]` dari `/hub/me/hubs` lalu memakainya untuk memblok tab dan meng-`enable` query. Jebakan yang sudah satu kali terjadi: `HUB_MEMBER_ROLES` terurut widest-first, jadi `indexOf` memberi `owner` angka **terkecil** — membandingkan dengan `>` lalu membalik aturan secara senyap (owner tak bisa mengelola viewer). `core/hub/utils/roles.ts` sekarang punya `STRENGTH` eksplisit + 11 test.

**Audit**: mutasi anggota memakai actor nyata, bukan baris kosong di `platform_audit` — `PlatformAuditService.recordFromRequest` menerima `AuditActor` opsional yang mengalahi field platform. Raw token undangan tidak pernah masuk audit.

Batas yang diketahui: lifecycle tenant (pause/resume/subscription/destructive) **tetap platform-only**; `switch-hub` masih ganti halaman, bukan ganti session; ringkasan grant per anggota ("N dari M tenant") masih butuh endpoint bulk; satu-satunya jalan keluar dari role owner adalah meminta admin platform.

### Fase 25 — Gerbang Status Nonaktif (Tenant · Outlet · Hub) ✅ (2026-10-06)

Tiga status "nonaktif" sebelumnya hanya tampil di layar admin, tidak menutup pintunya. Fase ini menyamakan semantiknya: **status nonaktif = akses ditolak dengan alasan**, bukan diam-diam berhasil atau gagal generik.

- **Tenant** — `AuthService.execute` membaca `tenantRepository.findById(tenantId)` **setelah password terbukti** dan menolak `!tenant.isActive()` dengan **403** berlabel Indonesia (`suspended`→"ditangguhkan", `frozen`→"dibekukan", `cancelled`→"dibatalkan", `deactivated`→"dinonaktifkan"). Dua jebakan yang dijaga: (1) gate **tidak** boleh sebelum verifikasi password (jadi oracle enumerasi — tes mengunci `findById` tak dipanggil pada password salah); (2) dokumen tenant **tidak ada** tidak memblokir, karena super admin `platform` tidak punya baris di `tenants`.
- **Outlet** — middleware baru `createResolveOutlet(outletRepository)` di `resolveOutlet.ts` = `resolveOutlet` + gate `isActive`. Dipasang di route transaksi POS (order/payment/shift) via `bootstrap/routes.ts`; urutan dijaga: cek scope (murah, sinkron) lebih dulu sehingga header di luar `outletIds` tidak memicu lookup DB, lalu lookup, lalu 403 `Outlet "<nama>" sedang nonaktif — pilih outlet lain.` Dokumen outlet **tidak ditemukan tidak** memblokir (semantik hapus tetap di handler downstream). Route factory order/payment/shift kini menerima `outletMw` (default `resolveOutlet`) agar bisa diuji dengan stub. `DashboardLayout` berhenti menawarkan outlet nonaktif, **tetapi** outlet yang sedang aktif tetap ditampilkan walau kemudian dinonaktifkan — dropdown tidak boleh kosong, backend yang menolak dengan pesan.
- **Hub** — `HubMemberAccessService.getContext` mengisi `blocked` saat `hubs[]` kosong **karena** penangguhan: `membership_suspended` / `hub_suspended` / `hub_archived` + `hubName`; `null` bila user memang bukan anggota hub. Hub yang **dihapus** di-skip (bukan status yang bisa ditindaklanjuti). `HubRoute` merender layar "Akses Hub Ditolak" berisi alasan alih-alih bounce senyap ke form login — perubahan status tidak lagi terlihat seperti login gagal.

**Tests**: `resolveOutlet.middleware.test.ts` (7, DENY/ALLOW + urutan scope-sebelum-lookup + propagasi error + "outlet hilang tidak memblokir"), `HubMemberAccessService.test.ts` +6 (`blocked` per jenis + null), `AuthService.test.ts` +5 (DENY per status, ALLOW active/trial, dokumen hilang, tanpa oracle), `HubRoute.test.tsx` (5), `DashboardLayout.test.tsx` (3). **Berdampingan dengan `HUB_V2_DECISIONS.md`**: tanpa ADR baru; ini pengetatan kontrak yang sudah ada, bukan keputusan produk baru.

### Lampiran 2026-10-07 — Masa Aktif Efektif (banner sisi anggota)

Hub `TenantsSection` (`core/hub/sections/`) kini menampilkan banner ringkasan "**N tenant dalam hub berada di ambang masa aktif berakhir atau berstatus nonaktif**" — tenant dihitung bila (a) `status` bukan `active`/`trial` (tanpa harus punya expiry), atau (b) `subscriptionExpiresAt` ≤ 7 hari. Read-only: keputusan perpanjangan/suspend tetap di Terminal Center. Detail implementasi penuh (sweep, lazy gate, drift fix) ada di `AGENTS.md` § Masa Aktif Efektif.

### Di luar scope (terkunci di `HUB_V2_DECISIONS.md`)
`HubTenantMembership` (multi-hub) · wallet/`WalletLedger`/`HubWallet` · `HubInvoice`/prepaid credit
(ditunda) · `Hub.settings`/logo/contact · **lifecycle tenant & operasi destruktif dari sisi anggota** (tetap
Terminal Center) · scheduled reports & export overview.

### Urutan & release
```
1. Commit dokumen: HUB_V2_DECISIONS.md + HUB_V2_FRONTEND_PLAN.md + fase ini   (docs only)
2. Fase 16 (commit sendiri — ada migrasi Role & wajib re-login)
3. Fase 17 (commit sendiri — mengubah cara token lintas-tenant diterbitkan)
4. Fase 18 → 19 → 20 → 21 → 22 (satu commit per fase)
```
