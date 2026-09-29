# PLAN — Frontend Hub V2 (Fase 17–20): Access Matrix, Identity, Overview, Undangan

> Dokumen rencana **frontend** untuk tahap lanjutan pengembangan Hub.
> Dibuat 2026-09-28. Companion: [`HUB_V2_DECISIONS.md`](HUB_V2_DECISIONS.md) (ADR D1–D4),
> [`HUB_ARCHITECTURE.md`](HUB_ARCHITECTURE.md) (phase ledger Fase 16–20).
> Predecessor (sudah selesai & **beku**): [`HUB_FRONTEND_PLAN.md`](HUB_FRONTEND_PLAN.md) — Fase 15, tab `Hub & Anggota` F1–F9.
>
> **Status: RENCANA (belum ada kode).** Keputusan arsitektur sudah terkunci di `HUB_V2_DECISIONS.md`;
> implementasi dimulai dari **Fase 16 (backend: namespace permission)** — dokumen ini baru relevan
> secara kode mulai Fase 17.

Fase 15 membuat **UI Kelola Hub & Anggota** utuh di Terminal Center. Fase 17–20 menambah dua
kemampuan yang **belum ada sama sekali** dan mengubah perilaku yang sudah dipakai:

| Fase | Nama | Yang berubah di frontend |
|---|---|---|
| 16 | Namespace permission | Tanpa perubahan UI (tapi **wajib re-login** admin) |
| 17 | Access model per tenant/outlet ★ | **Sub-tab baru "Access"** + tenant switcher lebih ketat |
| 18 | Hub identity | `code` + `status` di profil hub |
| 19 | Hub Overview | **Sub-tab baru "Overview"** (kartu + penjualan) |
| 20 | Undangan | Tombol "Undang" + daftar undangan pending |

Yang paling penting: **Fase 17 menutup kebocoran otorisasi yang aktif hari ini** — anggota hub
dengan role `owner` sekarang otomatis jadi **Owner penuh di semua tenant dalam hub**. Detail & kode
di `HUB_V2_DECISIONS.md` §"Temuan Kritis".

---

## 1. Tujuan

1. Admin bisa **membatasi akses tiap anggota** per tenant dan per outlet (matriks akses), bukan
   "semua tenant dalam hub, semua outlet".
2. Profil hub punya identitas yang jelas untuk onboarding: `code` (mis. `KOPI-NUSANTARA`) + `status`
   (`active`/`suspended`/`archived`).
3. Terminal Center punya **ringkasan hub** yang berguna: jumlah tenant/outlet/anggota, penjualan
   tenant mana yang turun/naik, status operasional outlet.
4. Onboarding anggota tidak perlu input User ID manual — cukup kirim undangan ke email.

## 2. Kondisi saat ini (recon 2026-09-28)

Sudah ada (tidak perlu dibuat ulang):

```
Terminal Center → tab "Hub & Anggota" (HubsSection)
  ├── sub-tab Profil  → HubProfileCard      (nama, deskripsi, toggle isActive, hapus hub)
  ├── sub-tab Tenant  → HubTenantPanel      (assign/unassign tenant, "Lihat Konsolidasi")
  └── sub-tab Anggota → HubMemberPanel      (tambah/ganti role/hapus anggota, tenant asal)

Belum ada:
  ✗ matriks akses tenant/outlet per anggota
  ✗ ringkasan/overview hub
  ✗ undangan (invite by email)
  ✗ field code/status hub
  ✗ UI apa pun untuk "user biasa yang punya akses lintas-tenant" (selain tenant switcher di top bar)
```

Perilaku yang **berubah** dan harusotron diperbarui test-nya:

- `HubTenantSwitcher` (top bar) — setelah Fase 17 hanya menampilkan tenant **ber-grant**.
- `HubsSection.test.tsx` (10 test) & `usePlatformHubs.test.tsx` (6 test) — field hub berubah
  (`isActive` → `status`, tambah `code`).
- `useHubMemberships` — role hub jadi 4 (`owner`/`admin`/`manager`/`viewer`) + `status`.

## 3. Keputusan desain

