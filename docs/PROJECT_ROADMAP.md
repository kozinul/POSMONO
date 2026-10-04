# PROJECT ROADMAP

> POSMono — Modular Business Operating System
> Solo Founder · Multi-Tenant SaaS · Indonesia Market

---

## SECTION 1 — PROJECT OVERVIEW

| Field | Value |
|-------|-------|
| **Project Name** | POSMono |
| **Vision** | Modular business operating system for Indonesian small businesses |
| **Target Market** | UMKM (MVP) → Restaurant → Hospitality/Villa |
| **Current Phase** | MVP Development |
| **Architecture** | Modular Monolith + Multi-Tenant SaaS |
| **Patterns** | DDD · Event-Driven · CQRS-ready |
| **Frontend** | React + Vite + TypeScript |
| **Backend** | Node.js + Express.js + TypeScript |
| **Database** | MongoDB |
| **Infrastructure** | Docker · Redis · pnpm monorepo |

### Long-Term Roadmap

```
MVP (UMKM) ──→ Restaurant Module ──→ Villa Module ──→ AI/Platform
  2026              2026-2027            2027              2028
```

---

## SECTION 2 — MASTER ROADMAP

### PHASE A — Foundation Setup `[x]`

| Task | Status |
|------|--------|
| Monorepo scaffolding (pnpm + turbo) | `[x]` |
| Docker environment (MongoDB, Redis) | `[x]` |
| Shared package (types, utils, constants) | `[x]` |
| Backend folder structure (DDD layers) | `[x]` |
| Frontend folder structure (feature-based) | `[x]` |
| TypeScript strict config | `[x]` |
| ESLint + Prettier setup | `[x]` |

**Completion:** 100%

---

### PHASE B — Core Backend Development `[~]`

| Task | Status |
|------|--------|
| Authentication & JWT | `[x]` |
| Tenant system (multi-tenant isolation) | `[x]` |
| RBAC (roles & permissions) | `[x]` |
| Event bus (in-process) | `[x]` |
| Product catalog module | `[x]` |
| Category module | `[x]` |
| Family module (menu type: food/beverage) | `[x]` |
| SKU / variant system | `[x]` |
| Inventory module | `[x]` |
| Stock movement & adjustment | `[x]` |
| POS cart engine | `[x]` |
| Checkout / order processing | `[x]` |
| Payment handling (cash) | `[x]` |
| Payment method management (CRUD) | `[x]` |
| Receipt generation | `[x]` |
| Basic reporting | `[x]` |
| Upload service (image) | `[x]` |
| Settings (key-value store) | `[x]` |
| Member/Customer domain | `[x]` |
| Promotion domain (14 rule types) | `[x]` |
| Document template engine (core) | `[x]` |
| Expression engine & formatters | `[x]` |
| Template CRUD REST API | `[x]` |
| Print output (ESC/POS thermal + PDF) | `[x]` |
| Template versioning + rollback | `[x]` |
| Render API (render, preview, validate) | `[x]` |
| Template export/import | `[x]` |
| Receipt template designer UI | `[x]` |

**Completion:** ~100%

---

### PHASE C — Core Frontend Development `[~]`

| Task | Status |
|------|--------|
| Project scaffolding (Vite + React Router) | `[x]` |
| Login page | `[x]` |
| Dashboard layout | `[x]` |
| Product management UI (search, filter, CRUD, image upload, tags) | `[x]` |
| Family management UI (Food/Beverage tabs) | `[x]` |
| Category management UI | `[x]` |
| Inventory management UI | `[x]` |
| POS page (3-level filter: Menu Type → Family → Category) | `[x]` |
| Checkout flow UI | `[x]` |
| Receipt view | `[x]` |
| Reports page | `[x]` |
| Settings page | `[x]` |
| Shift management UI | `[x]` |
| Member management UI | `[x]` |
| Promotion management UI | `[x]` |
| Payment method management UI (presets, color picker) | `[x]` |
| Template list page | `[x]` |
| Template designer (3-panel drag-drop canvas) | `[x]` |

**Completion:** ~100%

---

### PHASE D — POS Engine `[~]`

| Task | Status |
|------|--------|
| Cart state management | `[x]` |
| Barcode scanning | `[x]` |
| Discount & promo engine | `[x]` |
| Discount configuration (dynamic, di-sync ke POS via polling) | `[x]` |
| Tax calculation engine | `[x]` |
| DPP Nilai Lain (Indonesia PPN 12%) | `[x]` |
| Compound tax (Charge + PPN) via Adjustment Pipeline | `[x]` |
| Category-based & product-based tax | `[x]` |
| Tax exemption rules | `[x]` |
| Split bill | `[x]` |
| Hold / recall order (held bills, Daftar Bill) | `[x]` |
| Cash rounding (pembulatan tunai per tenant) | `[x]` |
| Void order / item + approval Manager PIN | `[x]` |
| Close unpaid bill (`POST /orders/:id/close-bill`) | `[x]` |

**Completion:** ~100%

