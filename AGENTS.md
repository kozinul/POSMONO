# POSMono — Agent Notes

## Project Overview
Modular SaaS POS Platform (Node.js/Express + React/Tailwind). Multi-tenant, multi-outlet, with shift management, promotions, inventory, and reporting.

## Repo Structure
- `frontend/` — React 18 + Vite 5 + Tailwind CSS + Zustand + TanStack Query
- `backend/` — Node.js + Express + TypeScript + MongoDB (Mongoose)
- Monorepo with pnpm workspaces

## Key POS UI Components
- `frontend/src/core/pos/pages/PosPage.tsx` — Main POS page; cart sidebar, product grid, bill indicator
- `frontend/src/core/pos/components/PosActionPanel.tsx` — Drawer (☰ menu): Daftar Bill, Daftar Transaksi, Laporan Kasir, Shift
- `frontend/src/core/pos/components/PosVoidModal.tsx` — Generic void confirmation (reason + PIN)
- `frontend/src/core/pos/components/ReceiptDisplay.tsx` — Receipt viewer with Print button
- `frontend/src/core/pos/components/ReportPrintModal.tsx` — Printable kasir reports (struk style: window.print + html2pdf download)
- `frontend/src/core/pos/components/ProductCard.tsx` — Whole card clickable to add to cart (no Add button)
- `frontend/src/core/pos/utils/paymentLabels.ts` — payment method label + sort helpers
- `frontend/src/core/pos/store/posStore.ts` — Zustand store (cart, bill, payment state)

## Recent Changes (2026-08)

### Void Transaksi Redesign
- **Before**: Nested modals (list → item detail → void confirm) — clunky UX
- **After**: Click order in list → transaction loads directly in cart sidebar with "Tutup" close button
- Cart sidebar shows transaction items with per-item "Void" buttons + bottom "Void" (full order) + "Print Ulang" buttons
- "Daftar Transaksi" replaces old "Void Transaksi" label in drawer

### Cart Indicator
- Single "Tutup" button (discards bill, no void API call) — removed "Simpan & Tutup"
- `discardBill()` in posStore now fully clears cart (items, pricing, customer, table, bill state)

### Stale Data Fix
- After payment/void, `queryClient.invalidateQueries` for `orders`, `daily-report`, `dashboard-summary`, `shifts`, `open-shift`
- This ensures Void Transaksi modal and Laporan Kasir show fresh data without browser refresh

### Backend Date Filter Bug
- `MongoOrderRepository.findByTenant` was using `new Date(dateStr)` directly for `$lte` — always midnight UTC, so no orders matched
- Fixed: expand `dateFrom` to `setHours(0,0,0,0)` and `dateTo` to `setHours(23,59,59,999)` (matches `ReportAggregation` pattern)

### HeldOrdersPanel Removed
- Floating held-orders panel removed; held orders now accessible only via "Daftar Bill" in drawer

### Void Approval (Manager PIN) — 2026-08-06
- Cashier without `order:void` permission must enter a Manager PIN to void (order/item). Manager auto-seeds a hashed PIN; PIN approval recorded in `voidApprovals[]`
- Manager has order:void so can self-approve; option "B" (keep PIN approval) chosen

### Partial Quantity Void
- `voidItem(..., quantity?)` decrements the item qty (instead of removing) and recomputes prices/tax; sets status `partially-voided` when items remain
- Void modal stepper for quantity (shown only when `availableQuantity > 1`); `managerPin` & `quantity` forwarded on both Daftar Transaksi paths
- Backend: `OrderController.voidItemSchema.quantity`, `OrderService.VoidItemInput.quantity`, `Order.voidItem` partial logic

### Persistent Dev MongoDB
- `backend/src/dev.ts` loads `import 'dotenv/config'` at top so `MONGO_URI` is read before the connect branch decision
- `backend/.env` default `MONGO_URI=mongodb://mongodb:27017/posmono` → persistent Mongo (`db:"persistent"`); in-memory only when `MONGO_URI` unset or contains `localhost:27017/posmono`
- Keeps data + login sessions across restarts (avoided stale-token "User not found" on void)

### Stale-Invalidation for Void (fixed)
- `useVoidOrder`/`useVoidItem` now invalidate `orders`, `daily-report`, `dashboard-summary`, `sales-report`, `finance-report` so dashboard reflects voided orders

### Kasir Printable Reports (Laporan Transaksi & Penerimaan) — 2026-08-07
- `ReportPrintModal.tsx` renders 80mm struk (monospace) with **Print** (`window.print()` + `.report-print` CSS) and **Download PDF** (`html2pdf.js`, client-side)
- "Laporan Transaksi" = per-order with item lines; "Laporan Penerimaan Kasir" = payment-method breakdown
- `ReportAggregation.getPaymentBreakdownAggregation` aggregates from the `payments` collection (was `order.paymentBreakdown`, which is empty) with an `orders` lookup to exclude voided/cancelled; `paymentModel` injected in `container.ts`
- Payment methods: `cash|qris|transfer|card|debit|credit|ewallet` → labels in `paymentLabels.ts`

### Best-Seller "⭐ Favorit" Toggle — 2026-08-07
- `GET /reports/best-sellers?days=7` (top products by qty over range) via `ReportService.getBestSellers` + `ReportAggregation.getBestSellersAggregation`
- `useBestSellers(days)` hook; PosPage `showFavorites` state filters/orders the product grid, ignoring category (only best sellers, refreshed ~60s)

### Product Card — Click to Add — 2026-08-07
- `ProductCard` root is now `role="button"`, clickable to call `addItem` (Enter/Space support); "Add" button removed; sold-out cards are `cursor-not-allowed` and non-clickable

### Shift: Server-Side Source of Truth + Contract Fixes — 2026-08-07
- **Contract fixes**: `POST /shifts/open` accepts only `{openingBalance}` (`registerId` optional, defaults `register-default`); `POST /shifts/:id/close` accepts `physicalCash` **or** `closingBalance` alias. Frontend `useCloseShiftMutation` sends `physicalCash`.
- **Race condition closed at DB**: partial unique index `one_open_shift_per_cashier` on `{tenantId, cashierId}` where `status='open'` (`ShiftSchema`); `ShiftService.open` catches `E11000` → `ValidationError`; `ShiftModel.syncIndexes()` at boot in `container.ts`
- **Shift sales computed server-side** (Shift = projection cache, not source of truth): `ReportAggregation.getShiftSalesAggregation` aggregates `payments` (`status:'completed'`, `paidAt` in `[openedAt, closedAt]`, `shiftId`) with `orders` lookup excluding voided/cancelled → void auto-reflects, closed shifts are snapshotted
- `Payment` domain + `PaymentSchema` gained `shiftId` (indexed); threaded through `payCash`/`processByOrderId`/`splitBill` (`PaymentController` schemas accept `shiftId`)
- `PaymentModal` sends `shiftId` from `openShiftId` in posStore
- `ShiftService.refreshSales()` recomputes from server on `getCurrent` (10s poll) and `close`; `PUT /shifts/:id/sales` no longer trusts client body (recomputes instead)

### Laporan Kasir is Per-Shift — 2026-08-07
- PosActionPanel "Laporan Kasir" section is scoped to the **current open shift**, not the day: shows shift totals (Transaksi/Penjualan/Tunai/Non-Tunai) from `useShiftReport(openShift.id)`; if no shift is open it prompts "Buka shift terlebih dahulu"
- New backend `GET /reports/shift?shiftId=` via `ReportService.getShiftReport` returns `{ shift, sales, orders }`; `ReportAggregation.getShiftOrdersAggregation` joins `payments`→`orders` (paid/completed, excludes voided/cancelled) to list that shift's orders
- Frontend `useShiftReport(shiftId)` hook (10s polling); ReportPrintModal fed shift orders + shift `paymentBreakdown`/totals

