# PLAN — Role-Based Access & Outlet Scoping (RBAC)

> **Status: TERVERIFIKASI 2026-09-12.** Bagian §2 (recon) & §3 (desain) = WHAT-WAS dan rencana; bagian §5 (fase) ditandai `[x]` per item yang sudah diimplementasikan.
> Diimplementasikan: RBAC JWT permission (`authenticate` isi `req.userPermissions` dari token, `authorize()` aktif), redirect kasir → `/pos` + filter sidebar, guard route per permission, modul Outlet + `User.outletIds` + `resolveOutlet` (`X-Outlet-Id`), frontend outlet switcher/`activeOutletId`, laporan per-outlet. **Keterbatasan aktif**: 9-role template belum (baru `Owner`/`Manager`/`Cashier` + `Platform Super Admin`), KDS/drink-queue tidak ada, device/integration permission belum dibuat, limit nominal (approval by amount) deferred.
> Dokumen dibuat 2026-08-05, direvisi 2026-08-06; impl. bertahap 2026-08-08 s/d 2026-09-12. Detail terkini: `docs/HUB_ARCHITECTURE.md`.
> Melengkapi `docs/archive/VOID_APPROVAL_PLAN.md` (void approval) — keputusan "fix `authorize()`/JWT roleName" di dokumen itu menjadi fondasi dokumen ini.

---

## 1. Tujuan

Pisahkan hak akses berdasarkan peran dan outlet.

### Prinsip Role

> **Prinsip Role**
>
> Role menentukan **tanggung jawab operasional** dan kumpulan permission.
> Role **tidak menentukan approval**.
> Approval ditentukan oleh **Approval Policy** yang dapat menggunakan role, permission, approval level, nominal transaksi, atau kondisi lainnya.

### Fokus Utama Setiap Role

| Role | Fokus |
| ------------- | ------------------ |
| Owner | Strategi & bisnis |
| Administrator | Sistem & perangkat |
| Manager | Operasional outlet |
| Supervisor | Operasional shift |
| Cashier | Transaksi |
| Waiter | Pelayanan meja |
| Kitchen | Produksi makanan |
| Barista | Produksi minuman |
| Inventory | Persediaan |

### Skema outlet per role

| Role | Outlet |
|------|--------|
| **Owner** | Semua outlet |
| **Administrator** | Semua outlet |
| **Manager** | 1+ outlet |
| **Supervisor** | 1+ outlet |
| **Cashier** | Tepat 1 outlet |
| **Waiter** | 1+ outlet |
| **Kitchen** | 1+ outlet |
| **Barista** | 1+ outlet |
| **Inventory** | 1+ outlet |

Prinsip:
- **Frontend**: menu/route/tombol dibatasi per role (UX).
- **Backend**: semua keputusan akses **ditegakkan di API** (security). Frontend hanya kosmetik.
- **Konsolidasi**: `owner`/`administrator` melihat gabungan semua outlet; `manager`/`supervisor`/dll. hanya outlet yang ditugaskan; `cashier` hanya outlet miliknya.

---

## 2. Fakta Arsitektur Saat Ini (hasil recon)

### 2.1 Identity & Auth (backend)

> **Status 2026-09-12: sudah diimplementasikan.** Rekam jejak dibawah ini adalah kondisi saat dokumen dibuat (2026-08-05/06).

- **User** (`backend/src/core/identity/domain/User.ts`) — punya `tenantId`, `roleId`, **`outletIds: string[]`** (`[]` = semua outlet tenant).
- **Role** (`backend/src/core/identity/domain/Role.ts`) — RBAC berbasis **permissions**: `{ name, description, permissions: string[], isSystem }`.
- **JWT** — payload kini memuat `roleName`, `permissions`, `outletIds` (access + refresh).
- **Login/me** — mengembalikan `{ id, email, displayName, roleName, roleId, permissions, outletIds }`.
- **Middleware**:
  - `authenticate` — verifikasi JWT, isi `req.userId`, `req.tenantId`, `req.userRole`, `req.userPermissions` (dari token, bukan `[]`), `req.outletIds`.
  - `authorize(...permissions)` — aktif (403 bila kurang permission); di-mount ke route user/role/settings/reports/produk/inventory/hub/outlet/platform.
  - `resolveOutlet` + `scopeOutletIds(req)` — validasi header `X-Outlet-Id` ∈ `req.outletIds`; `[]`/tanpa header tetap jalan (`HUB_ARCHITECTURE.md` Fase 7).
