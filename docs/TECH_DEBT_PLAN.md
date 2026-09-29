# Rencana Pengurangan Kompleksitas (Technical Debt Plan)

> Tanggal baseline: **2026-09-29** (setelah Fase 17 commit `ab80d14e`)
> Status: 🟡 **aktif** — 0/9 item selesai. Fase 18 **terblokir** sampai T0–T2 selesai.
> Catatan: dokumen ini adalah **satu-satunya** daftar pekerjaan pengurangan kompleksitas.
> Kalau ada item refactor yang dikerjakan di luar daftar ini, tambahkan di sini lebih dulu.

---

## 1. Kesimpulan eksekutif

Masalahnya bukan fitur. Yang rusak adalah **pagar regresi** dan **batas konteks kerja**:

| Gejala | Angka terukur | Akibat nyata |
|---|---|---|
| Composition root monolitik | `container.ts` 1.241 baris, 162 import, 36 deklarasi model | Satu tempat untuk salah urut; sulit direview |
| Constructor tidak terlindungi tipe | `PaymentService` 16 param **semua `any`**; `OrderController` 24 param | 1 kelas bug **sudah terjadi**: argumen geser → HTTP 500 produksi |
| File god | `GeneralSettingsPage` 1.749 · `TerminalCenterPage` 1.387 · `ReportPage` 1.368 · `ReportAggregation` 1.212 | Tidak muat di satu layar/context; perubahan = baca ulang semuanya |
| Pagar regresi **tidak nyata di CI** | `ci.yml` jalankan `pnpm vitest run` tanpa config root; job lint panggil `eslint` yang tidak terpasang | 1.249 test hanya "hijau" secara lokal |
| Type safety tergerus | 289 `: any` + 134 cast (`strict: true` → semua opt-out sadar) | Salah nama lolos compile, mati saat runtime |
| UI uang tanpa test | 17 file test untuk 141 file source; `PosPage`/`PaymentModal`/3 god page tanpa test | Refactor halaman = tanpa jaring pengaman |

**Yang justru sudah kuat dan tidak boleh dibongkar:** 1.249 test backend, falsaf **"test DENY
wajib"**, ADR D1–D4, dan modularitas domain yang jelas (98 file domain, 48 service). Yang rusak
adalah **yang perekat**, bukan yang domain.

**Kesimpulan satu kalimat:** hentikan menambah fitur selama 4–6 sesi, perbaiki pagarnya dulu
(T0), lalu turun ke bagian bawahnya (T1–T3), baru lanjut Fase 18.

---

## 2. Skala prioritas

Empat tingkat. Tiap item punya skor agar urutannya bisa dipertanggungjawabkan, bukan dari
"mood hari itu".

| Tingkat | Definisi | Kapan dikerjakan | Syarat lanjut |
|---|---|---|---|
| **P0 — Pagar** | Kalau rusak, semua pekerjaan lain bisa lolos ke produksi tanpa terdeteksi. Termasuk kelas bug yang **sudah terbukti** mahal. | Sekarang, sebelum fitur baru | Wajib hijau di CI, bukan hanya lokal |
| **P1 — Batas konteks** | File/constructor yang secara harfiah tidak muat di satu layar. Pemecahan **mekanis** (pindah/balik nama), tidak mengubah perilaku. | Setelah P0 | Suite hijau, diff enak direview |
| **P2 — Pertahanan kedalaman** | Menguatkan apa yang sudah jalan: tipe di jalur uang, test UI uang, pagar anti-regresi. | Setelah P1, selagi belum ada fitur baru | Angka membaik, budget hijau |
| **P3 — Polish** | Nyaman, bukan prioritas. Tidak ada risiko nyata kalau tidak dikerjakan. | Hanya kalau ada sisa kapasitas | — |

### Penentuan skor

| Faktor | Skala | Arti |
|---|---|---|
| **D** — Dampak | 1–5 | Seberapa besar rasa sakit atau kebocoran yang hilang kalau item ini beres |
| **R** — Risiko sekarang | 1–5 | Seberapa besarKemugnian kalau **tidak** dikerjakan |
| **Skor** | `D + R` (2–10) | Angka urut; seri dipecah oleh effort, bukan asal urutan |
| **Effort** | S / M / L | S ≈ 1 sesi (2–4 jam) · M ≈ 2–3 sesi · L ≈ 4–6 sesi |

### Papan item