### Shift Wajib Dibuka (Enforcement) + Carried-Over Bills — 2026-08-08
- **Backend enforcement**: `PaymentService.assertOpenShift` (di `payCash`/`processByOrderId`/`splitBill`) dan `CreateOrderService` (hanya `source='pos'`) melempar `ValidationError('Buka shift terlebih dahulu sebelum bertransaksi')` bila `findOpenShift(tenantId, cashierId)` null; `source='waiter'` tidak diblokir
- **Client-submitted shiftId tidak dipercaya** — selalu diganti dengan `shift.id` dari server saat `assertOpenShift`
- **Carried-Over Bills (rollover)**: `ShiftService.close` snapshot bill `status='held'` milik kasir via `MongoOrderRepository.findOpenBillsForCarryOver` → `Shift.setCarriedOverBills`; tersimpan di `ShiftSchema.carriedOverBills` (sub-doc schema `CarriedOverBillSchema`)
- `ReportService.getShiftReport` mengisi `inheritedCarriedBills` dari shift tertutup sebelumnya (`findLastClosedByCashierBefore`) hanya saat shift **open**; tampil di ShiftPage + Laporan Kasir
- **Jebakan Mongoose**: snapshot carried bills awalnya bocor wrapper sub-doc (`$__`/`_doc`/`__parentArray`) → disanitasi via `Shift.toCarriedOverBillValue()` + field eksplisit di `MongoShiftRepository.toDomain`
- Frontend: full-screen gate `z-[80]` di `PosPage.tsx` saat `!openShift?.id && !isLoading`; `OpenShiftModal.tsx` (buka shift + "Logout & Ganti Pengguna" untuk kasir yang salah shift)

### Login & Receipt Kasir — 2026-08-08
- `LoginPage.tsx`: `navigate(roleName === 'Cashier' ? '/pos' : '/dashboard')` — kasir mendarat langsung ke POS
- `ReceiptDisplay.tsx` menampilkan `Kasir: {receipt.cashierName}`; template "Struktur Kasir Default" (seed.ts/dev.ts) memuat node `r4b 'Kasir: {{ order.cashier }}'` setelah `order.time`; template live di DB di-patch manual
- `backend/src/scripts/backfillCashierName.ts` (`pnpm backfill:cashier` di backend): mengisi `cashierName` kosong pada order dari `User.displayName` via `cashierId`

### MongoPaymentRepository shiftId Bug — 2026-08-08
- **Gejala**: laporan kasir per-shift selalu kosong (`totalSales=0`) padahal ada transaksi
- **Root cause**: `MongoPaymentRepository.toPersistence()` tidak mengirim `shiftId` → semua record `payments` tersimpan `shiftId:null`; `getShiftSalesAggregation`/`getShiftOrdersAggregation` memfilter `{ shiftId }` sehingga tak ada yang cocok
- **Fix**: `shiftId` ditambahkan di `PaymentDoc` interface + `toDomain` + `toPersistence` (schema/domain `Payment` sudah punya field sejak awal)
- Cache: fix hanya berlaku untuk transaksi baru; `shiftId:null` lama tidak terpetakan ke shift mana pun

### Close Shift SweetAlert + POS Opens In New Tab — 2026-08-08
- `PosActionPanel.handleCloseShift` menggantikan `window.prompt` dengan **SweetAlert2** (`Swal.fire`): dialog satu-set menunjukkan ringkasan (Penjualan Tunai / Non-Tunai / Kas Diharapkan = `expectedCash ?? openingBalance + cashSales - totalCashPickups`), input rupiah difilter digit, `inputValidator`, `showLoaderOnConfirm`, error via `Swal.showValidationMessage`, toast sukses setelah `closeShiftMut`
- `DashboardLayout` nav link "POS" dirender sebagai `<a target="_blank" rel="noopener noreferrer">` (bukan `<Link>`) → POS selalu terbuka tab baru dari dashboard; link lain tetap `<Link>`

### Auth Persist & RBAC (Cashier Restricted) — 2026-08-08
- **Auth store persist**: `useAuthStore.user` dipersist ke `localStorage.authUser` (di-set saat login, direstore saat store dibuat) → nama user tampil di top bar setelah refresh/tab baru; `logout` & `LoginPage` membersihkannya
- **Frontend guard**: `ProtectedRoute` redirect non-`/pos` ke `/pos` saat `user.roleName === 'Cashier'`; `DashboardLayout` sidebar kasir hanya filter `navigation` untuk `/pos` (dinamis `visibleNavigation`)
- **Backend RBAC (JWT permissions)**: `TokenService`/`AuthService` embeds `permissions` di access+refresh JWT; `authenticate` mengisi `req.userPermissions` dari token (bukan `[]` hardcode); `authorize(...)` kini berfungsi
- **Route guard diterapkan** (permission dari seed): `users` → `users:read`/`users:write`; `roles` → `roles:read`/`roles:write`; `settings` → `settings:read`/`settings:write`; `reports` dashboard/daily/sales/cashier/finance+exports → `reports:read`; products/categories/families/modifiers+promotions mutations → `products:write`; inventory/warehouse mutations → `inventory:write` (untuk `stock-in`/`stock-out`/`adjust`/`reserve`/`release`/`import`)
- **Tetap terbuka untuk kasir**: `GET /reports/shift`, `GET /reports/best-sellers`, `GET /inventory` (list stok sold-out di POS), produk/kategori/family GET, shifts, orders, payments, customers (kasir wajib bisa buat member di POS)
- Terverifikasi E2E: **Owner** → `/reports/dashboard`/`/users`/`/settings` 200; **Cashier** → semuanya 403 & tetap bisa akses `/products` `/inventory` `/shifts` `/reports/shift` `/reports/best-sellers`

### Stale POS Data Fixes (Drawer Transaksi + Badge Diskon) — 2026-08-13
- **Drawer transaksi basi**: `PosActionPanel` membaca `today` dari module-scope (stale) dan tidak me-refetch setelah drawer dibuka → daftar transaksi & laporan shift menampilkan data lama
  - Fix: `today` dihitung di dalam komponen; `useEffect` me-refetch `todayOrders` + `shiftReport` setiap drawer dibuka; tombol "Daftar Transaksi" & "Laporan Transaksi" me-refetch sebelum modal dibuka
- **Badge diskon basi**: perubahan promo/discount-config di dashboard tidak tampil di POS
  - Fix: `useDiscountConfiguration` + `refetchInterval: 60_000` + `refetchOnWindowFocus`; `usePromotions` (create/update/delete) invalidate `discount-config`
- **Invalidasi realtime diperluas**: `useRealtimeSync` kini invalidate `orders` + `shift-report` pada event `voided`/`cancelled`/`paid`/`pos.sale.completed`; `useVoidOrder`/`useVoidItem`/`PaymentModal` juga invalidate `shift-report`
- **Socket room join**: `socket.ts` membaca `payload.tenant` sebagai fallback selain `tenantId`/`tenant_id` → event realtime sampai ke room tenant dengan benar

