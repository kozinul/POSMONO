# QRIS Gateway Integration — Status & Plan

> Terakhir diperbarui: **2026-08-28** · Status: **COMMITTED + FIXED** — backend, finalisasi pembayaran, frontend PaymentModal, Settings UI, semua test, dan docs (`API_REFERENCE.md`, `POS_CURRENT_FEATURES.md`) selesai. Simulator internal sudah dihapus — development memakai gateway eksternal di `http://host.docker.internal:3334` (§7).
> ✅ **Kontrak cek status aktual sudah diimplementasikan** (commit `694b613b`): `checkpaid_qris.php?do=checkStatus&mID&invid&trxvalue&trxdate` + mapping persisten `qris_invoices` — lihat §10.
> Dokumen ini adalah backup konteks jika sesi coding terputus — semua keputusan desain, kontrak API, dan daftar file tercantum di sini.

---

## 1. Tujuan

Integrasi pembayaran **QRIS dinamis** (QR berisi nominal) melalui *QRIS Gateway* pihak ketiga dengan pola REST sederhana:

1. Kasir memilih metode **QRIS** di POS → backend membuat invoice ke gateway → dapat QR string/image
2. Frontend menampilkan QR → customer scan & bayar
3. Frontend polling status sampai `paid` → finalize pembayaran order (paymentBreakdown, shiftId, struk)

| Gateway dikonfigurasi **per tenant** (base URL, API key, merchant ID), sehingga satu deployment bisa multi-gateway/multi-merchant. Gateway eksternal diakses via `http://host.docker.internal:3334` (container terpisah). |

---

## 2. Keputusan Desain

| Keputusan | Alasan |
|---|---|
| Gateway dipanggil dari **backend** (`QrisGatewayService`), bukan browser | API key tidak boleh bocor ke client |
| Config disimpan di `TenantConfig` (bukan collection terpisah) | Konsisten dengan pattern rounding/autoPrint; 4 field saja |
| `referenceNumber` dibuat **lokal**: `QRIS-<12 hex uppercase>` | Idempotent, bisa ditelusuri di kedua sisi; dikirim sebagai `cliTrxNumber` |
| Endpoint gateway tunggal `/restapi/qris/show_qris.php` dengan param `do=` | Mengikuti kontrak gateway eksternal yang sudah ada (style PHP REST lama) |
| Error gateway dilempar sebagai `ValidationError` (HTTP 400) dengan pesan Indonesia | Konsisten dengan error handling lain; kasir langsung paham |
| Timeout HTTP 10 detik (`AbortSignal.timeout`) | Gateway lambat jangan menggantung POS |
| Route QRIS hanya `authenticate` (tanpa `authorize`) | Kasir harus bisa transaksi QRIS; sama seperti route payments lain |
| Controller menerima `qrisGatewayService?` **opsional** + guard `requireQrisGateway()` | Aman jika DI belum di-wire di environment tertentu |

---

## 3. Kontrak API Backend (SUDAH ADA, uncommitted)

Semua route di `backend/src/core/payment/interfaces/http/routes/payment.routes.ts`, prefix `/api/payments`:

| Method | Path | Fungsi | Body/Param |
|---|---|---|---|
| POST | `/qris/initiate` | Buat invoice + dapat QR | `{ amount: number(int > 0) }` |
| GET | `/qris/status/:referenceNumber` | Cek status invoice | — |
| POST | `/qris/test-config` | Uji koneksi gateway (buat invoice Rp 10.000 lalu void) | — |
| POST | `/qris/:referenceNumber/cancel` | Batalkan invoice | — |

### Response shapes

```ts
// initiate →
{ referenceNumber, qrString, qrImage /* dataURL | null */, amount, expiresAt }

// status →
{ status: 'pending' | 'paid' | 'expired' | 'cancelled' | 'unknown', paidAt: string | null }

// cancel → { cancelled: true }
// test-config → { ok: true, message }
```

---

## 4. Config Tenant (SUDAH ADA, uncommitted)

Field baru di `config` tenant:

```
qrisGatewayEnabled    : boolean, default false
qrisGatewayBaseUrl    : string,  default 'http://host.docker.internal:3334'
qrisGatewayApiKey     : string,  default ''
qrisGatewayMerchantId : string,  default ''
```

Validasi (`shared/src/validation/schemas/tenant-schemas.ts`):
- `baseUrl` harus URL valid atau string kosong
- `.refine`: saat `qrisGatewayEnabled === true`, base URL + API key + merchant ID **wajib** diisi

---

## 5. File Inventory