| # | Keputusan | Alasan |
|---|---|---|
| FD1 | Sub-tab Access = **bagian dari sub-tab Anggota**, bukan tab utama | Satu entitas (anggota) punya dua dimensi (peran hub + akses tenant); memecah jadi tab level hub menambah kedalaman navigasi tanpa menambah nilai |
| FD2 | Matriks akses ditampilkan **read-only + tombol "Atur Akses"** per anggota (bukan grid editable inline) | Grid dengan 2 dropdown + checkbox outlet terlalu padat; dialog lebih mudah diakses & diuji |
| FD3 | Default akses = **semua tenant + semua outlet** (D3), narrowing bersifat opt-in | Nol anggota existing kehilangan akses; admin bisa dipersempit kapan saja |
| FD4 | Overview memakai **satu endpoint** `GET /api/platform/hubs/:hubId/overview` | 4 endpoint terpisah = 4 loading state + risiko data tidak konsisten antar kartu |
| FD5 | Undangan tetap dari Terminal Center dulu (D1 tahap 1) | Tidak menambah permukaan auth baru sebelum access model matang |
| FD6 | Permission gate per **aksi**, bukan per sub-tab | Admin bisa melihat anggota tanpa bisa mengubah aksesnya (pemisahan read/write yang wajar) |
| FD7 | `status: suspended` pada hub = **read-only untuk semua anggota**, dengan banner, bukan hard-disable — Admin platform masih butuh melihat data hub yang disuspensi; hard-disable menyembunyikan diagnosis |

## 4. Target UI

### 4.1 Sub-tab "Access" (Fase 17) — di dalam sub-tab Anggota

```
Anggota                                          [+ Undang Anggota]

┌──────────────────────────────────────────────────────────────────────────┐
│ Budi Santoso            [Hub Owner ▾]   Tenant asal: Kopi Nusantara Bali   │
│ budi@kopi.co.id                                                      ⋯    │
└──────────────────────────────────────────────────────────────────────────┘
   klik "Atur Akses" →

  Atur Akses — Budi Santoso
  ─────────────────────────────────────────────────────────────────
  Akses default: SEMUA tenant dalam hub · semua outlet.
  Kosongkan centang untuk membatasi.

  ┌──────────────────────────┬───────────────┬─────────────────────────┐
  │ Tenant                   │ Role di tenant│ Outlet                  │
  ├──────────────────────────┼───────────────┼─────────────────────────┤
  │ ☑ Kopi Nusantara Bali    │ [Owner     ▾] │ Semua outlet            │
  │ ☑ Kopi Nusantara Jakarta │ [Manager   ▾] │ ☑ Kemang                │
  │                          │               │ ☐ Senopati              │
  │ ☐ Kopi Nusantara Roastery│ —            │ —                       │
  └──────────────────────────┴───────────────┴─────────────────────────┘

  [Batal]                    [Simpan akses]
```

Kontrol saat satu tenant di-uncheck: dropdown role & daftar outlet **disabled** (abu-abu), dengan
teks kecil "tidak diberi akses". Role di tenant **bukan** role hub — label memakai
`HUB_TENANT_ROLE_LABELS`.

### 4.2 Profil hub (Fase 18)

```
Kopi Nusantara Group            KOPI-NUSANTARA            [Aktif ▾]
┌────────────────────────────────────────────────────────────────────────┐
│ Nama       [ Kopi Nusantara Group                                   ]  │
│ Kode       [ KOPI-NUSANTARA            ]  ← uppercase, unik           │
│ Deskripsi  [ Grup-operasional 3tenant...                            ]  │
│ Status     [ Aktif ▾ ]  → Aktif / Ditangguhkan / Diarsipkan          │
│ Owner      Budi Santoso (display only, dari HubMembership role owner)  │
└────────────────────────────────────────────────────────────────────────┘
```

Peringatan saat memilih `suspended`/`archived`: seluruh anggota kehilangan akses lintas-tenant
(lama) → konfirmasi Swal dengan jumlah anggota terdampak, seperti pola toggle `isActive` yang sudah
ada di `HubProfileCard`.

### 4.3 Sub-tab "Overview" (Fase 19)

```
Overview                                    [Hari ini ▾] [7 hari ▾] [30 hari ▾]

┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ 5 Tenants    │ 12 Outlets   │ 18 Anggota   │ 10 Online    │ Rp 485,2 jt  │
│              │              │              │ 1 Perhatian │ Penjualan    │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘

Penjualan per tenant
  Kopi Nusantara Bali      ████████████████  Rp 210.000.000
  Kopi Nusantara Jakarta   ████████████       Rp 165.000.000
  Kopi Nusantara Roastery  ██████             Rp 110.200.000

Status outlet
  ●Sanur (Bali)          shift terbuka 4j12m
  ●Kemang (Jakarta)      shift terbuka 1j02m
  ⚠Ubud (Bali)           tidak ada shift 6j

Langganan
  Bali · Pro · aktif (sisa 12 hari)   |   Jakarta · Starter · aktif (sisa 3 hari) ⚠
```