| ID | Item | D | R | Skor | Effort | P |
|---|---|---|---|---|---|---|
| **T0** | Pagar regresi nyata: CI menjalankan suite sungguhan | 5 | 5 | **10** | S | **P0** |
| **T1** | `PaymentService` 16 param `any` → 1 deps object bertipe | 5 | 5 | **10** | M | **P0** |
| **T2** | `OrderController` 24 param → 1 deps object | 4 | 4 | **8** | S | **P0** |
| **T3** | `container.ts` 1.241 baris → wiring per domain | 5 | 4 | **9** | L | **P1** |
| **T4** | `GeneralSettingsPage` 1.749 → shell + 9 section | 4 | 2 | **6** | M | **P1** |
| **T5** | `TerminalCenterPage` 1.387 → 7 file section | 3 | 2 | **5** | S | **P1** |
| **T6** | `ReportPage` 1.368 → 1 file per report type | 3 | 2 | **5** | M | **P1** |
| **T7** | Ketik jalur uang: buang `: any` di dependency | 4 | 2 | **6** | L | **P2** |
| **T8** | Test frontend untuk money path + 3 smoke test god page | 5 | 2 | **7** | M | **P2** |
| **T9** | Budget kompleksitas otomatis (anti-regresi) | 3 | 3 | **6** | S | **P2** |

> T9 sengaja ditaruh di P2 meski skornya lumayan: ia hanya berguna **setelah** T1–T6, karena
> angka batasnya baru berarti kalau batasannya sudah diturunkan.

---

## 3. Cara mengukur ulang baseline

Jalankan dari root. Angka di dokumen ini harus bisa diverifikasi ulang, bukan dipercaya.

```bash
# LOC per area (ekskl. test)
for d in backend/src frontend/src shared/src; do
  echo "$d: $(find $d \( -name '*.ts' -o -name '*.tsx' \) ! -name '*.test.*' | wc -l) file, \
$(find $d \( -name '*.ts' -o -name '*.tsx' \) ! -name '*.test.*' | xargs wc -l | tail -1)"
done

# 15 file terbesar
find backend/src frontend/src \( -name '*.ts' -o -name '*.tsx' \) ! -name '*.test.*' \
  | xargs wc -l | sort -rn | sed -n '2,16p'

# jumlah ': any' backend  (baseline: 289)
grep -rn ": any" backend/src --include='*.ts' | wc -l

# constructor dengan >= 8 param positional  (baseline: 5)
#   PaymentService 16 | OrderController 24 | AuthService 9 | DatabaseService 9 | ReportAggregation 8
#   (dari 200 constructor; 5 sudah memakai gaya deps-object)

# endpoint & koleksi (baseline: 280 endpoint, 36 schema)
grep -rn "router\.\(get\|post\|put\|delete\|patch\)" backend/src --include='*.routes.ts' | wc -l
ls backend/src/core/*/infrastructure/persistence/schemas/*.ts | wc -l
```

**Baseline 2026-09-29:** backend 367 file / 36.978 LOC · frontend 141 file / 28.529 LOC ·
shared 35 file / 1.288 LOC · test 67 file / 16.847 LOC · **1.249 test backend** (103 file) ·
**121 test frontend** (17 file) · 280 endpoint · 36 schema · 48 service · 98 file domain ·
289 `: any` · 134 cast · 136 commit (48 Agu, 45 Sep).

---

## 4. Item pekerjaan

### T0 — Pagar regresi nyata (CI) · **P0** · D5 R5 · Effort S

**Bukti.** `.github/workflows/ci.yml`:

- Step test menjalankan `pnpm vitest run` **di root**, dan root tidak punya `vitest.config.*`.
  Artinya `backend/vitest.config.ts` (`pool:'forks'`, `maxForks:1` — wajib agar
  mongodb-memory-server kehabisan RAM) **tidak dipakai**, dan kedua suite bisa dijalankan
  dalam satu proses.
- Job `lint` menjalankan `pnpm run lint` → `eslint src/`, tapi **tidak ada file konfigurasi
  ESLint** dan eslint tidak ada di `devDependencies` backend/frontend. Job itu pasti gagal.
  `AGENTS.md` sudah jujur soal ini: "No ESLint config found; rely on TypeScript checks".
- Root script `dev:api|web|pos|opsc` menyaring paket `@kuire/*` yang tidak pernah ada.

**Target.** Command yang dipakai CI = command yang benar-benar dipakai manusia:

1. `ci.yml` test → `pnpm -r test` (satu package satu proses, config per paket terpakai).
2. `lint` di `backend`/`frontend` → `tsc --noEmit` (konvensi yang sudah dipakai repo) sampai
   ESLint benar-benar dipasang; hapus script `dev:*` yang filter `@kuire/*`.
3. Job `docker` tidak berubah.

**Langkah.**

1. Ubah step test CI → `pnpm -r test`.
2. Ubah script `lint` di `backend` & `frontend` → `tsc --noEmit`.
3. Hapus 4 script root `dev:*` yang memfilter `@kuire/*` (atau ganti filter ke `backend`/`frontend`).
4. Jalankan pipeline secara lokal persis seperti CI: `pnpm -r build && pnpm -r test`.

**DoD.** `pnpm -r test` di lokal melaporkan 1.249 + 121 test hijau; `pnpm -r build` hijau;
tidak ada job CI yang bergantung pada tool yang tidak terpasang.

**Verifikasi.** `cd /workspace && pnpm -r build && pnpm -r test` · `git diff .github/workflows/ci.yml`

**Risiko & mitigasi.** Rendah (hanya CI). Yang perlu diwaspadai: kalau `pnpm -r test` ternyata
menjalankan dua mongod sekaligus dan RAM habis — itu sebabnya `vitest.config.ts` per paket dibatasi
(`maxForks:1`): dipanggil sebagai satu proses per paket oleh turbo, bukan digabung.

---

### T1 — `PaymentService`: 16 param `any` → 1 deps object bertipe · **P0** · D5 R5 · Effort M

**Bukti.** `backend/src/core/payment/application/services/PaymentService.ts`:

```
constructor(paymentRepository: any, orderRepository: any, refundRepository: any,
            tenantRepository: any, taxService: any, discountService: any, eventBus: any,
            receiptRenderService?: any, inventoryService?: any, userRepository?: any,
            shiftRepository?: any, printService?: any, qrisGatewayService?: any,
            productRepository?: any, modifierRepository?: any, categoryRepository?: any)
```

16 slot, **semuanya `any`**. Tidak ada satu pun tipe yang bisa protect urutan slot. Kelas bug ini
sudah sekali menyala: saat ctor membesar, `taxService` menggeser ke slot `tenantRepository` →
HTTP **500** `taxResult.charges.reduce is not a function` (tercatat di `AGENTS.md` § E2E).

**Target.** `PaymentServiceDeps` — interface dengan **nama** untuk setiap slot, memakai tipe
domain yang sudah ada (`PaymentRepository`, `OrderRepository`, `TaxService`, `EventBus`, …) dan
mempertahankan sifat opsional. Ctor jadi `constructor(private readonly deps: PaymentServiceDeps) {}`.
Pola persis sudah ada di `HubMemberAccessService` (lihat `container.ts:1094-1105` —
`injector: () => ({ deps: { … } })`), jadi tidak ada pola baru yang perlu dirancang.

**Langkah.**

1. Tulis `backend/src/core/payment/application/services/PaymentServiceDeps.ts`.
2. Ubah ctor jadi `constructor(private readonly deps: PaymentServiceDeps) {}`.
3. Ganti `this.<x>` → `this.deps.<x>` di seluruh file (mekanis; `tsc` yang menyalah-nama).
4. Ubah registrasi `container.ts` ke `asClass(PaymentService, { injector: () => ({ deps: {...} }) })`.
5. Update `backend/tests/helpers/integration.ts` + test yang meng-`new PaymentService(...)` manual.
6. Jalankan money suite: `PaymentService`, `PaymentService.qris`, `hub-fase17-access`,
   `e2e/critical-path-flows` (skenario money loop, void, carried bill).

**DoD.** `constructor` file ini ≤ 1 param · 0 `any` pada tipe di `PaymentServiceDeps` ·
`grep -c ': any' PaymentService.ts` turun dari **28 → ≤ 5** (sisa = callback internal, diberi
komentar) · endpoint & perilaku tidak berubah (suite hijau tanpa test yang dihapus/di-`skip`).

**Verifikasi.**
`cd backend && npx tsc --noEmit` ·
`npx vitest run tests/services/PaymentService.test.ts tests/services/PaymentService.qris.test.ts tests/e2e/critical-path-flows.test.ts`