---

### PHASE E — Payment System `[~]`

| Task | Status |
|------|--------|
| Cash payment flow | `[x]` |
| QRIS gateway (create invoice, confirm, cancel, status) | `[x]` |
| Transfer confirmation (manual) | `[x]` |
| Payment reconciliation | `[x]` |
| Invoice generation | `[x]` |

**Completion:** ~100%

> Sync 2026-08-30: status roadmap sebelum ini basi — transfer confirmation & payment reconciliation sebenarnya sudah ada di kode:
> - **Transfer confirmation**: `PaymentService.listPendingTransfers/confirmTransferPayment/cancelTransferPayment` + routes `GET /payments/pending`, `POST /payments/:paymentId/confirm|cancel` + UI "Konfirmasi Transfer" di `PosActionPanel.tsx`. RBAC: `confirm` tetap `authenticate`-only (kasir wajib konfirmasi transfer masuk di POS — uang MASUK, paralel `pay-cash`), SUDAH diproteksi `authorize('payments:write')` untuk `cancel` (membatalkan order + release stok — uang KELUAR/destruktif, paralel `refund`). Kasir tanpa `payments:write` → 403 + toast di UI.
> - **Payment reconciliation**: laporan `GET /reports/payment-reconciliation` (`ReportService.getPaymentReconciliation`) — bandingkan `payments` completed vs `orders.paymentBreakdown` per metode + total transfer pending, `difference` per metode; frontend tab "Payment Reconciliation" di `ReportPage.tsx` + export PDF/XLSX. Ini rekonsiliasi report-level (bukan auto-reconcile bank statement/feed).
> - **Invoice generation `[x]`**: endpoint baru `GET /orders/:id/invoice` (`OrderController.invoice` + route) — resolve order+tenant+payment server-side, panggil `InvoiceRenderService.render` (sebelumnya orphan/dead code, template A4 "Standard Invoice"), kembalikan `{ pdf(base64), layout, templateId, templateName, paper, invoiceNumber }`. Frontend: tombol **"Invoice A4"** di `OrderDetailModal.tsx` → dekode base64 → blob PDF → buka tab baru (fallback download bila popup diblokir). Template invoice bisa diedit di Template Designer (documentType `invoice`).

---

### PHASE F — Reporting `[~]`

| Task | Status |
|------|--------|
| Daily sales report | `[x]` |
| Sales report (per produk / rentang tanggal) | `[x]` |
| Finance report (DPP, SC, pajak, diskon, pembulatan) | `[x]` |
| Product performance (best-sellers, "⭐ Favorit" di POS) | `[x]` |
| Laporan kasir per-shift (transaksi + penerimaan) | `[x]` |
| Penerimaan & penjualan per kasir | `[x]` |
| Export PDF (struk) + XLSX (tabular) | `[x]` |
| Inventory summary (saldo awal + pergerakan + valuasi) | `[x]` |
| Profit & loss simple (HPP dari stock movement `out` × cost) | `[x]` |

**Completion:** ~95%

---

### PHASE G — Testing & QA `[x]`

| Task | Status |
|------|--------|
| Unit tests (backend) | `[x]` |
| Service tests (mocked repos) | `[x]` |
| Repository tests (mongodb-memory-server) | `[x]` |
| API tests (Supertest) | `[x]` |
| Integration tests | `[x]` |
| Frontend smoke tests | `[x]` |
| E2E tests (critical paths) | `[x]` |
| Load testing (k6 artifact) | `[x]` |

**Completion:** ~100%

> Status per 2026-08-30: **backend 950/950 (78 files)** — suite jalan **penuh tanpa Docker** via `mongodb-memory-server` (mongod arm64 7.3.4) • harness integration di-rewrite ke wiring service terkini • **E2E** `tests/e2e/critical-path-flows.test.ts` (5 skenario: money loop shift→sale→invoice→close, enforce shift, carried-over bill, void restore stok, isolasi tenant over HTTP) • k6 artifact `backend/loadtest/` + script `pnpm loadtest`/`loadtest-sweep` (butuh backend running) • `npx tsc --noEmit` backend & frontend bersih • yang tersisa hanya drill k6 di instance deployed & browser E2E (baru setelah UI stabil).

---

### PHASE G2 — Hub & Outlet Architecture `[~]`

> Rencana lengkap: `docs/HUB_ARCHITECTURE.md`. Hierarki: **Hub (optional) → Tenant → Outlet → Warehouse**; `tenantId` = legal boundary, `outletId` = operational, `hubId` = grouping (tanpa data bisnis).