- **Route**: route transaksi POS (payment/order/shift) kini pakai `resolveOutlet`; route protected lain pakai `authorize(...)`.

### 2.2 Seed role saat ini (`backend/src/seed.ts` / `core/platform/defaults/roles.ts`)

> **Status 2026-09-12:** men-seed `Owner`, `Manager`, `Cashier` + **`Platform Super Admin`** (`tenantId: 'platform'`, `platform.hubs.manage`, `platform.*`). Role `Supervisor`/`Administrator`/`Waiter`/`Kitchen`/`Barista`/`Inventory` **belum** di-seed (9-role template tetap rencana).
>
> **Group Admin lintas-tenant (HubMembership, Fase 9 2026-09-12):** user lintas-tenant memakai `HubMembership {hubId, userId, role}` — BUKAN role tenant. Saat `switch-tenant`, token baru ber-`role: hub-{owner|admin|manager|viewer}` dengan permission dari `HUB_MEMBER_ROLE_PERMS` (`core/platform/defaults/roles.ts`): **owner** = set Owner penuh, **admin** = Manager-level + `users:read` + `reports:read`, **manager** = Manager-level + `reports:read` (tanpa `users:read`), **viewer** = read-only (`reports/orders/products/customers/inventory/shifts/payments:read`). `outletIds: []` (semua outlet tenant target). Manajemen anggota via `/api/hub-memberships` (`platform.hubs.manage`, platform).

> **★ Grant akses per tenant (Hub V2 Fase 17, 2026-09-29):** `HubMembership` tidak lagi menentukan hak di tenant tujuan. Tabel baru `HubMemberTenantAccess {hubId, userId, tenantId, tenantRole, outletIds[], status}` menentukan **tenant mana** yang boleh dimasuki dan **dengan role apa** — `tenantRole` = role **tenant** (`owner|admin|manager|cashier|viewer`, permission `TENANT_ACCESS_ROLE_PERMS`). Aturan resolusi di `AuthService.switchTenant`: (1) punya ≥1 baris grant → mode grant, `role: grant-{tenantRole}` + `outletIds` dari grant, grant `suspended` = **403**; (2) nol baris grant → **fallback** ke `HUB_MEMBER_ROLE_PERMS` + semua tenant (agar nol anggota existing kehilangan akses). Revoke = `suspended` (bukan delete — delete baris terakhir akan mengembalikan user ke fallback owner-like). Anggota baru otomatis di-seed grant `viewer` ke semua tenant hub; hapus anggota → suspend semua grant. API: `GET/PUT/DELETE /api/hub-memberships/hub/:hubId/:userId/access` + `GET /api/hub-context/me`. Detail: `docs/HUB_ARCHITECTURE.md` § Fase 17.

### 2.3 Outlet

> **Status 2026-09-12: modul Outlet sudah ada** (`core/outlet/`), lengkap dengan domain/schema/repo/service/controller/routes. Hierarki penuh: Hub (optional) → Tenant → Outlet → Warehouse (`docs/HUB_ARCHITECTURE.md`). **Sejak 2026-09-13 (Fase 12) pembuatan/penghapusan outlet hanya via Terminal Center** (`POST /api/platform/outlets`, Platform Super Admin `outlet:manage`); tenant hanya `GET`/`PUT /api/outlets`.

- Model **Outlet** (entity/schema/CRUD) — `{ tenantId, name, code, warehouseId, isActive }`, 1:1 ke Warehouse; **create/delete platform-only** (`OutletService.createWithWarehouse` buat Outlet + Warehouse 1:1), update info via `PUT /api/outlets` guarded `outlet:manage`; halaman `/outlets` (Edit + toggle status + banner "Hubungi sales/support").
- **`outletId`** kini ada di `Order`, `Payment`, `Shift`, `Warehouse` (+ laporan). Produk/Promosi/Member **tetap tenant-level**. `Tenant.hubId` opsional (null = standalone).
- Default: tiap tenant otomatis punya **Outlet Utama** + **Warehouse Utama** (`provisionDefaults.ensureDefaultOutlet`) + backfill data lama (`outletId: null` → utama).

### 2.4 Frontend

