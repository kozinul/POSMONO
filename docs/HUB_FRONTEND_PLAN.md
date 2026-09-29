# PLAN — Frontend Hub (Terminal Center): Assign Tenant & Kelola Anggota

> Dokumen rencana **frontend Hub**. Dibuat 2026-09-28.
> LCompanion: [`HUB_ARCHITECTURE.md`](HUB_ARCHITECTURE.md) (arsitektur & fase backend 1–14, sudah selesai).
> Fokus dokumen ini: **UI/UX + implementasi frontend** tab `Hub & Anggota` di Terminal Center — khususnya **assign/unassign tenant ke hub** dan **kelola anggota (group admin)** yang saat ini belum ada jalur UI-nya.
> **Status: FASE 0–5 SELESAI & TERVERIFIKASI 2026-09-28** — frontend **106 test / 15 files**, backend **1157 test / 99 files**, `tsc` kedua sisi bersih, `vite build` OK. Fase 4 (backend opsional) **sudah dikerjakan 2026-09-28**: `GET /api/platform/users` (pencarian user lintas-tenant) + `userTenantName` di `HubMembershipService.listMembers`, dan picker anggota `AddMemberModal` kini **satu kolom** (tanpa pilih-tenant-dulu).

> **DOKUMEN BEKU.** Cakupannya (Fase 0–5 di bawah = Fase 15 pada phase ledger
> `HUB_ARCHITECTURE.md`) sudah selesai & terverifikasi. Dokumen ini tidak lagi diperbarui; jangan menambah
> fase/temuan baru di sini. Lanjutan (Fase 16–20: access matrix, hub identity, overview, undangan)
> ada di **[`HUB_V2_FRONTEND_PLAN.md`](HUB_V2_FRONTEND_PLAN.md)** — keputusannya di
> [`HUB_V2_DECISIONS.md`](HUB_V2_DECISIONS.md), phase ledger di
> [`HUB_ARCHITECTURE.md`](HUB_ARCHITECTURE.md) § Fase 16–20.

### Status implementasi (F1–F9)

| # | Temuan | Fix | File |
|---|---|---|---|
| F1 | create/delete hub tanpa invalidasi cache | 5 mutasi React Query baru + helper `invalidateHubScope` / `invalidateHubTenantScope` | `@shared/hooks/usePlatform.ts` |
| F2 | tidak ada UI edit hub / `isActive` | `HubProfileCard` form inline (nama, deskripsi, toggle status) + konfirmasi dampak ke anggota | `core/platform/components/HubProfileCard.tsx` |
| F3 | assign/unassign tenant tidak ada di tab Hub | `HubTenantPanel` + `AssignTenantModal` (search, cek tenant sudah di hub, konfirmasi pindah hub) | `HubTenantPanel.tsx`, `AssignTenantModal.tsx` |
| F4 | tambah anggota wajib tempel User ID | `AddMemberModal` 2 tahap: pilih tenant → pilih user → role (tanpa input ID) | `AddMemberModal.tsx` |
| F5 | `confirm()`/`alert()` native | semua dialog destruktif pakai Swal2 (`showLoaderOnConfirm` + `preConfirm` + `Swal.showValidationMessage`), termasuk `TenantsSection` | `HubProfileCard`, `HubTenantPanel`, `HubMemberPanel`, `AddMemberModal`, `TerminalCenterPage` |
| F6 | warna pesan dari string match | state `error` + komponen `ErrorNote`/`apiErrorMessage` | `platformUi.tsx` |
| F7 | ganti role / hapus anggota tanpa konfirmasi & guard | Swal confirm + `disabled={isPending}` per tabel | `HubMemberPanel.tsx` |
| F8 | kolom Hub menampilkan `hubId` mentah | `PlatformController.withHubNames` menyertakan `hubName` per baris list tenant | `PlatformController.ts` (+ test) |
| F5b | link audit dari panel hub | tombol "Lihat di Audit" di `HubTenantPanel` (`TENANT_ASSIGNED_TO_HUB`) & `HubMemberPanel` (`MEMBER_ADDED`); filter aksi `AuditSection` di-lift ke page | `HubTenantPanel.tsx`, `HubMemberPanel.tsx`, `TerminalCenterPage.tsx` |
| F9 | tab terlihat tanpa permission | `TABS` kini ber-permission, di-filter `visibleTabs`; `activeTab` jatuh ke tab pertama yang terlihat; tanpa permission → pesan | `TerminalCenterPage.tsx` |