| Task | Status |
|------|--------|
| Shared types hub/outlet + permission `outlet:manage`/`hub:manage` | `[x]` |
| Modul Hub (domain/schema/repo/service/controller) + assign tenant | `[x]` |
| Modul Outlet (domain/schema/repo/service/controller, 1:1 → Warehouse) | `[x]` |
| Scope transaksi: `outletId` di Order/Payment/Shift/Warehouse/laporan | `[x]` |
| Provisioning boot: Outlet Utama + Warehouse Utama + backfill `outletId: null` | `[x]` |
| User `outletIds[]` + validasi per-role + JWT + middleware `resolveOutlet`/`scopeOutletIds` | `[x]` |
| Frontend: `activeOutletId` + `X-Outlet-Id`, outlet switcher, halaman `/outlets`, POS per-outlet, receipt/OpenShiftModal nama outlet | `[x]` |
| Role Platform Super Admin + seed `platform@demo.com` | `[x]` |
| Terminal Center backend: `/api/platform` (health, hubs/tenants/outlets, shift & payment summaries, hub consolidated), `platformAuthenticate`/`platformAuthorize` | `[x]` |
| Terminal Center frontend (`/terminal-center` di layout khusus + login `/terminal/login`; Hub & Anggota / Tenants / Outlet / Ringkasan / Konsolidasi) | `[x]` |
| HubMembership `{userId, hubId, role}` + session lintas-tenant (`/auth/switch-tenant`, `activeTenantId`, tenant switcher) | `[x]` |
| Hub Consolidated Report (Tenant→Outlet breakdown) | `[x]` |
| `req.outletId` dibaca service (dari `X-Outlet-Id`/resolveOutlet, bukan body/default shift) | `[x]` (2026-09-23) |
| Provision Tenant API: `ProvisionTenantService` + `POST /api/platform/provision/tenant` (Tenant + Owner + Outlet + Warehouse atomik, hub opsional, idempotency key) + `MongoUserRepository.findByEmailGlobal` + session support repos | `[x]` |
| Terminal Center `+ New Tenant` UI (`CreateTenantModal` + `usePlatformProvisionTenant`) | `[x]` |
| **Outlet Platform-Only** (Fase 12): owner TIDAK bisa tambah outlet — `OutletService.createWithWarehouse` + `POST /api/platform/outlets`, route tenant `POST`/`DELETE /api/outlets` dihapus, UI `+ Tambah Outlet` Terminal Center, banner tenant | `[x]` |
| **Billing & Plan Management** (Fase 14): modul `core/billing` (Plan/Subscription/Entitlement, `Tenant.planId`), default plans Trial/Starter/Pro/Enterprise, tab **Plans** Terminal Center (`PlansSection` CRUD) + assign/ganti/batalkan di `TenantDetailModal`, API platform + merchant entitlement, RBAC `platform.plans.*` | `[x]` |
| **Product Modifier Groups** (2026-09-17): modifier group `radio|checkbox|stepper`, min/max/required, `priceAdjustment`, attach ke Product via `modifierGroupIds`, validasi order/payment via `ModifierValidationService`, UI `/modifiers` | `[x]` |
| **Terminal Center Logging + Control Plane** (2026-09-22): Audit Log trx (`PlatformAuditLog` + `platform.audit.read`, rekam eksplisit tanpa gagalkan operasi utama), Subscription History ledger (`SubscriptionHistory`, extend ter-unifikasi `SubscriptionService.extendSubscription`), Provisioning History + idempotency DB (`ProvisioningRun` di `provisioning_runs`), Tenant 360° `GET /platform/tenants/:id` (owner/users/outlets/warehouse/subscription/recentActivity/provisioningRuns), frontend tab Audit + `TenantDetailModal` tabbed | `[x]` |
| **Frontend Hub & Anggota** (Fase 15, 2026-09-28): 9 temuan audit F1–F9 diperbaiki — 5 mutasi React Query (`usePlatform*Hub`), UI CRUD hub + toggle `isActive` (tanpa `EditHubModal`), assign/unassign tenant di tab Hub, picker anggota **satu kolom pencarian global** (`GET /platform/users` + `userTenantName`), Swal2 + `platformUi.tsx` (`apiErrorMessage`), link "Lihat di Audit", tab Terminal Center ber-permission, `hubName` di `GET /platform/tenants` | `[x]` |
| Uji Fase 10: unit/regresi tenant standalone + sync ROLE_ACCESS_PLAN/ARCHITECTURE | `[x]` |
| **Hub V2 Fase 16** (2026-09-29): permission platform `hub:manage` → `platform.hubs.manage` (21 route guard) + migrasi dokumen `Role` otomatis saat boot (`migratePlatformHubPermissions`), namespace `hub.*` **reserved** untuk hub-side admin (D1 tahap 2), matriks role hub 4 (`owner`/`admin`/`manager`/`viewer`) + `HUB_ROLE_PERMISSION_MATRIX`. ⚠️ super admin wajib re-login. Fase 17–20 masih rencana | `[x]` |
| **Rencana Pengurangan Kompleksitas** (2026-09-29): 9 item T0–T9 dengan skala prioritas P0–P3 — **T0** pager regresi nyata (CI belum menjalankan suite sungguhan; job lint panggil eslint yang tidak terpasang), **T1** `PaymentService` 16 param `any` → deps object, **T2** `OrderController` 24 param, **T3** `container.ts` 1.241 baris → wiring per domain, **T4–T6** 3 god page, **T7** ketik jalur uang, **T8** test money path frontend, **T9** budget kompleksitas otomatis. **Fase 18 terblokir sampai T0–T2 selesai** | `[~]` |
| **Hub V2 Fase 17** (2026-09-29): grant akses **per tenant/outlet** (`HubMemberTenantAccess` + `HubMemberAccessService`) menutup lubang otorisasi anggota hub — `switchTenant` baca grant dulu (mode grant `grant-{tenantRole}` + `outletIds`), **nol baris grant = fallback** D3; revoke = `suspended` (bukan delete); anggota baru di-seed `viewer`; hapus anggota → suspend semua grant. API `GET/PUT/DELETE /hub-memberships/hub/:hubId/:userId/access` + `GET /hub-context/me`, UI `HubMemberAccessModal`. **Test DENY wajib** (tenant revoked 403, tenant tak muncul di switcher, outlet di luar grant 403) | `[x]` |
| **Hub V2 Fase 21–23** (2026-10-02 → 2026-10-04): **permukaan baca anggota hub** (`GET /api/hub/me/hubs` + `/:hubId{,/tenants,/members,/overview}`) dengan guard `requireHubPermission` per-request — permission `hub.*` sengaja **tidak** di JWT, matriks `viewer` dipersempit jadi `[hub.read]`, 404 sebelum 403, tanpa bypass platform admin; halaman anggota `/hub` dengan tab permission-gated + `HubOverviewBody`/`useHubOverviewRange` diekstrak supaya Terminal Center & anggota render identik; lalu **dashboard hub per outlet** `/hub/outlet` (`GET /api/hub/outlet/overview`, outlet dari header `X-Outlet-Id` → tenant → `tenant.hubId`, **tanpa** `:hubId`/`:outletId` di path) dengan read model sendiri, penjualan per outlet (`outletId` null ikut hanya bila tenant 1 outlet), aturan stale 24 jam di `HubOverviewPrimitives`. **Test DENY**: viewer 403, non-member 403, platform non-member 403, tanpa header 400, tenant tanpa hub 404 | `[x]` |

