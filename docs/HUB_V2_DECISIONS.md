# ADR — Arah Pengembangan Hub Next (HUB V2)

> **Status:** DITERIMA (locked) · **Tanggal:** 2026-09-28
> **Konteks:** `HUB_ARCHITECTURE.md` (Fase 1–15 selesai), `HUB_FRONTEND_PLAN.md` (Fase 15 selesai),
> `HUB_V2_FRONTEND_PLAN.md` (rencana frontend Fase 17–20).
> **Efek:** keputusan ini membatalkan/tegaskan beberapa keputusan lama — dipetakan di §6.

Dokumen ini **ADR (Architecture Decision Record)** untuk 4 keputusan yang mengunci seluruh
pekerjaan Hub berikutnya. Semuanya **domain → permission → API → UI**, tidak mulai dari UI.

---

## Ringkasan Keputusan

| # | Keputusan | Status |
|---|---|---|
| **D1** | Administrasi Hub **ber tahap**: platform dulu, hub-side admin menyusul | Diterima |
| **D2** | **Satu tenant = satu hub** (`Tenant.hubId` tetap satu-satunya sumber kebenaran) | Diterima |
| **D3** | Anggota baru = akses **semua tenant dalam hub**, role default **`viewer`** | Diterima |
| **D4** | **Tidak ada uang/saldo di level hub** (wallet ditolak) | Diterima |

---

## Konteks: apa yang sudah ada (recon 2026-09-28)

Sebelum memutuskan, kondisi kode sudah dicek langsung:

| Komponen | Status | Lokasi |
|---|---|---|
| `Hub { id, name, description?, isActive, createdAt, updatedAt }` | ada (tanpa `code`/`status`/`ownerUserId`) | `core/hub/domain/Hub.ts` |
| `HubMembership { hubId, userId, role: owner\|admin\|viewer }` | ada | `core/hub/domain/HubMembership.ts` |
| Relasi Hub↔Tenant | **sudah ada** sebagai `Tenant.hubId` (satu tenant maks satu hub), single source of truth | `Tenant.ts`, `HubService.assignTenant` |
| UI tab **Hub & Anggota** (Fase 15) | selesai & beku (F1–F9) | `frontend/src/core/platform/components/HubsSection.tsx` |
| Pencarian user lintas-tenant (`GET /api/platform/users`) | selesai 2026-09-28 | `PlatformController.listUsers` |
| `Hub Consolidated Report` (tenant→outlet, dari shift sales + payments) | ada | `PlatformController.consolidated` |
| Session lintas-tenant (`POST /auth/switch-tenant`) | ada — **tapi dengan asumsi "semua tenant, semua outlet"** | `AuthService.switchTenant` |
| Permission `hub:manage` | ada — sebagai **permission platform**, bukan namespace hub-side | `PLATFORM_ROLE_PERMS` |
| Billing (`Plan`, `Subscription`, `SubscriptionHistory`, `Entitlement`) | ada, **scoped ke tenant** | `core/billing/` |
| `HubTenantMembership`, `HubInvitation`, wallet/ledger | belum ada | — |

### Temuan kritis (alasan access model didahulukan)

`AuthService.switchTenant` sekarang menerbitkan token lintas-tenant seperti ini:

```ts
role: `hub-${target.role}`,                   // "hub-owner"
permissions: HUB_MEMBER_ROLE_PERMS[target.role], // owner → OWNER_PERMS (penuh!)
outletIds: [],                                 // [] = SEMUA outlet tenant tujuan
```

Dan `HubMembershipService.findAccessibleTenants` mengembalikan **seluruh tenant dalam hub** untuk
setiap anggota. Akibatnya: seorang anggota hub dengan role `owner` otomatis menjadi **Owner penuh
di semua tenant dalam hub**, tanpa ada cara expresses "hanya tenant C, outlet Jakarta saja".

**Kesimpulan:** "access model" yang ada di proposal produk adalah **lubang otorisasi yang aktif**,
bukan fitur masa depan. Karena itu urutannya di balik: **V1 = access model**, bukan CRUD hub.

---

## D1 — Administrasi Hub: bertahap (platform dulu, lalu hub-side admin)

**Keputusan:** Management Hub (`create`/`edit`/`delete` hub, kelola anggota, assign tenant) **tetap
dimiliki Platform Super Admin** (Terminal Center, `X-Tenant-Id: platform`). Nanti ada tahap kedua:
customer group owner bisa mengelola hub-nya sendiri.