**Risiko & mitigasi.** Sedang — diff lebar tapi tanpa mengubah logika. Mitigasi: tidak boleh ada
satu pun `test.skip` atau penghapusan test supaya item ini hijau; kalau ada test yang harus diubah,
itu bukti ada perilaku yang tidak sengaja berubah.

---

### T2 — `OrderController`: 24 param → 1 deps object · **P0** · D4 R4 · Effort S

**Bukti.** 24 param: 19 use-case + `orderRepository` + `paymentRepository` + `tenantRepository`
+ `invoiceRenderService`. Membengkak dari 19 use-case yang ditambahkan bertahap — tidak ada
yang menyadarinya sampai 24.

**Target.** `OrderControllerDeps`. Kalau 24 field datar terasa seperti memindahkan masalah,
pakai dua interface (`OrderUseCases` + `OrderControllerDeps` yang merangkumnya) — **tapi** jangan
mengubah call-site jadi `this.deps.useCases.x` di item ini; itu pekerjaan terpisah (P3).

**Langkah.** Tulis interface → ubah ctor → ganti `this.x` → update `container.ts` dan
`tests/helpers/integration.ts` (harness saat ini menyebut "OrderController 24 arg") → suite.

**DoD.** ctor ≤ 1 param · controller tetap ≤ 700 baris · suite hijau · tidak ada perubahan rute.

**Verifikasi.** `cd backend && npx tsc --noEmit` · `npx vitest run tests/integration`

**Risiko & mitigasi.** Rendah–sedang; mekanis total. `AGENTS.md` sudah merekam harness test
pernah tersesat karena argumen bergeser — refactor ini justru menghapus penyebabnya.

---

### T3 — `container.ts` 1.241 baris → wiring per domain · **P1** · D5 R4 · Effort L

**Bukti.** `backend/src/bootstrap/container.ts`: 162 import, 36 deklarasi
`systemConnection.model(...)` + `syncIndexes()` + migrasi, lalu satu `container.register({ … })`
raksasa. Import per domain: catalog 20 · identity 15 · payment 13 · hub 11 · billing 11 ·
template 10 · platform 10 · inventory 10 · … 21 domain lain.

**Target.**

- `bootstrap/wiring/models.ts` — `buildModels(connection)` mengembalikan objek seluruh model
  (satu-satunya tempat `systemConnection.model()` dipanggil) + `syncIndexes()` + migrasi.
- `bootstrap/wiring/<domain>.ts` — `export function register<Domain>Wiring({ container, models, eventBus })`.
- `container.ts` → orkestrator: models → panggil N wiring → `return container`. Target ≤ 200 baris.

**Langkah (urutan sengaja — ringan dulu, commerce terakhir).**

1. `models.ts` (pindah murni, tidak mengubah urutan deklarasi).
2. 3 domain paling ringan untuk membuktikan pola: `printing`, `promotion`, `upload`.
3. `identity`, `catalog`, `tenant`, `settings`, `tax`, `pricing`.
4. **Terakhir** `payment` & `ordering` (dependensi silang terbanyak; T1/T2 sudah menyiapkan call-site-nya jadi deps-object, jadi ini jauh lebih murah daripada kalau T3 duluan).

**DoD.** `container.ts` ≤ 200 baris · semua 36 deklarasi model hanya di `models.ts` ·
`buildContainer()` resolve identik (dibuktikan `tests/integration/provisioning.test.ts`, satu-satunya
pemanggil `buildContainer()`) · **urutan** `container.register` tidak berubah untuk
`eventBus`/`connectionManager` (keduanya `Lifetime.SINGLETON`, urutan memengaruhi waktu koneksi) ·
`routes.ts` tidak tersentuh.

**Verifikasi.**
`cd backend && npx tsc --noEmit` · `npx vitest run tests/integration/provisioning.test.ts` · `npx vitest run`

**Risiko & mitigasi.** **Tinggi dari semua item** — menyentuh tempat semua hal bertemu. Syarat
eksplisit: **T0 sudah hijau** (suite jalan di CI) dan diff per domain_small supaya `git revert`
nyata mungkin. Jangan pernah mencampur T3 dengan item lain dalam satu commit.

---

### T4 — `GeneralSettingsPage` 1.749 → shell + 9 section · **P1** · D4 R2 · Effort M

**Bukti.** 9 section inline (`profile`, `tax`, `discount`, `tax-rules`, `pricing-profiles`,
`rounding`, `qris`, `charges`, `receipt`), **0 komponen lokal**. `handleSave` dipakai bersama
oleh semua section — sekarang jadi tanggung jawab yang terpecah di satu fungsi besar.