**Completion:** ~100% (Fase 1–9 + Fase 11 ProvisionTenantService + Fase 12 Outlet Platform-Only + Fase 14 Billing & Plan Management selesai & terverifikasi 2026-09-14; Product Modifier Groups selesai 2026-09-17; HubMembership, session lintas-tenant, Hub Consolidated Report, halaman Terminal Center frontend, Create Tenant API/UI, kontrol outlet platform-only, dan Sistem Plan rampung; **Terminal Center Logging + Control Plane 2026-09-22**: Audit Log + Subscription History ledger + Provisioning History/idempotency + Tenant 360°; **`req.outletId` dibaca service 2026-09-23**; **Hub V2 Fase 16 permission namespace + Fase 17 grant akses per tenant/outlet selesai 2026-09-29** — backend **1249/1249 (103 files)**, frontend **121/121 (17 files)**, tsc shared+backend+frontend + vite build bersih. Sisa: **Hub V2 Fase 16–20 selesai 2026-10-02** (namespace permission, grant akses per tenant/outlet, identitas `code`/`status`, hub overview read-model, undangan hub & suspend member) — backend **1403/1403 (111 files)**, frontend **174/174 (24 files)**, tsc shared+backend+frontend bersih, `pnpm budget` hijau, vite build OK; debt pass T0–T9 sudah tuntas 2026-09-30 (`docs/TECH_DEBT_PLAN.md`); **Hub V2 Fase 21–23 selesai 2026-10-04** (permukaan baca anggota `/api/hub/*`, halaman anggota `/hub`, dashboard outlet `/hub/outlet`) — backend **1491/1491 (116 files)**, frontend **185/185 (25 files)**, tsc backend+frontend bersih, `pnpm budget` hijau, vite build OK

---

### PHASE H — MVP Deployment `[~]`

| Task | Status |
|------|--------|
| Production Dockerfile | `[x]` |
| CI/CD pipeline | `[x]` |
| VPS / cloud provisioning | `[ ]` |
| SSL & domain setup | `[ ]` |
| First tenant onboarding | `[ ]` |
| Monitoring (logs, errors) | `[ ]` |
| Backup strategy | `[ ]` |

**Completion:** ~30% (menunggu akses VPS dari user)

---

## SECTION 3 — WEEKLY DEVELOPMENT CHECKLIST

### WEEK 1 — Foundation `[x]`

- `[x]` Monorepo setup (pnpm + turbo)
- `[x]` Docker compose (MongoDB + Redis)
- `[x]` Dockerfile (multi-stage)
- `[x]` Backend DDD structure
- `[x]` Frontend structure
- `[x]` Shared package
- `[x]` TypeScript configs

### WEEK 2 — Auth & Tenant `[x]`

- `[x]` Authentication module
- `[x]` JWT strategy
- `[x]` Tenant middleware
- `[x]` RBAC system
- `[x]` User management
- `[x]` Login API
- `[x]` Login page

### WEEK 3 — Product Catalog `[x]`

- `[x]` Product module (CRUD)
- `[x]` Category module
- `[x]` SKU system
- `[x]` Variant support
- `[x]` Product UI (list, create, edit)
- `[x]` Category UI
- `[x]` Image upload

### WEEK 4 — Inventory `[x]`

- `[x]` Inventory module
- `[x]` Stock movement tracking
- `[x]` Stock adjustment
- `[x]` Low stock alert
- `[x]` Inventory UI
- `[x]` Stock history UI

### WEEK 5 — POS Cart `[x]`

- `[x]` Cart engine (backend)
- `[x]` POS page layout
- `[x]` Product search
- `[x]` Cart state (frontend)
- `[x]` Add/remove items
- `[x]` Quantity adjustment

### WEEK 6 — Checkout & Payment `[x]`

- `[x]` Order creation
- `[x]` Checkout flow
- `[x]` Cash payment
- `[x]` Receipt generation
- `[x]` Order history

### WEEK 7 — Reports `[x]`

- `[x]` Daily sales report
- `[x]` Report UI
- `[x]` Dashboard metrics
- `[x]` Shift management UI

### WEEK 8 — Testing & Polish `[x]`

- `[x]` Backend unit tests (Layer 1: 93 tests)
- `[x]` Backend service tests (Layer 2: 85 tests)
- `[x]` Repository tests (Layer 3: 66 tests)
- `[x]` API tests (Layer 4: 20 tests)
- `[x]` Integration tests (Layer 5: 24 tests)
- `[x]` Frontend smoke test (11 tests)
- `[x]` Bug fixing
- `[x]` UI polish

### WEEK 9 — MVP Launch Prep

- `[x]` Production build (Dockerfile + compose.prod.yml)
- `[ ]` Deploy to VPS
- `[ ]` Domain + SSL
- `[ ]` Pilot tenant onboarding
- `[ ]` Go-live

---

## SECTION 4 — MVP FEATURE CHECKLIST

| Feature | Status |
|---------|--------|
| Authentication (register, login, logout) | `[x]` |
| Tenant management (multi-tenant) | `[x]` |
| User & role management (RBAC) | `[x]` |
| Product management (CRUD + SKU) | `[x]` |
| Category management | `[x]` |
| Inventory management | `[x]` |
| Stock movement tracking | `[x]` |
| POS cart (add/remove/qty) | `[x]` |
| Checkout & order processing | `[x]` |
| Cash payment | `[x]` |
| Receipt printing (thermal) | `[x]` |
| KOT (Kitchen Order Ticket) printing | `[x]` |
| Basic reporting (daily sales) | `[x]` |
| Laporan kasir per-shift (Transaksi/Penerimaan) + export PDF/XLSX | `[x]` |
| Ringkasan Stok (saldo awal + pergerakan + valuasi HPP) | `[x]` |
| QRIS payment gateway | `[x]` |
| Integrated hardware printer (WebUSB/Bluetooth/TCP + auto-print struk/KOT) | `[x]` |
| Shift wajib dibuka + carried-over bills | `[x]` |
| Void + approval Manager PIN + riwayat stok | `[x]` |
| Pembulatan tunai (cash rounding per tenant) | `[x]` |
| Shift management (open/close register) | `[x]` |
| Dashboard (summary cards + recent orders) | `[x]` |
| Settings page | `[x]` |
| Hub & Outlet architecture (multi-outlet, outlet switcher, `/outlets`) | `[x]` |
| Terminal Center backend (`/api/platform` + Platform Super Admin) | `[x]` |
| HubMembership + session lintas-tenant + Hub Consolidated Report + halaman `/terminal-center` | `[x]` |
| ProvisionTenantService — Create Tenant dari Terminal Center (Tenant + Owner + Outlet + Warehouse atomik, hub opsional) | `[x]` |
| Bug fixing & polish | `[x]` |
| **MVP Ready** | **`[ ]`** |

---

## SECTION 5 — FUTURE FEATURES (DO NOT BUILD YET)

> ⚠️ **NOT MVP** — Do not implement until MVP is live with real users.

| Feature | Notes |
|---------|-------|
| `[ ]` Restaurant module | Table management, online ordering (Kitchen printer & KOT sudah selesai) |
| `[ ]` Villa / hospitality module | Reservation calendar, check-in/out, housekeeping |
| `[ ]` Mobile app (Capacitor) | Wraps existing frontend for mobile install |
| `[ ]` Desktop app (Electron) | Offline-first desktop POS |
| `[ ]` Offline sync | Local-first with background sync when online |
| `[x]` Bluetooth printer | ESC/POS over Bluetooth (WebBluetooth client-side) |
| `[x]` Network printer (TCP ESC/POS) | Printer network langsung via server `net.Socket` |
| `[x]` WebUSB printer | Direct client-side printing via WebUSB (bulk / interrupt endpoint) |
| `[ ]` Barcode scanner | Hardware scanner integration |
| `[x]` QRIS payment gateway | Gateway QRIS eksternal (`QrisGatewayService`) — GoPay/OVO/bank transfer belum |
| `[ ]` Multi-currency | For tourism/hospitality |
| `[ ]` AI automation | Auto-stock reorder, sales prediction |
| `[ ]` Plugin runtime | 3rd-party plugin system |
| `[ ]` Marketplace | Plugin store |

**Rule:** If it's not in the MVP checklist, do not build it.

---

## SECTION 6 — CURRENT ARCHITECTURE STATUS

| Design | Status |
|--------|--------|
| System architecture (overview) | `[x]` |
| DDD tactical design (entities, aggregates, repos) | `[x]` |
| Database schema design (MongoDB collections) | `[x]` |
| API design (RESTful routes) | `[x]` |
| Authentication & JWT design | `[x]` |
| RBAC / permission design | `[x]` |
| Event bus / domain events | `[x]` |
| Infrastructure (Docker, networking) | `[x]` |
| Transaction engine design | `[x]` |
| Offline sync architecture | `[ ]` |
| Printer architecture | `[x]` (Printer aggregate, ESC/POS via TCP + WebUSB + WebBluetooth, auto-print struk/KOT) |
| QRIS gateway architecture | `[x]` (`QrisGatewayService` + PaymentModal QR flow + Settings UI — lihat `docs/QRIS_GATEWAY_PLAN.md`) |
| Plugin architecture | `[ ]` |
| Deployment architecture | `[x]` (Dockerfile multi-stage + compose.prod.yml + CI; VPS/SSL/belum live) |

---

## SECTION 7 — CURRENT BLOCKERS

### Blocker 1

| Field | Value |
|-------|-------|
| **Problem** | Printer integration strategy not finalized — USB thermal vs Bluetooth vs cloud (e.g., QZ Tray, WebUSB, ESC/POS over network). |
| **Possible Solutions** | 1) WebUSB for browser-based direct printing, 2) QZ Tray app for reliable thermal, 3) Network printer proxy via local server. |
| **Priority** | Medium |
| **Deadline** | Before MVP launch (Week 8) |
| **Status** | **Resolved** — semua jalur diimplementasikan: WebUSB (bulk/interrupt), WebBluetooth (chunk 20-byte), TCP `net.Socket` via server, auto-print struk/KOT, settings printer UI |