**Alasan:**
- Otoritas mengelola Hub saat ini sengaja dikunci ke platform (keputusan lama #5) supaya tidak ada
  permukaan auth baru yang belum di-hardening.
- Permission namespace `hub:*` **belum ada**; menambahkannya bersamaan dengan surface auth baru
  = dua perubahan besar sekaligus → sulit di-review dan di-rollback.
- Akses cross-tenant sudah terlatih lewat `switch-tenant`, jadi gestion de.self-service (self-service)
  adalah **fitur**, bukan prasyarat.

**Konsekuensi:**
- Fase 16 (namespace permission) dan Fase 17 (access model) tidak menambah route publik baru.
- Permission baru `hub:*` **didefinisikan** di Fase 16 tapi **belum dipakai** sampai tahap kedua;
  ini disengaja — supaya tidak ada permission mati yang membingungkan.
- Tahap kedua butuh keputusan UX terpisah: customer hub admin login lewat mana, dan apakah memakai
  tenant switcher atau hub switcher.

**Rekaman tahap 2 (Fase 21, 2026-10-02)** — D1 tidak berubah: **tidak ada mutasi** dari sisi
anggota. Yang tiba adalah permukaan baca (`GET /api/hub/*`), dan tiga hal yang harus tercatat
supaya tahap berikutnya tidak mengulang perdebatan yang sama:
- **Permission `hub.*` ditagih dari membership, bukan dari JWT.** Token membawa permission
  *tenant*; kalau `hub.*` ikut masuk token, lapisan hub akan menumpang di session tenant. Guard
  `requireHubPermission` membaca baris membership per request, jadi suspend member berlaku
  seketika di API — sama seperti di tenant switcher.
- **Tidak ada bypass platform.** Admin platform tetap mengelola hub dari Terminal Center; di
  `/api/hub/*` dia adalah anggota biasa, dan tanpa membership mendapat 403. Kalau nanti terminal
  butuh melihat hub milik klien, jalurnya endpoint platform, bukan membuka bypass di sini.
- **`viewer` dipersempit.** Fase 16 memberi `viewer` akses `hub.reports.read` — angka pendapatan
  semua tenant, sementara ia ditolak untuk melihat daftar tenant-nya. Sekarang `viewer` hanya
  `hub.read`. Matriks harus tetap monoton per level dan diuji begitu.

**Rekaman tahap 2 lanjutan (Fase 24, 2026-10-04)** — D1 tetap, tapi tahap 2 kini punya
**mutasi sisi anggota**: `POST/PUT/DELETE /api/hub/:hubId/members*` + grant + undangan
(`hub.members.manage`), gerakkan dari console `/hub` sendiri (`/hub/login` + `HubLayout`,
di luar `ProtectedRoute`/`DashboardLayout` — kasir adalah anggota `viewer` yang sah dan
`ProtectedRoute` melemparnya ke `/pos`). Tiga hal yang harus tercatat:
- **Permission saja tidak cukup; ada plafon.** `hub.members.manage` bilang "boleh mengelola",
  bukan "boleh mengelola siapa pun". `hubRoleRules.ts` menambah rank-ketat (`>`): yang boleh
  dikelola hanya role di bawah diri → baris `owner` immutable, tanpa guard "owner terakhir"
  terpisah (guard itu tidak terjangkau selama aturannya strict-rank). Cap grant tenant memakai
  cap table (`owner→owner`, …, `viewer→null`), bukan perbandingan dua tangga — dua set tidak
  sejajar (role tenant punya `cashier` di tengah), jadi perbandingan numerik akan membuat
  hub `viewer` bisa mencetak tenant `cashier`.
- **`hub.*` tetap tidak masuk JWT.** Mutasi membaca membership per request seperti baca;
  suspend member berlaku seketika. Membungkus `authorize()` di sini akan membalik keputusan
  Fase 16.
- **Yang TIDAK berpindah ke tahap 2**: lifecycle tenant (pause/resume/subscription/destructive)
  tetap platform-only; `switch-hub` masih ganti halaman bukan ganti session; kelola/arsip
  hub tetap Terminal Center. Jarak ini yang membedakan "mengelola orang dalam hub" (boleh)
  dengan "mengelola entitas bisnis lintas-tenant" (belum).

## D2 — Satu tenant = satu hub

**Keputusan:** `Tenant.hubId` (nullable) tetap **satu-satunya sumber kebenaran** relasi Hub↔Tenant.
Satu tenant maksimal berada di satu hub. Tabel join `HubTenantMembership` **tidak dibuat**.

**Alasan:**
- Ini sudah jadi keputusan terdokumentasi (`HUB_ARCHITECTURE.md` keputusan #9) dan sudah dipakai
  di mana-mana: `Tenant.hubId` (domain+schema+repo), `tenantRepository.findByHubId`,
  `resolvePlatformScope`, provisioning, konsolidasi, UI Terminal Center, filter tenant.
- Join table = **dua sumber kebenaran** (`Tenant.hubId` + tabel) selama masa transisi → kelas bug
  yang mahal (tenant terlihat di satu tempat, hilang di tempat lain).
- Single database (`tenantId: {$in: [...]}`) membuat konsolidasi tetap murah **tanpa** join table.

**Kapan ditinjau ulang:** kalau ada kasus nyata "satu tenant gabung dua grup" (misal franchise yang
berpisah dari grup lama), barulah `HubTenantMembership` dievaluasi sebagai **migrasi** (ADR baru +
backfill + masa dual-read), **bukan** feature.

## D3 — Default akses anggota baru: semua tenant, role `viewer`

**Keputusan:** Anggota baru yang ditambahkan ke sebuah hub langsung punya akses ke **seluruh tenant
dalam hub** tersebut, dengan role **`viewer`** (bisa lihat, tidak bisa ubah). Admin boleh
**mempersempit** akses ini per tenant/outlet kapan saja (Fase 17).

**Alasan:**
- **Zero-regression:** anggota existing tidak kehilangan akses saat tabel grant diperkenalkan —
  dijamin oleh fallback `switch-tenant`.
- Role default bukan `admin`/`owner` → default paling aman; eskalasi harus eksplisit.
- Onboarding member jadi satu klik, bukan formulir berjenjang.

**Konsekuensi:** yang wajib diuji adalah grant **narrowing/revoke** — bukan hanya grant berhasil.

## D4 — Tidak ada uang/saldo di level hub

**Keputusan:** Tidak ada `HubWallet`, `WalletAccount`, atau `WalletLedger`. Langganan tetap
per-tenant (`Subscription.tenantId`, `Tenant.planId`).

**Alasan:**
- Menyimpan saldo customer = **menyimpan dana pihak ketiga** (stored funds). Konsekuensi yang muncul:
  KYC/AML, escrow, ledger append-only, rekonsiliasi harian, pajak atas top-up, dan risiko audit.
- Kuire adalah **POS SaaS**; wallet adalah produk/lisensi lain.
- Alternatif yang murah: **tagihan konsolidasi manual / invoice** di luar sistem (atau invoice PDF
  per grup) — 80% nilai, 10% risiko, reuse `Plan` + `SubscriptionHistory` yang sudah ada.

**Ditunda (bukan ditolak permanen):** `HubInvoice` / prepaid credit untuk subscription — hanya
kalau ada kebutuhan komersial nyata.

---

## Opsi yang Ditolak (agar tidak dibahas ulang)

| Opsi | Alasan ditolak |
|---|---|
| `HubTenantMembership` (tabel join multi-hub) | Dua sumber kebenaran dengan `Tenant.hubId`; belum ada kebutuhan nyata (D2) |
| Wallet / top-up saldo di Kuire | Stored funds + KYC/escrow/rekonsiliasi (D4) |
| `Hub.settings` sebagai config-bag | Jebakan yang sama seperti `TenantConfig` (QRIS); cukup `code`/`status` dulu |
| `Hub.logo` / `contact` | Estetis; tidak ada kebutuhan produk yang terverifikasi |
| Langsung buat UI hub-side admin | Memakai D1: permission namespace belum ada, permukaan auth belum di-hardening — **selesai di Fase 24, berurutan sesuai D1** (namespace Fase 16 → baca Fase 21 → tulis Fase 24) |
| Mapping `hub.owner` → `OWNER_PERMS` (status quo) | Security hole: memberi Owner penuh di semua tenant (lihat Temuan Kritis) |
| Permission `hub:*` langsung dipakai bareng `hub:manage` (platform) | Tabrakan makna: `hub:manage` = permission platform. Namespace platform → `platform.hubs.manage` (Fase 16) |

---

## Efek ke Fase 16–20 (phase ledger di `HUB_ARCHITECTURE.md`)

| Fase | Nama | Inti | Dampak keputusan ini |
|---|---|---|---|
| **16** | Namespace permission & matriks role hub | `platform.hubs.manage` (rename) + `hub:read`, `hub:members:*`, `hub:tenants:*`, `hub:reports:*` | D1 (permission `hub:*` didefinisikan dulu, dipakai nanti) |
| **17** | Access model per tenant/outlet ★ | `HubMemberTenantAccess` + `switch-tenant` baca grant (dengan fallback) | D2 (pakai `Tenant.hubId`) · D3 (default all-tenant + viewer, opt-in narrowing) |
| **18** | Hub identity | `code` unique + `status` enum + `ownerUserId` | — |
| **19** | Hub Overview (read model) | Sales dari orders per tenant (bukan shift) + kartu ringkas | D4 (tidak ada angka "saldo", hanya subscription rollup) |
| **20** | Hub Invitation & suspend member | `HubInvitation` + `HubMembership.status` | D1 (undangan dipakai platform dulu) |
| **21** | Permukaan baca anggota hub (D1 tahap 2, **read-only**) | `GET /api/hub/*` + `requireHubPermission` | D1 (tahap 2 dimulai dari **baca**, bukan tulis) · D2 (satu tenant = satu hub, jadi daftar tenant hub lengkap) |
| **22** | Halaman anggota `/hub` | Tab permission-gated + overview diekstrak bersama Terminal Center | D1 (baca dulu) |
| **23** | Dashboard per outlet `/hub/outlet` | **DIREVERT** 2026-10-04 — hub dipakai client multi-tenant, per-outlet ada di `/reports` | — |
| **24** | Hub Center console + mutasi sisi anggota ★ | `/hub/login` + `HubLayout` (di luar dashboard) + `POST/PUT/DELETE /api/hub/:hubId/members*` + grant + undangan, plafon `hubRoleRules` | D1 (tahap 2 **tulis**: kelola orang dalam hub pindah ke anggota; kelola entitas tetap platform) · D3 (cap grant per tenant role) |

Front-end plan: [`HUB_V2_FRONTEND_PLAN.md`](HUB_V2_FRONTEND_PLAN.md).

---

## 6. Dampak ke keputusan lama

| Keputusan lama (`HUB_ARCHITECTURE.md` §4) | Dampak |
|---|---|
| #5 — Otoritas kelola Hub = platform saja | **Disebagian dicabut di Fase 24** (D1 tahap 2): kelola anggota/grant/undangan jadi milik anggota hub; kelola & lifecycle entitas hub tetap platform |
| #9 — `Hub.tenantId` dihapus, relasi via `Tenant.hubId` | **Dipertahankan & ditegaskan** (D2) |
| #6 — `hub:manage` | Dipertahankan sebagai permission platform, tapi **di-rename** `platform.hubs.manage` (Fase 16) |

## 7. Risiko

| Risiko | Mitigasi |
|---|---|
| Rename `hub:manage` → `platform.hubs.manage` memutus super admin yang token-nya masih lama | JWT embed permission → wajib re-login setelah deploy; catat di release note + `DAILY_LOG` |
| `switchTenant` salah baca grant → user terkunci dari tenant yang sebelumnya bisa diakses | **Fallback** ke perilaku lama bila tabel grant kosong; test harus membuktikan grant (izin) dan revoke (penolakan) |
| Permission `hub:*` terdefinisi tapi belum dipakai | Diterima (D1); catat di `HUB_ARCHITECTURE.md` Fase 16 sebagai "reserved" |
| `ownerUserId` disalahARTikan sebagai otoritas | Dokumentasikan eksplisit "display only"; otoritas tetap `HubMembership.role` |

## 8. Status

**D1–D4 terkunci** (2026-09-28). **Fase 16 selesai 2026-09-29** — permission platform
`hub:manage` → `platform.hubs.manage` (+ migrasi dokumen `Role` saat boot), namespace `hub.*`
direservasi untuk D1 tahap 2, matriks role hub 4. Catatan & release note di
[`HUB_ARCHITECTURE.md`](HUB_ARCHITECTURE.md) § Fase 16.

**Fase 16–20 selesai** (lihat phase ledger di atas dan §Fase 16–21 `HUB_ARCHITECTURE.md`).

**Fase 21 selesai 2026-10-02** (backend) — D1 tahap 2 dimulai dari **baca**: `GET /api/hub/*`
read-only, dijaga membership, dengan `viewer` dipersempit ke `hub.read` saja dan `config` tenant
(proyeksi QRIS) tidak pernah keluar.

**Fase 22 selesai 2026-10-03** (frontend) — halaman anggota `/hub` (tab permission-gated, overview
diekstrak supaya sama dengan Terminal Center). Lihat § Fase 22 di `HUB_ARCHITECTURE.md`.

**Fase 23 (dashboard per outlet `/hub/outlet`) DIREVERT 2026-10-04** — alasannya produk, bukan teknis:
hub hanya dipakai client yang **punya banyak tenant**, jadi pertanyaan "bagaimana outlet saya" sudah
jawabannya di outlet/client itu sendiri, bukan di layar hub. Angka per outlet tidak ikut hilang:
`/reports` sudah meneruskan `?outletId=` (yang belum ada hanya filter outlet di UI).

**Fase 24 selesai 2026-10-04** — mutasi sisi anggota (tambah/ubah role/suspend/hapus anggota,
grant per tenant, undangan) + console `/hub` sendiri di luar dashboard, dijaga plafon
`hubRoleRules` (rank-ketat + cap table). Lihat § Fase 24 di `HUB_ARCHITECTURE.md`.

**Yang masih terbuka di D1 tahap 2**: kelola/arsip/`status` hub tetap platform-only; lifecycle
tenant (pause/resume/subscription/destructive) tetap platform-only; belum ada `switch-hub`
(ganti halaman, bukan ganti session); belum ada ringkasan grant per anggota ("N dari M tenant",
butuh endpoint bulk); belum ada export/scheduled report.