> **Status 2026-09-12: sudah diimplementasikan** (Fase 7 Hub/Outlet).

- **Auth store** (`frontend/src/@shared/hooks/useAuth.ts`) — `user = { id, email, displayName, roleName, roleId, permissions, outletIds, tenantId }` + `activeOutletId` (persist `localStorage.activeOutletId`, auto-pick 1 outlet, cleared saat logout) + `activeTenantId` + `switchTenant()` (session lintas-tenant).
- **Guard** (`ProtectedRoute`) — redirect non-`/pos` → `/pos` untuk kasir; `DashboardLayout` sidebar filter by permission.
- API client kirim `X-Outlet-Id` (dari `activeOutletId`) + JWT.
- **Router** (`frontend/src/app/router.tsx`) — 16 halaman tenant di bawah `ProtectedRoute` + `DashboardLayout`; **Terminal Center** (`/terminal-center`) di layout terpisah (`TerminalLayout` + `PlatformRoute`) guard platform; `/terminal` redirect ke `/terminal-center`; halaman login platform di `/terminal/login`.
- **Sidebar** (`frontend/src/layouts/DashboardLayout.tsx`) — array `navigation[]` **statis** untuk semua role tenant (Dashboard, POS, Orders, Products, Families, Categories, Members, Promotions, Payment, Inventory, Gudang, Templates, Reports, Shifts, Settings, Printer, Database; **Terminal Center sudah tidak di sidebar** — platform super admin otomatis di-redirect ke `/terminal-center` oleh `DashboardLayout`); **tenant switcher** muncul di top bar saat user punya hub membership lintas-tenant (`GET /auth/accessible-tenants`).
- **Login** (`frontend/src/core/auth/pages/LoginPage.tsx`) — simpan token + tenant di localStorage, `setUser(data.data.user)`; **tidak ada checkbox platform** — login super admin pakai URL terpisah `/terminal/login` (`TerminalLoginPage.tsx` selalu mengirim `X-Tenant-Id: platform` → mendarat `/terminal-center`).

---

## 3. Desain Target

### 3.1 Role Template (9 role sistem)

Role **bawaan hanyalah template**. Tenant bebas rename, disable, duplicate, dan membuat role baru. Yang benar-benar mengontrol hak akses adalah **permission**. Role template di-seed dengan `isSystem: true` supaya tidak terhapus tidak sengaja.

Daftar permission di bawah adalah **nilai default template** — setiap role didefinisikan dengan daftar permission-nya **sendiri** (tidak didefinisikan relatif terhadap role lain).

| Role (`name`) | Permission default (eksplisit) |
|---|---|
| `owner` (Owner / Business Owner) | Semua permission, seluruh domain (termasuk Business & System Settings) |
| `administrator` (System Administrator) | `user:manage`, `role:manage`, `device:manage`, `device:pair`, `smtp:manage`, `gateway:manage`, `api-key:manage`, `integration:manage`, `system:settings` |
| `manager` | `pos:use`, `order:create`, `order:read`, `order:void`, `order:merge`, `order:split`, `payment:take`, `payment:refund`, `payment:void`, `discount:manual`, `price:override`, `drawer:open`, `product:manage`, `modifier:manage`, `category:manage`, `promotion:create`, `stock:adjust`, `shift:open`, `shift:close`, `shift:reopen`, `shift:closeout`, `cash:count`, `cash-diff:approve`, `reprint:approve`, `table:force-close`, `report:view` |
| `supervisor` | `pos:use`, `order:create`, `order:read`, `order:void`, `order:merge`, `order:split`, `payment:take`, `discount:manual`, `drawer:open`, `shift:open`, `shift:close`, `cash:count`, `cash-diff:approve`, `reprint:approve`, `table:transfer`, `bill:merge`, `bill:split`, `bill:request`, `cashier:force-logout` |
| `cashier` | `pos:use`, `order:create`, `order:read`, `payment:take`, `bill:hold`, `bill:resume`, `shift:open`, `shift:close`, `reprint:last` |
| `waiter` | `table:open`, `order:create`, `order:read`, `order:edit`, `table:transfer`, `bill:request`, `bill:split` |
| `kitchen` | `kds:view`, `kds:status` |
| `barista` | `drink-queue:view`, `drink-queue:status` |
| `inventory-staff` | `stock:in`, `stock:out`, `stock:count`, `stock:transfer`, `stock:adjust`, `purchase:request`, `receiving`, `waste` |