### Cash Rounding (Pembulatan Total Tunai) — 2026-08-13
- **Config per tenant**: `TenantConfig` + `TenantSchema` + `updateTenantConfigSchema` (shared zod) + field `roundingEnabled`, `roundingMode` ('nearest'|'up'|'down'), `roundingDenomination` (0|100|500|1000, hanya kelipatan genap Rupiah); `.refine` mewajibkan `roundingMode`+`roundingDenomination>0` saat `roundingEnabled`
- **Backend engine**: `RoundingEngine.roundToDenomination(value, mode, denom)` + `TotalRoundingMode`; `Order.recalculateTotals` memakai engine (hapus hardcode `precision=100`; denom 0 → no-op); `Order` + `OrderSchema` + `MongoOrderRepository` gain `roundingDenomination`; `Order.applyCashRounding(adjustment, method, denomination)`
- **Hanya untuk tunai (cash)**: `PaymentService.payCash`/`processByOrderId` membaca config tenant via `getRoundingConfig`, menghitung `roundedPayable = roundToDenomination(total, mode, denom)` hanya saat `method === 'cash'`, validasi `amountPaid >= roundedPayable`; non-cash tidak dibulatkan; `roundingDenomination` dikirim ke order hanya untuk cash
- **Pricing API**: `PricingService.calculate` menerima `tenantRepository` opsional, menghitung `rounding` & `roundedPayable` dari config tenant; `createPricingRouter` + `routes.ts` me-wire `tenantRepository` dari DI container
- **Frontend POS**: `usePricing` mengekspos `roundedPayable`; `PaymentModal` menampilkan baris "Pembulatan" (±) dan "Total Tagihan (dibulatkan)" untuk cash, `Uang Pas`/quick-amount/kembalian memakai `payable`; `amountPaid` dikirim apa adanya (bukan grandTotal)
- **Receipt**: `ReceiptRenderService` memakai `order.roundedPayable || order.total` sebagai `grandTotal`
- **Settings UI**: `GeneralSettingsPage` section baru "Pembulatan" (toggle aktifkan + denominasi Rp 100/500/1.000 + mode terdekat/ke atas/ke bawah) + helper `formatRounding`; config disimpan via `updateTenantConfigSchema`

### Rounding in Reports (Laporan Memuat Pembulatan) — 2026-08-13


- **Backend**: `totalRounding` ditambahkan di `MongoOrderRepository.getDailySales` ($sum `roundingAdjustment` via `$ifNull`), `ReportAggregation.getFinanceAggregation`, dan `ReportService` (`getDailyReport`/`getSalesReport`/`getShiftReport`/`getFinanceReport` — shift via `orders.reduce` di `roundingAdjustment`)
- **Frontend**: `useOrders` interface `Order.roundingAdjustment`/`roundedPayable`, `DailyReport`/`SalesReport`/`FinanceReport`/`ShiftReportData` + `totalRounding`; `PosActionPanel` summary shift menampilkan baris "Pembulatan"; `ReportPrintModal` menampilkan per-order "Pembulatan" + "Total Pembulatan" di footer (Laporan Transaksi & Penerimaan); `ReportPage` menampilkan "Total Pembulatan" di tab Harian/Penjualan dan "Pembulatan" di tab Keuangan (hanya bila ≠ 0)
- **Tests**: `RoundingEngine.test.ts` +9 (roundToDenomination nearest/up/down/denom 0); backend 210 pass; frontend 73/73 pass; tsc frontend & shared bersih; tsc backend masih error pre-existing `ApplyDiscountUseCase.ts(25,7)`
- **Export per produk + rincian transaksi (2026-08-14)**: `ReportExportService.exportSalesPerProduct` kini **mengelompokkan per produk** (PDF & XLSX): baris produk = header grup (bold + bg `#eef2ff`), di bawahnya baris detail tiap transaksi (no. order, qty, total, DPP, SC, Pajak, Grand Total; indent + font 8/gray di PDF), lalu baris **Subtotal** per produk (bold + garis atas), ditutup baris Total + Pembulatan. Di Excel detail-row diberi `outlineLevel=1` → muncul tombol collapse/expand grup di margin (ExcelJS tidak punya `groupRows`, pakai `Row.outlineLevel`). Model tabel umum `ReportTable` diperluas `rowStyles?: ('group'|'detail'|'subtotal')[]` (opsional, tak mengubah export lain). `getSalesPerProductAggregation` sudah mengirim `transactions[]` per produk (tanpa limit). Test `ReportExportService.test.ts`: assert row 5 grup / 6-7 detail ORD-1/ORD-2 (grand total 21.800) / 8 Subtotal (43.600) / 9 Total (Pembulatan 500, Grand Total 44.100) + `outlineLevel` detail =1

### Integrated Hardware Printer & Auto-Print Struk/KOT — 2026-08-13
- **Shared Schemas & Types**: `printer.ts` & `printer-schemas.ts` (`PrinterConnectionType` = `network` | `usb` | `bluetooth`, `PrinterPurpose` = `receipt` | `kot`, `PrinterPaperSize` = `thermal58` | `thermal80` | `a4-portrait`). Zod schema refines required IP/port for network printers. Added `autoPrintReceipt` (default `true`) & `autoPrintKot` (default `false`) config fields to `TenantConfig` and `TenantSchema`.
- **Backend Printing Infrastructure**:
  - `Printer` Aggregate Root & `MongoPrinterRepository` with collection `printers` and partial unique index on `{tenantId, purpose, isDefault: 1}` where `isDefault: true`.
  - `PrintService`: ESC/POS formatting, copy multiplication, direct TCP socket printing (`net.Socket` with 3s timeout, retry once, and settled race guard), test print generator.
  - `PrinterService`: CRUD & automatic default printer reassignment per purpose on deletion/update.
  - `KotRenderService` & `DocumentPrintService`: renders layout and binary thermal buffer for Struk and KOT (Kitchen Order Ticket).
  - API Endpoints: `GET/POST/PUT/DELETE /api/printers`, `POST /api/printers/:id/test`, `POST /api/print/receipt`, `POST /api/print/kot/:orderId` guarded by `printers:read` / `printers:write` permissions.
- **Auto-Print Hooks & Event Bus**:
  - `PaymentService` auto-prints receipt thermal buffer upon payment completion if tenant `autoPrintReceipt` is active.
  - `eventBus` listens to `ORDER_CONFIRMED` event and invokes `onOrderConfirmedAutoKot` to trigger auto-KOT print if tenant `autoPrintKot` is active.
- **Frontend WebUSB & WebBluetooth Support**:
  - `PrintClient.ts`: Direct client-side hardware printing via WebUSB (bulk endpoints) & WebBluetooth GATT characteristic chunks (20-byte chunks), with pairing memory saved in `localStorage` (`posmono.pairedPrinters`).
  - `autoPrint.ts`: `tryClientAutoPrint` & `reprintReceipt` helper with query client prefetching.
  - UI Pages & Components: `/settings/printers` (`PrinterSettingsPage.tsx` with Uji Cetak test button), `GeneralSettingsPage.tsx` "Struk & Cetak" toggles, `PaymentModal.tsx` auto-print trigger, `PosPage.tsx` Print Ulang & Cetak KOT actions, `ReceiptDisplay.tsx` thermal reprint integration.
  - Permissions `printers:read` & `printers:write` assigned to Owner and Manager roles in `seed.ts` & `dev.ts`.