### Modified (uncommitted)
| File | Perubahan |
|---|---|
| `backend/src/core/payment/application/services/QrisGatewayService.ts` | **FILE BARU (untracked)** — inti integrasi, lihat §6 |
| `backend/src/core/payment/application/services/PaymentService.ts` | +`confirmQrisPayment` (§8.A); `processByOrderId` terima `referenceNumber?`; ctor sudah punya `qrisGatewayService?` |
| `backend/src/core/payment/interfaces/http/controllers/PaymentController.ts` | +4 handler (`qrisInitiate/Status/Cancel/TestConfig`) + `qrisConfirm`, schema `qrisInitiateSchema` & `qrisConfirmSchema` |
| `backend/src/core/payment/interfaces/http/routes/payment.routes.ts` | +5 route QRIS (termasuk `POST /qris/confirm`) |
| `backend/src/core/tenant/infrastructure/persistence/schemas/TenantSchema.ts` | +4 field config QRIS |
| `shared/src/validation/schemas/tenant-schemas.ts` | +4 field + `.refine` wajib lengkap |
| `backend/src/bootstrap/container.ts` | Wiring DI `qrisGatewayService` → `paymentController` **dan** `paymentService`. Diff kosmetik `.catch` sudah dibersihkan |
| `frontend/package.json` | +`qrcode@^1.5.4` (+dev `@types/qrcode`) — fallback render QR client-side |
| `frontend/src/@shared/hooks/useQrisPayment.ts` | **FILE BARU** — state machine QRIS: initiate/polling 3s/countdown/cancel/fallback QR (`qrcode.toDataURL`), lihat §8.B |
| `frontend/src/core/pos/components/PaymentModal.tsx` | Alur QRIS: klik Bayar → invoice → panel QR menggantikan kolom kanan → paid → `POST /qris/confirm` → sukses jalur existing via `applyPaymentResult`; kolom kiri di-dim saat QR aktif; close modal membatalkan invoice |
| `frontend/src/@shared/hooks/useTenant.ts` | Interface `TenantConfig` +4 field `qrisGateway*` (opsional) |
| `frontend/src/core/settings/pages/GeneralSettingsPage.tsx` | Section "QRIS Gateway": toggle + Base URL/API Key/Merchant ID + tombol Uji Koneksi (auto-save lalu test-config), lihat §8.C |

### Untracked
| File | Isi |
|---|---|
| `backend/tests/services/PaymentService.qris.test.ts` | Unit test `confirmQrisPayment` (12 test, semua pass) |
| `frontend/tests/unit/useQrisPayment.test.ts` | Unit test hook QRIS (6 test, semua pass) |
| `backend/tests/services/QrisGatewayService.test.ts` | Unit test gateway service (19 test, semua pass) |

---

## 6. QrisGatewayService — Detail Implementasi

Lokasi: `backend/src/core/payment/application/services/QrisGatewayService.ts`

- **Konstruktor**: `tenantRepository: any` (di-inject dari container)
- **`resolveConfig(tenantId)`**: ambil tenant → `tenant.serialize().config` → throw jika disabled / field kosong; trim + strip trailing slash pada baseUrl
- **`callGateway(baseUrl, params)`**: `GET ${baseUrl}/restapi/qris/show_qris.php?<urlSearchParams>`; timeout 10s; non-OK → error; parse JSON
- **`assertSuccess(json)`**: wajib `json.status === 'success' && json.data`, else throw pesan `json.message`
- **`createInvoice(tenantId, amount)`**: validasi integer > 0 → ref `QRIS-<uuid tanpa strip, 12 char, uppercase>` → kirim `do=create-invoice&apikey&mID&cliTrxNumber&cliTrxAmount` → return `{ referenceNumber, qrString: data.qris, qrImage, amount, expiresAt }`; throw jika `data.qris` kosong
- **`checkStatus(tenantId, referenceNumber)`**: `do=check-status&apikey&cliTrxNumber` → normalisasi status ke enum, selain itu `'unknown'`
- **`cancelInvoice(...)`**: `do=void&apikey&cliTrxNumber` → `{ cancelled: true }`
- **`testConnection(tenantId)`**: create-invoice Rp 10.000 (ref `TEST-<10 char>`) lalu void (void best-effort, `.catch(() => undefined)`) → `{ ok: true, message }`

---

## 7. QRIS Gateway Eksternal (development)

Gateway QRIS berjalan di container terpisah dan diakses backend via:

```
http://host.docker.internal:3334/restapi/qris/show_qris.php
```

- `host.docker.internal` dipakai karena backend POSMono juga berjalan di Docker — `localhost` dari dalam container menunjuk ke container itu sendiri, bukan ke gateway
- Endpoint tunggal: `GET|POST /restapi/qris/show_qris.php?do=...`
- Aksi (`do=`): `create-invoice` · `check-status` · `pay` · `void|cancel` · `list` (kontrak lihat §2/§6)
- Config tenant: `qrisGatewayBaseUrl=http://host.docker.internal:3334` + API Key & Merchant ID sesuai gateway

