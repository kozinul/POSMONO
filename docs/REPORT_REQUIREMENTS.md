# KEBUTUHAN REPORT — CASHIER vs MANAJEMEN

> Analisis kebutuhan report POS, dipisahkan antara kebutuhan **kasir** (operasional, shift-based, rekonsiliasi kas) dan kebutuhan **manajemen/lainnya** (analitik, akuntansi, tren). Dokumen ini adalah bahan diskusi & tasking — sebagian kebutuhan kasir sudah diimplementasikan (lihat §7).
>
> Last updated: 2026-08-05

---

## 1. Kondisi Saat Ini (As-Is)

### Backend — `backend/src/core/reporting/`

| Komponen | Lokasi | Catatan |
|----------|--------|---------|
| `ReportController` | `interfaces/http/controllers/ReportController.ts` | Handler untuk semua endpoint `/reports/*` |
| `ReportService` | `application/services/ReportService.ts` | Orchestrasi: dashboard, daily, sales, cashier, daily-metrics, sales-per-product |
| `ReportAggregation` | `infrastructure/aggregation/ReportAggregation.ts` | Aggregation MongoDB: daily sales, payment breakdown, top products, cashier performance, sales by category, sales-per-product |

Endpoint yang tersedia di `report.routes.ts`:

| Endpoint | Status |
|----------|--------|
| `GET /reports/dashboard` | ✅ |
| `GET /reports/daily?date=` | ✅ |
| `GET /reports/sales?dateFrom=&dateTo=` | ✅ |
| `GET /reports/cashier?date=` | ✅ (admin) |
| `GET /reports/daily-metrics?dateFrom=&dateTo=` | ✅ |
| `GET /reports/sales-per-product?dateFrom=&dateTo=` | ✅ |
| `GET /reports/finance` | ❌ **tercantum di docs tapi tidak ada di router** |
| `POST /reports/daily-metrics/generate?date=` | ✅ |

### Frontend — `frontend/src/core/reports/`

- `pages/ReportPage.tsx` — ringkasan daily + sales
- `pages/SalesPerProductPage.tsx` — tabel penjualan per produk + transaksi
- `hooks/useSalesPerProductReport.ts`, `useOrders.ts` (`useDashboardSummary`, `useDailyReport`, `useSalesReport`)
- Router: `/reports`, `/reports/sales-per-product` (di `src/app/router.tsx`)
- **Belum ada** UI cashier-report maupun shift-close report.
- Role user: `admin` | `cashier`; permission `reports.read`, `reports.export`, `reports.dashboard.customize` (+ `platform.reports.read`).

### Data pendukung

- **Order** punya `cashierId`, `cashierName`, `paymentBreakdown[]`, `voidedItems[]`, `voidedByName`, `paidAt`.
- **Shift** punya `openingBalance`, `closingBalance`, `physicalCash`, `expectedCash`, `cashSales`, `nonCashSales`, `totalTransactions`, `paymentBreakdown[]`, `cashPickups[]`, `expectedTotal`, `actualTotal`.
- Logika shift-close (docs): `expectedCash = openingBalance + cashSales - totalCashPickups`, `difference = physicalCash - expectedCash`.

---

## 2. Kebutuhan Kasir (Operasional / Shift-Based)

Fokus: **rekonsiliasi kas**, **akurasi pembayaran**, **penutupan shift**. Kasir melihat laporan ini di akhir shift / saat berhenti.

| # | Kebutuhan | Sumber / aksi yang ada | Gap / catatan |
|---|-----------|------------------------|---------------|
| C1 | **Shift closeout summary** — ringkasan penutupan shift kasir | `Shift` (openingBalance, expectedCash, physicalCash, cashSales, nonCashSales, totalTransactions, paymentBreakdown) | ✅ **Terimplementasi (2026-08-05)** — `/shifts/:id/close` mengembalikan `difference`; UI ShiftPage menampilkan laporan penutupan + print |
| C2 | **Rekonsiliasi kas** — expected vs physical, selisih (kurang/lebih) | `expectedCash = openingBalance + cashSales - totalCashPickups`; `difference = physicalCash - expectedCash` | ✅ **Terimplementasi (2026-08-05)** — `difference` diekspos di `Shift.serialize()`; CloseShiftModal & laporan penutupan menampilkan selisih live |
| C3 | **Breakdown pembayaran per metode** (tunai/QRIS/debit) | `paymentBreakdown` di Order & Shift; `getPaymentBreakdownAggregation` | ✅ **Terimplementasi (2026-08-05)** — POS men-sync `paymentBreakdown` ke shift via `PUT /shifts/:id/sales`; ditampilkan di laporan penutupan |
| C4 | **Voided items / pembatalan** | Order punya `voidedItems`, `voidedAt`, `voidedByName` | `/daily` dan `/sales` belum menampilkan voided |
| C5 | **Print / export shift report** | Docs sebut "Print report" | Belum ada export modal (CSV/PDF) |
| C6 | **Ringan & spesifik** — single-date (hari ini), cepat, bisa print offline | — | Cashier report harus hemat biaya komputasi |