### Void Stock History (Riwayat Stok + Restore Stok) — 2026-08-14
- **Bug lama**: void tidak pernah menulis `stock_movements` — `VoidOrderService` membaca `order.serialize().items` **setelah** `voidOrder()` mengosongkannya (`items=[]`), jadi loop `releaseStock` tak pernah jalan; `VoidItemService`/`VoidAndRollbackService` bahkan tidak punya `inventoryService`
- **Tipe movement baru `'void'`**: `StockMovementType` (backend domain + `StockMovementSchema` enum) + `shared/src/types/domain/inventory.ts`
- **`InventoryService.restockForVoid`**: `stock.adjust(+qty)` + movement `type:'void'`, `referenceType:'void'`, `referenceId=orderId`, `notes='Void #ORD-xxx - {alasan}'` (restore stok yang terpotong saat penjualan)
- **Helper `restoreVoidedStock`** di `OrderService.ts` dipakai oleh `VoidOrderService`/`VoidItemService`/`VoidAndRollbackService`, memutuskan berdasarkan status pembayaran order:
  - **Sudah dibayar** (`paymentStatus='completed'` / `paymentBreakdown` non-empty) → `restockForVoid` → riwayat "Void" (+qty)
  - **Belum dibayar / open bill (held)** → `releaseStock` → lepas reservasi, riwayat "Rilis" (mencegah qty fisik naik keliru karena bill di-hold hanya reserve, tidak decrement)
- Items di-snapshot **sebelum** `voidOrder()`/`voidAndRollback()` mengosongkannya (agar `isFreeItem` terbaca); skip free item; best-effort (gagal restock/release tidak memblokir void)
- **Frontend `StockListPage.tsx`**: badge rose "Void" + `+qty` untuk tipe `void`
- **Wiring DI**: `inventoryService` di-inject ke `voidItemService` & `voidAndRollbackService` (`container.ts`)
- **Tests**: `OrderService.test.ts` +10 (restock paid / release open-bill / free-item skip / best-effort), `InventoryService.test.ts` +4 (`restockForVoid` movement & notes); backend service/domain 190 pass; frontend 73/73; tsc frontend & shared bersih

### Recent Orders Dashboard: Tipe Pembayaran + Pembulatan — 2026-08-14
- `DashboardPage.tsx` Recent Orders kini punya kolom **Pembayaran** (label metode dari `order.paymentBreakdown`, gabung ` + ` bila banyak metode) dan **Pembulatan** (ungu `±Rp …`, hanya bila `roundingAdjustment` ≠ 0)
- **Root cause "tipe pembayaran kosong"**: `PaymentService.payCash` hanya memanggil `order.markPaid()` — `order.paymentBreakdown` tetap `[]` (padahal jalur `processByOrderId`/`splitBill`/`OrderService` memakai `order.pay()`). Semua konsumen `paymentBreakdown` (VoidPayment, TransactionHistory, ReportPrintModal, PosPage) ikut kosong
- **Fix**: `payCash` kini memanggil `order.pay([{ method, code: refNumber, amount: amountPaid, change, cardLastFour }], cashierId, cashierName)` menggantikan `markPaid()` → sekaligus meng-*emit* event `ordering.order.paid` (realtime sync POS ikut benar)
- **Backfill**: `pnpm backfill:payment` (`src/scripts/backfillPaymentBreakdown.ts`) mengisi `paymentBreakdown` order paid/completed lama dari koleksi `payments` (method, referenceNumber, amount, change utk cash). CATATAN: script dipicu via shell mendapat `MONGO_URI` inherited `mongodb://mongodb:27017` (tanpa `/posmono` → DB `test`) karena `dotenv` tidak override env existing; jalankan dengan `MONGO_URI=mongodb://mongodb:27017/posmono pnpm backfill:payment`
- `markPaid()` tetap dipakai di Order.ts dan tidak dihapus (dipakai `processByOrderId`? tidak — hanya `payCash` yang dahulu; sekarang payCash pakai `pay()`)
- Tests: `PaymentService.test.ts` +assert `paymentBreakdown` terisi

### Report Penerimaan per Kasir & Penjualan per Kasir — 2026-08-14
- **`GET /reports/cashier-receipts?dateFrom=&dateTo=`** (Penerimaan per Kasir): `ReportAggregation.getCashierReceiptsAggregation` agregat dari koleksi `payments` (status `completed`, `paidAt` dalam range), join `orders` untuk eksklusi void/cancel, group `{cashierId, method}` → `{ cashiers[] {cashierId, cashierName, methods[] {method,total,count}, total, totalTransactions}, totals {total, totalTransactions, methods[]} }`
- **`GET /reports/sales-per-cashier?dateFrom=&dateTo=`** (Penjualan per Kasir): `getSalesPerCashierAggregation` via `orders` `$facet` — per cashier `totalOrders/totalRevenue(+roundingAdjustment)/dpp/serviceCharge/tax` + `totalItems` dari unwind items → `{ cashiers[], totals }` (+`avgOrderValue`)
- **Export**: `exportCashierReceipts` (kolom metode dinamis via `PAYMENT_METHOD_ORDER`; baris grup/detail-per-metode/subtotal per kasir di PDF & XLSX, filename `penerimaan-per-kasir-…`) dan `exportSalesPerCashier` (Kasir/Jumlah Order/Qty Item/Total Penjualan/DPP/SC/Pajak/Rata-rata per Order + totals, filename `penjualan-per-kasir-…`)
- **Frontend**: hooks `useCashierReceiptsReport.ts` & `useSalesPerCashierReport.ts`; `ReportPage.tsx` +2 tab baru di sidebar (grouping metode di bawah baris kasir); `ReportType` di `useReportExport.ts` + `'cashier-receipts' | 'sales-per-cashier'`
- **Router/RBAC**: `authenticate` + `authorize('reports:read')`; route JSON + `/export?format=pdf|xlsx` (Cashier tetap 403)
- **Tests**: `ReportService.test.ts` +2, `ReportExportService.test.ts` +2; backend 194/194 service-domain pass (setelah fix TS7006 di `getSalesPerCashierAggregation` & tiping `cashierReceipts` di export) + frontend 73/73

### Fix Printer RBAC Kasir & WebUSB Configuration (2026-08-14)
- **Printer GET RBAC**: `GET /api/printers` dan `GET /api/printers/:id` kini hanya perlu `authenticate` (dihapus `authorize('printers:read')`). Kasir bisa memuat daftar printer untuk WebUSB/Bluetooth auto-print tanpa memberikan akses `printers:write` (POST/PUT/DELETE tetap dibatasi).
- **WebUSB Configuration Fix (`PrintClient.ts`)**: Memperbaiki `DOMException: Failed to execute 'selectConfiguration' on 'USBDevice'`. Menggunakan `device.configurations?.[0]?.configurationValue ?? 1` (bukan hardcoded `0`), mengecek status `configurationValue` aktif sebelum `selectConfiguration`, serta menggunakan `interfaceNumber` dan mendukung endpoint `bulk` & `interrupt` untuk compatibility thermal printer USB.

