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
> Status: **Fase 16 selesai 2026-09-29** (permission namespace + matriks role hub). Fase 17–20 masih rencana.
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
- [ ] Domain `HubMemberTenantAccess { id, hubId, userId, tenantId, tenantRole, outletIds[] }` — `tenantRole` adalah role **tenant** (`owner|admin|manager|cashier|viewer`), bukan role hub.
- [ ] `HubMemberTenantAccessSchema`: index unik `{hubId, userId, tenantId}`, lookup `{userId, tenantId}`; repo + wiring `container.ts`.
- [ ] Service: `listGrants(userId)`, `grantAccess`, `revokeAccess`, `setOutlets`, `resolveSessionFor(userId, tenantId)`.
- [ ] `AuthService.switchTenant` **baca grant dulu** → `{ tenantRole, outletIds }`; **fallback** ke perilaku lama (`HUB_MEMBER_ROLE_PERMS`, `outletIds: []`, semua tenant) bila tabel grant kosong untuk user tsb → **nol anggota existing kehilangan akses** (D3).
- [ ] `HubMembershipService.findAccessibleTenants` di-intersect dengan grant → tenant switcher hanya menampilkan tenant ber-grant.
- [ ] `HubMemberTenantAccess.status`: `active`/`suspended` per tenant (menunda revoke, atau memindahkan revoke ke status bila butuh histori).
- [ ] API: `GET /api/hub-context/me` (`hubs[]`, `grants[]`, `effectivePermissions[]`), `GET/PUT /api/hub-memberships/hub/:hubId/:userId/access` (sementara `platformAuthenticate` — D1 tahap 1).
- [ ] **Test DENY wajib**: tenant yang di-revoke → `POST /auth/switch-tenant` 403, tenant tak muncul di switcher, outlet di luar `outletIds` tak terlihat. Bukan hanya test GRANT berhasil.
- [ ] Frontend: sub-tab "Access" (`HubMemberAccessModal`) + `useHubMemberAccess`/`useSaveHubMemberAccess`.

### Fase 18 — Hub identity
- [ ] `Hub`: `code` (unique, uppercase, backfill dari `name`), `status: 'active'|'suspended'|'archived'` (menggantikan `isActive`; `isActive` jadi field derived sementara agar UI lama tidak rusak), `ownerUserId` (**display only** — otoritas tetap `HubMembership.role`).
- [ ] `status: suspended|archived` → `findAccessibleTenants` kosong untuk anggotanya; Terminal Center tetap bisa melihat detail hub (diagnostics), dengan konfirmasi yang menyebut jumlah anggota terdampak.
- [ ] `logo`/`contact`/`settings` **ditunda** (D4 & opsi ditolak) — jebakan config-bag yang sama seperti `TenantConfig`/QRIS.
- [ ] Frontend: `HubProfileCard` + field `code`, dropdown `status`, baris owner.

### Fase 19 — Hub Overview (read model)
- [ ] `ReportService.getPlatformSalesByTenant(tenantIds, { dateFrom, dateTo })` mengikuti pola `getPlatformShiftsSummary` (**satu** agregasi grouped `tenantId` — bukan `getFinanceAggregation` per tenant yang N+1), sumber **`orders`** (bukan shift sales).
- [ ] `GET /api/platform/hubs/:hubId/overview` (`platform.reports.read`) → `{ hub, counts, operational, sales.byTenant[], subscription[] }`.
- [ ] **Tanpa koleksi baru** — Hub tidak menyimpan data bisnis; semua agregasi dari `orders`/`payments`/`shifts`/`outlets` yang sudah tenant-scoped (`tenantId: {$in: [...]}`).
- [ ] Frontend: sub-tab "Overview" (`HubOverviewPanel`) — 5 kartu, penjualan per tenant, status outlet (open shift/stale), rollup langganan. Nol → `Rp 0`; tidak ada data → `—`.

### Fase 20 — Hub Invitation & suspend member
- [ ] Domain `HubInvitation { id, hubId, email, role, tokenHash, expiresAt, invitedBy, status: pending|accepted|expired|revoked }` + repo/schema/service.
- [ ] `HubMembership.status: 'active'|'suspended'` (suspend ≠ hapus; membership yang disuspend tidak muncul di `findAccessibleTenants`).
- [ ] API platform: `POST/GET /api/hubs/:hubId/invitations`, `DELETE /api/hubs/:hubId/invitations/:id`; accept: `POST /api/hub-invitations/:token/accept` (`authenticate`).
- [ ] Validasi: email format, duplikat `(hubId, email, pending)` ditolak, token di-hash (tidak disimpan plaintext), expiry dicek saat accept.
- [ ] Frontend: `HubInvitationPanel` (daftar pending + kirim) di tab Anggota; halaman accept `/hub-invitations/accept` (layout minimal, **bukan** `TerminalLayout`/`PlatformRoute`).

### Di luar scope (terkunci di `HUB_V2_DECISIONS.md`)
`HubTenantMembership` (multi-hub) · wallet/`WalletLedger`/`HubWallet` · `HubInvoice`/prepaid credit
(ditunda) · `Hub.settings`/logo/contact · UI admin sisi customer (D1 tahap 2) · scheduled reports &
export overview.

### Urutan & release
```
1. Commit dokumen: HUB_V2_DECISIONS.md + HUB_V2_FRONTEND_PLAN.md + fase ini   (docs only)
2. Fase 16 (commit sendiri — ada migrasi Role & wajib re-login)
3. Fase 17 (commit sendiri — mengubah cara token lintas-tenant diterbitkan)
4. Fase 18 → 19 → 20 (satu commit per fase)
```
