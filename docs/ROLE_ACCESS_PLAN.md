# PLAN — Role-Based Access & Outlet Scoping (RBAC)

> Dokumen rencana (belum diimplementasikan). Dibuat 2026-08-05.
> Melengkapi `docs/VOID_APPROVAL_PLAN.md` (void approval) — keputusan "fix `authorize()`/JWT roleName" di dokumen itu menjadi fondasi dokumen ini.

---

## 1. Tujuan

Pisahkan hak akses berdasarkan peran dan outlet:

| Peran | Outlet | Tugas utama |
|-------|--------|-------------|
| **Admin** | Semua outlet | Mengatur outlet, user, dan kebutuhan lain; laporan konsolidasi semua outlet |
| **Manager** | 1+ outlet | Operasional penuh + **boleh buat promotion** + boleh void |
| **SPV** | 1+ outlet | Operasional, **tidak boleh buat promotion**, boleh void |
| **Cashier** | Tepat 1 outlet | Hanya POS + laporan shift outlet tersebut; tidak boleh sentuh menu manajemen |

Prinsip:
- **Frontend**: menu/route/tombol dibatasi per role (UX).
- **Backend**: semua keputusan akses **ditegakkan di API** (security). Frontend hanya kosmetik.
- **Konsolidasi**: `admin` melihat gabungan semua outlet; `manager`/`spv` hanya outlet yang ditugaskan; `cashier` hanya outlet miliknya.

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

### 2.2 Outlet
- **BELUM ADA model Outlet** (entity/schema/CRUD).
- Kata `outlet` hanya muncul sebagai **dimensi scope** di:
  - `backend/src/core/discount/domain/DiscountScope.ts` (`type: 'outlet'`, `outletId?`)
  - `backend/src/core/tax/domain/TaxScope.ts` (`forOutlet(outletId, outletName)`)
- Tidak ada `outletId` di `User`, `Order`, `Shift`, `Product`, `Promotion`, `Member`.
- `Tenant` (`backend/src/core/tenant/domain/Tenant.ts`) = 1 bisnis (ownerId, config, modules, businessType). Tenancy saat ini adalah **1 tenant = 1 bisnis**.

### 2.3 Frontend
- **Auth store** (`frontend/src/@shared/hooks/useAuth.ts`) — `user = { id, email, displayName, role }`; `role` = roleId (belum di-resolve ke name/permissions). Tidak ada `outletIds`.
- **Guard** (`frontend/src/@shared/components/ProtectedRoute.tsx`) — hanya cek `isAuthenticated` (ada token). Tidak ada cek role/outlet.
- **Router** (`frontend/src/app/router.tsx`) — 15 halaman, semuanya di bawah `ProtectedRoute` + `DashboardLayout`. Tidak ada guard per-route.
- **Sidebar** (`frontend/src/layouts/DashboardLayout.tsx`) — array `navigation[]` **statis** untuk semua role (Dashboard, POS, Orders, Products, Families, Categories, Members, Promotions, Payment, Inventory, Gudang, Templates, Reports, Shifts, Settings).
- **Login** (`frontend/src/core/auth/pages/LoginPage.tsx`) — simpan token + tenant di localStorage, `setUser(data.data.user)`.

---

## 3. Desain Target

### 3.1 Konsep Role + Permission (RBAC berbasis permission)

Tetap memakai model `Role.permissions[]` yang sudah ada. Tambahkan **role sistem** (seed):

| Role sistem (`name`) | Permission utama (proposal) | Sifat |
|----------------------|-----------------------------|-------|
| `admin` | `*` (atau semua permission eksplisit) | isSystem |
| `manager` | `pos:use`, `shift:manage`, `order:manage`, `product:manage`, `promotion:create`, `void:approve`, `report:view`, `inventory:manage`, ... | isSystem |
| `spv` | sama dgn manager **minus** `promotion:create` | isSystem |
| `cashier` | `pos:use`, `shift:manage` (own outlet) | isSystem |

Daftar permission yang diusulkan:
- `pos:use` — pakai POS
- `shift:manage` — buka/tutup shift, lihat laporan shift
- `order:manage` — lihat/void order
- `void:approve` — menyetujui void (PIN)
- `product:manage` — CRUD produk/family/kategori/harga
- `promotion:create` — buat/ubah/hapus promotion
- `inventory:manage` — stok & warehouse
- `payment-method:manage` — metode pembayaran
- `template:manage` — template receipt
- `member:manage` — CRUD member
- `user:manage` — kelola user (admin only)
- `outlet:manage` — kelola outlet (admin only)
- `report:view` — lihat laporan (semua outlet utk admin; outlet miliknya utk manager/spv)

> Catatan: `admin` = semua permission + `user:manage` + `outlet:manage`. Detail permission eksplisit bisa disetel per role sistem saat seed.

