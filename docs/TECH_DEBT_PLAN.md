# Rencana Pengurangan Kompleksitas (Technical Debt Plan)

> Tanggal baseline: **2026-09-29** (setelah Fase 17 commit `ab80d14e`)
> Status: 🟢 **gate Fase 18 TERPENUHI** — **6/9 item selesai (T0, T1, T2, T3, T4, T5 — 2026-09-30)**. T0–T5 sudah hijau, jadi
> produk boleh lanjut Fase 18; debt pass tetap dilanjutkan (T6–T9) sebagai P1–P3.
> Catatan: dokumen ini adalah **satu-satunya** daftar pekerjaan pengurangan kompleksitas.
> Kalau ada item refactor yang dikerjakan di luar daftar ini, tambahkan di sini lebih dulu.

---

## 1. Kesimpulan eksekutif

Masalahnya bukan fitur. Yang rusak adalah **pagar regresi** dan **batas konteks kerja**:

| Gejala | Angka terukur | Akibat nyata |
|---|---|---|
| Composition root monolitik | `container.ts` 1.241 baris, 162 import, 38 deklarasi model | Satu tempat untuk salah urut; sulit direview |
| Constructor tidak terlindungi tipe | `PaymentService` 16 param **semua `any`**; `OrderController` 24 param | 1 kelas bug **sudah terjadi**: argumen geser → HTTP 500 produksi |
| File god | `GeneralSettingsPage` 1.749 · `TerminalCenterPage` 1.387 · `ReportPage` 1.368 · `ReportAggregation` 1.212 | Tidak muat di satu layar/context; perubahan = baca ulang semuanya |
| Pagar regresi **tidak nyata di CI** — **✅ diperbaiki T0** | `ci.yml` jalankan `pnpm vitest run` tanpa config root; job lint panggil `eslint` yang tidak terpasang | 1.249 test hanya "hijau" secara lokal |
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
| **T0** | Pagar regresi nyata: CI menjalankan suite sungguhan | 5 | 5 | **10** | S | **P0** ✅ |
| **T1** | `PaymentService` 16 param `any` → 1 deps object bertipe | 5 | 5 | **10** | M | **P0** ✅ |
| **T2** | `OrderController` 24 param → 1 deps object | 4 | 4 | **8** | S | **P0** ✅ |
| **T3** | `container.ts` 1.241 baris → wiring per domain | 5 | 4 | **9** | L | **P1** ✅ |
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