### Blocker 2

| Field | Value |
|-------|-------|
| **Problem** | Tenant middleware needs centralized schema — user scoping via `tenantId` is currently ad-hoc in some services. |
| **Possible Solutions** | 1) Extract tenant context into a shared middleware that injects `tenantId` into every request, 2) Create tenant-scoped Mongo connection pool. |
| **Priority** | High |
| **Deadline** | This week |
| **Status** | Resolved — `tenantId` is now injected via `authenticate` middleware + `X-Tenant-Id` header |

### Blocker 3

| Field | Value |
|-------|-------|
| **Problem** | No CI/CD pipeline — manual deployment is fragile and time-consuming. |
| **Possible Solutions** | 1) GitHub Actions for build + deploy, 2) Docker Hub + watchtower on VPS. |
| **Priority** | Low (needed before pilot) |
| **Deadline** | Before Week 9 |
| **Status** | In progress — Dockerfile multi-stage + compose.prod.yml + CI pipeline sudah ada; deployment ke VPS + SSL/belum |

---

## SECTION 8 — DAILY ENGINEERING LOG

### Template

```markdown
### DATE: YYYY-MM-DD

**Today I worked on:**
*

**Problems found:**
*

**Next task:**
*

**Notes / decisions:**
*
```

### Entries

### DATE: 2026-06-30