Semua angka **format Rp**, angka nol tampil `Rp 0` (bukan `-`), dan `—` untuk data tidak tersedia
(mis. outlet tanpa shift). Kartu "Perhatian" (outlet tanpa shift > 24 jam) **bukan** alert error —
cuma info operasional, warna amber.

### 4.4 Undangan (Fase 20)

```
Anggota                                          [+ Undang Anggota]

Aktif (3)
  Budi Santoso      Hub Owner        ⋯
  Andi Wijaya       Hub Admin        ⋯
  Sari             Hub Viewer       ⋯

Undangan menunggu (1)                          ← sub-bagian baru di tab Anggota
  rina@kopi.co.id    Diundang 2 hari lalu · kadaluarsa 22 Sep   [Batalkan]

  + Undang Anggota →  email [rina@kopi.co.id ]  Peran [Viewer ▾]  [Kirim undangan]
                     ⚠ "rini@ group sudah punya akun" (cek sebelum kirim)
```

Alur setelah "Kirim undangan": toast "Undangan dikirim ke X", baris baru muncul di "Undangan
menunggu". Di luar Terminal Center, undangan diterima lewat halaman accept (lihat §5.4).

## 5. Hooks, API & Cache

### 5.1 Endpoint baru

```
# platform (Fase 17–20) — permission platform, bukan hub-side (D1)
GET    /api/platform/hubs/:hubId/overview?dateFrom=&dateTo=
                                                    → platform.reports.read
GET    /api/hub-memberships/hub/:hubId/:userId/access        (D1: sementara platformAuthenticate)
PUT    /api/hub-memberships/hub/:hubId/:userId/access        → platform.hubs.manage
POST   /api/hubs/:hubId/invitations        { email, role }   → platform.hubs.manage
GET    /api/hubs/:hubId/invitations                           → platform.hubs.manage
DELETE /api/hubs/:hubId/invitations/:invitationId            → platform.hubs.manage
POST   /api/hub-invitations/:token/accept                     → authenticate
```

Bentuk response `overview` (backend single query, lihat `HUB_ARCHITECTURE.md` Fase 19):

```ts
{
  hub: { id, code, name, status },
  counts: { tenants, outlets, members, pendingInvitations },
  operational: { outletsWithOpenShift, outletsStale, outletsWithoutShift },
  sales: { total, currency: 'IDR', byTenant: [{ tenantId, tenantName, total, transactions }] },
  subscription: [{ tenantId, tenantName, planName, status, daysRemaining }]
}
```

### 5.2 Hook baru (`frontend/src/@shared/hooks/usePlatform.ts`)

```ts
useHubOverview(hubId, { dateFrom?, dateTo? }, { enabled })
useHubMemberAccess(hubId, userId, { enabled })
useSaveHubMemberAccess(hubId, userId)          // PUT + invalidasi akses & audit
useHubInvitations(hubId, { enabled })
useInviteHubMember(hubId)                      // POST + invalidasi invitations
useRevokeHubInvitation(hubId)                  // DELETE
```

`HUB_TENANT_ROLE_LABELS` + `HUB_TENANT_ROLE_HINTS` (5 role: owner/admin/manager/cashier/viewer)
ditempatkan di `useHubMemberships.ts` — **bukan** reuse `HUB_MEMBER_ROLE_LABELS` (yang 3 role hub),
supaya tidak tertukar saat baca kode.

### 5.3 Matriks invalidasi cache

| Aksi | Invalidasi |
|---|---|
| Simpan akses anggota | `['hub-member-access', hubId]`, `['hub-members', hubId]`, `['platform-audit']`, `['accessible-tenants']` |
| Ubah `code`/`status` hub | `['hubs']`, `['hub', hubId]`, `['platform-tenants', …]` (column `hubName`), `['platform-audit']` |
| Kirim/batalkan undangan | `['hub-invitations', hubId]`, `['hub-overview', hubId]`, `['platform-audit']` |
| Ganti rentang tanggal overview | hanya `['hub-overview', hubId, range]` (tidak invalidate hub/member) |

Pola invalidate mengikuti `invalidateHubScope`/`invalidateHubTenantScope` yang sudah ada (Fase 15) —
**tidak** membuat helper baru untuk scope yang sama.

### 5.4 Halaman accept undangan (di luar Terminal Center)