### 3.2 Outlet

Tambahkan model Outlet minimal:
- `Outlet`: `{ id, tenantId, name, address, phone, isActive, createdAt, updatedAt }` — modul baru `backend/src/core/outlet/`.
- **Binding User→Outlet**: tambahkan `outletIds: string[]` di `User`:
  - `cashier`: wajib tepat 1 outlet.
  - `manager`/`spv`: 1+ outlet.
  - `admin`: semua outlet (diwakili `[]` = semua, atau list eksplisit).
- **Backfill**: tenant yang sudah ada di-seed 1 outlet default ("Outlet Utama") dan seluruh data lama (Order/Shift/Product/Promotion/Member) diassign ke outlet tersebut (atau mulai `null` dan diisi manual).

### 3.3 Scoping kueri per outlet

Helper middleware/service `scopeOutletIds(req)`:
- `admin` → semua outlet.
- `manager`/`spv`/`cashier` → `req.outletIds` (dari user).

Terapkan filter `outletId ∈ scopeOutletIds(req)` pada resource yang memiliki `outletId`. Untuk MVP, tambahkan field `outletId` ke agregat utama: **Order, Shift, Product, Promotion, Member**. Saat create, set `outletId` dari `req.outletId` (header) atau fallback outlet default user.

### 3.4 Backend enforcement

Urutan middleware per route (di seluruh `*.routes.ts`):
```
router.get('/', authenticate, tenantContext, authorize('report:view'), controller...)
```

Rincian:
- **Promotion**: `POST/PUT/DELETE` → `authorize('promotion:create')` (manager/admin; spv dapat `promotion:create` TIDAK punya). `GET` → semua role terautentikasi (dengan scoping outlet).
- **Void** (`order.routes.ts`): 
  - cashier → butuh approval PIN manager/spv (implementasi di `VOID_APPROVAL_PLAN.md`).
  - manager/spv/admin → `authorize('void:approve')` (bypass PIN).
  - Validasi: void oleh user dengan `void:approve` = otomatis disetujui.