**Target.** `core/settings/sections/<Name>Section.tsx` (satu file per section) +
`core/settings/hooks/useSettingsSave.ts` sebagai pemilik tunggal alur simpan (kirim patch
tenant config, toast sukses/gagal). Halaman jadi shell: sidebar section + render section aktif.

**DoD.** halaman ≤ 250 baris · tiap section di file sendiri · `handleSave` ada di satu tempat ·
smoke test render halaman ada (bagian T8) · tidak ada nilai default yang berubah.

**Verifikasi.** `cd frontend && npx tsc --noEmit` · `npx vitest run` · `npx vite build`

**Risiko & mitigasi.** Rendah–sedang. Halaman ini belum punya test render, jadi andalkan
`tsc` + `vite build` + smoke test T8. Saat memindah, **jangan** menyalin logika — pindahkan
JSX apa adanya; setiap perbedaan logika ditunda ke commit terpisah.

---

### T5 — `TerminalCenterPage` 1.387 → 7 file section · **P1** · D3 R2 · Effort S

**Bukti.** Pola sudah terbukti berhasil: `PlansSection` & `HubsSection` sudah di file sendiri.
Yang masih inline: `TenantsSection` (±311 baris), `OutletsSection`, `SummarySection`,
`ConsolidatedSection`, `AuditSection`, `CreateTenantModal`, `CreateOutletModal`.

**Target.** Semua pindah ke `core/platform/sections/`. Halaman hanya shell tab + permission gate
(`visibleTabs`, `activeTab` fallback) yang sekarang sudah benar.

**DoD.** halaman ≤ 300 baris · semua section file sendiri · minimal satu test (`TenantsSection`),
mengikuti pola `HubsSection.test.tsx` · tab filtering tidak berubah.

**Risiko & mitigasi.** Rendah — ini **pemindahan**, logika tidak disentuh. Contoh item "murah, tapi banyak
yang langsung terasa".

---

### T6 — `ReportPage` 1.368 → 1 file per report type · **P1** · D3 R2 · Effort M

**Bukti.** 10 `ReportType` (`daily`, `sales`, `finance`, `profit-loss`, `sales-per-product`,
`refunds`, `cashier-receipts`, `sales-per-cashier`, `inventory-summary`, `payment-reconciliation`)
semuanya di satu component.

**Target.** `core/reports/sections/<Type>Section.tsx` + `ReportShell` (filter tanggal + tombol
export, dipakai bersama — sudah ada `ExportButtons`, jangan diduplikasi).

**DoD.** halaman ≤ 300 baris · satu section per file · tidak ada logika format duplikat
(tarik ke `utils/format` yang sudah ada) · smoke test render halaman.

**Risiko & mitigasi.** Rendah–sedang. `ReportPage` punya banyak tab yang berbagi state
filter tanggal — pastikan state filter **naik** ke `ReportShell`, jangan diduplikasi per section.

---

### T7 — Ketik jalur uang (buang `: any` di dependency) · **P2** · D4 R2 · Effort L

**Bukti.** `tsconfig` sudah `strict: true` + `noImplicitAny: true` → setiap `: any` adalah
**opt-out yang disengaja**. Teratas: `OrderService` 53 · `PaymentService` 28 ·
`PlatformController` 25 · `ReportAggregation` 14.

**Target.** Dependency memakai interface domain yang sudah ada (`PaymentRepository`,
`OrderRepository`, `TaxService`, …). Urutan: **dependency dulu** (ini yang memblokir refactor
lain), baru callback internal. `OrderService` (53) adalah yang terbesar, tapi bukan yang paling
tergesa — ambil setelah T1, karena `PaymentServiceDeps` yang baru adalah tempat alami untuk
meletakkan tipe itu.

**DoD.** `PaymentService` & `OrderService`: 0 `: any` pada tipe dependency ·
sisa `any` (callback, aggregate dynamic) dikomentari alasannya · tidak ada `as any` baru.

**Verifikasi.** `cd backend && npx tsc --noEmit` · `grep -rn ': any' backend/src | wc -l` (baseline 289, target ≤ 120 setelah semua P2)

**Risiko & mitigasi.** Sedang. Memperkenalkan tipe yang benar bisa memunculkan **`tsc` error lama**
(yang selama ini ditelan `any`) — itu gunanya: error lama itu bug tersembunyi. Reaksinya: **tangkap**,
jangan `as any` balik.