### QRIS Gateway Integration — 2026-08-23 (COMMITTED feat(qris))
> **Dokumentasi lengkap: `docs/QRIS_GATEWAY_PLAN.md`** (kontrak API, keputusan desain, file inventory). Status: **SELESAI & TER-COMMIT** — backend + frontend PaymentModal + Settings UI + tests + docs (`API_REFERENCE.md` §Payments/QRIS, `POS_CURRENT_FEATURES.md` §22). Simulator internal (`tools/qris-simulator`) **sudah dihapus** — dev memakai gateway eksternal di container lain: `http://host.docker.internal:3334`.
- **Backend**: `QrisGatewayService.ts` (baru) — createInvoice/checkStatus/cancelInvoice/testConnection via gateway REST `/restapi/qris/show_qris.php?do=...`, config per-tenant dari `tenant.serialize().config`, timeout 10s, ref format `QRIS-<12 hex uppercase>`; `MongoPaymentRepository.findByReferenceNumber` untuk guard ref-reuse
- **Endpoint baru** (`payment.routes.ts`, hanya `authenticate`): `POST /payments/qris/initiate` `{amount}`, `POST /payments/qris/confirm` `{referenceNumber, amount, orderId?|items?, discount?...}`, `GET /payments/qris/status/:ref`, `POST /payments/qris/test-config`, `POST /payments/qris/:ref/cancel`
- **Finalisasi pembayaran selesai**: `PaymentService.confirmQrisPayment` — guard no-gateway/no-shift/ref-reuse/double-pay (`paymentStatus completed`)/insufficient → `checkStatus` harus `paid` + `status.amount === amount` → delegasi ke `processByOrderId(method='qris')` (order existing) atau `payCash(method='qris')` (sale baru); shiftId selalu server-side via `assertOpenShift`; `processByOrderId` kini terima `referenceNumber?` opsional
- **Frontend PaymentModal selesai**: hook `useQrisPayment.ts` (state machine idle→creating→awaiting→confirming+expired/cancelled/error; polling 3s; countdown; fallback QR via paket **`qrcode`** bila gateway tak kirim `qrImage`; cancel void invoice di gateway) + panel QR di kolom kanan PaymentModal menggantikan daftar metode (kolom kiri di-dim); klik Bayar metode qris → initiate → paid → `POST /qris/confirm` → sukses lewat handler bersama `applyPaymentResult` (cart bersih, invalidate queries, struk + auto-print WebUSB); expired → "Buat Ulang QR"; confirm gagal → "Coba Lagi"; close modal membatalkan invoice
- **Config tenant baru**: `qrisGatewayEnabled/BaseUrl/ApiKey/MerchantId` di `TenantSchema` + shared `updateTenantConfigSchema` (refine wajib lengkap saat enabled); default baseUrl `http://host.docker.internal:3334`; frontend `TenantConfig` (useTenant.ts) +4 field opsional
- **Settings UI selesai**: GeneralSettingsPage section "QRIS Gateway" — toggle aktif + input Base URL/API Key (password)/Merchant ID (field kosong border merah) + tombol "Uji Koneksi" (auto-save config lalu `POST /payments/qris/test-config`, hasil inline hijau/merah); handleSave umum hanya menyertakan field QRIS bila lengkap agar refine server tidak menolak seluruh patch; section sidebar id `'qris'` dengan icon qr-code + keywords pencarian
- **DI**: `qrisGatewayService` singleton di `container.ts` di-inject ke `paymentController` DAN `paymentService`; guard `requireQrisGateway()` di controller
- **Tests**: `backend/tests/services/PaymentService.qris.test.ts` (12 pass) untuk confirmQrisPayment; `frontend/tests/unit/useQrisPayment.test.ts` (6 pass) untuk hook; `backend/tests/services/QrisGatewayService.test.ts` (19 pass: resolveConfig/createInvoice/checkStatus/cancel/testConnection/network-failure, mock fetch via vi.stubGlobal); tsc frontend/backend bersih; vite build OK; frontend 79/79
- **Sisa kerja**: tidak ada — fitur lengkap & ter-commit (E2E manual dengan gateway eksternal belum dijalankan: docker tidak tersedia di env ini)

### QRIS Simulator Eksternal — 2026-08-23
- `tools/qris-simulator/` dihapus dari repo (beserta entry `.gitignore`); development memakai simulator QRIS di container terpisah
- Backend mengakses gateway via **`http://host.docker.internal:3334`** (`/restapi/qris/show_qris.php?do=...`) — bukan localhost, karena backend juga jalan di Docker
- Default `qrisGatewayBaseUrl` di `TenantSchema` + placeholder di GeneralSettingsPage diganti ke `http://host.docker.internal:3334`
- CATATAN tenant lama: config `qrisGatewayBaseUrl` yang sudah tersimpan di MongoDB **tidak otomatis berubah** oleh perubahan default schema — update manual via Settings > QRIS Gateway bila masih menunjuk `http://localhost:5000`

### Open Bill Nyangkut Setelah Dibayar / Ganti Shift — Fix (2026-08-28)
- **Gejala**: bill held dibayar sukses (order baru dibuat via `pay-cash`), lalu tampil lagi di Daftar Bill / dashboard "Open Bill" / carry-over shift setelah login ulang
- **Root cause**: POS membayar bill dengan membuat **order baru** (`PaymentModal` selalu `POST /payments/pay-cash`), lalu membersihkan bill asli via `POST /orders/:id/void` **fire-and-forget** tanpa `managerPin` di `posStore.closeBillAfterPayment`/`cancelActiveBill`; kasir tanpa `order:void` → `VoidApprovalService` lempar `ForbiddenError` yang di-swallow `.catch(() => {})` → order asli tetap `status:'held'` di MongoDB
- **Fix**: endpoint baru `POST /orders/:id/close-bill` (`CloseBillService` di `OrderService.ts`, `OrderController.closeBill`, route, DI `container.ts`) — **cancel** (bukan void) bill yang belum dibayar: `order.cancel(reason)` → `status:'cancelled'`, idempotent (paid/cancelled/voided/refunded → no-op, aman retry), tenant-check, release reserved stock best-effort (`inventoryService.releaseStock`), publish `ordering.order.cancelled` → realtime sync invalidate `held-orders`/`orders`/`shift-report`. Tanpa gating PIN: bill unpaid tidak menyentuh uang
- **Frontend**: `closeBillAfterPayment` (≈ `posStore.ts:704`) kini **await** `/close-bill` (bukan void di-swallow); `dismissHeldOrder` (tombol × Daftar Bill) juga panggil `/close-bill` untuk bill non-temp → jadi alat manual bersihkan bill nyangkut lama; `cancelActiveBill` ikut diarahkan ke `/close-bill`
- **Catatan**: bill stuck lama tak punya link ke order pembayarannya → dibersihkan via tombol × Daftar Bill (close-bill) atau otomatis saat dibayar lagi; `carriedOverBills` shift tertutup tetap snapshot
- **Tests**: `OrderService.test.ts` +7 (`CloseBillService`: held→cancelled+release, paid no-op, cancelled no-op, free-item skip, release best-effort, not-found, tenant mismatch); backend services 237/237 pass; frontend 79/79 + tsc + vite build OK

### Void Dead Code Cleanup — 2026-08-28
- Menghapus jalur void cart/bill yang **tidak dipakai UI**: `voidItemOnBill` + `voidActiveBill` (posStore store action + interface) dan `handleVoidItem`/`submitVoidItem`/`voidTarget`/`paidItemIndex` (PosPage.tsx + modal voidTarget)
- Void item/order aktif hanya lewat **Daftar Transaksi** (`viewTransaction` → `useVoidOrder`/`useVoidItem`); bill unpaid dibersihkan via `/close-bill`
- Tests: `posStore.test.ts` −7 (test voidItemOnBill/voidActiveBill dihapus); frontend 72/72 pass; tsc + vite build OK

### Finance Report Double-Count Diskon Fix — 2026-08-28
- **Gejala**: Laporan Keuangan menampilkan Diskon 2× (misal diskon 5.000 → 10.000)
- **Root cause**: `getFinanceAggregation` menjumlah `$add: [$discount, $discountTotal]`, padahal kedua field selalu diisi nilai identik (`payCash` PaymentService, `CreateOrderService`, `Order.recalculateTotals`). `$add` awalnya untuk order lama (pre-`discountTotal`, 2026-07-21) yang salah satu field null → `$ifNull`=0 → benar; tapi data baru keduanya sama → dobel
- **Fix**: `$sum: { $max: [$discount, $discountTotal] }` di ReportAggregation.ts (generik untuk data lama & baru; diskon non-negative via zod)

