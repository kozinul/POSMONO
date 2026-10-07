# Rencana — Member Area Langganan (Merchant)

> **Status:** 🟡 direncanakan (belum ada kode) · **Tanggal:** 2026-10-07 (revisi 1 — 2026-10-07)
> **Konteks:** billing module (`core/billing/`) sudah punya `Plan`/`Subscription`/`SubscriptionHistory`/
> `Entitlement` (`Fase 14`, 2026-09-14) dan masa aktif efektif (`2026-10-07`). Belum ada invoice
> dan pembayaran untuk langganan; merchant juga belum punya halaman untuk melihatnya.
> **Efek:** menambah `SubscriptionInvoice` + `PaymentAttempt`, endpoint merchant & platform,
> halaman `/langganan`, dan RBAC `settings.billing.read`. **Wallet/VA/auto-renewal TIDAK
> diimplementasi di fase ini** — kontraknya dideklarasikan (§ Arah Target & § Non-goals) supaya
> MVP ini tidak mengunci desain billing jangka panjang.

Dokumen ini mengunci **keputusan produk + kontrak** untuk member area langganan sebelum kode
ditulis. Urutan kerja mengikuti pola repo: **domain → permission → API → UI**, satu commit satu
fase.

---

## Ringkasan Keputusan

| # | Keputusan | Status |
|---|---|---|
| **K1** | Invoice & pembayaran = **data nyata** (`SubscriptionInvoice` + `PaymentAttempt`), bukan derivasi ledger riwayat | Terkunci |
| **K2** | Member area = **halaman baru `/langganan`** + nav item "Langganan" (bukan section `/settings`) | Terkunci |
| **K3** | Aksi **"Perpanjang"** mandiri tersedia (ubah `POST /tenants/current/subscription/renew` menjadi **invoice-first**) | Terkunci |
| **K4** | Halaman diakses **Owner & Manager** saja → aktifkan permission `settings.billing.read` | Terkunci |
| **K5** | **Invoice ≠ Payment ≠ Wallet ledger.** `PaymentAttempt` one-to-many per invoice (bisa gagal/expired/berhasil); `WalletTransaction` adalah pencatatan uang sebenarnya — layer terpisah | Terkunci |
| **K6** | **Renew = invoice-first**: merchant minta perpanjang → buat invoice `pending` → setelah settlement sukses → subscription diperpanjang. Admin assign/change/extend tetap langsung (uang sudah diterima offline) + settle via PaymentAttempt | Terkunci |

---

## Konteks: apa yang sudah ada (recon 2026-10-07)

| Komponen | Status | Lokasi |
|---|---|---|
| `Plan` (basePrice, billingCycle, modules, limits, addOns) | ada | `core/billing/domain/Plan.ts` |
| `Subscription` (planId, status, billingCycle, currentPeriodStart/End, autoRenew, …) | ada | `core/billing/domain/Subscription.ts` |
| `SubscriptionHistory` (action `assigned|changed|extended|cancelled|expired`, **tanpa nominal**) | ada | `core/billing/domain/SubscriptionHistory.ts` |
| `EntitlementService` (plan+sub+modules+limits; fallback Trial) | ada | `core/billing/application/services/EntitlementService.ts` |
| Merchant endpoints `GET …/subscription`, `…/entitlement`, `POST …/renew` | ada (authenticate-only) | `tenant.routes.ts` · `subscription.routes.ts` |
| **Invoice/payment langganan** | **belum ada** (0 kemunculan; 0 di `core/billing`) | — |
| Tipe `Invoice`/`InvoiceLineItem` di shared | **mati** (0 pemakai) — siap diadopsi | `shared/src/types/domain/billing.ts` (L52–71) |
| Tipe `Subscription` di shared | **drifted** (kurang `startedAt/trialEndsAt/autoRenew/assignedAt/cancellationReason`) | `shared/src/types/domain/billing.ts` |
| Halaman merchant untuk langganan | **belum ada** (hanya `SubscriptionBanner`) | — |
| Pembayaran dicatat manual oleh admin Kuire (self-service checkout NONAKTIF by design) | fakta bisnis | docs billing (Fase 14) |
| Permission `settings.billing.read` / `.update` | **didefinisikan tapi mati** (0 referensi) | `shared/src/constants/permissions.ts` |