> Contoh template: coffee shop cukup memakai Owner, Manager, Cashier (+Barista). Restoran besar dapat memakai seluruh 9 role. Karena kontrolnya di permission, tidak ada konsekuensi teknis dari menghapus/menonaktifkan role yang tidak terpakai.

### 3.2 Katalog Permission (dikelompokkan per domain)

```
POS        pos:use, pos:order:input, pos:order:edit, pos:bill:hold, pos:bill:resume, pos:reprint
ORDER      order:create, order:read, order:void, order:merge, order:split, order:transfer
PAYMENT    payment:take, payment:refund, payment:void, discount:manual, price:override, drawer:open
MENU       product:manage, modifier:manage, category:manage, price:override
PROMOTION  promotion:create
STOCK      stock:in, stock:out, stock:count, stock:transfer, stock:adjust,
           purchase:request, receiving, waste
REPORT     report:view, shift:closeout, analytics:view
SHIFT      shift:open, shift:close, shift:reopen, cash:count, cash-diff:approve
TABLE      table:open, table:transfer, table:force-close
KDS        kds:view, kds:status, drink-queue:view, drink-queue:status
DEVICE     device:pair, device:manage
PRINT      printer:manage, print:receipt, print:kot
SYSTEM     system:settings, smtp:manage, gateway:manage, api-key:manage, integration:manage
USER       user:manage, role:manage
```

> **Implementasi aktual printer (2026-08-13):** permission yang dipakai di seed/dev adalah `printers:read` & `printers:write` (Owner + Manager), guard di `printer.routes.ts` (`/api/printers` CRUD + test → `printers:read`/`printers:write`). `POST /api/print/receipt` & `POST /api/print/kot/:orderId` cukup `authenticate` (kasir boleh print ulang/cetak KOT). Nama permission di atas adalah target konvensi rencana; saat ini kedua permission printer hidup di katalog `PRINT`.

> Catatan: daftar ini hidup (bukan statis) — permission baru dapat ditambahkan ke katalog saat fitur baru lahir. Setiap penambahan permission membutuhkan peninjauan permission default tiap role template.

### 3.3 Business vs System Settings

Memisahkan dua kelompok pengaturan agar hak akses Administrator tidak ambigu:

| Kelompok | Isi | Bisa diubah oleh |
|---|---|---|
| **Business Settings** | Nama toko, alamat, pajak, service charge, promo, harga jual, `defaultOpeningBalance` | `owner`, `manager` |
| **System Settings** | SMTP, payment gateway, API key, integrasi platform, pairing device (printer/KDS/customer display/scanner/cash drawer) | `owner`, `administrator` |

- `owner` = satu-satunya role yang menyentuh keduanya.
- `administrator` (System Administrator) **tidak boleh** mengubah Business Settings, dan **tidak memiliki permission operasional POS** (`pos:use`, `order:*`, `payment:*`, `discount:*`, `price:*`).
- `manager`/`supervisor`/`cashier`/dll. **tidak boleh** mengubah System Settings.

### 3.4 Approval adalah policy, bukan role

Role hanya menyatakan **capability**. Siapa yang mengesahkan (mis. void, refund, cash difference) diatur oleh **Approval Policy** terpisah yang dapat menggunakan role, permission, approval level, nominal transaksi, atau kondisi lain.

- Dokumen ini tidak memuat aturan approval (mis. "Owner/Manager/SPV bypass").
- Contoh konkret policy void: `docs/archive/VOID_APPROVAL_PLAN.md` (per-manager PIN, dua alur same-terminal / two-device).
- Policy lain (refund, cash difference) didokumentasikan terpisah bila diperlukan.

### 3.5 Outlet

Tambahkan model Outlet minimal:
- `Outlet`: `{ id, tenantId, name, address, phone, isActive, createdAt, updatedAt }` — modul baru `backend/src/core/outlet/`.
- **Binding User→Outlet**: tambahkan `outletIds: string[]` di `User`:
  - `cashier`: wajib tepat 1 outlet.
  - `manager`/`supervisor`/`waiter`/`kitchen`/`barista`/`inventory-staff`: 1+ outlet.
  - `owner`/`administrator`: semua outlet (diwakili `[]` = semua).