---

### T8 — Test frontend untuk money path + smoke test god page · **P2** · D5 R2 · Effort M

**Bukti.** 17 file test untuk 141 file source. Tidak ada test untuk `PosPage`,
`PaymentModal`, `ReportPrintModal`, `GeneralSettingsPage`, `ReportPage`,
`TerminalCenterPage`. Test hook (`useProfitLossReport`, `useInventorySummaryReport`,
`useQrisPayment`) sudah ada — polanya sudah ada, tinggal cakupan.

**Target (urutan nilai/usaha).**

1. `PaymentModal` — auto-print trigger, handler `applyPaymentResult` (kembalian dari rounding),
   jalur QRIS confirm.
2. `ReportPrintModal` — baris pembulatan + footer (regresi "Pembulatan hilang" pernah terjadi).
3. `posStore` — kasus rounding + `closeBillAfterPayment` (kasus "bill nyangkut" yang pernah jadi bug).
4. Smoke test render untuk 3 god page (menjaga T4–T6).

**DoD.** ≥ 1 test untuk setiap money path di atas · 3 smoke test halaman · `npx vitest run`
frontend hijau · tidak ada test yang hanya menguji mock tanpa perilaku.

**Verifikasi.** `cd frontend && npx vitest run`

**Risiko & mitigasi.** Rendah; hanya menulis test. Smoke test cukup "render tidak crash + label
utama ada" — jangan buildsnapshot besar yang rapuh.

---

### T9 — Budget kompleksitas otomatis (anti-regresi) · **P2** · D3 R3 · Effort S

**Bukti.** Tanpa pagar angka, god file & ctor 24-param akan kembali dalam 2–3 bulan —
pola lama creeping back begitu tidak ada yang menolak.

**Target.** `scripts/complexity-budget.mjs` (Node murni, tanpa dependency) + `pnpm budget` yang
**gagal** kalau ada:

| Aturan | Baseline | Batas |
|---|---|---|
| `container.ts` | 1.241 | ≤ 200 |
| `GeneralSettingsPage.tsx` | 1.749 | ≤ 250 |
| `TerminalCenterPage.tsx` | 1.387 | ≤ 300 |
| `ReportPage.tsx` | 1.368 | ≤ 300 |
| Constructor ≥ 8 param positional | 5 | 0 |
| `backend/src` total `: any` | 289 | ≤ 120 (turunkan bertahap per T7) |
| File `src` > 1.000 baris | 4 | 0 |

Jalankan di `.github/workflows/ci.yml` setelah T0, di step sendiri (`complexity budget`).

**DoD.** `pnpm budget` hijau di commit baseline (angka batas = angka **setelah** T1–T6, bukan
sekarang — kalau disetel ke angka sekarang, dia hanya mendokumentasikan Leaderboard yang ada) ·
sengaja menaikkan satu angka → `pnpm budget` merah (bukti bukan rubber stamp) · step CI hijau.

**Verifikasi.** `node scripts/complexity-budget.mjs` · `git diff .github/workflows/ci.yml`

**Risiko & mitigasi.** Rendah. Yang perlu diwaspadai: **jangan** setel batas terlalu ketat
sehingga_ci_marah di commit berikutnya; naikkan batas dengan alasan tertulis, jangan diam-diam.

---

## 5. Urutan eksekusi

```
T0 (pagar)  →  T1 (PaymentService)  →  T2 (OrderController)  →  T3 (container)
                                                                   │
                        ┌──────────────────────────────────────────┘
                        ▼
        T4 (Settings)  ·  T5 (Terminal Center)  ·  T6 (Reports)      ← boleh paralel
                        │
                        ▼
        T7 (ketik jalur uang)  →  T8 (test money path)  →  T9 (budget)
```

**Aturan main.**

1. **Satu item = satu commit.** Kalau sebuah commit refactor ikut mengubah perilaku → itu bukan
   refactor, itu bug; pisahkan.
2. **Jangan mulai item baru sebelum item sebelumnya hijau** (yang “hijau” = suite lokal + `tsc`
   + build, dan setelah T0 juga CI).
3. **Satu item per sesi.** Refactor yang digabung fitur selalu setengah jadi dua.
4. **T3 tidak boleh dicampur** dengan item lain; kalau diff-nya > ~400 baris, pecah per domain.
5. **GATE Fase 18:** T0 + T1 + T2 selesai. Setelah itu produk boleh jalan lagi.