### Catatan penting dari recon

1. `SubscriptionService.recordHistory` **tidak pernah menyimpan nominal** — ledger bukan invoice.
2. Tidak ada "tagihan" yang pernah dibuat; uang berjalan **di luar sistem** (Kuire menagih manual).
   Artinya pencatatan pembayaran = **platform admin** merekam pembayaran yang sudah diterima →
   direpresentasikan sebagai `PaymentAttempt` `completed`.
3. `InvoiceRenderService` terikat keras ke `IOrder` (template A4) — **tidak dipakai** untuk invoice
   langganan di fase ini.
4. Frontend `PlatformSubscriptionHistoryEntry.action` **drifted** — belum punya `'expired'`
   (backend domain+schema sudah punya).
5. **Visi jangka panjang (dari pemilik produk, 2026-10-07):** Member Area → Wallet → Top Up →
   VA/Payment Gateway → Auto Renewal (saldo dipotong → invoice paid → subscription diperpanjang).
   Dokumen ini didesain agar MVP manual **tidak mengunci** visi tersebut (lihat § Arah Target).

---

## Arah Target: Member Area + Wallet + VA + Auto-Renewal

Diagram target 4 layer — MVP fase ini mengimplementasi **3 layer atas** (sebagian) dan hanya
**mendeklarasikan kontrak** layer Wallet:

```
                    ┌──────────────────┐
                    │   SUBSCRIPTION   │   Plan · Subscription · Entitlement · SubscriptionHistory
                    └────────┬─────────┘
                             │ extend / change
                             ▼
                    ┌──────────────────┐
                    │     INVOICE      │   SUB-2026-0001 · durable billing document (nominal + periode)
                    └────────┬─────────┘
                             │ attempt (banyak, boleh gagal)
                             ▼
                    ┌──────────────────┐
                    │  PAYMENT ATTEMPT │   VA / QRIS / gateway / manual · pending → completed | expired | failed
                    └────────┬─────────┘
                             │ settlement sukses → catat pergerakan uang
                             ▼
                    ┌──────────────────┐
                    │      WALLET      │   balance + ledger (WalletTransaction) — layer FINANSIAL, TERPISAH
                    └────────┬─────────┘
                             │ auto-renewal: cek saldo → debit → mark paid → extend
                             ▼
                    ┌──────────────────┐
                    │  AUTO RENEWAL    │   job/sweep (kandidat: perluas subscriptionSweep)
                    └──────────────────┘
```

Prinsip kuncinya: **invoice ≠ payment ≠ wallet transaction** — tiga dokumen berbeda dengan
siklus hidup berbeda:

| Konsep | Mewakili | Siklus | One-to-many? |
|---|---|---|---|
| `SubscriptionInvoice` | tagihan yang sah ("utang" tenant ke Kuire) | pending → paid/overdue/cancelled | 1 proposal tagihan |
| `PaymentAttempt` | usaha bayar sebuah invoice | pending → completed \| expired \| failed | **banyak per invoice** |
| `WalletTransaction` | pergerakan uang sebenarnya (ledger finansial) | append-only | banyak per wallet |

**Akibat desain:** kalau nanti ada VA/gateway, satu invoice bisa punya `payment_attempt #1 → expired`,
`#2 → failed`, `#3 → completed`. Kalau ada wallet, `SUBSCRIPTION_RENEWAL` di ledger = sumber
perpanjangan, dan `PaymentAttempt` menggambar "attempt" dari wallet. Invoice tetap dokumen yang
sama — **tidak perlu breaking change**.

---

## Arsitektur data (MVP: 2 dokumen baru di `core/billing`)