- **Settings** (`setting.routes.ts`), **Tenant config**: `authorize('user:manage')` (admin) atau permission `setting:manage`.
- **User management** (`user.routes.ts`, `role.routes.ts`): `authorize('user:manage')` (admin only).
- **Outlet** (modul baru): CRUD `authorize('outlet:manage')` (admin); `GET /outlets` semua role untuk pilih outlet kerja (scoped).
- **Product/Family/Category/Inventory/Payment-method/Template/Member**: mutasi → manager/admin (atau permission masing-masing); `GET` di-scope per outlet.
- **Reports**: `authorize('report:view')` + scoping outlet (admin: semua; manager/spv: outlet miliknya; cashier: tanpa akses laporan manajemen).
- **Shift**: cashier hanya shift outlet miliknya; manager/spv/admin bisa lintas outlet miliknya.
- **Open shift (keputusan #3, 2026-08-05)**: cashier BOLEH membuka shift sendiri. Nilai `openingBalance` default diambil dari **pengaturan** (field baru `defaultOpeningBalance` di `Tenant.config`, di-set dari halaman Settings oleh admin/manager). Modal "Open Register" (`ShiftModal`, `frontend/src/core/shifts/pages/ShiftPage.tsx:13`) saat ini memakai `useState(0)` — diubah agar ter-prefill dari nilai default tersebut (tetap bisa diubah oleh kasir).

### 3.5 JWT & sesi (fondasi, dijelaskan di VOID_APPROVAL_PLAN §3.2)

- JWT tetap `{ sub, tenant, role }` ringan, tapi **`role` diubah menjadi role NAME** (bukan roleId) — atau tambahkan klaim `roleName` + `perm`.
- Setelah `authenticate`, **load user+role dari DB** → isi `req.userRole` (name), `req.userPermissions` (dari `Role.permissions`), `req.outletIds`. (Kesalahan kredensial/peran berubah dicerminkan, walau dengan biaya 1 query/request.)
- Login/`me` mengembalikan: `{ id, email, displayName, roleName, roleId, permissions, outletIds }`.

### 3.6 Frontend

1. **`useAuthStore.user` diperluas**: `{ id, email, displayName, roleName, roleId, permissions: string[], outletIds: string[], activeOutletId: string }` (+ helper `can(perm)`, `isRole(...roles)`).
2. **Guard baru**: `ProtectedRoute` tetap; tambah **`RoleRoute allow={...} or requirePerm="..."`** di `router.tsx` (redirect ke `/` atau halaman "no access" saat tidak berhak).
3. **Sidebar dinamis** (`DashboardLayout.tsx`): filter `navigation[]` dengan `can(perm)`; tambah **outlet switcher** untuk manager/spv/admin (set `activeOutletId` → dikirim via header `x-outlet-id`).
4. **Halaman**: sembunyikan tombol aksi untuk role non-berhak (mis. tombol "Buat Promosi" hanya untuk `can('promotion:create')`); **halaman tanpa akses** (403 UI) bukan sekadar hilang dari menu.
5. **POS**: semua role bisa; tombol void → alur approval PIN (lihat `VOID_APPROVAL_PLAN.md`); aksi manajemen tidak muncul untuk cashier.
6. **API client**: kirim `x-tenant-id` + `x-outlet-id` + token di setiap request.

---

## 4. Pertanyaan Terbuka (perlu keputusanmu)

Status 2026-08-05:

1. **"Sebagian yang tidak boleh dilihat admin"** — kamu bilang ada sebagian yang tidak boleh dilihat admin. **Sedang dianalisa.** Ini menentukan permission `admin` (`*` vs eksplisit minus X).
2. **SPV vs Manager** — selain `promotion:create`, apakah hak mereka identik? **Sedang dianalisa.**
3. ~~**Cashier & Shift** — boleh buka shift sendiri?~~ **DIPUTUSKAN: YA** — cashier bisa buka shift dengan nilai `openingBalance` default dari pengaturan (lihat §3.4).
4. **Backfill outlet** — data lama di-assign otomatis ke outlet default, atau dibiarkan `outletId: null` sampai diatur manual?
5. **Multi-tenant** — apakah ini tetap 1 tenant per instalasi (multi-outlet dalam 1 tenant), atau kamu ingin platform multi-tenant penuh (1 admin super mengelola banyak bisnis)? Dokumen ini diasumsikan **yang pertama**.

---

## 5. Urutan Implementasi (fase)

### Fase 0 — Fondasi Identity (unblock semua)
- [ ] Perbaiki `authenticate` + `tenantContext`: load user+role dari DB; isi `req.userRole` (name), `req.userPermissions`, `req.outletIds`. Tambahkan deklarasi `Express.Request` yang lengkap.
- [ ] Aktifkan `authorize(...permissions)` (403 saat kurang permission).
- [ ] Ubah login/me: kembalikan `roleName`, `permissions`, `outletIds`.
- [ ] Seed role sistem: `admin`, `manager`, `spv`, `cashier` (+ permission set).
- [ ] Update `frontend/useAuth` + guard + sidebar + API client (header outlet).
- [ ] Tes: unit (auth/authorize) + integrasi login.

### Fase 1 — Outlet
- [ ] Modul `outlet` (domain, schema, repository, service, controller, routes) — CRUD admin.
- [ ] Tambah `outletIds` di `User` (validasi: cashier = 1; manager/spv ≥ 1).
- [ ] Seed outlet default + backfill data lama.
- [ ] Tambah `outletId` di agregat Order/Shift/Product/Promotion/Member + set saat create.
- [ ] Helper scoping `scopeOutletIds(req)` + terapkan di query.

### Fase 2 — Guard backend per route
- [ ] Promotion: mutasi butuh `promotion:create`.
- [ ] Void: approval PIN + bypass `void:approve` (integrasi `VOID_APPROVAL_PLAN.md`).
- [ ] Settings/tenant: admin only.
- [ ] User/Role management: admin only.
- [ ] Product/Family/Category/Inventory/Payment-method/Template/Member: guard mutasi + scoping GET.
- [ ] Reports & Shifts: scoping per outlet.

### Fase 3 — Frontend
- [ ] `RoleRoute`/permission guard di router.
- [ ] Sidebar dinamis + outlet switcher.
- [ ] Sembunyikan aksi per role + halaman 403.
- [ ] POS void approval UI (dari `VOID_APPROVAL_PLAN.md`).
- [ ] Laporan per outlet + konsolidasi admin.

### Fase 4 — Uji & dokumentasi
- [ ] Unit test (guard/scope/outlet), integrasi (login→route per role).
- [ ] Update `docs/POS_CURRENT_FEATURES.md`, `docs/DAILY_LOG.md`, `docs/REPORT_REQUIREMENTS.md`.

---

## 6. Risiko & Catatan

- **`authorize` saat ini mati** — memperbaikinya (Fase 0) akan **langsung memblokir** endpoint yang mulai diberi guard; pastikan guard per route ditegakkan bertahap agar tidak "jebol" di tengah.
- **Scoping penuh ke semua agregat besar** — MVP hanya 5 agregat utama; resource lain (mis. template, settings) di-scope secara org-wide atau admin-only.
- **Perf**: load role per request = +1 query; bisa dimitigasi dengan cache role (TTL) atau klaim permission di JWT (trade-off: perubahan permission butuh re-login).
- **Keamanan**: enforce di backend adalah keharusan; frontend hanya penyembunyian UX.
- Dokumen ini **belum dieksekusi** — setelah disetujui, mulai Fase 0.