### OrderListPage: Detail (Item + Struk) & Print Ulang — 2026-08-28
- Spek: di halaman Orders dashboard pengguna ingin melihat item yang di-order dan melakukan print ulang struk
- **`OrderDetailModal.tsx`** (baru, `core/orders/components`): tampilan struk (`.receipt-print report-print`) berisi header order (no./status/kasir/waktu), daftar item (qty, total, penanda VOID + reason + modifiers), Subtotal/Diskon/SC/Pajak/Pembulatan/Total (`roundedPayable ?? total`), breakdown bayar + kembalian, dan "Rincian Void"; tombol footer `Tutup` / `Print Ulang` / `Print`
- **Print Ulang** memakai jalur POS yang sama: `apiPrintReceipt({ orderId })` (`/print/receipt`, tanpa permission khusus) → jika `clientPrint && buffer && printer` → `printViaClient` (WebUSB/Bluetooth), jika `dispatched` → toast "Struk terkirim ke printer", error → toast; fallback `window.print()` struk modal. Catatan: `/print/receipt` butuh payment completed (throw `Payment not found for order` bila order belum dibayar)
- **OrderListPage.tsx**: tombol **Detail** (selalu tampil, termasuk order non-voidable) membuka modal; tombol void (Void/Item/Bayar) tetap hanya untuk `isVoidable`; `ModalState` + tipe `'detail'`
- **Type**: `Order.serviceCharge?` ditambahkan di `useOrders.ts` (backend mengirimnya, dipakai modal)
- Tests: frontend 72/72 + tsc + vite build OK

### Ringkasan Stok (Inventory Summary Report) — 2026-08-28
- **Spek**: di Reports (tab Laporan) pengguna bisa melihat ringkasan stok: total nilai stok, total unit, total tersedia, produk menipis, dan rincian per produk per gudang + pergerakan stok dalam periode
- **Cost price (HPP) & moving-average**: `Stock.costPrice` + `StockMovement.unitCost` (domain + schemas + repos). `Stock.adjust(delta, reason, unitCost?)` menghitung moving-average (`(oldQty*oldCost + delta*unitCost)/newQty`, round 2dp); delta negatif tidak mengubah cost; `InventoryService.stockIn`/`adjust`/`importStock` terima `costPrice` opsional; movements mencatat `unitCost`; `exportStock` sertakan costPrice; controller zod `costPrice` optional; backfill `pnpm backfill:cost` (`src/scripts/backfillStockCost.ts`)
- **Laporan**: `ReportAggregation.getInventorySummaryAggregation` (lookup product/category/warehouse, hitung `availableQuantity`/`value`/`lowStock`) + `getStockMovementTotalsAggregation` (sum per `{productId, warehouseId, type}`); `ReportService.getInventorySummary(tenantId, dateFrom?, dateTo?)` menggabungkan snapshot + total movement per produk:gudang → `{items, totals{totalItems,totalReserved,totalAvailable,totalValue}, lowStockCount, generatedAt}`
- **API**: `GET /reports/inventory-summary?dateFrom=&dateTo=` + `/export?format=pdf|xlsx` (`authorize('reports:read')`; kasir tetap 403); `ReportExportService.exportInventorySummary` grup produk → detail gudang (`outlineLevel=1`) → subtotal → total; kolom Produk/Gudang/Stok/Reserved/Tersedia/Min/HPP/Nilai/Status (MENIPIS); subtitle `· N produk menipis`; filename `laporan-ringkasan-stok-{dateTo ?? 'now'}`
- **Frontend**: hook `useInventorySummaryReport` (queryKey `['inventory-summary', dateFrom, dateTo]`, enabled only bila keduanya terisi); `ReportPage` sidebar entry "Ringkasan Stok" + 4 summary cards + tabel grup per produk (klaim perkembangan stok "Masuk/Keluar/Void" dari `movements`)
- **Perluasan types**: `Stock`/`StockMovement` shared types + frontend `InventorySummaryItem.movements` map
- **Tests**: `Stock.test.ts` costPrice (moving-avg, negatif tak berubah, round 2dp), `StockMovement.test.ts` unitCost, `InventoryService.test.ts` stockIn/adjust costPrice + unitCost movement, `ReportService.test.ts` +2 (merger snapshot+movement, low-stock + valuasi), `ReportExportService.test.ts` +2 (xlsx grup/detail/subtotal/total + HPP/Nilai/Status; PDF + MENIPIS), `useInventorySummaryReport.test.tsx` +2; backend services/domain/src-core 786 pass (TemplateAPI.test.ts gagal = butuh Mongo `localhost:27027`, pre-existing), frontend 74/74, tsc frontend/shared bersih, tsc backend hanya error pre-existing `ApplyDiscountUseCase.ts(25,7)`; **laporan selesai, data HPP diisi via backfill `pnpm backfill:cost` atau Manual Stock In/Adjust/Import**

### Carried Bills UX (Tutup & Buka Shift) — 2026-08-28
- **Spek** (konfirmasi user): bill gantung **TIDAK** dihitung ke Kas Diharapkan (info-only); dialog Tutup Shift menampilkan daftar lengkap bill; OpenShiftModal menampilkan banner amber non-blocking
- **Backend**: `ShiftService.getCarriedBillsForCashier(tenantId, cashierId)` — ambil snapshot `carriedOverBills` dari `findLastClosedByCashierBefore(tenantId, cashierId, now)` lalu **intersect** dengan kondisi live (`orderRepository.findOpenBillsForCarryOver`) → bill yang sudah dibayar/divoid sejak snapshot disembunyikan; return `{count, totalAmount, bills[{orderId,orderNumber,total,status,createdAt}], fromShift}`; tanpa shift tertutup sebelumnya → `{count:0, bills:[], fromShift:null}`
- **Route**: `GET /shifts/carried-bills` (authenticate saja, scoped tenantId+userId) di `ShiftController.carriedBills`
- **Frontend**: hook `useCarriedBills.ts` (queryKey `['carried-bills']`); `PosActionPanel.handleCloseShift` me-refetch via `queryClient.fetchQuery(['carried-bills'])` sebelum `Swal.fire` lalu menampilkan section "Bill Menggantung" (scrollable, per bill nomor+status+total, footer total, catatan "Tidak dihitung dalam Kas Diharapkan"); 0 bill → baris redup; `OpenShiftModal` banner amber "Ada N bill menggantung dari shift sebelumnya · Total Rp X" (sembunyi bila count 0 / fetch error — tidak memblokir buka shift)
- **Tests**: `ShiftService.test.ts` +3 (intersect live, tanpa shift sebelumnya → 0, semua sudah dibayar → 0 tapi fromShift terisi); backend services/domain/src-core 789 pass; frontend 74/74; tsc backend/frontend bersih; vite build OK