### `SubscriptionInvoice` — collection `subscription_invoices`

```ts
type SubscriptionInvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

interface ISubscriptionInvoice {
  id: string;
  tenantId: string;
  subscriptionId: string | null;
  number: string;                       // SUB-<YYYY>-<seq> (per tenant)
  status: SubscriptionInvoiceStatus;
  amount: number;
  currency: 'IDR';
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;                        // = periodEnd
  paidAt: Date | null;
  lineItems: Array<{ description: string; amount: number; quantity: number; total: number }>;
  referenceType: 'plan_assigned' | 'plan_changed' | 'renewal' | 'extended';
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

- **Adopsi + perluas** tipe mati `Invoice`/`InvoiceLineItem` di `shared/src/types/domain/billing.ts`
  (tambah `periodStart/periodEnd`, `currency`, `referenceType`, `notes`). **Align ulang** `Subscription`
  shared dengan `ISubscription` backend.
- **Nomor invoice**: `SUB-<YYYY>-<seq>` per tenant, `seq = countDocuments({ tenantId }) + 1`,
  index unique `{ tenantId, number }` + **retry `E11000`** (aksi billing jarang & admin-initiated).
- **Status `overdue` diturunkan saat dibaca** (`pending && dueDate < now`), gaya lazy-gate masa aktif
  (`Tenant.isExpired`) — tanpa sweep baru.
- **Dibuat** (best-effort, pola `recordHistory` — gagal ≠ gagal operasi billing):
  - `assignPlan` (assign/change) → full `plan.basePrice`, line item "Plan {name} — {periode}".
  - `extendSubscription` / **renew merchant (invoice-first)** → `round(basePrice × days/30)`,
    line item "Perpanjangan {N} hari". **Belum** memperpanjang subscription — lihat K6 & § Alur.
  - **Skip** bila hasil `amount === 0` (Trial).
  - **Tidak dibuat** saat `sweepExpired`, `cancelSubscription`, atau update status.
- **Tidak ada prorasi mid-cycle** pada `plan_changed` (invoice full `basePrice` plan baru) — Batas #1.

### `PaymentAttempt` — collection `payment_attempts` (pengganti rencana `SubscriptionPayment`)

```ts
type PaymentAttemptStatus = 'pending' | 'completed' | 'expired' | 'failed';