Ekstra yang ikut dikerjakan: `TenantsSection` menerima filter hub (chip + hapus filter, dari panel hub), `ConsolidatedSection` jadi controlled (tombol "Lihat Konsolidasi" di panel profil), `useHubMemberships` typed (`HubMemberRole`, label & hint role, `useMyHubMemberships` untuk endpoint `/hub-memberships/me` yang tadinya tak ada konsumen), helper UI bersama `platformUi.tsx` (`role="dialog"`, `Modal`, `Badge`, `EmptyState`, `apiErrorMessage`).


---

## 1. Tujuan

1. **Assign tenant ↔ hub** bisa dilakukan **langsung dari tab Hub** (bukan hanya lewat form tenant), lengkap dengan pencarian tenant, konfirmasi pindah hub, dan tampilan tenant yang sudah punya hub lain.
2. **Kelola anggota hub** tanpa mengetik `User ID` manual — pakai pencarian user, ganti role dengan konfirmasi, hapus dengan konfirmasi.
3. **Lengkapi CRUD hub** (edit nama/deskripsi + toggle aktif/nonaktif) yang endpoint-nya sudah ada tapi tidak terpakai.
4. **Konsisten** dengan section Terminal Center lain (React Query + invalidasi, Swal2, toast) dan **gating permission `platform.hubs.manage`**.

Out of scope: perubahan model hub/tenant, logika `HubMembershipService`, billing, konsolidasi (sudah ada tab sendiri).

---

## 2. Hasil Audit — Backend SUDAH LENGKAP (tidak perlu diubah untuk MVP)

Semua route sudah ada & ter-mount. Prefix `/api/hubs` & `/api/hub-memberships` (mount di `backend/src/bootstrap/routes.ts:130,133`), guard `platformAuthenticate` + `platformAuthorize('platform.hubs.manage')` untuk semua route mutasi & list.

### 2.1 Hub (`backend/src/core/hub/interfaces/http/routes/hub.routes.ts`)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/hubs` | – | `PlatformHub[]` (id, name, description, isActive, createdAt, updatedAt) |
| GET | `/api/hubs/:id` | – | `PlatformHub` (tanpa tenant) |
| POST | `/api/hubs` | `{ name, description? }` | `201 PlatformHub` · `409` bila nama bentrok |
| PUT | `/api/hubs/:id` | `{ name?, description?, isActive? }` | `200 PlatformHub` |
| DELETE | `/api/hubs/:id` | – | `204` · `400` bila masih ada tenant |
| **POST** | **`/api/hubs/:hubId/tenants/:tenantId`** | – | **`200 { success: true }`** (assign — **belada dipakai frontend**) |
| **DELETE** | **`/api/hubs/:hubId/tenants/:tenantId`** | – | **`200 { success: true }`** (unassign — **belum dipakai frontend**) |
| GET | `/api/hubs/:hubId/tenants` | – | `Tenant[]` serialize |

### 2.2 Keanggotaan (`hubmembership.routes.ts`)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/hub-memberships` | `{ hubId, userId, role }` | `201 HubMembership` · `400` role invalid (harus `owner|admin|manager|viewer`), `404` user/hub tak ada, `409` sudah anggota |
| GET | `/api/hub-memberships/hub/:hubId` | – | `HubMember[]` **didekorasi**: `+ displayName, email, userTenantId` (null bila user hilang) |
| PUT | `/api/hub-memberships/:hubId/:userId` | `{ role }` | `200 HubMembership` |
| DELETE | `/api/hub-memberships/:hubId/:userId` | – | `204` |
| GET | `/api/hub-memberships/me` | `authenticate` | `HubMembership[] + hubName` (**tanpa konsumen frontend** — dead end) |
| GET | `/api/hub-memberships/me/tenants` | `authenticate` | `AccessibleTenant[]` (dipakai via `/auth/accessible-tenants`) |

### 2.3 Endpoint `/api/platform` untuk baca data pendukung

