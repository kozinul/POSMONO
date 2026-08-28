# Carried Bills UX — Tutup & Buka Shift

> Terakhir diperbarui: **2026-08-28** · Status: **DIEKSEKUSI — SELESAI** (backend `GET /shifts/carried-bills`, banner OpenShiftModal, daftar bill di dialog Tutup Shift)
> Dokumen ini adalah backup konteks jika sesi coding terputus — semua keputusan desain dan detail implementasi tercantum di sini.

---

## 1. Tujuan

Saat tutup kasir kadang masih ada bill yang menggantung (*held/open bill*). Kebutuhan:

1. **Saat input hasil closing (Tutup Shift)** → dialog menampilkan daftar lengkap bill menggantung yang akan dibawa ke shift berikutnya.
2. **Saat buka shift berikutnya** → muncul informasi bahwa ada bill menggantung dari shift sebelumnya.

## 2. Keputusan (dikonfirmasi user 2026-08-23)

| Keputusan | Pilihan |
|---|---|
| Bill gantung dihitung ke "Kas Diharapkan"? | **Tidak** — info saja (uangnya memang belum masuk kas fisik) |
| Detail daftar bill di dialog Tutup Shift | **Daftar lengkap**: semua nomor bill + nominal masing-masing |
| Banner di OpenShiftModal | **Info saja**, non-blocking (tanpa wajib ack) |

## 3. Kondisi Saat Ini (sudah ada)

| Komponen | Lokasi | Status |
|---|---|---|
| Snapshot bill saat close | `ShiftService.close` (`backend/src/core/pos/application/services/ShiftService.ts:59-63`) → `MongoOrderRepository.findOpenBillsForCarryOver` → `Shift.setCarriedOverBills` → `ShiftSchema.carriedOverBills` | ✅ |
| Kriteria bill gantung | `paymentStatus='pending'` + status `draft/held/confirmed/preparing`, milik kasir (`MongoOrderRepository.ts:284-307`) | ✅ |
| Info inherited di Laporan Kasir | `ReportService.getShiftReport` → `inheritedCarriedBills` dari `findLastClosedByCashierBefore` (hanya saat shift open); tampil di PosActionPanel + ReportPrintModal + ShiftPage | ✅ |
| Dialog Tutup Shift | `PosActionPanel.handleCloseShift` (`frontend/src/core/pos/components/PosActionPanel.tsx:72-128`, SweetAlert2) — hanya Kas Diharapkan/Tunai/Non-Tunai | ❌ belum ada bill gantung |
| Gate Buka Shift | `frontend/src/core/pos/components/OpenShiftModal.tsx` (input saldo awal saja) | ❌ belum ada info bill gantung |

## 4. Rencana Backend

### 4.1 `ShiftService.getCarriedBillsForCashier(tenantId, cashierId)`
- Snapshot dari `shiftRepository.findLastClosedByCashierBefore(tenantId, cashierId, new Date())` → `carriedOverBills`
- **Intersect dengan kondisi live**: panggil `orderRepository.findOpenBillsForCarryOver(tenantId, cashierId)` → filter snapshot berdasarkan `orderId` yang masih ada di hasil live → bill yang sudah dibayar/divoid setelah snapshot tidak ditampilkan
- Return:
```ts
{
  count: number,
  totalAmount: number,          // sum total bill tersisa
  bills: Array<{ orderId, orderNumber, total, status, createdAt }>,
  fromShift: { id: string; closedAt: Date } | null,
}
```

### 4.2 Route & Controller
- `ShiftController.carriedBills` (handler baru) + route **`GET /shifts/carried-bills`** di `backend/src/core/pos/interfaces/http/routes/shift.routes.ts`
- Guard: hanya `authenticate` (konsisten route shift lain); scoped `req.tenantId` + `req.user.id`

### 4.3 Tests
- Unit test `ShiftService`: bill sudah dibayar sejak snapshot → difilter; tanpa shift tertutup sebelumnya → `{count:0}`; tanpa live order (semua sudah selesai) → kosong

## 5. Rencana Frontend

### 5.1 Hook baru
- `frontend/src/core/shifts/hooks/useCarriedBills.ts` — react-query key `['carried-bills']`, `GET /shifts/carried-bills`; dipakai dengan `enabled` sesuai konteks (gate visible / sebelum dialog tutup)

### 5.2 Dialog Tutup Shift (`PosActionPanel.handleCloseShift`)
- Fetch carried bills dulu (mis. via `queryClient.fetchQuery`) sebelum `Swal.fire`
- Tambah section di `html` SweetAlert: judul "Bill Menggantung", **daftar lengkap** per bill (nomor + Rp total, container scrollable `max-height`), footer Total
- Catatan kecil: *"Tidak dihitung dalam Kas Diharapkan — otomatis dibawa ke shift berikutnya"*
- Jika 0 bill → satu baris redup "Tidak ada bill menggantung"

### 5.3 Gate Buka Shift (`OpenShiftModal`)
- Banner amber non-blocking di atas input saldo: "Ada N bill menggantung dari shift sebelumnya · Total Rp X" + hint "buka lewat ☰ > Daftar Bill"
- Sembunyikan bila `count === 0`; error fetch → banner tidak muncul (jangan blokir buka shift)

## 6. Verifikasi
- Backend: `cd backend && npx vitest run tests/services` + `npx tsc --noEmit`
- Frontend: `cd frontend && npx tsc --noEmit` (+ unit test bila pola existing cocok)

## 7. File Inventory (rencana)

| File | Aksi |
|---|---|
| `backend/src/core/pos/application/services/ShiftService.ts` | +`getCarriedBillsForCashier` |
| `backend/src/core/pos/interfaces/http/controllers/ShiftController.ts` | +`carriedBills` handler |
| `backend/src/core/pos/interfaces/http/routes/shift.routes.ts` | +`GET /carried-bills` |
| `frontend/src/core/shifts/hooks/useCarriedBills.ts` | **BARU** |
| `frontend/src/core/pos/components/PosActionPanel.tsx` | handleCloseShift: fetch + section daftar bill |
| `frontend/src/core/pos/components/OpenShiftModal.tsx` | Banner amber bill gantung |