### QRIS checkStatus Contract Fix — 2026-08-28 (tandai selesai; commit `694b613b`)
- Item pending lama ini ternyata **sudah diimplementasikan & ter-commit** sejak commit `694b613b` ("feat(dashboard): ... fix QRIS status check") — AGENTS.md tadi masih mencatatnya sebagai pending
- **Kontrak asli gateway**: `GET /restapi/qris/checkpaid_qris.php?do=checkStatus&apikey&mID&invid=<INVOICE_ID>&trxvalue=<nominal>&trxdate=<YYYY-MM-DD>` — bukan tebakan awal `show_qris.php?do=check-status&cliTrxNumber`
- **Mapping persisten**: collection `qris_invoices` (`QrisInvoice` domain + `QrisInvoiceSchema` unique `{tenantId, referenceNumber}` + `MongoQrisInvoiceRepository` upsert). `createInvoice` menyimpan `{tenantId, referenceNumber, invid (dari qris_invoiceid ?? invid ?? invoice_id ?? invoiceId), amount, trxDate}`; `checkStatus` membaca mapping lalu memanggil `checkpaid_qris.php` dengan `invid`/`trxvalue`/`trxdate`/`mID`, normalisasi status (paid/settlement/capture/00 dst.)
- **Fallback**: record tanpa `invid` (invoice lawas / persist gagal) → `status:'unknown'` (bukan error). `callGateway(baseUrl, params, endpoint?)` — endpoint per-aksi
- **Wiring**: `qrisInvoiceRepository` di `container.ts` → `qrisGatewayService` (systemConnection `QrisInvoiceModel`); test `QrisGatewayService.test.ts` assert path/param + fallback; `container.ts` resolve `qrisInvoiceRepository` di line ~657

### Ringkasan Stok: Saldo Awal Historis (Fix caveat lama) — 2026-08-29
- **Caveat lama** (blok Pending Work 2026-08-23) sudah **diselesaikan**: Ringkasan Stok kini memuat **saldo awal** agar periode bisa reconcile
- **Backend `ReportService.getInventorySummary`**: hitung per produk:gudang `openingQuantity` (= stok saat ini − `netQtyChange` periode, di mana `netQtyChange = in − out + adjustment + void`; `reserve`/`release` hanya mempengaruhi reserved), `openingReservedQuantity` (= `reserved − (reserve − release)`, clamp ≥ 0), `openingAvailableQuantity`, dan `openingValue` (= `openingQuantity × costPrice`, **estimasi** karena cost price moving-average). Totals bertambah `totalOpeningItems`/`totalOpeningValue`. Reconcile: `Awal + Masuk − Keluar + Adj + Void = Stok`
- **Frontend** `ReportPage` tab Ringkasan Stok: kolom baru **Awal** (qty) dan **Nilai Awal** (estimasi) di baris grup/detail/footer; subtitle "saldo awal & pergerakan pada periode"
- **Export** `ReportExportService.exportInventorySummary`: kolom `Awal` + `Nilai Awal` (PDF & XLSX), total baris ikut
- **Catatan tersisa**: total `in/out` tetap untuk rentang tanggal terpilih (bukan akumulasi sepanjang masa) — itu memang semantik laporan periode; nilai total tetap "saat ini"; `openingValue` adalah estimasi (replay seluruh movement untuk valuasi historis presisi terlalu berat)
- **Tests**: `ReportService.test.ts` +1 (opening quantity/reserved/value + totals), `ReportExportService.test.ts` update kolom Awal/Nilai Awal (posisi cell baru), `useInventorySummaryReport.test.tsx` assert opening fields; backend non-Mongo 825 pass · frontend 74/74 · tsc backend & frontend bersih · vite build OK

### Lain-lain — 2026-08-29
- **tsc backend bersih**: error pre-existing `ApplyDiscountUseCase.ts(25,7)` (kurang `freeItemValue: 0` di early-return `DiscountResult`) sudah diperbaiki; sekalian fix TS4053 `ReportAggregation.IPaymentBreakdownGroup` tidak bisa di-name → interface di-`export`
- **Docs sync**: `docs/PROJECT_ROADMAP.md` (Phase F Inventory summary `[x]`, MVP checklist +Ringkasan Stok, status test terbaru) & `docs/BACKLOG.md` (Split bill, Hold/recall, QRIS → `[x]`) diperbarui agar sinkron dengan kode

### Laporan Laba Rugi (Profit & Loss) — 2026-08-29
- **Spek**: item roadmap Phase F terakhir — laporan Laba Rugi simple per periode memakai HPP dari pergerakan stok
- **Backend**: `getCogsAggregation(tenantId, dateFrom, dateTo)` di `ReportAggregation.ts` — aggregate koleksi `stockmovements` type `'out'` dalam range `createdAt` → `{ totalCogs: $sum(qty × unitCost), totalUnits }` (guard `!stockMovementModel` → zeros); `ReportService.getProfitLoss` menggabungkan `getFinanceAggregation` + `getCogsAggregation` → `{dateFrom, dateTo, generatedAt, totalOrders, totalRevenue, totalCogs, cogsUnits, totalDiscount, totalTax, totalServiceCharge, totalRounding, grossProfit (revenue − cogs), netProfit (grossProfit − discount), grossMarginPct}`; `ReportController.profitLoss` + `exportProfitLoss`; routes `GET /reports/profit-loss` & `/reports/profit-loss/export` (`authorize('reports:read')`)
- **Export** `ReportExportService.exportProfitLoss`: tabel Metrik/Nilai (Total Order, Pendapatan, HPP, Laba Kotor, Margin %, Diskon, Pajak, SC, Pembulatan opsional, Laba Bersih) + totals; `rowStyles` dinamis subtotal pada Laba Kotor & Laba Bersih; filename `laporan-laba-rugi-{dateFrom}-{dateTo}`
- **Frontend**: hook `useProfitLossReport.ts` (queryKey `['profit-loss', dateFrom, dateTo]`); sidebar ReportPage entry "Laba Rugi" (icon bar-chart) + section dengan 5 summary card (Total Order, Pendapatan, HPP merah, Laba Kotor hijau, Margin %) + tabel rincian; `ReportType` di `useReportExport.ts` + `'profit-loss'`
- **Semantik**: revenue & diskon/pajak/SC dari `orders` (finance), HPP = total `qty × unitCost` stock keluar periode (moving-average cost saat sale). `grossMarginPct` = Laba Kotor / Pendapatan
- **Tests**: `ReportService.test.ts` +2 (getProfitLoss hitung & zeros), `ReportExportService.test.ts` +1 (PDF valid + XLSX cell A4/A5/A7/B7/B8/B14), `useProfitLossReport.test.tsx` +2; backend services pass · frontend 76/76 + tsc kedua sisi + vite build OK

### Invoice A4 Generation (Phase E rampung) — 2026-08-30
- **Spek**: Phase E item terakhir — user melihat detail order di dashboard ingin generate invoice formal A4 per order
- **Backend** `GET /orders/:id/invoice` (route `order.routes.ts` + `OrderController.invoice`): resolve order (tenant-check) + tenant + payment (prefer `status:'completed'`, fallback first/`null`) → `InvoiceRenderService.render` (sebelumnya **orphan/dead code** — DI di `container.ts:600` tapi tak pernah dipanggil; kini di-inject juga ke konstruktor `OrderController` bersama `paymentRepository` + `tenantRepository` yang sudah lama di-injector) → `{ pdf(base64), layout, templateId, templateName, paper, invoiceNumber }` (invoiceNumber = `order.invoiceNumber || 'INV-' + orderNumber.replace(/^ORD-/,'')`)
- **Template**: pakai default template `documentType:'invoice'` ("Standard Invoice A4", seeded di seed.ts/dev.ts, `getDefault` fallback ke first-by-tenant) — bisa diedit di Template Designer
- **Frontend** `OrderDetailModal.tsx`: tombol **"Invoice A4"** → `api.get('/orders/:id/invoice')` → `atob` → `Uint8Array` → `Blob(application/pdf)` → `window.open(URL.createObjectURL(url))`, fallback `<a download>` bila popup diblokir; error toast bila template invoice tak ada
- **Tests**: `InvoiceRenderService.test.ts` +9 (store/customer/order mapping, subtotal=total−discount, grandTotal=roundedPayable||total, items+isFreeItem, invoiceNumber fallback, payment firstPayment, tanpa payment → payments:[], split suffix `/N`); backend tsc bersih · frontend tsc + vite build OK · frontend 76/76