| Method | Path | Permission | Dipakai untuk |
|---|---|---|---|
| GET | `/platform/hubs` | `platform.hubs.manage` | daftar hub (sudah dipakai) |
| GET | `/platform/hubs/:hubId` | `platform.hubs.manage` | detail hub + `tenants[]` + `tenantCount` (sudah dipakai) |
| GET | `/platform/tenants?search=&hubId=&page=&limit=` | `platform.tenants.read` | **kandidat picker assign tenant** (TIDAK ada `hubName` di list) |
| GET | `/platform/tenants/:tenantId` | `platform.tenants.read` | `usersSummary[]` (maks 20 user) — **MVP picker anggota** |
| GET | `/platform/audit` | `platform.audit.read` | audit sudah punya label `HUB_*`, `TENANT_ASSIGNED_TO_HUB`, `MEMBER_*` |

Permission platform tersedia (`core/platform/defaults/roles.ts:49-59`): `platform.hubs.manage`, `outlet:manage`, `platform.tenants.read|manage`, `platform.plans.read|manage`, `platform.reports.read`, `platform.support.access`, `platform.audit.read`.

> ⚠️ `permissions` di-embed di JWT saat login → **super admin yang sudah login harus re-login** agar permission baru terbaca.

---

## 3. Hasil Audit — Frontend saat ini (dan 9 temuan)

Implementasi existing sudah ada tapi masih minim: `HubsSection` + `HubDetail` inline di
`frontend/src/core/platform/pages/TerminalCenterPage.tsx:57-247`.

| # | Temuan | Bukti | Dampak |
|---|---|---|---|
| F1 | Create/delete hub pakai helper raw `apiPost`/`apiDelete` → **tidak ada `invalidateQueries`** | `TerminalCenterPage.tsx:71,86,1214-1224` | Daftar hub & detail hub **stale** setelah create/delete (hanya refresh saat remount/30s staleTime) |
| F2 | **Tidak ada UI edit hub** walau `PUT /api/hubs/:id` ada | `TerminalCenterPage.tsx:93-148` | `name`/`description` tak bisa diubah; **`isActive` tidak terjangkau sama sekali** |
| F3 | **Assign/unassign tenant tidak ada di tab Hub** | `TerminalCenterPage.tsx:178-191` (panel read-only) | Endpoint `POST/DELETE /hubs/:hubId/tenants/:tenantId` **dead** di sisi frontend |
| F4 | Tambah anggota = input **"User ID" mentah** | `TerminalCenterPage.tsx:227-229` | Salah ketik → membership yatim (dekorasi list jadi `null`, `HubMembershipService.ts:93-99`); tidak ada discoverability |
| F5 | Konfirmasi hapus hub pakai `confirm()`/`alert()` native | `TerminalCenterPage.tsx:84,89` | Tidak konsisten dengan `Swal2` di tab Tenants (`TerminalCenterPage.tsx:548-580`) |
| F6 | Warna pesan error ditentukan string match | `TerminalCenterPage.tsx:240` (`msg.includes('Gagal')`) | Rapuh; pesan sukses/kegagalan bercampur |
| F7 | Ganti role & hapus anggota **tanpa konfirmasi & tanpa `isPending` guard** | `TerminalCenterPage.tsx:208-219` | Salah klik langsung mengubah akses lintas-tenant; double-click bisa spam request |
| F8 | Kolom "Hub" di tabel Tenants menampilkan `hubId` mentah | `TerminalCenterPage.tsx` `TenantsSection` + `usePlatform.ts:28-30` | `TenantService.list` **tidak mengembalikan `hubName`** → user baca ID, bukan nama |
| F9 | `PlatformRoute` hanya cek `tenantId === 'platform'`, **tanpa cek permission** | `frontend/src/@shared/components/PlatformRoute.tsx:13` | Platform user tanpa `platform.hubs.manage` tetap lihat tab Hub → kumpulkan 403 |

Tambahan kecil: `apiDelete` (`TerminalCenterPage.tsx:1220`) memanggil `res.data.data` padahal `DELETE /hubs/:id` balas `204 No Content`; `GET /hub-memberships/me` tanpa konsumen.

### 3.1 Cara assign hub yang tersedia hari ini (cek requested)

