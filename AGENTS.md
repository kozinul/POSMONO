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

## Key Patterns
- `useQueryClient()` for cache invalidation after mutations
- `useVoidOrder` for full order void; `useVoidItem` for per-item void
- `setReceipt()` in store triggers ReceiptDisplay (reprint flow)
- `today = new Date().toISOString().split('T')[0]` — UTC date string used for daily queries

## Testing
- Type check: `cd frontend && npx tsc --noEmit`
- No ESLint config found; rely on TypeScript checks
