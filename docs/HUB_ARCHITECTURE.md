# PLAN — Optional Business Group (Hub) Architecture

> Dokumen rencana (belum diimplementasikan). Dibuat 2026-08-13.
> Merevisi arah multi-outlet dari `docs/ROLE_ACCESS_PLAN.md` §3.5–3.6: Hub kini **di atas Tenant**, bukan anak Tenant.

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

### HubMembership (FASE BERIKUTNYA, bukan MVP)

```
HubMembership { userId, hubId, role, ... }
```

Dibutuhkan untuk user lintas-tenant (Group Admin) dan Hub Consolidated Report. **Tidak diimplementasikan di MVP.**

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
- [ ] `shared/src/constants/permissions.ts`: `outlet:manage` (tenant), `hub:manage` (platform)
- [ ] `shared/src/types/domain/tenant.ts`: `Tenant.hubId: string | null`
- [ ] `backend/src/core/tenant/domain/Tenant.ts` + `TenantSchema.ts`: field `hubId` (default `null`, index)

### Fase 2 — Modul Hub (backend, baru) `backend/src/core/hub/`
- [ ] `domain/Hub.ts` (id, name, description, isActive — **tanpa tenantId**), `HubSchema.ts`, `MongoHubRepository.ts`
- [ ] `application/services/HubService.ts`: CRUD + `assignTenant(tenantId, hubId)`/`unassignTenant` (via TenantRepository), `listTenants(hubId)`, `findByTenant`
- [ ] `interfaces/.../HubController.ts` + `hub.routes.ts`: `GET/POST/PUT/DELETE /api/hubs`, `POST/DELETE /api/hubs/:hubId/tenants/:tenantId` — guarded `hub:manage` (platform)
- [ ] `TenantService` + `tenant.routes.ts`: `PATCH /api/tenants/:id { hubId }` (platform) — set/clear hubId
- [ ] Register DI di `container.ts` + mount di `routes.ts`

### Fase 3 — Modul Outlet (backend, baru) `backend/src/core/outlet/`
- [ ] `domain/Outlet.ts` (id, tenantId, name, address, phone, warehouseId, isActive), `OutletSchema.ts` (index `{tenantId, name}` unique), `MongoOutletRepository.ts`
- [ ] `OutletService.ts`: CRUD + `ensureDefaultOutlet(tenantId)`, `listScoped(tenantId, outletIds)`, `getByWarehouse(warehouseId)`
- [ ] `OutletController.ts` + `outlet.routes.ts`: `GET /api/outlets` (scoped) semua role terautentikasi; mutasi `outlet:manage`
- [ ] DI + mount route

### Fase 4 — Scope transaksi
- [ ] **Order** (`Order.ts`, `OrderSchema.ts`, `MongoOrderRepository`): `outletId`; stamp di `CreateOrderService.execute` (context outlet aktif; `source='pos'` wajib shift+outlet)
- [ ] **Payment** (`Payment.ts`, `PaymentSchema`): `outletId`; stamp di `payCash`/`processByOrderId`/`splitBill`
- [ ] **Shift** (`Shift.ts`, `ShiftSchema`): `outletId`; stamp di `ShiftService.open`; index → `{tenantId, cashierId, outletId, status}`
- [ ] **Warehouse** (`Warehouse.ts`, `WarehouseSchema`): `outletId` (1:1); `resolveWarehouseId()` → warehouse outlet aktif
- [ ] **Reports** (`ReportAggregation.ts`, `ReportService.ts`): param `outletId` (filter/group) untuk getDailySales/getShiftSales/getFinance; tenant consolidated = jumlah `outlets` tanpa Hub

### Fase 5 — Backfill & boot
- [ ] `ensureDefaultOutlet(tenantId)` saat boot: buat **Outlet Utama** + **Warehouse Utama** bila belum ada
- [ ] Backfill: order/payment/shift lama tanpa `outletId` → Outlet Utama
- [ ] Seed role platform (super-admin) dengan `hub:manage` + kredensial login platform

### Fase 6 — User & auth
- [ ] `User.ts` + `UserSchema`: `outletIds: string[]`; validasi (cashier = 1, manager/supervisor ≥ 1, owner/admin = `[]` = semua outlet tenant)
- [ ] `AuthService`/`TokenService`: `login`/`me` + JWT (access & refresh) menyertakan `outletIds`
- [ ] `authenticate.ts`: isi `req.outletIds` dari JWT + deklarasi `Express.Request`
- [ ] Middleware `resolveOutlet` + helper `scopeOutletIds(req)`: validasi `X-Outlet-Id` ∈ `req.outletIds`
- [ ] `UserController`/halaman Users: update `outletIds`

### Fase 7 — Frontend
- [ ] `useAuth.ts`: `AuthUser` + `outletIds` + `activeOutletId` (persist `localStorage.activeOutletId`)
- [ ] `api.ts`: header `X-Outlet-Id`
- [ ] Hooks `useOutlets`/`useHubs` + invalidasi; `useTenant` tampilkan `hubId` + nama Hub (read-only)
- [ ] `DashboardLayout.tsx`: outlet switcher saat `outlets.length > 1` (data-driven, tanpa flag mode)
- [ ] `frontend/src/core/outlets/pages/OutletListPage.tsx` (`/outlets`, guarded `outlet:manage`)
- [ ] Halaman Users: assign outlet; POS: `useStockList()` di-scope warehouse outlet aktif; receipt nama outlet; `OpenShiftModal` tampil outlet aktif

### Fase 8 — Terminal Center (layer platform, terpisah dari auth tenant)
- [ ] Grup route/konfigurasi platform terpisah (login super-admin, bukan tenant session)
- [ ] Provision: buat Hub, assign tenant ke Hub, list Hub/Tenant/Outlet
- [ ] Diagnostik read-only: ringkasan shift/payment, health

### Fase 9 — HubMembership (fase berikutnya, bukan MVP)
- [ ] `HubMembership {userId, hubId, role}`; session lintas-tenant (`activeTenantId`); Hub Consolidated Report (Tenant→Outlet breakdown); UI group admin

### Fase 10 — Uji & dokumentasi
- [ ] Unit: Hub/Outlet domain, validasi `User.outletIds`, `scopeOutletIds`, `ensureDefaultOutlet`
- [ ] Integrasi: tenant standalone tanpa Hub tidak berubah (regresi penuh); multi-outlet tenant → transaksi/laporan per outlet; platform → assign tenant ke Hub
- [ ] Typecheck backend + frontend; update `docs/ROLE_ACCESS_PLAN.md`, `docs/DAILY_LOG.md`, `docs/ARCHITECTURE.md`

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
