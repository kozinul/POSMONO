# PLAN — Role-Based Access & Outlet Scoping (RBAC)

> Dokumen rencana (belum diimplementasikan). Dibuat 2026-08-05, direvisi 2026-08-06.
> Melengkapi `docs/VOID_APPROVAL_PLAN.md` (void approval) — keputusan "fix `authorize()`/JWT roleName" di dokumen itu menjadi fondasi dokumen ini.

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
- **User** (`backend/src/core/identity/domain/User.ts`) — punya `tenantId`, `roleId` (referensi ke `Role`). **Belum ada field `outletIds`/`outletId`.**
- **Role** (`backend/src/core/identity/domain/Role.ts`) — RBAC berbasis **permissions**: `{ name, description, permissions: string[], isSystem }`. Ada kunci `isSystem` (role sistem tidak bisa diubah/dihapus).
- **JWT** (`backend/src/core/identity/infrastructure/auth/JwtStrategy.ts`) — payload `{ sub, tenant, role }`; **`role` = roleId**, bukan role name.
- **Login** (`AuthController.login`) — mengembalikan `user.role = roleId` (bukan name) dan tidak ada `permissions`/`outletIds`.
- **Middleware**:
  - `authenticate` (`backend/src/@shared/interfaces/middleware/authenticate.ts`) — verifikasi JWT, isi `req.userId`, `req.tenantId`, `req.userRole`, dan **`req.userPermissions = []` (hardcode, TODO)**.
  - `authorize(...permissions)` (`backend/src/@shared/interfaces/middleware/authorize.ts`) — cek `req.userPermissions`, **tapi karena di-set `[]`, middleware ini efektif tidak berfungsi.**
  - `tenantContext` (`backend/src/@shared/interfaces/middleware/tenantContext.ts`) — ambil tenant dari header `x-tenant-id` / query / `req.user.tenantId`; fallback `dev-tenant` di development.
- **Route**: SEMUA route hanya `authenticate` — **`authorize` tidak dipakai di file route mana pun** (konfirmasi: satu-satunya pemakaian adalah definisi middleware). Contoh: `promotion.routes.ts`, `role.routes.ts`, `order.routes.ts` (`/:id/void`, `/:id/void-item`, `/:id/void-payment`).

### 2.2 Seed role saat ini (`backend/src/seed.ts`)
- Men-seed **3 role sistem** (`isSystem: true`): `Owner`, `Manager`, `Cashier` (line 59–110).
- Format permission: `resource:action` (mis. `orders:cancel`, `settings:write`, `reports:read`).
- **Belum ada** role `Supervisor`/`Administrator`/`Waiter`/`Kitchen`/`Barista`/`Inventory`.
- Role puncak bernama `Owner` (bukan `admin`) — menjadi dasar resolusi konflik penamaan di §4.

### 2.3 Outlet
- **BELUM ADA model Outlet** (entity/schema/CRUD).
- Kata `outlet` hanya muncul sebagai **dimensi scope** di:
  - `backend/src/core/discount/domain/DiscountScope.ts` (`type: 'outlet'`, `outletId?`)
  - `backend/src/core/tax/domain/TaxScope.ts` (`forOutlet(outletId, outletName)`)
- Tidak ada `outletId` di `User`, `Order`, `Shift`, `Product`, `Promotion`, `Member`.
- `Tenant` (`backend/src/core/tenant/domain/Tenant.ts`) = 1 bisnis (ownerId, config, modules, businessType). Tenancy saat ini adalah **1 tenant = 1 bisnis**.