**Today I worked on:**

- Docker environment (MongoDB + Redis)
- Monorepo structure (pnpm, turbo, shared package)
- Backend DDD folder structure
- Frontend Vite + React Router setup
- Project roadmap creation

**Problems found:**

- `node_modules` mount had wrong permissions — fixed with `chown`
- `.turbo/cache` permission issue — fixed with `chown`
- `msgpackr-extract` native build failed on first attempt, rebuilt successfully

**Next task:**

- Complete POS cart engine (backend)
- Wire up cart state on frontend
- Checkout flow

---

### DATE: 2026-08-30

**Today I worked on:**

- Sinkronisasi status Phase E dengan kode aktual: transfer confirmation (manual) & payment reconciliation ditandai `[x]`; invoice generation `[~]` (template A4 + `InvoiceRenderService` + QRIS invoice ada, UI invoice formal per order belum).

**Problems found:**

- Status roadmap Phase E (@~50%) basi — fitur transfer confirmation & reconciliation sebenarnya sudah terimplementasi (& ter-commit). Endpoint transfer `/payments/:id/cancel` masih `authenticate`-only tanpa `payments:write` — gap RBAC (kasir bisa batalkan order + release stok tanpa otorisasi).

**Next task:**

- ✅ Gap RBAC ditutup: `POST /payments/:id/cancel` kini `authorize('payments:write')` (via `createPaymentRoutes` + security middleware); `confirm` & `GET /pending` sengaja tetap open utk kasir.
- ✅ Invoice generation selesai: `GET /orders/:id/invoice` (`OrderController.invoice` + `InvoiceRenderService` yang tadinya dead code) + tombol "Invoice A4" di `OrderDetailModal` (PDF base64 → blob → tab baru). Phase E kini 100%.
- ✅ **Phase G selesai**: suite backend kini jalan penuh tanpa Docker → `mongodb-memory-server` (mongod arm64 7.3.4, cache `~/.cache/mongodb-binaries`) di `tests/helpers/db.ts`; `vitest.config.ts` `pool:'forks' maxForks:1` (RAM box); harness `tests/helpers/integration.ts` di-rewrite ke wiring service terkini (PaymentService 14 arg, OrderController 24 arg, tax mock VAT 12%); 2 test stale di bootstrap difix; **E2E** `tests/e2e/critical-path-flows.test.ts` (5 skenario) + k6 artifact `backend/loadtest/`; hasil **950/950 backend (78 files)**, frontend 76/76, tsc dua sisi bersih.
- Lanjut berikutnya: drill k6 di instance deployed (butuh backend live) + browser E2E (Playwright) saat UI stabil, lalu Phase H (butuh akses VPS dari user).

