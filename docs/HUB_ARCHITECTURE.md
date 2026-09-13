# PLAN — Optional Business Group (Hub) Architecture

> Dokumen rencana implementasi. Dibuat 2026-08-13.
> Merevisi arah multi-outlet dari `docs/ROLE_ACCESS_PLAN.md` §3.5–3.6: Hub kini **di atas Tenant**, bukan anak Tenant.
>
> **Status: Fase 1–9 SELESAI & TERVERIFIKASI 2026-09-12** — modul Hub/Outlet + scope transaksi (outletId), provisioning boot, User `outletIds` + JWT + middleware `resolveOutlet` (dimount ke route transaksi POS), frontend: `activeOutletId`/`X-Outlet-Id`, outlet switcher, halaman Outlet, POS stock ter-scope per outlet, receipt/OpenShiftModal tampil outlet, `useTenant` +`hubId`/`hubName`; **Terminal Center**: auth platform terpisah (`platformAuthenticate`), `/api/platform` (health, hub/tenant/outlet lists, shift & payment summaries, hub consolidated report), provision Hub/tenant via `hub:manage`; **HubMembership**: user lintas-tenant (`HubMembership {hubId, userId, role}`), session lintas-tenant (`/auth/switch-tenant` + `activeTenantId` + tenant switcher di top bar), UI admin halaman Terminal Center (`/terminal-center`, tabs Hub & Anggota / Tenants / Outlet / Ringkasan / Konsolidasi) di layout sendiri (`TerminalLayout` + `PlatformRoute`), login khusus di `/terminal/login` (langsung `X-Tenant-Id: platform`, tanpa checkbox). Backend tsc bersih (1021/1021 tests), frontend tsc + vite build OK (85/85), shared dist dibangun ulang.

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
- **Session lintas-tenant**: user memegang JWT tenant sendiri, lalu `POST /auth/switch-tenant {tenantId}` → token baru ber-`role: hub-{owner|admin|viewer}`, `permissions` dari `HUB_MEMBER_ROLE_PERMS` (owner = FULL Owner, admin = Manager-level + reports, viewer = read-only), `outletIds: []`; `GET /auth/me` pada token lintas-tenant otomatis resolve lewat membership (bukan role tenant). Frontend top bar menampilkan tenant switcher dari `GET /auth/accessible-tenants`; ganti tenant → `switchTenant` store + `queryClient.clear()`.
- **Hub Consolidated Report**: `GET /api/platform/hubs/:hubId/consolidated?dateFrom=&dateTo=` (guard `platform.reports.read`) — breakdown `Tenant → Outlet` dari shift summary + payment consolidation per outlet (`PaymentService.getPlatformPaymentsConsolidationByOutlet`), plus totals. UI di tab Konsolidasi halaman Terminal Center.

---

## 3. Fakta Arsitektur Saat Ini (recon 2026-08-13)

- **Satu database bersama**: semua model di-register di `systemConnection` (`backend/src/bootstrap/container.ts:126-156`, `mongoose.connection`), dipisah oleh field `tenantId`. `ConnectionManager.getTenantConnection` ada tapi **tidak dipakai** di bootstrap.
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
- [x] `OutletController.ts` + `outlet.routes.ts`: `GET /api/outlets`/`/:id` (scoped) semua role terautentikasi; mutasi `POST/PUT/DELETE` `outlet:manage`
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
- [x] Hooks `useOutlets` (pindah ke `@shared/hooks/useOutlets.ts` + CRUD) / `useHubs` (`@shared/hooks/useHubs.ts`); `useTenant` membaca `hubId` + `hubName` (read-only dari `GET /tenants/current`); backend `TenantController.getCurrent` +`hubId`/`hubName` (inject `hubRepository`)
- [x] `DashboardLayout.tsx`: outlet switcher saat user punya >1 outlet (data-driven, tanpa flag mode; pilihan outlet dari `useOutlets` dibatasi `user.outletIds`; akses semua outlet `[]` → semua); ganti outlet → invalidate `inventory/products/orders/shifts/daily-report/sales-report/best-sellers`
- [x] `frontend/src/core/outlets/pages/OutletListPage.tsx` (`/outlets`, nav "Outlet" guarded `outlet:manage`, CRUD via `OutletController` `outlet:manage`)
- [x] Halaman Users: assign outlet (Fase 6); POS: `useStockList()` di-scope warehouse outlet aktif (`PosPage.stockMap` filter `activeWarehouseId` → `Outlet.warehouseId`); `ReceiptDisplay` fallback struk + nama outlet aktif; `OpenShiftModal` menampilkan "Outlet: {nama}"
- [x] Backend `resolveOutlet` di-mount ke route transaksi POS: payment (`pay-cash`/`process`/`split`/`refund`/transfer confirm+cancel/`qris` initiate+confirm+cancel), order (semua mutasi), shift (`open`/`close`/`pickup`/`sales`) — validasi `X-Outlet-Id` ∈ `req.outletIds` (tanpa header / `[]` tetap jalan)
- **Status**: verifikasi 2026-08-30 — backend tsc bersih + 964/964, frontend tsc bersih + 83/83 (+7 `useAuth.test` outlet), vite build OK. `req.outletId` belum dibaca service (masih body `outletId` default) — pembacaan layanan di-wire Fase 8/9.

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