---

## 8. Sisa Pekerjaan (TODO — urutan pengerjaan)

### A. Finalisasi pembayaran di backend — ✅ SELESAI (2026-08-23)
- **`PaymentService.confirmQrisPayment({tenantId, cashierId, referenceNumber, amount, orderId?|items?, discount?, discountType?, promoCode?, cashierName?, shiftId?})`**:
  1. Guard `qrisGatewayService` ter-wire (else `'Layanan QRIS Gateway tidak tersedia'`)
  2. Jika `orderId`: load order, cek tenant + `paymentStatus !== 'completed'` (double-pay) + `amount >= totalDue`; jika tanpa `orderId` wajib `items`
  3. Anti reuse ref: `paymentRepository.findByReferenceNumber` → tolak bila sudah ada
  4. `checkStatus` gateway: `expired`/`cancelled`/non-`paid` → error spesifik; `status.amount !== amount` → error mismatch
  5. Finalisasi lewat jalur existing: `processByOrderId(method='qris')` untuk order existing, atau `payCash(method='qris')` untuk sale baru — keduanya otomatis dapat `paymentBreakdown`, event realtime, shift via `assertOpenShift`, struk + auto-print
- **`processByOrderId` kini menerima `referenceNumber?` opsional** (default generate `QRIS-xxx`) agar payment tercatat dengan ref gateway
- Endpoint finalisasi: `POST /payments/qris/confirm` body `{referenceNumber, amount, orderId? | items?, discount?, discountType?, promoCode?, cashierName?, shiftId?}` → response `{payment, order, receipt}` (sama seperti `/process`)
- Wiring: `qrisGatewayService` di-inject ke `paymentService` di container.ts; diff kosmetik `.catch(() => { })` sudah dibersihkan
- Tests: `backend/tests/services/PaymentService.qris.test.ts` (12 pass): guard no-gateway/no-shift/ref-reuse/double-pay/insufficient/pending/expired/cancelled/amount-mismatch + sukses order-existing & sale-baru & shiftId server-side

### B. Frontend PaymentModal — alur QRIS — ✅ SELESAI (2026-08-23)
- **Hook baru `frontend/src/@shared/hooks/useQrisPayment.ts`**: state machine `idle → creating → awaiting → confirming` (+ `expired/cancelled/error`), `create(amount)` → `POST /payments/qris/initiate`, polling status tiap 3s (`GET /qris/status/:ref`, stop saat unmount/paid/expired/cancelled), countdown dari `expiresAt` (ISO), fallback render QR client-side via paket **`qrcode`** bila gateway tidak kirim `qrImage`, `cancel()` → void invoice di gateway, `confirmFailed(msg)` menyimpan invoice untuk "Coba Lagi"
- **PaymentModal.tsx**: klik "Bayar" saat metode `qris` → buat invoice (amount = `payable` non-cash = grandTotal tanpa pembulatan) → panel QR menggantikan kolom kanan (QR image, nominal, countdown merah <60s, status, tombol Batalkan/Buat Ulang/Kembali/Coba Lagi); kolom kiri di-dim (`opacity-50 pointer-events-none`) selama QR aktif; input referensi manual disembunyikan untuk qris; tombol close modal membatalkan invoice best-effort
- Saat gateway `paid`: `POST /payments/qris/confirm {referenceNumber, amount, items?, discount?...}` → sukses → jalur sukses existing (bersihkan cart, invalidate queries, setReceipt struk, auto-print WebUSB) lewat handler bersama `applyPaymentResult`
- Confirm gagal (mis. mismatch/double-pay) → panel error + "Coba Lagi" / "Kembali"; expired → "Buat Ulang QR" (initiate baru)
- Dep baru frontend: `qrcode@^1.5.4` (+dev `@types/qrcode`)
- Tests: `frontend/tests/unit/useQrisPayment.test.ts` (6 test: initiate+polling, paid→onPaid, expired, cancel+void+stop-polling, confirmFailed/retry/reset, error initiate); tsc + vite build bersih; 79/79 pass

### C. Settings UI — GeneralSettingsPage — ✅ SELESAI (2026-08-23)
- Section sidebar baru **"QRIS Gateway"** (`id: 'qris'`, icon qr-code, keywords pencarian)
- Toggle "Aktifkan QRIS Gateway" + input **Base URL** / **API Key** (type password) / **Merchant ID** — muncul saat toggle aktif; field kosong diberi border merah + hint validasi
- Tombol **"Uji Koneksi"**: auto-save 4 field via `useUpdateSettings` (`PATCH /tenants/current/settings`) lalu `POST /payments/qris/test-config` → pesan sukses (hijau) / gagal (merah) inline; disabled bila form belum lengkap
- `handleSave` umum menyertakan field QRIS hanya bila lengkap/`disabled` agar refine server-side tidak menolak seluruh patch settings
- Frontend `TenantConfig` interface (+useTenant.ts) ditambah 4 field opsional qrisGateway*

