# Dokumentasi POSMono — Index

> **Dokumen ini adalah peta dokumentasi.** Kalau tidak tahu dokumen mana yang otoritatif untuk
> suatu topik, cek [`HUB_ARCHITECTURE.md` §4](#4-keputusan-arsitektur-terpilih) dan tabel di bawah.
>
> Aturan main: **satu topik = satu dokumen otoritatif.** Kalau ada dua dokumen yang berbeda isi
> untuk topik yang sama, yang lama dipindah ke [`archive/`](archive/) — bukan dihapus (riwayat git
> tetap ada), tapi tidak lagi dirujuk sebagai sumber kebenaran.

## Start di sini

| Kalau kamu mau… | Baca |
|---|---|
| Mulai ngoding | [`AGENTS.md`](../AGENTS.md) (root) — konvensi, pattern, status fitur, catatan regresi |
| Paham sistem secara keseluruhan | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Tahau endpoint-nya | [`API_REFERENCE.md`](API_REFERENCE.md) |
| Lihat status/rencana kerja | [`PROJECT_ROADMAP.md`](PROJECT_ROADMAP.md) · [`DAILY_LOG.md`](DAILY_LOG.md) |
| Tau fitur POS sudah sampai mana | [`POS_CURRENT_FEATURES.md`](POS_CURRENT_FEATURES.md) |

---

## 1. Fondasi & Arsitektur

| Dokumen | Isi | Status |
|---|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Arsitektur kanonik (EN): filosofi, struktur repo, backend, frontend, shared, event catalog, multi-tenancy, modularitas, keputusan teknologi | 🟢 aktif |
| [`DOMAIN_ARCHITECTURE.md`](DOMAIN_ARCHITECTURE.md) | Peta domain lengkap: Order, Payment, Shift, Inventory, Discount, Template, Print, Auth, Billing | 🟢 aktif |
| [`DATABASE_ARCHITECTURE.md`](DATABASE_ARCHITECTURE.md) | Koleksi, skema, index, strategi query | 🟢 aktif |
| [`HUB_ARCHITECTURE.md`](HUB_ARCHITECTURE.md) | **Hierarki `Hub → Tenant → Outlet → Warehouse`**, membership, session lintas-tenant, konsolidasi, phase ledger Fase 1–20 | 🟢 aktif |
| [`TRANSACTION_SYSTEM_ARCHITECTURE.md`](TRANSACTION_SYSTEM_ARCHITECTURE.md) | Alur transaksi uang (order → payment → shift → laporan) | 🟢 aktif |
| [`INFRASTRUCTURE_ARCHITECTURE.md`](INFRASTRUCTURE_ARCHITECTURE.md) | Infra, deployment topology, scaling | 🟢 aktif |
| [`DECISIONS.md`](DECISIONS.md) | Catatan keputusan teknis (ADR gaya lama) | 🟡 aktif, sebagian usang |
| [`ROLE_ACCESS_PLAN.md`](ROLE_ACCESS_PLAN.md) | Matriks RBAC, permission, scoping outlet, approval policy | 🟢 aktif |

## 2. Spesifikasi Produk & Fitur

| Dokumen | Isi | Status |
|---|---|---|
| [`POS_CURRENT_FEATURES.md`](POS_CURRENT_FEATURES.md) | Fitur POS per area (pos, produk, shift, void, diskon, struk, printer, QRIS, hub/outlet) | 🟢 aktif |
| [`REPORT_REQUIREMENTS.md`](REPORT_REQUIREMENTS.md) | Kebutuhan laporan + filter (`outletId`, tanggal, metode) | 🟢 aktif |
| [`RECEIPT_TEMPLATE_GUIDE.md`](RECEIPT_TEMPLATE_GUIDE.md) | Struktur template struk/KOT/invoice, node, repeater, kolom thermal | 🟢 aktif |
| [`pricing/`](pricing/README.md) | **Spesifikasi resmi Pricing Engine** (19 file): diskon, service charge, pajak, pembulatan, adjustment, pipeline, matematika, testing | 🟢 aktif |

## 3. Rencana Kerja (plans)

Dokumen yang **sudah dieksekusi** tetap disimpan di sini karena berisi keputusan/contract yang
masih dirujuk (mis. kontrak API QRIS). Yang benar-benar usang ada di `archive/`.

| Dokumen | Isi | Status |
|---|---|---|
| [`PROJECT_ROADMAP.md`](PROJECT_ROADMAP.md) | Phase A–G + status fitur | 🟢 aktif |
| [`BACKLOG.md`](BACKLOG.md) | Fitur di luar MVP (jangan dikerjakan sebelum MVP live) | 🟢 aktif |
| [`HUB_FRONTEND_PLAN.md`](HUB_FRONTEND_PLAN.md) | Fase 15 — UI tab **Hub & Anggota** (F1–F9) | ✅ **selesai & beku** (lihat `HUB_V2_FRONTEND_PLAN.md` untuk kelanjutan) |
| [`HUB_V2_DECISIONS.md`](HUB_V2_DECISIONS.md) | **ADR** — keputusan D1–D4 untuk pengembangan Hub berikutnya + opsi yang ditolak | 🟢 baru, aktif |
| [`HUB_V2_FRONTEND_PLAN.md`](HUB_V2_FRONTEND_PLAN.md) | Fase 17–20 — bagian **frontend** (matriks akses, identity, overview, undangan) | 🟡 direncanakan |
| [`QRIS_GATEWAY_PLAN.md`](QRIS_GATEWAY_PLAN.md) | Kontrak integrasi gateway QRIS (endpoint, polling, mapping invoice) | ✅ selesai, rujukan kontrak |

## 4. Kontrak & Operasional

| Dokumen | Isi | Status |
|---|---|---|
| [`API_REFERENCE.md`](API_REFERENCE.md) | Kontrak semua endpoint (request/response, permission, query param) | 🟢 aktif, sering di-update |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Deployment VPS/Docker, env, backup, rollback | 🟢 aktif |
| [`OPS_RUNBOOK.md`](OPS_RUNBOOK.md) | Runbook operasional harian (health, restart, incident) | 🟢 aktif |

## 5. Testing

| Dokumen | Isi | Status |
|---|---|---|
| [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md) | Strategi 7 layer, harness, commands, debt | 🟢 aktif |
| [`TEST_PROGRESS.md`](TEST_PROGRESS.md) | Status & cakupan test terkini | 🟢 aktif |

## 6. Log & Tracking

| Dokumen | Isi | Status |
|---|---|---|
| [`DAILY_LOG.md`](DAILY_LOG.md) | Jurnal harian engineering (entri terbaru di atas) | 🟢 aktif |
| [`BUG_TRACKER.md`](BUG_TRACKER.md) | Bug & regresi | 🟡 aktif, cek tanggal entri terakhir |

## 7. Archive (historis — jangan dipakai sebagai sumber kebenaran)

| Dokumen | Kenapa di-archive |
|---|---|
| [`archive/ARSITEKTUR.md`](archive/ARSITEKTUR.md) | Terjemahan Indonesia dari `ARCHITECTURE.md` (Juni 2026) — versi English sudah jadi kanonik, 0 referensi |
| [`archive/EXECUTION_STRATEGY.md`](archive/EXECUTION_STRATEGY.md) | Rencana eksekusi solo-founder, digantikan `PROJECT_ROADMAP.md` + `AGENTS.md` |
| [`archive/LAYER1_TEST_RESULTS.md`](archive/LAYER1_TEST_RESULTS.md) | Snapshot hasil test Layer 1 (Juni 2026) — angkanya sudah usang |
| [`archive/ops-dashboard-plan.md`](archive/ops-dashboard-plan.md) | Rencana Ops Dashboard (Juli 2026) — digantikan Terminal Center |
| [`archive/POS_REDIRECT_PLAN.md`](archive/POS_REDIRECT_PLAN.md) | Rencana redirect kasir (Agustus 2026) — sudah diimplementasikan, header dokumen masih bilang "belum" |
| [`archive/VOID_APPROVAL_PLAN.md`](archive/VOID_APPROVAL_PLAN.md) | Rencana void + PIN manager — **Langkah 1 selesai**; alur 2b (two-device `void_requests`) tidak pernah dikerjakan & tidak ada di roadmap |
| [`archive/CARRIED_BILLS_SHIFT_PLAN.md`](archive/CARRIED_BILLS_SHIFT_PLAN.md) | Rencana UX carried bills — selesai 2026-08-28 |
| [`archive/dokumen_pricing_wiremap.md`](archive/dokumen_pricing_wiremap.md) | Wiremap pricing di root — sudah ada versi terstruktur di `pricing/` |
| [`archive/pos/`](archive/pos/) | Spec desainer struk & roadmap POS (Juli 2026) — digantikan `RECEIPT_TEMPLATE_GUIDE.md` + engine template |
| [`archive/opencode_fix_guide.md`](archive/opencode_fix_guide.md) | Catatan instalasi OpenCode di devcontainer — bukan domain produk |

---

## Konvensi penamaan

- `*_ARCHITECTURE.md` — arsitektur kanonik, jarang berubah, tidak pernah "rencana".
- `*_PLAN.md` — rencana kerja; setelah selesai tetap disimpan (isi = keputusan/contract), tapi
  **diberi banner status** di paragraf pertama supaya jelas sudah beres atau belum.
- `*_REQUIREMENTS.md` / `*_GUIDE.md` — spesifikasi fitur, living spec.
- **Status dalam dokumen** selalu pakai: 🟢 aktif · 🟡 perlu review · ✅ selesai · ⚪ archived.

## Aturan pemeliharaan

1. Entri baru di `DAILY_LOG.md` selalu di **atas** (chronological, terbaru dulu).
2. Perubahan kontrak API → update `API_REFERENCE.md` **di commit yang sama** dengan kode.
3. Keputusan arsitektur baru → tulis di dokumen yang relevan; kalau lintas banyak dokumen, buat
   ADR terpisah (contoh: `HUB_V2_DECISIONS.md`).
4. Dokumen yang selesai & digantikan → `git mv` ke `archive/` **lalu update semua referensinya**
   di commit yang sama (jangan tinggalkan link mati).
