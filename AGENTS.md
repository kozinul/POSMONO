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
- Frontend `useShiftReport(shiftId)` hook (10s refetch); ReportPrintModal fed shift orders + shift `paymentBreakdown`/totals

## Key Patterns
- `useQueryClient()` for cache invalidation after mutations
- `useVoidOrder` for full order void; `useVoidItem` for per-item void
- `setReceipt()` in store triggers ReceiptDisplay (reprint flow)
- `today = new Date().toISOString().split('T')[0]` — UTC date string used for daily queries

## Testing
- Type check: `cd frontend && npx tsc --noEmit`
- No ESLint config found; rely on TypeScript checks