### D. Test — ✅ SELESAI
- ✅ `tests/services/PaymentService.qris.test.ts` (12 test) untuk `confirmQrisPayment`
- ✅ `tests/services/QrisGatewayService.test.ts` (19 test): resolveConfig (repo kosong/disabled/config kurang/trailing slash), createInvoice (validasi amount/param gateway/fallback null/error message/payload QRIS kosong), checkStatus (ref wajib/normalisasi status/unknown), cancelInvoice (do=void/ref wajib), testConnection (probe create Rp 10.000 + void best-effort), failure jaringan (ECONNREFUSED/HTTP 500/TimeoutError) — semua mock `fetch` global via `vi.stubGlobal` + mock tenantRepository
- ⬜ Test gateway manual checklist (opsional, dev-time): create → pay → status=paid; create → void; expiry

### E. Rapikan & commit
- ✅ Hapus diff kosmetik `container.ts` (sudah dibersihkan)
- Commit backend sebagai satu commit feat(qris)
- Update `API_REFERENCE.md` + `POS_CURRENT_FEATURES.md` setelah frontend jadi

---

## 9. Catatan / Jebakan

- **Jangan percaya `shiftId` dari client** — finalisasi QRIS harus lewat `assertOpenShift` seperti metode lain (pattern sudah ada di `PaymentService`)
- **Non-cash tidak dibulatkan** — amount yang dikirim ke gateway harus `roundedPayable ?? total` yang sudah dihitung pricing (untuk QRIS = nilai asli karena non-cash)
- `AbortSignal.timeout` butuh Node ≥ 17.3 (repo aman)
- **Gateway di container terpisah** — backend harus memakai `host.docker.internal:3334`, bukan `localhost`, bila keduanya berjalan di container Docker berbeda
- `testConnection` meninggalkan invoice `TEST-*` di gateway jika gagal void — tidak fatal, tapi catat
- Reference number maksimal 25 char di tag 62.05 gateway — format `QRIS-<12>` aman

---

## 10. Kontrak Gateway Aktual untuk Cek Status — ✅ SELESAI (commit `694b613b`)

Kontrak asli endpoint cek status pembayaran dari gateway eksternal:

```http
GET http://localhost:3334/restapi/qris/checkpaid_qris.php?do=checkStatus&apikey=12345678&mID=123456&invid=<INVOICE_ID>&trxvalue=15000&trxdate=2026-08-23
```

(Backend POSMono tetap memanggil via `host.docker.internal:3334`, bukan `localhost`.)

### Implementasi final

| Aspek | Sebelum (ditebak) | Sesudah (fix) |
|---|---|---|
| Path | `/restapi/qris/show_qris.php` | `/restapi/qris/checkpaid_qris.php` |
| `do` | `check-status` | `checkStatus` |
| Referensi invoice | `cliTrxNumber=QRIS-xxx` (ref lokal) | `invid=<INVOICE_ID>` (dari gateway) |
| `mID` | tidak dikirim | dikirim |
| `trxvalue` | tidak dikirim | `amount` dari mapping |
| `trxdate` | tidak dikirim | `YYYY-MM-DD` dari mapping |

1. **Mapping persisten**: collection `qris_invoices` (`MongoQrisInvoiceRepository` + `QrisInvoiceSchema`, index unique `{tenantId, referenceNumber}`, upsert). Diisi saat `createInvoice` dari `data.qris_invoiceid ?? invid ?? invoice_id ?? invoiceId` + `amount` + `trxDate`; dibaca di `checkStatus`.
2. **`callGateway(baseUrl, params, endpoint?)`** — endpoint kini param per-aksi (default `show_qris.php`, cek status pakai `checkpaid_qris.php`).
3. **Fallback**: tanpa record/invid (invoice lawas atau persist gagal) → `status:'unknown'` (bukan error); polling lanjut menunggu.
4. File terdampak: `QrisGatewayService.ts`, `MongoQrisInvoiceRepository.ts` (BARU), `QrisInvoice.ts` (BARU), `QrisInvoiceSchema.ts` (BARU), `container.ts` (wiring `qrisInvoiceRepository`), test `QrisGatewayService.test.ts` (assert path & param), `PaymentService.qris.test.ts`.
5. Catatan: kontrak `create-invoice` & `void` masih `show_qris.php` (`do=create-invoice` / `do=void`, ref lokal `cliTrxNumber`) — pakai kontrak tersebut tanpa server gateway nyata; E2E manual dengan gateway eksternal belum dijalankan di env ini.