**Perkiraan total:** ~4–6 sesi terfokus (T0+T2+T5+T9 ≈ 4 sesi S; T1+T4+T6+T8 ≈ 8–10 sesi M;
T3+T7 ≈ 10 sesi L). Setara ~2–3 minggu kerja terfokus, atau ~1–2 minggu kalau lebih sering.

---

## 6. Tidak dikerjakan — dan alasannya

| Tidak | Alasan |
|---|---|
| Pecah jadi microservice | Modular monolith sudah punya batas domain yang jelas; 280 endpoint belum butuh network hop. Overhead > manfaat. |
| Tambah test coverage admin/CRUD non-uang | Nilai lebih rendah dibanding money path; cukup smoke test. |
| Pasang ESLint penuh sekarang | P3. Repo sudah memakai `tsc` sebagai linter (konvensi di `AGENTS.md`); ESLint baru jadi perlu kalau `tsc` ternyata tak cukup. T0 menggantinya dengan `tsc` dulu — **jangan** menambah dependency di tengah debt pass. |
| Pecah `Order.ts` (941 baris) | Masih sehat sebagai satu aggregate. Pecah aggregate = crafting keramik, bukan refactor. |
| Ganti DI library (tsyringe/reflect-metadata) | Awilix + pola `injector: () => ({ deps })` sudah cukup setelah T1–T2. Ganti library = 1.249 test jadi eksperimen. |
| Ubah `ReportAggregation` (1.212 baris) | Punya batas alami (per-report) tapi butuh waktu panjang; catat sebagai P3. Batas T9 hanya menahan
**pertumbuhan**, tidak memaksa turun. |

---

## 7. Metrik: apa yang harus turun

| Metrik | Baseline (2026-09-29) | Target setelah plan |
|---|---|---|
| Constructor ≥ 8 param | 5 | **0** |
| `container.ts` | 1.241 baris | ≤ 200 |
| File `src` > 1.000 baris | 4 (`GeneralSettings`, `TerminalCenter`, `ReportPage`, `ReportAggregation`) | **0** |
| `backend/src` `: any` | 289 | ≤ 120 |
| CI menjalankan test | ❌ tidak | ✅ ya |
| File test frontend | 17 | ≥ 23 |
| Test total | 1.249 + 121 | ≥ 1.349 + 145 |

Target test total naik karena T8 menambah test, bukan karena ada fitur baru.

---

## 8. Definition of Done — seluruh plan

- [ ] T0–T2 selesai, CI hijau pada commit bersih (bukan hanya lokal).
- [ ] T3–T6 selesai: `container.ts` ≤ 200; 3 god page ≤ 300 masing-masing.
- [ ] T7–T9 selesai: `: any` ≤ 120; test frontend naik; `pnpm budget` hijau di CI.
- [ ] `docs/HUB_ARCHITECTURE.md` Fase 18 dibuka (gate terpenuhi), `HUB_V2_FRONTEND_PLAN.md`
      di-unfreeze per plan.
- [ ] Baseline §3 di-update ke angka baru, tanggal baru.

---

## 9. Catatan & jebakan yang sudah diketahui

- **`shared/dist` harus di-rebuild** (`cd shared && npx tsc`) setiap kali `shared/src` berubah,
  kalau tidak backend/frontend compile dari `.d.ts` basi dan muncul error palsu.
- **`PaymentService` 16 param bertanda `any` weil** repo pernah `strict: true` tapi DI-nya `any`
  semua — artinya slot order **tidak** dijaga tipe sama sekali. T1 menutup ini; sebelum itu, setiap
  perubahan ctor harus diuji `PaymentService.test.ts` + `e2e/critical-path-flows`.
- **Urutan `container.register` affects** `eventBus`/`connectionManager` (SINGLETON). Saat T3
  memindah wiring, **jangan** mengurutkan ulang.
- **Test yang hang tanpa error** adalah kelas kegagalan sendiri (loop render, bukan flaky). Kalau
  `vitest run` timeout tanpa output, isolasi per-`it` (`-t`) sebelum curiga memory.
- **D3 fallback & keamanan berada di jalur kode yang sama** — lihat `HUB_ARCHITECTURE.md`
  § "Keputusan runtime Fase 17". Refactor T1–T3 **tidak boleh** menyentuh logika
  `switchTenant`/`isGrantStillLinked`.