1. ** saat provisioning tenant** — `CreateTenantModal` select hub (`TerminalCenterPage.tsx:293,495-510`), kirim `hubId` ke `POST /platform/provision/tenant`.
2. **Edit profil tenant** — `TenantProfileForm.tsx:36,64,143-148` (dropdown hub, kirim `hubId` via `usePlatformUpdateTenant`).
3. ❌ **Dari sisi hub** — belum ada sama sekali (F3).

---

## 4. Keputusan Desain

| Keputusan | Alasan |
|---|---|
| `HubsSection` diekstrak ke `core/platform/components/HubsSection.tsx` | `TerminalCenterPage.tsx` sudah 1424 baris; pola komponen section sudah ada (`PlansSection.tsx`) |
| Master–detail: **daftar hub (kiri) + detail hub (kanan)** dengan sub-tab `Profil · Tenant · Anggota` | Satu layar untuk semua tugas hub; sub-tab menghindari panel yang terlalu tinggi |
| **Assign tenant = modal picker** (search + tenant dari luar hub), bukan auto-complete | Butuh konteks "tenant ini pindah dari hub mana"; konfirmasieksplisit lebih aman |
| **Pencarian anggota: 2 tahap** (pilih tenant → pilih user dari `usersSummary`) untuk MVP | Nol perubahan backend; `GET /platform/tenants/:id` sudah mengembalikan `usersSummary` |
| Backend search user lintas-tenant = **P3 (opsional)** | `usersSummary` dipotong 20 & tidak ada `tenantName`; setelah 20 user per tenant, picker MVP tidak bisa Total |
| Notifikasimutasi = **Swal2 (`Swal.fire` + `showLoaderOnConfirm`)**; pesan sukses = `Swal.toast` | Konsisten dengan `TenantsSection` hapus tenant |
| **Gating `platform.hubs.manage`** di level tab + tombol aksi | `PlatformRoute` tidak bisa gating per-permission tanpa parse permission; gate di tab lebih lokal & murah |
| Lift state `hubFocus` ke `TerminalCenterPage` | Tombol "Lihat Konsolidasi" & "Lihat di Tenants" bisa=/cross-navigasi tab tanpa URL router |
| Ganti role anggota: `<select>` → **modal konfirmasi** | Perubahan akses lintas-tenant deserve konfirmasi (F7) |

---

## 5. Target UI

