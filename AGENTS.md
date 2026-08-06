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

## Key Patterns
- `useQueryClient()` for cache invalidation after mutations
- `useVoidOrder` for full order void; `useVoidItem` for per-item void
- `setReceipt()` in store triggers ReceiptDisplay (reprint flow)
- `today = new Date().toISOString().split('T')[0]` — UTC date string used for daily queries

## Testing
- Type check: `cd frontend && npx tsc --noEmit`
- No ESLint config found; rely on TypeScript checks