---

## SECTION 9 — TECHNICAL DEBT TRACKER

| Debt | Priority | Created | Notes |
|------|----------|---------|-------|
| `[x]` Refactor auth middleware to be tenant-aware | High | Done | tenantId injected via authenticate middleware + X-Tenant-Id header |
| `[ ]` Improve inventory service performance | Medium | - | Needs MongoDB index audit |
| `[ ]` Standardize error response format | Medium | - | Some endpoints return inconsistent shapes |
| `[ ]` Add request validation (Zod) | Medium | - | Critical before pilot |
| `[ ]]` Optimize MongoDB indexes | Low | - | Run explain() on slow queries |
| `[ ]` Better error boundary on frontend | Low | - | Currently bare React error boundary |
| `[ ]` Add logging service (structured logs) | Low | - | `console.log` in some places |
| `[x]` Write API documentation | Low | Done | `docs/API_REFERENCE.md` covers 52 endpoints |

---

## SECTION 10 — PERSONAL RULES

> **Rules for solo development discipline.**

### Rule 1 — No non-MVP features

If it's not on the MVP checklist, do not build it. No restaurant module, no mobile app, no AI. Focus.

### Rule 2 — Ship first, polish later

Working software > perfect software. Get a working feature into production, then iterate.

### Rule 3 — No premature refactoring

If it works and isn't blocking progress, leave it alone. Refactor only when the code actively hurts development speed.

### Rule 4 — One thing at a time

Solo founder = single-threaded. Finish one module before starting the next. No context switching.

### Rule 5 — Validate with real users early

Don't build in the dark. Get a pilot customer on the MVP as soon as possible. Real feedback > assumptions.

### Rule 6 — Write tests for critical paths only

Unit test the core domain logic. Skip tests for CRUD boilerplate. Time is the scarcest resource.

### Rule 7 — Document decisions, not code

Write down why you chose something (ADR). Don't waste time on code comments — the code should be self-documenting.

### Rule 8 — Commit daily

Even if it's a small change. Daily commits create momentum and a safety net.

### Rule 9 — No feature creep during bug fixing

When fixing a bug, fix only the bug. Do not "improve" or "restructure" while debugging.

### Rule 10 — Sleep on big decisions

Architecture changes, tech swaps, pricing — never decide the same day. Sleep on it and review with fresh eyes.

---

## SECTION 11 — SUCCESS METRICS

| Milestone | Status | Target Date |
|-----------|--------|-------------|
| First working local MVP | `[ ]` | Week 9 |
| First deployed server | `[ ]` | Week 9 |
| First pilot customer | `[ ]` | Week 10 |
| First active tenant | `[ ]` | Week 10 |
| First paying customer | `[ ]` | Q3 2026 |
| 100 transactions processed | `[ ]` | Q3 2026 |
| 1,000 transactions processed | `[ ]` | Q4 2026 |
| 10 active tenants | `[ ]` | Q4 2026 |
| Revenue positive | `[ ]` | 2027 |

---

*Last updated: 2026-09-14*
*Updated daily during development.*