```
┌─ Terminal Center ─ [Plans] [Hub & Anggota] [Tenants] [Outlet] [Ringkasan] [Konsolidasi] [Audit Log] ─┐
│ tab "Hub & Anggota" (hanya bila punya permission platform.hubs.manage)                                        │
│ ┌────────────────────┐ ┌──────────────────────────────────────────────────────────┐                │
│ │ 🔍 cari hub        │ │  [Profil] [Tenant (3)] [Anggota (2)]        [Lihat Konsolidasi]│  │
│ │ + Buat Hub        │ ├──────────────────────────────────────────────────────────┤                │
│ │ ┌────────────────┐ │ │  PROFIL                                                     │                │
│ │ │ ● BCA Hospitality│ │ │   Nama* [__________________]  Deskripsi [______________]  │                │
│ │ │   3 tenant · 2 │ │ │   Status  ( Aktif ⇄ Nonaktif )  badge  jumlah tenant/anggota │                │
│ │ │   anggota  [Aktif]│ │ │   [Simpan Perubahan]                                      │                │
│ │ └────────────────┘ │ ├──────────────────────────────────────────────────────────┤                │
│ │ ○ Maju Grup (1/0) │ │  TENANT                                                       │                │
│ └────────────────────┘ │   [+ Assign Tenant ke Hub]  tabel: nama · status · hub · [Lepas]│              │
│                         ├──────────────────────────────────────────────────────────┤                │
│                         │  ANGGOTA                                                      │                │
│                         │   [+ Tambah Anggota]  tabel: nama · email · tenant · role ▾ · 🗑 │              │
│                         └──────────────────────────────────────────────────────────┘                │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**AssignTenantModal**: input search (debounce 300 ms, `usePlatformTenants({ search, limit: 20 })`) → hasil = tenant yang `hubId !== hub.id` (tenant dalam hub ditampilkan sebagai "Sudah di hub ini" non-klik); baris menampilkan `status` pill + `hubName ?? 'Standalone'`; klik baris → konfirmasi Swal bila tenant punya hub lain ("Pindahkan dari {hubName}?") → `POST /hubs/:hubId/tenants/:tenantId` → invalidasi.

**AddMemberModal (MVP 2 tahap)**: step 1 pilih tenant (search `usePlatformTenants`, default = tenant pertama dalam hub) → step 2 `usePlatformTenant(tenantId).usersSummary` → pilih user → pilih role (`owner|admin|manager|viewer` + deskripsi singkat) → `POST /hub-memberships`. User yang sudah anggota ditampilkan badge "Sudah anggota" (dicek terhadap `useHubMembers`).

---

## 6. Hooks & Cache

### 6.1 Hook baru (semua di `frontend/src/@shared/hooks/usePlatform.ts`)

```ts
export function usePlatformCreateHub() {           // POST /hubs {name, description?}
export function usePlatformUpdateHub() {           // PUT  /hubs/:id {name?, description?, isActive?}
export function usePlatformDeleteHub() {           // DELETE /hubs/:id  (204, mutationFn return void)
export function usePlatformAssignTenantToHub() {   // POST   /hubs/:hubId/tenants/:tenantId
export function usePlatformUnassignTenantFromHub() { // DELETE /hubs/:hubId/tenants/:tenantId
```

### 6.2 Query key & invalidation matrix

| Key | Dipakai oleh |
|---|---|
| `['platform-hubs']` | daftar hub, select di `CreateTenantModal`, `TenantProfileForm` |
| `['platform-hub', hubId]` | detail hub (profil, tenant[], tenantCount) |
| `['hub-members', hubId]` | daftar anggota |
| `['platform-tenants', params]` | tabel Tenants, picker assign tenant |
| `['platform-tenant', tenantId]` | detail tenant, picker anggota (usersSummary) |
| `['platform-audit', …]` | tab Audit (label aksi hub sudah ada) |

| Mutasi | Invalidasi |
|---|---|
| create hub | `platform-hubs` |
| update hub | `platform-hubs`, `platform-hub/<id>` |
| delete hub | `platform-hubs`, `platform-hub/<id>` (hapus dari cache), `platform-tenants` |
| **assign tenant** | `platform-hubs`, `platform-hub/<hubId>`, `platform-tenants`, `platform-tenant/<tenantId>` |
| **unassign tenant** | idem (4 key di atas) |
| add member | `hub-members/<hubId>`, `platform-audit` |
| update role member | `hub-members/<hubId>`, `platform-audit` |
| remove member | `hub-members/<hubId>`, `platform-audit` |

> Invalidasi `platform-audit` opsional tapi murah — mutasi hub sudah direkam backend (F: audit best-effort tak pernah menggagalkan operasi).

### 6.3 Permission gate

```ts
// di dalam platform section
const canManageHub = (useAuthStore((s) => s.user?.permissions) ?? []).includes('platform.hubs.manage');
```
- Tab `'hubs'` **disembunyikan** dari `TABS` kalau `!canManageHub`.
- Tab `'consolidated'` butuh `platform.reports.read`, tab `'audit'` butuh `platform.audit.read` (terapkan sekalian, konsistensi).
- Semua tombol mutasi di `HubsSection` di-render hanya bila `canManageHub` (read-only bila tidak).

---

## 7. Rincian Fase Implementasi

### Fase 0 — Perbaikan cepat (F1, F5, F6, F7, F9) — ✅ SELESAI
**Files**: `TerminalCenterPage.tsx`, `usePlatform.ts`, `useHubMemberships.ts`, `PlatformRoute.tsx`
- Hapus `apiPost`/`apiDelete`; ganti dengan mutation React Query (F1).
- `confirm`/`alert` → `Swal.fire` + `Swal.toast` (F5); ganti pesan string-match dengan state `{ tone: 'ok'|'err', text }` (F6).
- Konfirmasi + `disabled={mutation.isPending}` untuk ganti role & hapus anggota (F7).
- Gating tab per permission (F9) — helper kecil, bukan di `PlatformRoute` (menghindari parse permission di router).

### Fase 1 — Ekstrak + CRUD hub lengkap (F2) — ✅ SELESAI
**New**: `core/platform/components/HubsSection.tsx`, `HubListPanel.tsx`, `HubProfileCard.tsx`, `CreateHubModal.tsx`, `EditHubModal.tsx`
- Pindahkan `HubsSection`/`HubDetail` dari page (Fase 0 fixes ikut terbawa).
- `EditHubModal` (dipakai oleh `HubProfileCard`): nama required, deskripsi, **toggle `isActive`**.
  - Saat nonaktif: warning di UI — "Menonaktifkan hub ini **mencabut akses lintas-tenant** anggota hub (`HubMembershipService.findAccessibleTenants` melewati hub nonaktif, `HubMembershipService.ts:132`)." Tampilkan jumlah anggota terdampak.
- Badge status `Aktif`/`Nonaktif` di baris daftar hub.
- Pesan error dinormalisasi dari API (`409` → "Nama hub sudah dipakai."; `400` delete → "Lepas semua tenant dari hub sebelum menghapus.").

### Fase 2 — Assign / Unassign tenant (F3) ⭐ — ✅ SELESAI
**New**: `core/platform/components/HubTenantPanel.tsx`, `AssignTenantModal.tsx`
- Tabel tenant dalam hub: nama, `slug`, status pill, plan, tombol `Lepas` (Swal confirm, sebutkan jumlah tenant tersisa).
- `AssignTenantModal`: search debounce 300 ms, `usePlatformTenants({ search, limit: 20 })`, tampilkan `hubName` fallback `'Standalone'`; tenant yang sudah punya hub lain diberi label "Pindah dari {hubName}"; tenant yang sudah di hub ini di-nonaktifkan.
- `usePlatformAssignTenantToHub` / `usePlatformUnassignTenantFromHub` (§6.1).
- Cross-link: dari `HubTenantPanel` → `setTab('tenants')` + set filter `hubId` (butuh lift `tenantFocus`, konsisten dengan `hubFocus`).

### Fase 3 — Anggota v2 (F4) — ✅ SELESAI
**New**: `core/platform/components/HubMemberPanel.tsx`, `AddMemberModal.tsx`
- 2 tahap (tenant → user → role), `usePlatformTenant(tenantId).usersSummary`.
- Deskripsi role: `owner` = akses penuh lintas tenant · `admin` = + kelola user & laporan · `viewer` = baca saja.
- Badge "Sudah anggota" untuk user yang sudah di `useHubMembers(hubId)`.
- User tanpa `displayName` (user hilang) ditampilkan sebagai `userId` + badge **"Data user tidak ditemukan"** (kondisi yang perlu ditangani di UI).
- Per-row `disabled` saat mutasi berjalan; `aria-label` pada tombol ikon.

### Fase 4 — Backend opsional (P3) — ✅ SELESAI (2026-09-28)
- `GET /api/platform/users?search=&tenantId=&hubId=&page=&limit=` → `platform.tenants.read` → `{ id, displayName, email, tenantId, tenantName, roleName, isActive, isHubMember }`. Mengganti 2 tahap jadi **satu kolom pencarian global**.
- `PlatformController.listTenants` menambahkan `hubName` (hapus F8) — join/lookup `hubRepository` per baris atau `$lookup`.
- `HubMembershipService.listMembers` menambahkan `userTenantName` pada dekorasi.
- Update `docs/API_REFERENCE.md` §Platform.

### Fase 5 — Polish & dokumentasi — ✅ SELESAI
- Loading skeleton per panel (bukan satu `Loading()` global), empty state yang memberi aksi ("Belum ada tenant → Assign tenant").
- Audit: dari baris hub/anggota, link "Lihat di Audit" (set `action=TENANT_ASSIGNED_TO_HUB` dst., sudah ada di `AUDIT_ACTION_LABELS`).
- `docs/HUB_ARCHITECTURE.md`: koreksi rujukan `useHubs.ts` (file tidak ada; hook sebenarnya di `usePlatform.ts` + `useHubMemberships.ts`) dan `TenantDetailModal` (sekarang `TenantDetailPage`).
- Tambah entri di `AGENTS.md` + `docs/PROJECT_ROADMAP.md`.

**Status Fase 5**: ✅ semua butir — `EmptyState` + aksi, link **"Lihat di Audit"** (panel Tenant → `TENANT_ASSIGNED_TO_HUB`, panel Anggota → `MEMBER_ADDED`; filter aksi `AuditSection` di-lift ke `TerminalCenterPage` via state `auditAction` + select `aria-label="Filter aksi audit"`), koreksi rujukan `useHubs.ts` di `docs/HUB_ARCHITECTURE.md`, entri `AGENTS.md` + `docs/PROJECT_ROADMAP.md` + `docs/API_REFERENCE.md`, dan `EditHubModal` yang sengaja dilebur ke `HubProfileCard` (lihat §11).

---

## 8. Test Plan

### Frontend (`frontend/tests/unit/`) — sudah ditulis & hijau
| Test | Isi | Hasil |
|---|---|---|
| `usePlatformHubs.test.tsx` (baru, 6 test) | create/update/delete/assign/unassign memanggil endpoint + body benar; **invalidasi `platform-hubs`**, `platform-hub/<id>`, `platform-tenants`, `platform-audit` untuk mutasi tenant | ✅ |
| `HubsSection.test.tsx` (baru, 10 test) | daftar hub + badge status + load profil terpilih; filter pencarian; aksi manage disembunyi saat `canManage=false`; simpan profil (PUT); assign tenant dari sub-tab Tenant; **unassign setelah konfirmasi Swal**; tambah anggota tenant→user→role (user existing = badge "Sudah anggota" + radio disabled, tanpa input ID); hapus anggota setelah konfirmasi | ✅ |
| `usePlatform.test.tsx`, `useHubMemberships` (lama) | regresi permission & query key existing | ✅ |

Total frontend: **106 test / 15 files** (dari 90 test / 13 files sebelum pekerjaan ini; +16).

### Backend
- `tests/integration/platform-terminal.test.ts` — `GET /platform/tenants` menyertakan `hubName` untuk tenant berhub, `null` untuk tenant standalone. ✅
- `tests/integration/platform-terminal.test.ts` — `GET /platform/users`: search/tenantId/hubId/isActive/paginasi, dekorasi `tenantName` + `roleName`, `isHubMember` hanya bermakna bila `hubId` dikirim, regex meta karakter di-escape, RBAC 403 (`platform.audit.read` saja) & 401 (token tenant). ✅
- `tests/repositories/MongoUserRepository.test.ts` — `searchAcrossTenants`: lintas tenant, cocok `displayName`/`email`/`_id`, escape regex, filter tenantIds/isActive, paginasi + `total`. ✅
- `tests/services/HubMembershipService.test.ts` — `userTenantName` terisi satu lookup per tenant unik & `null` bila tenant hilang. ✅

Total backend: **1157 test / 99 files** (dari 1145/99; +1 `hubName`, +1 `GET /platform/users` + RBAC, +5 `searchAcrossTenants`, +2 `userTenantName`).

### Verifikasi wajib
```
cd frontend && npx tsc --noEmit && pnpm test && pnpm build
cd backend  && npx tsc --noEmit && pnpm test
```
Hasil 2026-09-28: frontend tsc bersih, **106/106**, build OK · backend tsc bersih, **1157/1157**.

---

## 9. Acceptance Criteria

- [x] Dari tab **Hub & Anggota** bisa: buat hub, edit (nama/deskripsi/status), assign tenant, lepas tenant, tambah anggota, ganti role, hapus anggota — **tanpa pindah halaman**.
- [x] Tidak ada input `User ID` manual; anggota dipilih lewat pencarian (tenant → user → role).
- [x] Semua mutasi lewat React Query → **tidak ada cache basi** setelah create/edit/delete/assign/remove.
- [x] Semua aksi destruktif punya konfirmasi Swal2; semua error dari API tampil dalam bahasa Indonesia.
- [x] Tab Hub tidak terlihat untuk platform user tanpa `platform.hubs.manage`.
- [x] `PUT /api/hubs/:id` (terutama `isActive`) terjangkau dari UI.
- [x] Tidak ada lagi `apiPost`/`apiDelete`/`confirm()`/`alert()`/`prompt()` di `TerminalCenterPage`.
- [x] `npx tsc --noEmit` + test + build hijau: frontend **104/104 (15 files)**, backend **1149/1149 (99 files)**.

---

## 10. Risiko & Catatan

| Risiko | Mitigasi |
|---|---|
| `isActive=false` diam-diam membekukan akses anggota | Konfirmasi eksplisit + tampilkan jumlah anggota terdampak |
| Hard delete tenant dari Terminal Center **menghapus semua data tenant** (cascade 31 koleksi) | Aksinya sudah punya textarea alasan; **dilarang** meletakkan aksi ini di panel hub (tetap di tab Tenants) |
| Picker anggota MVP terpotong 20 user/tenant & tanpa nama tenant | Diberi label batas ("Menampilkan 20 user pertama — cari via tenant lain"), Fase 4 untuk search global |
| `usersSummary` memuat PII lintas tenant (nama/email) | Ini memang fungsi Terminal Center internal (`platform.tenants.read`); jangan pernah ditampilkan di UI tenant |
| `permissions` di JWT → permission baru butuh re-login | Dicatat di §2.3; tidak ada permission baru di rencana ini (semua sudah ada) |
| Duplikasi `hubId` pada tenant bila assign ganda | Backend `assignTenant` idempoten (`tenant.assignHub`), tapi UI tetap cegah lewat filter kandidat |

---

## 11. File Inventory

**Baru (sudah dibuat)**
```
frontend/src/core/platform/components/HubsSection.tsx        # shell: daftar hub + detail sub-tab
frontend/src/core/platform/components/HubProfileCard.tsx     # edit profil + toggle isActive + hapus hub
frontend/src/core/platform/components/HubTenantPanel.tsx     # tenant dalam hub + unassign
frontend/src/core/platform/components/HubMemberPanel.tsx     # anggota + ganti role + hapus
frontend/src/core/platform/components/CreateHubModal.tsx
frontend/src/core/platform/components/AssignTenantModal.tsx
frontend/src/core/platform/components/AddMemberModal.tsx
frontend/src/core/platform/components/platformUi.tsx         # inputCls/cardCls/Modal/Badge/ErrorNote/apiErrorMessage
frontend/tests/unit/usePlatformHubs.test.tsx                  # 6 test mutasi hub + invalidasi
frontend/tests/unit/HubsSection.test.tsx                     # 10 test komponen hub (assign, anggota, audit link, tenant asal)
```

> Catatan: `EditHubModal` tidak dibuat terpisah — editing dipusatkan di `HubProfileCard` agar tidak ada dua permukaan edit untuk data yang sama. `HubListPanel` juga dilebur ke dalam `HubsSection`.

**Diubah**
```
frontend/src/core/platform/pages/TerminalCenterPage.tsx   # hapus HubsSection/HubDetail + apiPost/apiDelete,
                                                         # tab per-permission, state hub/filter lintas tab, Swal di TenantsSection
frontend/src/@shared/hooks/usePlatform.ts                 # 5 mutasi hub (create/update/delete/assign/unassign)
frontend/src/@shared/hooks/useHubMemberships.ts            # typed role, label/hint, invalidasi audit, useMyHubMemberships
backend/src/core/platform/interfaces/http/controllers/PlatformController.ts  # hubName di list tenants
backend/tests/integration/platform-terminal.test.ts        # +2 test (hubName, GET /platform/users + RBAC)
backend/tests/repositories/MongoUserRepository.test.ts       # +5 test searchAcrossTenants
backend/tests/services/HubMembershipService.test.ts          # +2 test userTenantName
docs/API_REFERENCE.md                                      # catat field hubName + endpoint /platform/users
docs/HUB_ARCHITECTURE.md, docs/PROJECT_ROADMAP.md, AGENTS.md
```

**Fase 4 (backend) — baru**
```
backend: MongoUserRepository.searchAcrossTenants(filter, {limit, skip})
backend: PlatformController.listUsers + route GET /api/platform/users (platform.tenants.read)
backend: HubMembershipService.listMembers → userTenantName
backend: PlatformControllerDeps.hubMembershipService + wiring container.ts
frontend: usePlatformUsers() + PlatformUserRow di usePlatform.ts
frontend: AddMemberModal → satu kolom pencarian global (hapus pilih-tenant + props existingMemberIds/defaultTenantId)
```

**Tidak ada lagi pekerjaan tersisa.** Endpoint pencarian user global (Fase 4) dan `userTenantName` masuk 2026-09-28; link "Lihat di Audit" masuk sekaligus.