---

## 3. Kebutuhan Manajemen / Laporan Lainnya

Fokus: **analitik**, **akuntansi**, **tren**, **evaluasi performa**.

| # | Kebutuhan | Sumber / aksi | Gap |
|---|-----------|---------------|-----|
| M1 | **Sales report (rentang tanggal)** | `/reports/sales`, `getSalesByCategoryAggregation`, `getTopProductsAggregation`, `orders[]` | Sudah ada |
| M2 | **Finance report (nett, pajak, SC, diskon)** | Docs sebut `/reports/finance` | Endpoint belum ada; butuh pemisahan `discount`, `tax`, `serviceCharge` per order |
| M3 | **Cashier performance** (per kasir: order, revenue, avg) | `getCashierPerformanceAggregation` → `/reports/cashier` | API ada, UI belum |
| M4 | **Sales per product** | `getSalesPerProductAggregation` → `/reports/sales-per-product` | Sudah ada |
| M5 | **Dashboard summary** | `/reports/dashboard` + `useDashboardSummary` (todayRevenue, todayOrders, pendingOrders, lowStockCount, recentOrders, refetch 30s) | Sudah ada |
| M6 | **Daily metrics (historis)** | `DailyMetric` + `generateDailyMetric` / `daily-metrics` | Generate belum otomatis (perlu cron/penjadwalan) |
| M7 | **Export data mentah** | permission `reports.export` | Belum ada endpoint export |
| M8 | **Multi-outlet** | docs: `/api/reports/sales?...&outlet=` | Perlu filter `outletId` di aggregation jika multi-outlet |

---

## 4. Perbedaan Kunci

| Dimensi | Cashier | Manajemen / Lainnya |
|---------|---------|---------------------|
| Scope | Shift & kasir | Tenant / tanggal |
| Granularitas | Hari ini / shift tunggal | Rentang tanggal, lintas shift |
| Tujuan | Rekonsiliasi kas, penutupan shift | Analitik, akuntansi, tren |
| Data wajib | opening/expected/physical cash, cash pickups, selisih, voided, breakdown pembayaran | nett, pajak, SC, diskon, kategori, produk, performa kasir |
| Akses role | `cashier` (shift miliknya) | `admin` / `reports.read` |
| Bobot query | Ringan, cepat | Lebih berat, agregasi range |

---

## 5. Rekomendasi Pemisahan (Desain Target)

1. **Backend — CashierReport (shift-scoped)**: tambahkan ke `ReportService`/`ReportAggregation` agregasi per `cashierId` + `shiftId`/`date`; kembalikan `expectedCash` dan `difference` pada response `closeShift`.
2. **Backend — Finance report**: implementasikan `/reports/finance` → `netRevenue`, `totalTax`, `totalServiceCharge`, `totalDiscount`, per kategori. Pastikan Order menyediakan `serviceCharge`.
3. **Frontend**:
   - Halaman `/reports/cashier` khusus role cashier dengan shift-closeout report + export.
   - Nav "Reports" di `DashboardLayout` tetap admin-only; kasir melihat shift report dari halaman POS/Shift.
4. **Permission**: cashier hanya `reports:cashier` (scope shift); admin semua report.

---

## 6. Open Questions (perlu keputusan)

1. Apakah Order memiliki `shiftId`? Jika tidak, bagaimana memetakan transaksi ke shift milik kasir?
2. Apakah Order sudah menyimpan `serviceCharge` per order, atau cukup hitung dari field `serviceCharge` di items?
3. Apakah sistem multi-outlet? Jika ya, filter `outletId` wajib ditambahkan ke semua aggregation.
4. Apakah kasir boleh export? (hanya shift report, atau semuanya?)
5. UI approach: cashier report sebagai **tab di halaman Shift (`/shifts`)** atau **sub-halaman Reports (`/reports/cashier`)**?

---

## 7. Status Implementasi (update 2026-08-05)

| Kebutuhan | Status |
|-----------|--------|
| C1 Shift closeout summary | ✅ — UI laporan penutupan shift di `ShiftPage` (sales, rekonsiliasi, pickups, breakdown) + tombol print |
| C2 Rekonsiliasi kas | ✅ — `difference` di `Shift.serialize()`; selisih live di CloseShiftModal |
| C3 Breakdown pembayaran | ✅ — POS sync `paymentBreakdown` ke shift; tampil di laporan penutupan |
| C4 Voided items di daily/sales | ⏳ — belum |
| C5 Print/export shift report | ⏳ — print via window.print sudah ada; export CSV/PDF belum |
| C6 Ringan & spesifik | ✅ — laporan berbasis shift single-date |
| M1–M8 (manajemen) | ⏳ — belum (prioritas berikutnya) |

*Dokumen ini belum diimplementasikan — untuk dipakai saat tasking fitur report.*