interface IPaymentAttempt {
  id: string;
  tenantId: string;
  invoiceId: string;
  number: string | null;                // PAY-<seq> per tenant (NULL utk attempt gateway pra-persist?)
  amount: number;
  method: PaymentMethod | 'wallet';     // reuse shared PaymentMethod + 'wallet' utk masa depan
  status: PaymentAttemptStatus;
  gateway: {
    provider: string | null;            // 'manual' | 'va' | 'qris' | 'gateway-x' | 'wallet'
    txId: string | null;                // gateway transaction id / referensi bank
    vaNumber: string | null;
    qrUrl: string | null;
  } | null;
  actorEmail: string | null;            // admin Kuire utk attempt manual
  notes: string | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

- **One-to-many per invoice** — index `{ tenantId, invoiceId, startedAt }`, **TIDAK** ada unique
  `invoiceId` seperti rencana lama (itu yang mengunci 1:1).
- **Settlement rule (Satu pemilik):** sebuah invoice menjadi `paid` **hanya** saat satu attempt
  mencapai `completed`, dan **hanya satu attempt boleh completed** per invoice. Claim dilakukan
  **atomik** (`findOneAndUpdate` filter `status ∉ {paid, cancelled}`) — attempt yang kalah race
  **tetap dipersist sebagai `failed`** sebagai trail pembayaran.
- **Trail lengkap:** attempt yang ditolak karena invoice sudah paid / dibatalkan / nominal tidak
  cocok **juga dicatat `failed`** (double-pay tidak pernah "hilang" dari riwayat).
- **MVP manual:** admin Kuire mencatat attempt `manual`/`cash`/`transfer` → `completed` → invoice
  paid (**+ extend bila `referenceType='renewal'`** — lihat `recordPaymentAttempt`).
- **Masa depan (tidak diimplementasi sekarang):** attempt `pending` dari gateway VA/QRIS,
  polling status (pola `QrisGatewayService.checkStatus`), `expired`/`failed` → invoice tetap
  `pending` sampai ada attempt completed.

### Settlement hook — `SubscriptionBillingService.recordPaymentAttempt`

```text
recordPaymentAttempt(tenantId, invoiceId, attemptInput)
   │  validasi: invoice milik tenant · status pending/overdue · amount === invoice.amount
   │  validasi: invoice belum paid / belum cancelled (double-settle DENY)
   ▼
attempt.status = completed · invoice.markPaid() atomik (yang kalah race → attempt.failed + throw)
   ▼
JIKA invoice.referenceType === 'renewal'  →  subscriptionService.extendSubscription(tenantId, days, context)
   (days = ceil((periodEnd − periodStart) / 1 hari) — bukan dari lineItems/notes)
   referenceType 'plan_assigned' | 'plan_changed' | 'extended'  →  TIDAK extend (uang sudah
   diterima offline; settle hanya menandai lunas — mencegah double-extension pada admin extend)
```

- Satu tempat eksekusi "uang diterima → layanan diperpanjang". Ini juga titik colok auto-renewal
  di masa depan (wallet debit → `recordPaymentAttempt` → extend), tanpa mengubah kontrak invoice.
- **Deviasi dari draf awal**: draf memakai `'extended'` sebagai pemicu extend; implementasi memakai
  **`'renewal'`** (invoice-first merchant + auto-renewal masa depan), karena `'extended'` adalah aksi
  admin yang uangnya sudah diterima — settle `'extended'` tidak boleh memperpanjang ulang.

---

## Alur (perubahan penting dari desain lama)

### A. Merchant minta perpanjang (invoice-first — K6)

```text
[Member Area] tombol 'Perpanjang' (days = 30)
   ▼
POST /tenants/current/subscription/renew  { days }
   ▼
Buat SubscriptionInvoice pending (referenceType 'renewal', amount = round(basePrice × days/30))
   (TIDAK langsung memperpanjang subscription)
   ▼
Response: { invoice } → UI menampilkan "Menunggu pembayaran"
```

### B. Settlement manual (admin Kuire)

```text
Terminal Center → tab Invoice → 'Catat Pembayaran' { amount, method, referenceNumber? }
   ▼
POST /api/platform/tenants/:tenantId/subscription/invoices/:invoiceId/pay
   ▼
PaymentAttempt completed → invoice paid → (bila 'renewal') subscription diperpanjang
   + SubscriptionHistory action 'extended' (alasan 'Pembayaran diterima (manual)')
```

### C. Assign / change / extend oleh admin (tetap langsung — uang sudah diterima offline)

```text
POST /api/platform/tenants/:tenantId/subscription  { planId, billingCycle }
   ▼
Subscription diubah + tenant aktif
   ▼
SubscriptionInvoice pending dibuat (best-effort) — admin lalu 'Catat Pembayaran' untuk settle
```

### D. Auto-renewal (MASA DEPAN — kontrak, bukan implementasi)

```text
Sweep/job (perluas subscriptionSweep atau job baru)
   ▼
Cek Subscription.expiring (currentPeriodEnd dalam X hari) + Wallet.balance
   ▼
Kecukupan saldo:
   - cukup → create renewal invoice → PaymentAttempt method 'wallet' →
            wallet ledger SUBSCRIPTION_RENEWAL → recordPaymentAttempt → extend
   - kurang → invoice pending → (opsional) reminder; subscription berakhir & sweepExpired jalan
```

---

## Backend

### Commit 1 — shared types + domain + repos + service (+ wiring)

- `shared/src/types/domain/billing.ts` → hidupkan `Invoice`/`InvoiceLineItem` + align `Subscription`
  + (opsional) tipe baru `PaymentAttemptStatus`. **Rebuild wajib**:
  `cd shared && npx tsc` (backend/frontend resolve `@posmono/shared` ke `shared/dist`).
- `core/billing/domain/SubscriptionInvoice.ts` + `PaymentAttempt.ts` (metode `markPaid`, `cancel`,
  `isOverdue(now?)`; attempt: `complete()`, `fail()`, `expire()`).
- `schemas/SubscriptionInvoiceSchema.ts` + `PaymentAttemptSchema.ts` + repos
  `MongoSubscriptionInvoiceRepository` / `MongoPaymentAttemptRepository`. Daftar model di
  `bootstrap/wiring/models.ts` + sync index.
- **`SubscriptionBillingService`** (baru, `core/billing/application/services/`) — **tidak**
  membesarkan `SubscriptionService` (ctor 4 posisi; semangat T1/T2 = named deps):
  - `createInvoiceForPlan(tenant, sub, plan, kind)` / `createInvoiceForExtend(...)` (skip amount 0)
  - `listInvoices(tenantId)` → `{ items, totals: { outstanding, paid } }`
  - `listPaymentAttempts(tenantId, invoiceId?)` → `{ items }` (member area = attempt `completed`)
  - `recordPaymentAttempt(tenantId, invoiceId, { amount, method, referenceNumber?, notes?, actorEmail? })`
    → validasi + settle atomik (+ extend bila `referenceType='renewal'`; attempt yang ditolak/dikalahkan
    race dicatat `failed`)
  - `cancelInvoice(tenantId, invoiceId, reason)` (hanya pending/overdue)
  - Wiring deps object di `bootstrap/wiring/billing.ts`.
- Pemanggil pembuatan invoice (**setelah mutasi sukses**):
  `SubscriptionController.assignPlan` & `.extendSubscription` (platform),
  `PlatformController.extendTenantSubscription` (jalur hub-managed),
  `TenantController.renewSubscription` (merchant — invoice-first, bukan extend).

### Commit 2 — endpoints + RBAC (+ migrasi)

Merchant (guard `authenticate` + `authorize('settings.billing.read')`):

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/tenants/current/subscription/invoices` | `{ success, data: { items, totals } }` |
| GET | `/api/tenants/current/subscription/payments` | `{ success, data: { items } }` — attempt completed |
| GET | `/api/tenants/current/subscription/history` | proxy `getTenantSubscriptionHistory` **+ perbaiki limit** (sekarang hardcode 100, `?limit` diabaikan) |
| POST | `/api/tenants/current/subscription/renew` | **semantik berubah**: `{ days }` → buat invoice pending (bukan extend langsung). Response `{ invoice }` |

- **Gate `settings.billing.read` juga** ke `GET …/subscription`, `GET …/entitlement`, dan
  `POST …/renew` (tidak ada caller frontend yang terpengaruh saat ini — konsisten Owner/Manager).

Platform / Terminal Center (guard `platformAuthenticate` + `platformAuthorize`):

| Method | Path | Permission |
|---|---|---|
| GET | `/api/platform/tenants/:tenantId/subscription/invoices` | `platform.tenants.read` |
| GET | `/api/platform/tenants/:tenantId/subscription/invoices/:invoiceId/payments` | `platform.tenants.read` (list attempt) |
| POST | `/api/platform/tenants/:tenantId/subscription/invoices/:invoiceId/pay` | `platform.tenants.manage` (audit `SUBSCRIPTION_INVOICE_PAID`) |
| POST | `/api/platform/tenants/:tenantId/subscription/invoices/:invoiceId/cancel` | `platform.tenants.manage` (audit `SUBSCRIPTION_INVOICE_CANCELLED`) |

RBAC:

- Tambah `settings.billing.read` ke `OWNER_PERMS` + `MANAGER_PERMS`
  (`core/platform/defaults/roles.ts`), dan pastikan bundle role hub-grant (Fase 17
  `TENANT_ACCESS_ROLE_PERMS`) untuk `owner/admin/manager` ikut.
- **Migrasi boot idempotent** `migrateTenantBillingRead(RoleModel)` (pola
  `migratePlatformHubPermissions`) — `$addToSet` `settings.billing.read` ke role tenant
  ber-code `owner`/`manager` (role existing di DB tak otomatis ikut perubahan defaults).
- ⚠️ **Release note: wajib re-login** (permission di-embed di access+refresh JWT).

---

## Frontend

### Commit 3 — halaman `/langganan` + tab invoice Terminal Center

- `frontend/src/@shared/hooks/useSubscription.ts`:
  - `useMyEntitlement()` (`['tenant-entitlement']`, stale 5m), `useMyInvoices()`,
    `useMyPayments()`, `useMySubscriptionHistory()` (tipe aksi **termasuk `expired`** — perbaikan drift),
    `useRenewSubscription()` → **POST renew invoice-first**; invalidate `['tenant']` + entitlement + invoices.
  - Tipe `MyInvoice`/`MyPaymentAttempt`/`MySubscriptionHistoryEntry`; `Invoice` diimpor dari `@posmono/shared`.
- Halaman `core/subscription/` (pola `reportCatalog`/`settingsSections`):
  - `pages/SubscriptionPage.tsx` (shell) + `sections/`:
    - **Overview** — kartu plan + harga/bulan, badge status, bar kemajuan masa aktif
      (`currentPeriodStart/End` dari entitlement + `daysRemaining` dari `useTenant`), tombol
      **"Perpanjang"** (SweetAlert2, input hari default 30, pesan Indonesia, invalidate setelah
      sukses, lalu tampilkan invoice `pending` + "Menunggu pembayaran — hubungi tim Kuire"),
      catatan "Pembayaran dicatat oleh tim Kuire".
    - **Modules & Limits** — dari entitlement.
    - **Invoice** — tabel (nomor, periode, nominal via `formatCurrency`, badge
      pending/paid/overdue/cancelled), total outstanding & terbayar, modal detail + print
      `window.print()` (tanpa template engine A4 — Batas #3).
    - **Pembayaran** — tabel attempt completed (tanggal, metode via `paymentLabels`, nomor, nominal),
      empty state dengan catatan.
    - **Riwayat Langganan** — event assigned/changed/extended/cancelled/expired + tanggal + alasan.
  - `router.tsx`: lazy route `/langganan` di dalam `DashboardLayout`; nav
    `{ name: 'Langganan', href: '/langganan', permission: 'settings.billing.read' }`.
- Terminal Center `TenantDetailModal` → sub-blok **Invoice** di tab "Plan & Langganan":
  daftar invoice + list attempt + tombol **"Catat Pembayaran"** (Swal: nominal/metode/ref) +
  **"Batalkan"**; hooks baru di `usePlatform.ts` (`usePlatformTenantInvoices`,
  `usePlatformRecordInvoicePayment`, `usePlatformCancelInvoice`, `usePlatformInvoicePayments`).

---

## Tests (wajib: DENY *dan* ALLOW di jalur uang)

| Layer | Casus |
|---|---|
| Domain | `SubscriptionInvoice.test.ts` (markPaid/cancel/isOverdue), `PaymentAttempt.test.ts` (complete/fail/expire; selesaikan hanya sekali) |
| Service | `SubscriptionBillingService.test.ts` — generate skip amount 0 (Trial), totals list; **DENY**: invoice tenant lain, amount mismatch, double-pay (attempt kedua completed saat invoice paid), cancel yang sudah paid, attempt `completed` setelah ada attempt completed; ALLOW: 1×completed settle + extend (referenceType extended), attempt failed/expired TIDAK settle, overdue derived |
| Repo | `MongoSubscriptionInvoiceRepository.test.ts` + `MongoPaymentAttemptRepository.test.ts` (persist, index, E11000) |
| Integration HTTP | `subscription-member-area.test.ts` — merchant list invoices/payments/history (Owner 200 / **Cashier 403**); **renew invoice-first**: `POST renew` → invoice pending, `GET subscription` expiry TIDAK berubah; platform pay → invoice paid + subscription extended + payment tampil; **isolasi tenant** (invoice tenant lain 404); RBAC platform 401/403 |
| RBAC | defaults/roles: `settings.billing.read` masuk OWNER/MANAGER (+ bundle hub grant) |
| Frontend | `useSubscription.test.tsx`, `SubscriptionPage.test.tsx` (render + alur renew → invoice pending), hook Terminal Center |

---

## Commit structure (satu fase satu commit)

1. `feat(billing): subscription invoice & payment attempt — shared types, domain, repos, SubscriptionBillingService (recordPaymentAttempt + invoice-first)`
2. `feat(billing): endpoint member area + rename renew jadi invoice-first + pencatatan pembayaran Terminal Center + RBAC settings.billing.read`
3. `feat(ui): halaman /langganan (status, masa aktif, invoice, pembayaran, riwayat) + tab invoice Terminal Center`

## Verifikasi

- `pnpm lint` (tsc dua sisi — **rebuild `shared/dist` dulu** bila `shared/src` berubah)
- `pnpm test` di `backend/` + `frontend/` (jangan `pnpm vitest run` di root; `pnpm -r test` dipakai CI)
- `pnpm budget` hijau (`: any` ≤ 200/200, baris file, ctor)
- `vite build` OK
- Sync docs: `AGENTS.md` (entri baru), `API_REFERENCE.md` (endpoint + permission + gate + **semantik renew berubah** — commit yang sama dengan kode), `PROJECT_ROADMAP.md`, `BACKLOG.md` (`Invoice/billing portal` → `[x]` parsial)

---

## Batas & asumsi (default terpilih, bisa direvisi)

1. **Change plan = full `basePrice`** tanpa prorasi mid-cycle (kandidat refinement bersama wallet).
2. **Settlement = 1 attempt completed per invoice, full amount.** Attempt boleh banyak/gagal;
   yang mengunci bukan jumlah attempt, tapi **hanya satu yang boleh sukses**.
3. **Tanpa PDF A4 template engine** untuk invoice langganan — modal + `window.print()`
   (`InvoiceRenderService` terikat ke order).
4. **Renew = invoice-first (K6)** — layanan diperpanjang **setelah** settlement sukses; admin
   assign/change/extend tetap langsung karena uang sudah diterima offline.
5. **Nomor invoice dari `countDocuments + 1`** dengan retry `E11000` (bukan counter atomik).
6. **Method `'wallet'` di `PaymentAttempt` dideklarasikan** tapi belum bisa dipakai (belum ada wallet).

## Non-goals / kontrak masa depan (sengaja TIDAK diimplementasi sekarang)

- **Wallet** (`wallets` + `wallet_transactions` ledger): invariants yang akan dipakai —
  balance SELALU turunan `Σ WalletTransaction` (tidak ada mutasi balance langsung); tipe transaksi
  `TOPUP | SUBSCRIPTION_RENEWAL | ADJUSTMENT | REFUND`; referensi silang ke `invoiceId`/`attemptId`.
- **VA / Payment Gateway / QRIS online**: `PaymentAttempt.gateway` sudah menyediakan slot
  (`provider`, `txId`, `vaNumber`, `qrUrl`) — integrasi tinggal mengisi, tanpa migrasi invoice.
- **Auto-renewal**: job perluas `subscriptionSweep`, alur D di § Alur; settle hook
  `SubscriptionBillingService.recordPaymentAttempt` jadi titik colok (wallet debit → settle → extend).
- **Denda keterlambatan, reminder email/SMS, PDF A4 via template engine, Hub billing**
  (`HubInvoice`/prepaid — D4 HUB_V2 ditunda).