# endpoint & koleksi (baseline: 280 endpoint, 38 model)
grep -rn "router\.\(get\|post\|put\|delete\|patch\)" backend/src --include='*.routes.ts' | wc -l
ls backend/src/core/*/infrastructure/persistence/schemas/*.ts | wc -l
```

**Baseline 2026-09-29:** backend 367 file / 36.978 LOC · frontend 141 file / 28.529 LOC ·
shared 35 file / 1.288 LOC · test 67 file / 16.847 LOC · **1.249 test backend** (103 file) ·
**121 test frontend** (17 file) · 280 endpoint · 38 model · 48 service · 98 file domain ·
289 `: any` · 134 cast · 136 commit (48 Agu, 45 Sep).

> Diverifikasi ulang **2026-09-30** (sebelum T0): `pnpm -r build` + `pnpm -r test` hijau dengan
> angka identik — 1.249 (103 file) + 121 (17 file). Tidak ada angka baseline yang bergeser, jadi
> T0 tidak mengubah baseline.

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

#### Hasil T0 — 2026-09-30 ✅

Baseline diverifikasi ulang lebih dulu: `pnpm -r build` hijau, `pnpm -r test` hijau
(**backend 1.249/1.249 (103 file)** · **frontend 121/121 (17 file)**, persis angka dokumen).

| Yang diubah | Dari | Jadi |
|---|---|---|
| `ci.yml` step test | `pnpm vitest run` (di root) | `pnpm run test` → `pnpm -r --workspace-concurrency=1 test` |
| `ci.yml` job `lint` | `pnpm run lint` → `eslint` (tidak terpasang) | `pnpm run lint` → `tsc --noEmit` per paket, step bernama "Type check" |
| `backend` script `lint` | `eslint src/` | `tsc --build ../shared && tsc --noEmit` |
| `frontend` script `lint` | `eslint src/` | `tsc --noEmit` |
| Root `test` | `turbo run test -- --passWithNoTests` | `pnpm -r --workspace-concurrency=1 test` |
| Root `lint` | `turbo run lint` | `pnpm -r --workspace-concurrency=1 lint` |
| `turbo.json` | task `test`/`lint` bisa di-cache; task mati `test:unit`/`test:integration`/`typecheck`/`db:migrate`/`db:seed` | `test` & `lint` **`cache: false`** (agar tak ada "hijau" dari cache lokal), task mati dibuang, `seed` (`cache: false`) menggantikan `db:seed` |
| Root script mati | `dev:pos`, `dev:opsc` (filter `@kuire/*`), `build:packages` (`./packages/*`), `test:unit`, `test:integration`, `typecheck`, `lint:fix`, `db:migrate` | dihapus — filter/prefix-nya tidak pernah ada di repo ini |
| Root script salah arah | `dev:api`/`dev:web` filter `@kuire/api|web`; `db:seed` filter `@kuire/api`; `docker:*`/`infra:*` menunjuk `infrastructure/docker/…` | `@posmono/backend` · `@posmono/frontend`; `docker:up/down` → `docker/docker-compose.dev.yml`, `infra:up/down` → `docker/docker-compose.yml` (keduanya file itu memang ada) |

**Tiga keputusan yang menyimpang dari rencana awal — dan alasannya.**

1. **`--workspace-concurrency=1`.** Default `pnpm -r` menjalankan backend & frontend **bersamaan**
   (terbukti dari log: keduanya start `02:35:39`). Selain boros RAM, itu memunculkan warning
   `WebSocket server error: Port is already in use` dari dua instance vitest. Sekuensial: hilang,
   dan total hanya ~45 dtk. Turbo **tidak** dipakai untuk `test`/`lint` karena cache-nya bisa
   memunculkan "hijau" palsu tanpa eksekusi — justru yang harus dihapus oleh item ini.
2. **`lint` backend ikut membangun `shared`.** `backend/tsconfig.json` punya project reference ke
   `shared`, jadi `tsc --noEmit` tanpa `shared/dist` meledak **30 error `TS6305`** (terbukti).
   `tsc -b --noEmit` tidak bisa dipakai (`TS6310: Referenced project may not disable emit`).
   `tsc --build ../shared && tsc --noEmit` membuat `pnpm --filter @posmono/backend lint` jalan
   sendiri di clone segar. **Test suite tidak butuh ini** — resolve lewat `src/`, dibuktikan dengan
   suite penuh setelah `shared/dist` dihapus: tetap 1.249 + 121 hijau.
3. **Ruang lingkup sedikit lebih luas dari 4 script `dev:*`.** Semuanya satu kelas bug yang sama
   (script menunjuk sesuatu yang tidak pernah ada: filter paket, path compose, task turbo), jadi
   dibersihkan sekalian pada commit yang sama — tidak dicampur dengan item lain.

**Verifikasi (lokal, urutan sama dengan CI).**
`pnpm install` (lockfile tak berubah — hanya script) · `pnpm run build` ✅ · `pnpm run test` ✅ 1.249 + 121
· `pnpm run lint` ✅ · `pnpm run test` tanpa `shared/dist` ✅ · `git diff` hanya menyentuh
`ci.yml`, 3 × `package.json`, `turbo.json`, `README.md`, `docs/DEPLOYMENT.md`, `AGENTS.md`, dokumen ini.

**Utang yang tersisa dari T0 (sengaja, tidak diruvik di sini).**
- **CI belum pernah dieksekusi dari repo ini** (env ini tanpa Docker/network). Run pertama di
  GitHub Actions memakai Mongo **7.0** dari service, sedangkan lokal memakai mongod **7.3.4** dari
  `mongodb-memory-server`. Bedanya hanya versi minor + persistensi; kalau suite merah di sana,
  cek dulu `MONGO_URI`-related test, bukan asumsi.
- Service `redis` di job `test` tidak dipakai siapa pun (backend tidak punya dependency Redis).
  Dibiarkan: menghapus service container bukan bagian item ini.
- `turbo run build` masih dipakai (cache aman untuk build), jadi `pnpm run build` ≠ `pnpm run test`
  dalam hal cache — dan itu memang yang diinginkan.


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

#### Hasil T1 — 2026-09-30 ✅

| Yang diubah | Dari | Jadi |
|---|---|---|
| `PaymentService.ts` ctor | 16 param `any` (7 wajib + 9 opsional) | `constructor(private readonly deps: PaymentServiceDeps) {}` |
| Tipe dependency | `any` | `PaymentServiceDeps.ts` (baru): tiap slot `Pick<Konkret, 'method' \| …>`, 0 `any` |
| `this.<x>` | 86 kemunculan | `this.deps.<x>` (mekanis, diverifikasi lewat diff: hanya prefix yang berubah) |
| `grep -c ': any' PaymentService.ts` | **28** | **5** (sisa = callback internal `appliedRules`/return type, bukan dependency) |
| `container.ts` | `injector: () => ({ …16 slot… })` | `injector: () => ({ deps: { …16 slot bernama… } })` (pola `HubMemberAccessService`) |
| Call-site test | 9 file `new PaymentService(a, b, null as any, …)` | 9 file `new PaymentService({ nama: x, … })` |
| `PlatformSummaries.test.ts` | `(service as any).paymentRepository = repo` (menusuk field privat) | repo jadi argumen `makeService(repo)` |

**Tiga keputusan yang menyimpang dari rencana awal — dan alasannya.**

1. **`Pick<KelasKonkret, …>`, bukan port interface baru.** Rencana menyebut "memakai tipe domain
   yang sudah ada" (`PaymentRepository`, `TaxService`, …) — nama interface seperti itu **tidak ada**
   di repo ini untuk payment/order/user/shift. Menulis port interface untuk 9 repository hanya
   menduplikasi tanda tangan yang sudah dijaga `tsc`, dan tetap perlu di-drift-kan manual.
   `Pick<>` memberi hal yang sama (tiap slot punya nama + tanda tangan asli, typo ketahuan `tsc`)
   tanpa permukaan baru, dan precedent-nya sudah ada: `EntitlementService`/`BillingService`/
   `PrintingService` sudah mengimpor `Mongo*Repository` langsung. Konsekuensi yang **disukai**:
   perubahan tanda tangan di repository menjatuhkan wiring container saat compile, bukan saat runtime.
2. **Sembilan slot tetap opsional** (`?:`) persis seperti sebelumnya — beberapa jalur hanya butuh
   QRIS gateway, printer, shift enforcement, atau resolusi modifier, dan test membentuk service
   tanpa tool itu. Mengubahnya jadi wajib = perubahan perilaku di jalur yang tidak diuji.
3. **DoD `: any` 28 → ≤5 dijangkau dengan membetulkan 8 sisanya**, dan itu **tetap di dalam
   item ini** karena satu file: bucket agregasi `getPlatformPaymentsSummary` /
   `getPlatformPaymentsConsolidationByOutlet` (`perTenant: Record<string, any>`, `inc(bucket: any)`,
   6× `Object.entries(...).map(([method, v]: any) => …)`) diganti tipe lokal
   (`PaymentSummaryBucket`/`OutletPaymentSummaryBucket`/`TenantPaymentSummaryBucket` +
   `toPaymentMethodRows()`). **Anotasi saja** — bentuk objek, urutan key, dan isi tidak berubah;
   `PlatformSummaries.test.ts` (12 test) yang mengunci angka agregatnya tetap hijau tanpa perubahan
   ekspektasi. Sisa 5 `any` sengaja ditahan: itu return type/callback internal
   (`order: any` di hasil `payCash`, `appliedRules.map((rule: any) …)`), bukan dependency —
   membresihkannya = item "`any` yang tersisa" terpisah, bukan T1.

**Verifikasi (lokal, urutan sama dengan CI).**
`npx tsc --noEmit` ✅ 0 error · `npx vitest run tests/services/PaymentService.test.ts
tests/services/PaymentService.qris.test.ts` ✅ 34/34 · `npx vitest run tests/e2e
tests/integration/tenant-isolation.test.ts` ✅ 16/16 (money loop, void restore stok, carried bill,
DENY tenant) · `npx vitest run` ✅ **1.249/1.249 (103 file)** · `pnpm run build` ✅ ·
`pnpm run lint` ✅. **Tidak ada test yang dihapus, di-`skip`, atau dilewati**; satu-satunya
perubahan pada test adalah bentuk pemanggilan ctor (dan penghapusan satu poke field privat).

**Catatan jebakan yang ditemukan sambil mengerjakan.**
`tests/services/PlatformSummaries.test.ts` ternyata menusuk `(service as any).paymentRepository`
untuk menyuntik repo — pola itu **tidak akan menangkap** error wiring container mana pun, hanya
dibiarkan hidup oleh `any`. Sudah diganti jadi argumen eksplisit.

**Utang yang tersisa dari T1 (sengaja, tidak diruvik di sini).**
- 5 `any` sisa di `PaymentService.ts` (return type + callback internal) — belum masuk item mana pun
  di daftar T0–T9; biayanya kecil, tapi file yang sama sudah dua kali disentuh.
- `container.ts` masih `container.resolve()` **tanpa tipe** (awilix `any`), jadi isi `deps` produksi
  tidak di-check `tsc` — pagar sesungguhnya ada di kelas konkret yang jadi `Pick`, bukan di wiring.
  T3 (pisah wiring per domain) adalah tempat wajar memperkecil ini.

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

#### Hasil T2 — 2026-09-30 ✅

| Yang diubah | Dari | Jadi |
|---|---|---|
| `OrderController.ts` ctor | **23** param positional (19 use-case + 4 infra) | `constructor(private readonly deps: OrderControllerDeps)` |
| Tipe dependency | anotasi inline di ctor | `OrderControllerDeps.ts` (baru): `OrderUseCases` (19 × `Pick<Kelas, 'execute'>`) + 4 slot `Pick<Konkret, 'method'>`, 0 `any` |
| `this.<x>` | 25 kemunculan | `this.deps.<x>` (diverifikasi: dari 76 baris berubah, 53 adalah `this.deps`/baris ctor dan 23 adalah deklarasi param yang dihapus — **nol** perubahan statements) |
| Panjang file | 530 baris | **482** baris (import blok 19 baris pindah ke file deps) |
| `container.ts` | `injector: () => ({ …23 slot… })` | `injector: () => ({ deps: { …23 slot bernama… } })` |
| `tests/helpers/integration.ts` | `new OrderController(createOrderService, s.update, …)` 23 argumen | `new OrderController({ createOrderService, updateOrderService: s.update, … })` |
| `OrderControllerDeps.ts` | — | `grep -c ': any'` = 0 (file baru); `OrderController.ts` juga 0 |

**Dua keputusan yang menyimpang dari rencana awal — dan alasannya.**

1. **Dua interface dengan `extends`, bukan 23 field datar.** Rencana memberi opsi ini dan melarang
   `this.deps.useCases.x`. Yang dipakai: `OrderUseCases` berisi 19 use-case, lalu
   `OrderControllerDeps extends OrderUseCases` menambah 4 slot infra. Call site tetap rata
   (`this.deps.createOrderService.execute`) — jadi tidak ada hop tambahan, tapi 19 use-case
   punya tempat sendiri di grep/IDE, dan bisa di-reuse kalau nanti ada controller lain
   (mis. print/order split) yang butuh use-case yang sama.
2. **`OrderController.ts` kehilangan 19 import use-case.** Setelah tipe pindah ke
   `OrderControllerDeps.ts`, `tsc` akan menandai import itu unused; membiarkannya berarti
   controller masih menarik seluruh modul use-case tanpa alasan. 530 → 482 baris.

**Verifikasi (lokal, urutan sama dengan CI).**
`npx tsc --noEmit` ✅ 0 error · `npx vitest run tests/integration` ✅ **133/133 (12 file)** ·
`npx vitest run` ✅ **1.249/1.249 (103 file)** · `pnpm run build` ✅ · `pnpm run lint` ✅.
Route `createOrderRoutes` tidak disentuh sama sekali, jadi kontrak HTTP tidak berubah; tidak ada
test yang dihapus, di-`skip`, atau diberi ekspektasi baru.

**Efek samping yang justru memperbaiki utang lama.** `AGENTS.md` merekam bahwa harness pernah
menusuk argumen yang bergeser (mis. "OrderController 24 arg") dan itu baru ketahuan saat test merah
dengan `undefined.execute`. Dengan named deps, argumen yang lupa diisi tidak mungkin lagi bergeser —
nama yang salah akan jadi `TypeError` di `tsc`, bukan di produksi.

**Utang yang tersisa dari T2 (sengaja, tidak diruvik di sini).**
- Dua constructor 8-param tersisa (`AuthService`, `DatabaseService`) **tidak masuk** daftar T0–T9;
  jumlahnya kecil dan di bawah ambang P0. Baru digabung kalau item berikutnya menyentuh file itu.
- 19 use-case order masih dikelompokkan di **satu** file `OrderService.ts` (≈980 baris). Membelah
  file itu = item tersendiri; `OrderUseCases` sengaja hanya typing, tidak mengubah isi file.

---

### T3 — `container.ts` 1.241 baris → wiring per domain · **P1** · D5 R4 · Effort L

**Bukti.** `backend/src/bootstrap/container.ts`: 162 import, 38 deklarasi
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

**DoD.** `container.ts` ≤ 200 baris · semua 38 deklarasi model hanya di `models.ts` ·
`buildContainer()` resolve identik (dibuktikan `tests/integration/provisioning.test.ts`, satu-satunya
pemanggil `buildContainer()`) · **urutan** `container.register` tidak berubah untuk
`eventBus`/`connectionManager` (keduanya `Lifetime.SINGLETON`, urutan memengaruhi waktu koneksi) ·
`routes.ts` tidak tersentuh.

**Verifikasi.**
`cd backend && npx tsc --noEmit` · `npx vitest run tests/integration/provisioning.test.ts` · `npx vitest run`

**Risiko & mitigasi.** **Tinggi dari semua item** — menyentuh tempat semua hal bertemu. Syarat
eksplisit: **T0 sudah hijau** (suite jalan di CI) dan diff per domain_small supaya `git revert`
nyata mungkin. Jangan pernah mencampur T3 dengan item lain dalam satu commit.

#### Hasil T3 — 2026-09-30 ✅

| Yang diubah | Dari | Jadi |
|---|---|---|
| `container.ts` | **1.241** baris, 162 import, 1 `register` raksasa | **81** baris, 31 import, 22 call `register<Domain>Wiring` |
| Deklarasi model | 36 (`systemConnection.model(...)`) | **38** di `wiring/models.ts` (baseline plan salah hitung — lihat catatan) + `registerModels()` untuk 31 `asValue` |
| `bootstrap/wiring/` | — | **24 file**: `models.ts`, `types.ts`, 22 domain |
| `routes.ts` | 100% di `container.ts` | **0 byte tersentuh** |

Commit per domain_small (urutan = urutan dikerjakan): `467e33f2` (models) · `0dfe055b` (printing,
promotion, upload) · `855d4f2c` (identity, tenant) · `cc00d868` (catalog, inventory) ·
`e7800c3e` (pos, customer, settings, tax, pricing, discount) · `cad92690` (reporting, template,
database) · `2b9f3937` (hub, outlet, platform, billing) · `b327cee5` (ordering, payment).
Tidak ada satu pun commit yang mencampur T3 dengan item lain.

**Bukti `buildContainer()` resolve identik — bukan "test hijau berarti aman".**
Selain `provisioning.test.ts`, kunci registrasi dibandingkan secara mekanik antara
`container.ts` versi pra-T3 dan gabungan `container.ts` + `wiring/*.ts`:
**168 kunci sebelum vs sesudah** (136 `asClass` + 31 model `asValue` + `eventBus`) —
nol hilang, nol tambahan, nol duplikat, dan `eventBus`/`connectionManager` tetap dua
registrasi pertama. Inilah yang membuktikan DoD "resolve identik" tanpa harus menebak.

**Tiga keputusan yang menyimpang dari rencana awal.**

1. **Baseline plan salah hitung: 38 deklarasi model, bukan 36.** Angka itu hasil hitung
   `connection.model` sambil membaca cepat. Setelah diekstrak otomatis ternyata 38
   (`QrisInvoice`, `DiscountConfiguration`, `PromoCode`, `DailyMetric`, `PlatformAuditLog`,
   `ProvisioningRun`, `SubscriptionHistory` termasuk). Tepatnya: 7 model itu memang ada tapi
   hanya dipakai langsung oleh injector, tidak pernah `asValue` — itu sebabnya angka lama meleset.
2. **`registerModels(container, models)` tambahan.** Rencana hanya menyebut `buildModels`.
   Tanpa helper ini, 31 `asValue` model harus didaftarkan ulang di orkestrator, jadi
   `container.ts` akan kembali menyimpan inventaris model — persis masalah yang item ini
   maksudkan selesaikan. Helper-nya hidup di `models.ts`, bukan di orkestrator.
3. **`WiringContext.systemConnection` opsional.** `PlatformCleanupService` menerima
   `connection`, bukan model, jadi `platform` butuh handle mongoose mentah. Dibuat opsional
   supaya 21 wiring lain tak perlu menyalinnya.

**Catatan yang jadi komentar di kode, bukan sekadar urutan baris.** Selama pemindahan,
`container.register` yang urutan domainnya "kebetulan benar" ternyata menyiratkan kontrak
yang belum pernah ditulis. Tiga di antaranya:
- `ordering` ⇄ `payment` saling bergantung (`orderController` resolve `paymentRepository`,
  `paymentService` resolve `orderRepository`). Aman **hanya** karena resolve lazy di dalam
  `injector`; reference eager akan membuat salah satunya tak pernah ter-resolve.
- `databaseService` sengaja memakai model mentah, bukan repository, supaya job maintenance
  tetap jalan saat repository di atasnya bermasalah.
- Tripel akses hub (`hubMembershipRepository` + `hubMembershipService` + grant Fase 17
  `hubMemberAccessService`) tidak boleh digabung: anggota dengan nol grant jatuh ke fallback
  akses legacy yang luas, dan itu perilaku yang disengaja selama Fase 18/19 belum selesai.

**Verifikasi (lokal, urutan sama dengan CI).**
`npx tsc --noEmit` ✅ 0 error · `npx vitest run tests/integration/provisioning.test.ts` ✅ 4/4 ·
`npx vitest run` ✅ **1.249/1.249 (103 file)** · `npx vitest run` frontend ✅ **121/121 (17 file)** ·
`pnpm run lint` ✅ · `pnpm run build` ✅. Tidak ada test yang dihapus, di-`skip`, atau diberi
ekspektasi baru.

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

#### Hasil T4 ✅ — commit `35c86ac7` (2026-09-30)

| | Sebelum | Sesudah |
|---|---|---|
| `pages/GeneralSettingsPage.tsx` | 1.749 | **95** |
| File section | 0 | **9** (`sections/<Name>Section.tsx`) |
| Pemilik alur simpan | 1 fungsi di dalam halaman | 1 (`hooks/useSettingsSave.ts`) |
| `Array<any>` di helper tax config | 2 | **0** (`ITaxRule[]` / `IChargeConfig[]`) |

Struktur: `sections/` (9 section + `settingsSections.tsx` untuk registry sidebar),
`components/` (`SettingsTopBar`, `SettingsSidebar` — chrome shell),
`hooks/useSettingsDraft.ts` (state draft + 2 efek init, dikelompokkan per section),
`hooks/useSettingsSave.ts` (satu-satunya pemilik alur simpan), `utils/`.

**Bukti "pemindahan, bukan penulisan ulang"**: blok JSX ke-9 dicek ulang dengan
pembandingan baris-demi-baris terhadap versi sebelum refactor — 8 dari 9 **cocok
byte-per-byte**. Pengecualian satu-satunya ada di `TaxRulesSection` dan memang
dipaksa compiler: begitu `activeRules` bertipe `ITaxRule[]` (bukan `Array<any>`),
dua baris gagal strict check dan diperbaiki dengan `?? 0` + dua cast `as number`
(`undefined > 0` ≡ `0 > 0` ≡ false; cast menjaga propagasi NaN yang sudah ada).

State milik tiap section ikut pindah ke section-nya (form aturan pajak, form biaya,
form profil harga, status uji QRIS, pilih logo struk) — masing-masing hanya dipakai
satu section, jadi tidak ada state bersama yang terpecah. `qrisConfigComplete`
ditarik ke `utils/qris.ts` supaya definisi "config QRIS lengkap" punya satu
definisi, dipakai halaman dan hook simpan.

Verifikasi: tsc 0 error · frontend 121/121 (17 file) · vite build OK · backend
1249/1249 (103 file) · `pnpm -r lint` bersih. Smoke test render halaman **tetap
menunggu T8** (belum ada test render untuk halaman ini).

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
yang langsung terasa**.

#### Hasil T5 ✅ — commit `b970dd70` (2026-09-30)

| | Sebelum | Sesudah |
|---|---|---|
| `pages/TerminalCenterPage.tsx` | 1.387 | **105** |
| Komponen lokal di halaman | 8 | **0** (7 section + 2 modal di `platform/sections/`) |
| Test frontend | 17 file / 121 | **18 file / 131** (`TenantsSection.test.tsx`, 10 test) |

Struktur: `platform/sections/` (7 file), `platform/utils/dates.ts`
(`todayISO`/`Next30DaysAgo`), `StatCard` masuk `platformUi.tsx`. Sisa di
halaman benar-benar milik shell: `TABS` + `visibleTabs` + fallback `activeTab`,
state lintas tab, header & tab bar. Tab filtering tidak berubah — logikanya
verbatim.

Tiga hal yang **bukan** pemindahan murni dan sengaja dicatat:

- `inputCls`, `cardCls`, `SectionTitle`, `Loading` di halaman lama adalah
  salinan `platformUi.tsx` yang sudah ada (konten identik) — sekarang di-import.
- `AUDIT_ACTION_LABELS`/`AUDIT_ACTION_BADGE` pindah bersama `AuditSection`:
  state filter-nya memang sudah di-lift ke halaman sejak Fase 15, labelnya
  hanya dipakai section itu.
- Modul `platform/sections/import` menyatu `PlansSection` + `HubsSection`
  (sudah di file sendiri) dengan 7 file baru — satu nama folder untuk semua tab.

Jebakan test yang ditemukan sambil menulis test (bukan dari kode produksi):
`vi.clearAllMocks()` **tidak** mengembalikan `mockImplementation`. Override Swal
di test "alasan suspend wajib diisi" bocor ke test berikutnya, membuat test
extend & delete gagal dengan input kosong. Default dialog sekarang dipasang
ulang di `beforeEach` — pola ini akan dipakai ulang di T6/T8.

Verifikasi: tsc 0 error · frontend 131/131 (18 file) · vite build OK · backend
1249/1249 (103 file) · `pnpm -r lint` bersih.

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
| Constructor ≥ 8 param positional | 5 | 0 _(T1+T2: sisa 2)_ |
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
T0 (pagar) ✅ →  T1 (PaymentService)  →  T2 (OrderController)  →  T3 (container)
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
| Constructor ≥ 8 param | 5 | **0** _(T1+T2: 2 tersisa di `src` — `AuthService` 8, `DatabaseService` 8)_ |
| `container.ts` | 1.241 baris | ≤ 200 _(T3: **81**)_ |
| File `src` > 1.000 baris | 4 (`GeneralSettings`, `TerminalCenter`, `ReportPage`, `ReportAggregation`) | **0** |
| `backend/src` `: any` | 289 | ≤ 120 |
| CI menjalankan test | ❌ tidak | ✅ ya _(T0 — `pnpm run test`; belum pernah dijalankan di GitHub Actions)_ |
| File test frontend | 17 | ≥ 23 |
| Test total | 1.249 + 121 | ≥ 1.349 + 145 |

Target test total naik karena T8 menambah test, bukan karena ada fitur baru.

---

## 8. Definition of Done — seluruh plan

- [x] T0–T3 selesai, suite hijau pada commit bersih (bukan hanya lokal). _(T0, T1, T2, T3 selesai 2026-09-30 — **gate Fase 18 terpenuhi**; CI di GitHub Actions sendiri masih belum pernah dieksekusi)_
- [ ] T4–T6 selesai: 3 god page ≤ 300 masing-masing. _(T3: `container.ts` **81 baris**; T4: `GeneralSettingsPage` **1.749 → 95 baris**; T5: `TerminalCenterPage` **1.387 → 105 baris** — sisa T6 `ReportPage` 1.368)_
- [ ] T7–T9 selesai: `: any` ≤ 120; test frontend naik; `pnpm budget` hijau di CI.
- [ ] `docs/HUB_ARCHITECTURE.md` Fase 18 dibuka (gate terpenuhi), `HUB_V2_FRONTEND_PLAN.md`
      di-unfreeze per plan.
- [ ] Baseline §3 di-update ke angka baru, tanggal baru.

---

## 9. Catatan & jebakan yang sudah diketahui

- **`shared/dist` harus di-rebuild** (`cd shared && npx tsc`) setiap kali `shared/src` berubah,
  kalau tidak backend/frontend compile dari `.d.ts` basi dan muncul error palsu. Tiga jebakan
  yang sudah terukur saat T0:
  1. `tsc --noEmit` di backend **butuh** `shared/dist` (project reference) → 30 error `TS6305`
     kalau hilang; karena itu script `lint` backend diawali `tsc --build ../shared`.
  2. `tsc -b --noEmit` **tidak** bisa dipakai sebagai pengganti (`TS6310: Referenced project may
     not disable emit`).
  3. **Test suite tidak butuh `shared/dist`** (resolve lewat `src/`), jadi `pnpm test` aman di
     clone segar — jangan ikut panik saat `dist` kosong.
- **Jangan pernah `pnpm vitest run` di root.** Tidak ada `vitest.config.*` di root, jadi
  `backend/vitest.config.ts` (`pool:'forks'`, `maxForks:1`) & config frontend **terabaikan** —
  persis bug yang ditutup T0. Selalu `pnpm test` (root) atau `pnpm -r test`.
- **Cache turbo bisa membuat "hijau" palsu** untuk `test`/`lint`; keduanya sudah `cache: false`
  di `turbo.json`. Kalau suatu saat caching ditambahkan, jangan pernah di dua task ini.
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