- **Backfill**: tenant yang sudah ada di-seed 1 outlet default ("Outlet Utama") dan seluruh data lama (Order/Shift/Product/Promotion/Member) diassign ke outlet tersebut (atau mulai `null` dan diisi manual).

### 3.6 Scoping kueri per outlet

Helper middleware/service `scopeOutletIds(req)`:
- `owner`/`administrator` → semua outlet.
- role lain → `req.outletIds` (dari user).

Terapkan filter `outletId ∈ scopeOutletIds(req)` pada resource yang memiliki `outletId`. Untuk MVP, tambahkan field `outletId` ke agregat utama: **Order, Shift, Product, Promotion, Member**. Saat create, set `outletId` dari `req.outletId` (header) atau fallback outlet default user.

### 3.7 Backend enforcement

Urutan middleware per route (di seluruh `*.routes.ts`):
```
router.get('/', authenticate, tenantContext, authorize('report:view'), controller...)
```

Rincian (hanya permission; aturan approval mengikuti policy terpisah):
- **Promotion**: `POST/PUT/DELETE` → `authorize('promotion:create')`. `GET` → semua role terautentikasi (dengan scoping outlet).
- **Void** (`order.routes.ts`): route dilindungi `pos:use` (bukan `order:void`, supaya cashier bisa inisiasi void + PIN). Enforcement approval di service: caller dengan permission `order:void`/`payment:void` self-approve (tanpa PIN); caller lain wajib PIN approver yang punya permission tsb. Detail: `archive/VOID_APPROVAL_PLAN.md`. Guard `pos:use` otomatis mengecualikan waiter/kitchen/barista/inventory/administrator.
- **Settings/System** (`setting.routes.ts`, `tenant config`): `authorize('system:settings')` (owner/administrator). Business Settings: `owner`/`manager`.
- **User & Role management** (`user.routes.ts`, `role.routes.ts`): `authorize('user:manage')` / `authorize('role:manage')` (owner/administrator).
- **Device/Integrasi** (baru): `authorize('device:manage')` / `authorize('integration:manage')` (owner/administrator).
- **Outlet** (modul baru): CRUD `authorize('outlet:manage')` (owner/administrator); `GET /outlets` semua role untuk pilih outlet kerja (scoped).
- **Product/Family/Category/Inventory/Payment-method/Template/Member**: mutasi → `owner`/`manager` (atau permission masing-masing); `GET` di-scope per outlet.
- **Reports**: `authorize('report:view')` + scoping outlet (owner: semua; manager/supervisor: outlet miliknya; cashier/waiter/kitchen/barista/inventory: tanpa akses laporan manajemen).
- **Shift**: cashier hanya shift outlet miliknya; manager/supervisor/owner bisa lintas outlet miliknya.
- **Open shift (keputusan #3, 2026-08-05)**: cashier BOLEH membuka shift sendiri. Nilai `openingBalance` default diambil dari **Business Settings** (field baru `defaultOpeningBalance` di `Tenant.config`, di-set dari halaman Settings oleh owner/manager). Modal "Open Register" (`ShiftModal`, `frontend/src/core/shifts/pages/ShiftPage.tsx:13`) saat ini memakai `useState(0)` — diubah agar ter-prefill dari nilai default tersebut (tetap bisa diubah oleh kasir).

### 3.8 JWT & sesi (fondasi, dijelaskan di archive/VOID_APPROVAL_PLAN.md §3.2)

- JWT tetap `{ sub, tenant, role }` ringan, tapi **`role` diubah menjadi role NAME** (bukan roleId) — atau tambahkan klaim `roleName` + `perm`.
- Setelah `authenticate`, load user+role dari DB → isi `req.userRole` (name), `req.userPermissions` (dari `Role.permissions`), `req.outletIds`. (Kesalahan kredensial/peran berubah dicerminkan, walau dengan biaya 1 query/request.)
- Login/`me` mengembalikan: `{ id, email, displayName, roleName, roleId, permissions, outletIds }`.

### 3.9 Frontend

1. **`useAuthStore.user` diperluas**: `{ id, email, displayName, roleName, roleId, permissions: string[], outletIds: string[], activeOutletId: string }` (+ helper `can(perm)`, `isRole(...roles)`).
2. **Guard baru**: `ProtectedRoute` tetap; tambah **`RoleRoute allow={...}` atau `requirePerm="..."`** di `router.tsx` (redirect ke `/` atau halaman "no access" saat tidak berhak).
3. **Sidebar dinamis** (`DashboardLayout.tsx`): filter `navigation[]` dengan `can(perm)`; tambah **outlet switcher** untuk owner/manager/supervisor (set `activeOutletId` → dikirim via header `x-outlet-id`).
4. **Halaman**: sembunyikan tombol aksi untuk role non-berhak (mis. tombol "Buat Promosi" hanya untuk `can('promotion:create')`); **halaman tanpa akses** (403 UI) bukan sekadar hilang dari menu.
5. **POS**: role operasional sesuai permission masing-masing (cashier/waiter/manager/supervisor); role non-operasional (administrator, inventory-staff, kitchen, barista) tidak melihat menu transaksi; kitchen/barista memakai layar KDS/drink-queue masing-masing.
6. **API client**: kirim `x-tenant-id` + `x-outlet-id` + token di setiap request.

---

## 4. Pertanyaan Terbuka (status keputusan)

1. **Resolusi "Admin"** — DISELESAIKAN: dua role puncak, `owner` (Business Owner, super-user bisnis) dan `administrator` (System Administrator, tim IT tanpa akses operasional POS). Role `Owner` di seed (`seed.ts:63`) di-rename menjadi role sistem `owner`; role `administrator` ditambahkan.
2. **SPV vs Manager** — DISELESAIKAN: tiap role didefinisikan dengan daftar permission eksplisit (§3.1); tidak memakai relasi "minus role lain".
3. **Cashier & Shift** — DIPUTUSKAN: YA, cashier bisa buka shift dengan nilai `openingBalance` default dari Business Settings (lihat §3.7).
4. **Backfill outlet** — data lama di-assign otomatis ke outlet default, atau dibiarkan `outletId: null` sampai diatur manual? (masih perlu keputusan)
5. **Multi-tenant** — apakah ini tetap 1 tenant per instalasi (multi-outlet dalam 1 tenant), atau platform multi-tenant penuh (1 admin super mengelola banyak bisnis)? Dokumen ini diasumsikan **yang pertama**.
6. **Approval Policy** — DISELESAIKAN: dipisah dari dokumen role. Policy void sudah ada di `archive/VOID_APPROVAL_PLAN.md`; policy lain (refund, cash difference, dsb.) didokumentasikan terpisah.
7. **Limit nominal** — DEFERRED: "refund kecil", "approve cash difference kecil", "discount besar" butuh permission dengan ambang nilai (`{ perm, limit? }`) yang belum didukung data model (saat ini boolean). Ditangani sebagai ekstensi masa depan, bukan di dokumen role.

---

## 5. Urutan Implementasi (fase)

### Fase 0 — Fondasi Identity (unblock semua)
- [x] Perbaiki `authenticate` + `tenantContext`: load user+role dari DB; isi `req.userRole` (name), `req.userPermissions`, `req.outletIds`. Tambahkan deklarasi `Express.Request` yang lengkap. *(2026-08-08: permissions di-embed ke JWT; `authenticate` isi dari token)*
- [x] Aktifkan `authorize(...permissions)` (403 saat kurang permission).
- [x] Ubah login/me: kembalikan `roleName`, `permissions`, `outletIds`.
- [~] **Seed 9 role template** `isSystem` — **SELESAI SEBAGIAN**: `owner`, `manager`, `cashier` + `Platform Super Admin`; `administrator`, `supervisor`, `waiter`, `kitchen`, `barista`, `inventory-staff` **belum**.
- [x] Update `frontend/useAuth` + guard + sidebar + API client (header outlet).
- [x] Tes: unit (auth/authorize) + integrasi login.

### Fase 1 — Outlet
- [x] Modul `outlet` (domain, schema, repository, service, controller, routes) — CRUD guarded `outlet:manage`.
- [x] Tambah `outletIds` di `User` (validasi: cashier = 1; lainnya ≥ 1; owner/administrator = semua).
- [x] Seed outlet default + backfill data lama (`ensureDefaultOutlet`: Outlet Utama + Warehouse Utama + backfill `outletId: null`).
- [~] Tambah `outletId` di agregat Order/Shift/Payment/Warehouse + laporan ✅; **Product/Promotion/Member belum** (tetap tenant-level).
- [x] Helper scoping `scopeOutletIds(req)` + `resolveOutlet` middleware.

### Fase 2 — Guard backend per route
- [x] Promotion, produk/kategori/family: mutasi butuh `products:write`. *(promotions: semua mutasi → `products:write`)*
- [x] Void/refund: `order:void` gating + Approval Policy terpisah (`archive/VOID_APPROVAL_PLAN.md`).
- [x] Settings: `settings:read`/`settings:write`.
- [x] User/Role management: `users:read`/`users:write`, `roles:read`/`roles:write`.
- [ ] Device/Integrasi (baru): `device:manage`/`integration:manage` — **belum dibuat** (tidak ada modul device/integration).
- [x] Product/Family/Category/Inventory/Payment-method/Template/Member: guard mutasi (`products:write`/`inventory:write`) + scoping GET (tetap tenant-wide, bukan per-outlet).
- [ ] KDS/drink-queue: `kds:view`/`kds:status`, `drink-queue:view`/`drink-queue:status` — **belum ada** (KDS bukan MVP).
- [x] Reports & Shifts: `reports:read` di route report; `GET /reports/shift`, `GET /reports/best-sellers` tetap terbuka untuk kasir; laporan per-outlet (filter `outletId`).

### Fase 3 — Frontend
- [x] `RoleRoute`/permission guard di router. *(redirect kasir → `/pos`; sidebar admin filtered)*
- [x] Sidebar dinamis + outlet switcher (`DashboardLayout` + `activeOutletId`).
- [~] Sembunyikan aksi per role + halaman 403. *(guard route per-permission ada; UI 403 khusus belum)*
- [ ] POS: gating tombol aksi per permission; layar KDS/drink-queue terpisah untuk kitchen/barista.
- [x] Laporan per outlet + konsolidasi owner. *(report filter `outletId` opsional; konsolidasi lintas-tenant via `/api/platform` Terminal Center)*

> **Fokus awal**: redirect kasir langsung ke POS + filter sidebar role-aware — lihat `docs/archive/POS_REDIRECT_PLAN.md` (2026-08-07).

### Fase 4 — Uji & dokumentasi
- [x] Unit test (guard/scope/outlet), integrasi (login→route per role). *(backend 991/991; `platform-terminal.test.ts`, `useAuth.test.ts` outlet)*
- [ ] **Test permission matrix** — pastikan daftar permission eksplisit per role tidak drift (regresi saat permission baru ditambahkan).
- [x] Update `docs/POS_CURRENT_FEATURES.md`, `docs/DAILY_LOG.md`, `docs/REPORT_REQUIREMENTS.md`. *(DAILY_LOG sinkron 2026-09-12; sisanya di-sync bersama commit docs ini)*

---

## 6. Risiko & Catatan

- **`authorize` kini aktif** (Fase 0 selesai 2026-08-08) — pastikan guard per route ditegakkan bertahap & setiap permission template baru di-review; risiko yang tersisa adalah **drift** jika permission baru ditambahkan tanpa update role template.
- **Drift permission antar role** — karena tiap role berdaftar eksplisit, perubahan permission template perlu ditinjau per-role; mitigasi dengan test permission matrix (Fase 4).
- **Scoping penuh ke semua agregat besar** — saat ini Order/Payment/Shift/Warehouse + laporan sudah `outletId`; Product/Promotion/Member tetap tenant-wide (keputusan: skala MVP).
- **Perf**: load role per request = +1 query; bisa dimitigasi dengan cache role (TTL) atau klaim permission di JWT (trade-off: perubahan permission butuh re-login).
- **Keamanan**: enforce di backend adalah keharusan; frontend hanya penyembunyian UX.
- **Approval ≠ Role**: perubahan policy approval tidak mengubah role/permission; jangan tambahkan aturan bypass ke dokumen ini.
- **Status eksekusi**: sebagian besar Fase 0–3 telah diimplementasikan (2026-08-08 s/d 2026-09-12). Yang tersisa: 9-role template lengkap (`administrator`/`supervisor`/`waiter`/`kitchen`/`barista`/`inventory-staff`), KDS/drink-queue (non-MVP), device/integration permission, UI 403 khusus, dan permission-matrix test.