```
Route: /hub-invitations/accept?token=…
Guard : PlatformRoute TIDAK dipakai — halaman ini untuk user tenant biasa, bukan admin platform
Layout: TerminalLayout TIDAK dipakai — cukup layout minimal + header logo tenant
State : token invalid/expired → EmptyState + tombol "Minta undangan baru"
Aksi  : tombol "Terima undangan" → POST accept → simpan `activeHubId` di auth store → redirect
```

Setelah accept: user langsung masuk ke daftar tenant yang sekarang bisa dia akses (tenant switcher
di top bar terisi otomatis) — tanpa perlu login ulang, karena `hub-memberships/me/tenants` sudah
mengembalikan daftar itu.

## 6. Permission gate

| Elemen UI | Butuh permission | Perilaku bila tidak ada |
|---|---|---|
| Tab `Hub & Anggota` | `platform.hubs.manage` (Fase 16) | Tab tak terlihat (logika `visibleTabs` yang sudah ada) |
| Tab Overview | `platform.reports.read` | Sub-tab Overview tak dirender; tombol "Lihat Konsolidasi" tetap ada seperti sekarang |
| Tombol Atur Akses / Simpan | `platform.hubs.manage` | Kolom akses read-only, tanpa tombol |
| Kirim/Batalkan undangan | `platform.hubs.manage` | Tombol "Undang" disembunyikan, daftar pending tetap terlihat (read-only) |

## 7. Test plan

### Frontend (`frontend/tests/unit/`)

| File | Test baru | Total estimasi |
|---|---|---|
| `HubsSection.test.tsx` (existing) | Update fixture `isActive`→`status`; tambah `code` | 12 |
| `HubMemberAccessModal.test.tsx` (baru) | uncheck tenant → role/outlet disabled; submit payload benar; error API → `ErrorNote`; disabled saat mutasi | 6 |
| `HubOverviewPanel.test.tsx` (baru) | 5 kartu terisi; `Rp 0` untuk nol; `—` untuk data hilang; loading skeleton; ganti rentang → refetch | 6 |
| `HubInvitationPanel.test.tsx` (baru) | kirim undangan (validasi email), email sudah terdaftar, batalkan, daftar pending | 5 |
| `usePlatformHubAccess.test.tsx` (baru) | invalidasi setelah simpan akses | 3 |

`useMyHubMemberships` / tenant switcher: tambah test bahwa daftar tenant **menghormati grant**
(Backend: `findAccessibleTenants` sudah di-intersect — test backend yang utama).

### Backend

| File | Test baru |
|---|---|
| `HubMemberTenantAccessRepository.test.ts` (baru) | upsert idempoten (unique `{hubId,userId,tenantId}`), revoke, `findForUser`, `findForUserTenant` |
| `HubMemberAccessService.test.ts` (baru) | grant/revoke/outletIds, **revoke → tenant tidak bisa di-switch** (bukan hanya grant sukses) |
| `AuthService.test.ts` (existing) | `switchTenant` baca grant → role/outletIds dari grant; fallback ke membership bila grant kosong |
| `platform-terminal.test.ts` (existing) | endpoint overview + invitations, RBAC 401/403 |
| `HubService.test.ts` (existing) | `code` unik (409 duplikat), `status` enum, `suspended` → `findAccessibleTenants` kosong |

### Verifikasi wajib per fase

```bash
cd backend  && npx tsc --noEmit && npx vitest run     # baseline 1158 test / 99 file
cd frontend && npx tsc --noEmit && npx vitest run     # baseline 106 test / 15 file
cd frontend && npx vite build
# smoke HTTP alur hub (dev stack mongodb:27017) — incl. kasus DENY
```

## 8. Acceptance criteria

- [ ] Anggota bisa diberi akses ke 1 tenant + 1 outlet saja; setelah `switch-tenant`, tenant & outlet
      lain **tidak** terlihat dan `POST /auth/switch-tenant` ke tenant itu **403**.
- [ ] Anggota tanpa baris grant **tetap** bisa mengakses semua tenant dalam hub (regresi nol).
- [ ] `code` hub unik (case-insensitive), uppercase otomatis, duplikat → 409 dengan pesan Indonesia.
- [ ] `status: suspended` → `findAccessibleTenants` kosong untuk anggotanya, Terminal Center tetap
      bisa melihat + membuka detail hub, dengan konfirmasi yang menyebut jumlah anggota terdampak.
- [ ] Overview: 5 kartu + penjualan per tenant + status outlet + langganan; angka dari **orders**,
      bukan shift sales, dan total = jumlah `byTenant`.