### Transfer RBAC Fix — 2026-08-30
- **Gap**: `POST /payments/:paymentId/cancel` (batalkan transfer) sebelumnya `authenticate`-only — kasir bisa membatalkan order + release stok tanpa otorisasi (uang KELUAR/destruktif, paralel `refund` yang sudah `payments:write`)
- **Fix**: route `cancel` kini `authenticate` + `authorize('payments:write')` di `payment.routes.ts`
- **Sengaja DIBIARKAN open** (kasir wajib di POS): `GET /payments/pending` (lihat daftar) dan `POST /:paymentId/confirm` (konfirmasi transfer masuk = uang MASUK, paralel `pay-cash`/`process`/`split` yang juga `authenticate`-only). Menjaga `confirm` open lebih aman daripada menambah `payments:write` ke role Cashier (yang juga membuka `refund`)
- **Frontend** `PosActionPanel.handleCancelTransfer` sudah catch error → kasir kena 403 cuma dapat toast (tidak crash)
- **Tests**: `payment.routes.test.ts` +4 (real `createPaymentRoutes` + stub controller: pending/confirm open utk `payments:read`-only; cancel → 403; cancel → 200 dgn `payments:write`); backend 10/10 di file itu + tsc bersih

### Phase G Rampung — Suite Tanpa Docker + E2E Critical Paths (2026-08-30)
- **Mongo tests jalan tanpa Docker**: `tests/helpers/db.ts` di-rewrite — `setupTestDb()` pakai `MONGO_URI` env bila ada, else **`mongodb-memory-server`** dengan binary mongod 7.3.4 arm64 dari cache `~/.cache/mongodb-binaries` (`resolveSystemBinary()`: env `MONGO_SYSTEM_BINARY` → newest `mongod-*`); `{ binary: { version:'7.3.4', systemBinary } }`; tanpa cache default download 403 utk aarch64-debian12. `--wiredTigerCacheSizeGB`/`ephemeralForTest` crash mongod 7.3.4 → instance arg default. `teardownTestDb()` stop server
- **Determinisme memory**: `vitest.config.ts` `pool:'forks'` + `poolOptions.forks { maxForks:1, minForks:1 }` (banyak mongod paralel thrash RAM box 3.9GB; maxForks=2 → `MongoUserRepository` flaky). 2× full run hijau 950/950 (78 files) ~24s
- **Harness integration di-rewrite ke wiring terkini** (`tests/helpers/integration.ts`): `buildIntegrationApp({ enforceShift?: boolean, permissions?: string[] })` — PaymentService 14 arg (paymentRepo, orderRepo, null, tenantRepo, taxService, null, eventBus, null, inventoryService, userRepo, shiftRepoForEnforcement, null, null), OrderController 24 arg (19 service + orderRepo/paymentRepo/tenantRepo/invoiceRenderService), ShiftService(shiftRepo, undefined, orderRepo, userRepo), ProductService, InventoryService; `buildTaxServiceMock()` replikasi VAT 12% excl (base=taxable×11/12, `charges:[]`, `serviceCharge:0`); context expose repos/models/services/token/tenantId. HARUS ikut middleware `authorize`: `POST /products`→`products:write`, stock-in/low-stock→`inventory:write`
- **Debug skenario tarik-menarik yang ketemu**: PaymentService ctor yang membesar sejak harness lama bikin `taxService` nyasar ke slot `tenantRepository` → 500 `taxResult.charges.reduce`; `OrderController` voidItem kena `undefined.execute` (arg service geser). `tests/integration/tenant-isolation.test.ts` di-rewrite ke harness (11/11); `MongoOrderRepository.test.ts` fix stale (`draft.hold()` dulu agar `status:'held'` → pendingOrders=1); `MongoShiftRepository.test.ts` fix stale (`shift.close(750000)`; expectedTotal=openingBalance=500000)
- **E2E critical paths** (`tests/e2e/critical-path-flows.test.ts`, 5 skenario, HTTP penuh + Mongo penuh): (1) money loop — open shift → product+stock-in → pay-cash → assert subtotal/total/paymentBreakdown/change/shiftId → stok decrement → **`GET /orders/:id/invoice`** (seed tenant + default invoice template via `templateModel.create`; invoiceNumber `INV-…`, PDF base64) → close shift; (2) enforce shift — pay-cash tanpa shift → 400 "Buka shift…"; (3) carried-over bill — hold → close shift (snapshot `carriedOverBills`) → shift baru → `/shifts/carried-bills` count 1 → bayar sebagai sale baru → `/orders/:id/close-bill` → count 0 → stok reconcile (3 held, 3 paid dari 20 → 17); (4) void paid → stok restore; (5) isolasi tenant over HTTP (`generateTestToken({tenant:'other-tenant'})`: order/produk/stok → 400/404, `current` shift null, list order kosong). NB: `ShiftService.close` tanpa reportAggregation → cashSales tetap 0 → expectedCash = openingBalance (production wiring aggregasi)
- **k6 load artifact** (`backend/loadtest/`): `scenarios/money-loop.js` (constant-arrival-rate pay-cash loop, threshold p95<300ms p99<750ms fail<1%, setup login+open shift, SharedArray product IDs, handleSummary); `README.md` + scripts `pnpm loadtest` & `pnpm loadtest-sweep` (10/25/50 VUs) di package.json — butuh backend running (`--env BASE_URL=… EMAIL=… PASSWORD=… PRODUCT_ID=… VUS=…`)
- **package.json backend**: `test`/`test:watch`/`test:coverage` kini `vitest` langsung (wrapper docker compose dihapus); `test:db:up/down` tetap ada utk CI
- **Docs sync**: `docs/TEST_PROGRESS.md` (950 backend/78 files, tabel per-layer + infra No-Docker), `docs/TESTING_STRATEGY.md` (+Layer 6 E2E, Layer 7 Load; db.ts sample aktual; debt table; commands/config), `docs/PROJECT_ROADMAP.md` Phase G `[x]` ~100% + log 2026-08-30
- **Tes terakhir**: backend 950/950 (78 files) 2× hijau, tsc backend bersih; frontend 76/76 + tsc + vite build OK (sebelumnya)

## Key Patterns
- `useQueryClient()` for cache invalidation after mutations
- `useVoidOrder` for full order void; `useVoidItem` for per-item void
- `setReceipt()` in store triggers ReceiptDisplay (reprint flow)
- `today = new Date().toISOString().split('T')[0]` — UTC date string used for daily queries

## Testing
- Backend tests: `cd backend && pnpm test` (vitest, full suite runs without Docker via mongodb-memory-server)
- Type check: `cd frontend && npx tsc --noEmit`; backend: `cd backend && npx tsc --noEmit`
- No ESLint config found; rely on TypeScript checks
- Load test (needs running backend): `cd backend && pnpm loadtest --env BASE_URL=… --env EMAIL=… --env PASSWORD=… --env PRODUCT_ID=… --env VUS=…`