### 2.4 Frontend
- **Auth store** (`frontend/src/@shared/hooks/useAuth.ts`) — `user = { id, email, displayName, role }`; `role` = roleId (belum di-resolve ke name/permissions). Tidak ada `outletIds`.
- **Guard** (`frontend/src/@shared/components/ProtectedRoute.tsx`) — hanya cek `isAuthenticated` (ada token). Tidak ada cek role/outlet.
- **Router** (`frontend/src/app/router.tsx`) — 15 halaman, semuanya di bawah `ProtectedRoute` + `DashboardLayout`. Tidak ada guard per-route.
- **Sidebar** (`frontend/src/layouts/DashboardLayout.tsx`) — array `navigation[]` **statis** untuk semua role (Dashboard, POS, Orders, Products, Families, Categories, Members, Promotions, Payment, Inventory, Gudang, Templates, Reports, Shifts, Settings).
- **Login** (`frontend/src/core/auth/pages/LoginPage.tsx`) — simpan token + tenant di localStorage, `setUser(data.data.user)`.

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
SYSTEM     system:settings, smtp:manage, gateway:manage, api-key:manage, integration:manage
USER       user:manage, role:manage
```

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
- Contoh konkret policy void: `docs/VOID_APPROVAL_PLAN.md` (per-manager PIN, dua alur same-terminal / two-device).
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
- **Void** (`order.routes.ts`): route dilindungi `pos:use` (bukan `order:void`, supaya cashier bisa inisiasi void + PIN). Enforcement approval di service: caller dengan permission `order:void`/`payment:void` self-approve (tanpa PIN); caller lain wajib PIN approver yang punya permission tsb. Detail: `VOID_APPROVAL_PLAN.md`. Guard `pos:use` otomatis mengecualikan waiter/kitchen/barista/inventory/administrator.
- **Settings/System** (`setting.routes.ts`, `tenant config`): `authorize('system:settings')` (owner/administrator). Business Settings: `owner`/`manager`.
- **User & Role management** (`user.routes.ts`, `role.routes.ts`): `authorize('user:manage')` / `authorize('role:manage')` (owner/administrator).
- **Device/Integrasi** (baru): `authorize('device:manage')` / `authorize('integration:manage')` (owner/administrator).
- **Outlet** (modul baru): CRUD `authorize('outlet:manage')` (owner/administrator); `GET /outlets` semua role untuk pilih outlet kerja (scoped).
- **Product/Family/Category/Inventory/Payment-method/Template/Member**: mutasi → `owner`/`manager` (atau permission masing-masing); `GET` di-scope per outlet.
- **Reports**: `authorize('report:view')` + scoping outlet (owner: semua; manager/supervisor: outlet miliknya; cashier/waiter/kitchen/barista/inventory: tanpa akses laporan manajemen).
- **Shift**: cashier hanya shift outlet miliknya; manager/supervisor/owner bisa lintas outlet miliknya.
- **Open shift (keputusan #3, 2026-08-05)**: cashier BOLEH membuka shift sendiri. Nilai `openingBalance` default diambil dari **Business Settings** (field baru `defaultOpeningBalance` di `Tenant.config`, di-set dari halaman Settings oleh owner/manager). Modal "Open Register" (`ShiftModal`, `frontend/src/core/shifts/pages/ShiftPage.tsx:13`) saat ini memakai `useState(0)` — diubah agar ter-prefill dari nilai default tersebut (tetap bisa diubah oleh kasir).

### 3.8 JWT & sesi (fondasi, dijelaskan di VOID_APPROVAL_PLAN §3.2)

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
6. **Approval Policy** — DISELESAIKAN: dipisah dari dokumen role. Policy void sudah ada di `VOID_APPROVAL_PLAN.md`; policy lain (refund, cash difference, dsb.) didokumentasikan terpisah.
7. **Limit nominal** — DEFERRED: "refund kecil", "approve cash difference kecil", "discount besar" butuh permission dengan ambang nilai (`{ perm, limit? }`) yang belum didukung data model (saat ini boolean). Ditangani sebagai ekstensi masa depan, bukan di dokumen role.

---

## 5. Urutan Implementasi (fase)

### Fase 0 — Fondasi Identity (unblock semua)
- [ ] Perbaiki `authenticate` + `tenantContext`: load user+role dari DB; isi `req.userRole` (name), `req.userPermissions`, `req.outletIds`. Tambahkan deklarasi `Express.Request` yang lengkap.
- [ ] Aktifkan `authorize(...permissions)` (403 saat kurang permission).
- [ ] Ubah login/me: kembalikan `roleName`, `permissions`, `outletIds`.
- [ ] **Seed 9 role template** `isSystem`: `owner` (rename dari `Owner`), `administrator`, `manager`, `supervisor`, `cashier`, `waiter`, `kitchen`, `barista`, `inventory-staff` — dengan permission default per §3.1.
- [ ] Update `frontend/useAuth` + guard + sidebar + API client (header outlet).
- [ ] Tes: unit (auth/authorize) + integrasi login.

### Fase 1 — Outlet
- [ ] Modul `outlet` (domain, schema, repository, service, controller, routes) — CRUD owner/administrator.
- [ ] Tambah `outletIds` di `User` (validasi: cashier = 1; lainnya ≥ 1; owner/administrator = semua).
- [ ] Seed outlet default + backfill data lama.
- [ ] Tambah `outletId` di agregat Order/Shift/Product/Promotion/Member + set saat create.
- [ ] Helper scoping `scopeOutletIds(req)` + terapkan di query.

### Fase 2 — Guard backend per route
- [ ] Promotion: mutasi butuh `promotion:create`.
- [ ] Void/refund: guard permission `order:void`/`payment:void`; Approval Policy terpisah (integrasi `VOID_APPROVAL_PLAN.md`).
- [ ] Settings: Business (owner/manager) vs System (`system:settings` owner/administrator).
- [ ] User/Role management: `user:manage`/`role:manage` (owner/administrator).
- [ ] Device/Integrasi (baru): `device:manage`/`integration:manage` (owner/administrator).
- [ ] Product/Family/Category/Inventory/Payment-method/Template/Member: guard mutasi + scoping GET.
- [ ] KDS/drink-queue: `kds:view`/`kds:status`, `drink-queue:view`/`drink-queue:status`.
- [ ] Reports & Shifts: scoping per outlet.

### Fase 3 — Frontend
- [ ] `RoleRoute`/permission guard di router.
- [ ] Sidebar dinamis + outlet switcher.
- [ ] Sembunyikan aksi per role + halaman 403.
- [ ] POS: gating tombol aksi per permission; layar KDS/drink-queue terpisah untuk kitchen/barista.
- [ ] Laporan per outlet + konsolidasi owner.

### Fase 4 — Uji & dokumentasi
- [ ] Unit test (guard/scope/outlet), integrasi (login→route per role).
- [ ] **Test permission matrix** — pastikan daftar permission eksplisit per role tidak drift (regresi saat permission baru ditambahkan).
- [ ] Update `docs/POS_CURRENT_FEATURES.md`, `docs/DAILY_LOG.md`, `docs/REPORT_REQUIREMENTS.md`.

---

## 6. Risiko & Catatan

- **`authorize` saat ini mati** — memperbaikinya (Fase 0) akan **langsung memblokir** endpoint yang mulai diberi guard; pastikan guard per route ditegakkan bertahap agar tidak "jebol" di tengah.
- **Drift permission antar role** — karena tiap role berdaftar eksplisit, perubahan permission template perlu ditinjau per-role; mitigasi dengan test permission matrix (Fase 4).
- **Scoping penuh ke semua agregat besar** — MVP hanya 5 agregat utama; resource lain (mis. template, settings) di-scope secara org-wide atau owner/administrator-only.
- **Perf**: load role per request = +1 query; bisa dimitigasi dengan cache role (TTL) atau klaim permission di JWT (trade-off: perubahan permission butuh re-login).
- **Keamanan**: enforce di backend adalah keharusan; frontend hanya penyembunyian UX.
- **Approval ≠ Role**: perubahan policy approval tidak mengubah role/permission; jangan tambahkan aturan bypass ke dokumen ini.
- Dokumen ini **belum dieksekusi** — setelah disetujui, mulai Fase 0.