- [ ] Undangan: email invalid ditolak client-side, duplikat(email, pending) ditolak server, accept
      dengan token invalid/expired → `EmptyState` (bukan crash).
- [ ] Semua aksi destruktif lewat Swal2 + `preConfirm`; tidak ada `confirm`/`alert`/`prompt` native.
- [ ] `HubsSection.test.tsx` & `usePlatformHubs.test.tsx` diperbarui ke kontrak baru.

## 9. Risiko & catatan

| Risiko | Mitigasi |
|---|---|
| Fase 17 mengubah perilaku tenant switcher (daftar tenant bisa mengecil) | D3 + fallback; test DENY wajib ada, bukan hanya test GRANT |
| `hub:manage` → `platform.hubs.manage` memutus sesi super admin lama | JWT embed permission → release note "wajib re-login" + `DAILY_LOG` |
| Matriks akses jadi membingungkan (2 tingkat role: hub & tenant) | Label eksplisit ("Peran di hub" vs "Role di tenant"), hint di tiap dropdown, default all-outlet terlihat jelas |
| Overview menampilkan data penjualan lintas tenant | Read-only agregasi, sudah lewat `platform.reports.read`; tidak ada data PII |
| Halaman accept undangan butuh layout baru | Layout minimal, bukan `TerminalLayout`/`PlatformRoute` (bidang platform) |
| Angka nol vs data kosong | `Rp 0` untuk nol, `—` untuk tidak ada data — Jangan samakan |

## 10. Di luar scope

Sengaja **tidak** dikerjakan di Fase 17–20 (sudah diputuskan di `HUB_V2_DECISIONS.md`):
`HubTenantMembership` (multi-hub) · wallet/saldo · `Hub.settings`/logo/contact ·
UI admin sisi customer (D1 tahap 2) · scheduled reports & export PDF/XLSX untuk overview
(ekspor pakai `ReportExportService` yang sudah ada bila diperlukan).

## 11. File inventory (target)

**Baru**
```
docs/HUB_V2_DECISIONS.md
docs/HUB_V2_FRONTEND_PLAN.md

frontend/src/core/platform/components/HubMemberAccessModal.tsx   # matriks tenant×role×outlet
frontend/src/core/platform/components/HubOverviewPanel.tsx       # kartu + penjualan + status
frontend/src/core/platform/components/HubInvitationPanel.tsx    # daftar undangan + kirim
frontend/src/core/platform/pages/HubInvitationAcceptPage.tsx     # /hub-invitations/accept
frontend/tests/unit/HubMemberAccessModal.test.tsx
frontend/tests/unit/HubOverviewPanel.test.tsx
frontend/tests/unit/HubInvitationPanel.test.tsx
frontend/tests/unit/usePlatformHubAccess.test.tsx

backend/src/core/hub/domain/HubMemberTenantAccess.ts
backend/src/core/hub/application/services/HubMemberAccessService.ts
backend/src/core/hub/infrastructure/persistence/MongoHubMemberTenantAccessRepository.ts
backend/src/core/hub/infrastructure/persistence/schemas/HubMemberTenantAccessSchema.ts
backend/src/core/hub/domain/HubInvitation.ts            (+ repo, schema, service)
```

**Diubah**
```
frontend/src/core/platform/components/HubsSection.tsx        # sub-tab Overview + Access + code/status
frontend/src/core/platform/components/HubProfileCard.tsx    # field code + status + owner
frontend/src/core/platform/components/HubMemberPanel.tsx    # tombol Atur Akses + panel undangan
frontend/src/core/platform/pages/TerminalCenterPage.tsx     # route accept undangan
frontend/src/@shared/hooks/usePlatform.ts                   # 6 hook baru
frontend/src/@shared/hooks/useHubMemberships.ts            # HUB_TENANT_ROLE_* + 4 role hub
frontend/src/@shared/hooks/useAuth.ts                       # simpan activeHubId setelah accept
backend/src/core/hub/domain/Hub.ts                          # code, status, ownerUserId
backend/src/core/hub/application/services/HubMembershipService.ts   # intersect grant
backend/src/core/identity/application/services/AuthService.ts       # switchTenant baca grant
backend/src/core/platform/defaults/roles.ts                 # rename hub:manage
shared/src/constants/permissions.ts                          # permission baru
backend/src/core/reporting/application/services/ReportService.ts    # getPlatformSalesByTenant
docs/HUB_ARCHITECTURE.md, docs/API_REFERENCE.md, AGENTS.md, docs/DAILY_LOG.md
```