> **2026-08-28 — Sinkronisasi status dengan kode aktual.** Entri fase D/E/F, daftar fitur, blocker, dan arsitektur diperbarui agar sesuai implementasi nyata (split bill, hold/close-bill, QRIS gateway, printer terintegrasi, cash rounding, laporan per-kasir, export). Checklist lama ditandai `[x]` yang sebelumnya `[ ]` sudah tervalidasi di AGENTS.md. Estimasi kelengkapan MVP: ±80% (fungsional ±90–95%, selisihnya = deployment live + pilot tenant + E2E manual).
>
> **2026-09-12 — Hub & Outlet Architecture (Fase 1–9) selesai.** Modul Hub/Outlet, scope transaksi `outletId`, provisioning boot, User `outletIds` + JWT + `resolveOutlet`, frontend outlet switcher/`activeOutletId`, **Terminal Center** (`/api/platform` + super-admin `platform@demo.com`, auth platform terpisah), **HubMembership** (user lintas-tenant, `/auth/switch-tenant`, tenant switcher di top bar), **Hub Consolidated Report** (Tenant→Outlet breakdown), dan halaman admin `/terminal-center` terverifikasi — backend **1021/1021** (84 files), frontend **85/85** + tsc + vite build bersih. Sisa: `req.outletId` dibaca service (deferred), MVP deployment (VPS/SSL/monitoring/backup) menunggu akses VPS.
>
> **2026-09-13 — ProvisionTenantService (Fase 11) selesai.** Endpoint **`POST /api/platform/provision/tenant`** membuat Tenant + Owner User + Outlet Utama + Warehouse Utama secara **atomik** (`mongoose` transaction, fallback non-transaction pada standalone) memakai `OutletService.ensureDefault` yang sama dengan boot provisioning; owner memakai role Owner dengan `outletIds: []`, hub opsional (`hubId: null` = standalone, tidak membuat Hub baru), email owner dicek uniqueness global, dukungan header `Idempotency-Key` (request ulang → result sama, tanpa tenant ganda). Session support ditambahkan di repository (Tenant/User/Role/Outlet/Warehouse/Hub) via optional `options?: { session }`. UI: tombol **`+ New Tenant`** + `CreateTenantModal` di tab Tenants Terminal Center + hook `usePlatformProvisionTenant`. Backend **1035/1035** (86 files; +6 unit, +8 integrasi HTTP), frontend **85/85** + tsc + vite build bersih. Sisa: `req.outletId` dibaca service (deferred), invite email/billing/product seed (fase lanjutan), MVP deployment menunggu akses VPS.
>
> **2026-09-13 — Outlet Platform-Only (Fase 12) selesai.** Keputusan produk — **owner tidak bisa menambah outlet sendiri** (eksklusivitas + lisensi per cabang). `OutletService.createWithWarehouse` (Outlet + Warehouse 1:1 "Warehouse {name}" + link `warehouseId`, duplikat → 409) dipakai endpoint baru **`POST /api/platform/outlets`** (`platformAuthenticate` + `outlet:manage`, cek tenant → 404) di Terminal Center. Route tenant diramping: `POST /api/outlets` & `DELETE /api/outlets/:id` **dihapus** (tinggal `GET`/`PUT`); `useCreateOutlet`/`useDeleteOutlet` dihapus dari frontend. UI: `+ Tambah Outlet` + `CreateOutletModal` (dropdown tenant) di tab Outlet; `OutletListPage` tenant hanya Edit + toggle dengan banner "Butuh cabang tambahan? Hubungi tim sales/support kami". Backend **1048/1048** (87 files; +3 unit `createWithWarehouse`, +10 integrasi `platform-create-outlet`), frontend **85/85** + tsc + vite build bersih. Docs sync: HUB_ARCHITECTURE (Fase 12), API_REFERENCE, POS_CURRENT_FEATURES, DAILY_LOG.
>
> **2026-09-14 — Tenant Lifecycle & Merchant Client Portal (Fase 13) selesai.** Pemisahan tegas antara Terminal Center (Internal Kuire operations: status Active, Suspended, Frozen, Deactivated, manual subscription extension) dan Merchant Client Portal (area mandiri klien: `GET /api/tenants/current/subscription` & `POST /api/tenants/current/subscription/renew` via QRIS/renewal). Backend tests **1048/1048** dan frontend **85/85** hijau bersih.
>
> **2026-09-14 — Billing & Plan Management (Fase 14) selesai.** Sistem plan modular (self-service nonaktif — hanya admin Kuire): modul `backend/src/core/billing/` (domain `Plan`/`Subscription` + schema `_id` string + repos + `PlanService`/`SubscriptionService`/`EntitlementService`), default plans **Trial/Starter/Pro/Enterprise** di-seed, `Tenant.planId`, API platform (`/api/platform/plans*` + `/api/platform/tenants/:tenantId/subscription` + `/cancel` + `/entitlement`) dan merchant (`GET /api/tenants/current/entitlement`); UI tab **Plans** Terminal Center (`PlansSection` CRUD modules + limits) + section **Plan & Langganan** di `TenantDetailModal` (assign/ganti/batalkan, cancel → tenant `deactivated`). Frontend hooks di `usePlatform.ts`. Backend **1073/1073** (88 files; +25 integrasi `billing-plans.test.ts`), frontend **85/85** + tsc + vite build bersih. Commit `98b2cf41`. Sisa: membership enforcement per-permission di route tenant (deferred), self-service checkout tenant (nonaktif by-design), MVP deployment menunggu akses VPS.
