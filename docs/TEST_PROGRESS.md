# Test Progress

> **Updated:** 2026-08-30
> **Total Tests:** Backend vitest: **950 passing** (78 files) · Frontend vitest: **76 passing** (Tabby)
> **Test infra:** Backend suite runs **full-stack without Docker** via `mongodb-memory-server` (arm64 mongod 7.3.4 from `~/.cache/mongodb-binaries`). Gate: `pnpm test` = `vitest run` (2× full runs green ~24s, `pool: 'forks'`, `maxForks: 1`).

---

## Layer 1 — Domain Testing (428 tests) ✅

| Module | Test File | Tests | Status |
|--------|-----------|-------|--------|
| Shared | `@shared/domain/__tests__/AggregateRoot.test.ts` | 5 | ✅ |
| Catalog | `catalog/domain/__tests__/Product.test.ts` | 10 | ✅ |
| Customer | `customer/domain/__tests__/Customer.test.ts` | 17 | ✅ |
| Discount | `discount/domain/__tests__/BuyXGetYEffect.test.ts` | 16 | ✅ |
| Discount | `discount/domain/__tests__/ConditionEvaluator.test.ts` | 9 | ✅ |
| Discount | `discount/domain/__tests__/DiscountConfiguration.test.ts` | 4 | ✅ |
| Discount | `discount/domain/__tests__/DiscountEngine.test.ts` | 10 | ✅ |
| Discount | `discount/domain/__tests__/DiscountPolicy.test.ts` | 3 | ✅ |
| Discount | `discount/domain/__tests__/DiscountRule.test.ts` | 7 | ✅ |
| Discount | `discount/domain/__tests__/DiscountScope.test.ts` | 4 | ✅ |
| Discount | `discount/domain/__tests__/PromoCode.test.ts` | 5 | ✅ |
| Discount | `…/strategies/allocation/AllocationStrategy.test.ts` | 10 | ✅ |
| Discount | `…/strategies/effects/FixedPriceEffect.test.ts` | 4 | ✅ |
| Discount | `…/strategies/effects/FreeItemEffect.test.ts` | 7 | ✅ |
| Identity | `identity/domain/__tests__/User.test.ts` | 14 | ✅ |
| Inventory | `inventory/domain/__tests__/Stock.test.ts` | 18 | ✅ |
| Inventory | `inventory/domain/__tests__/StockMovement.test.ts` | 5 | ✅ |
| Ordering | `ordering/domain/__tests__/Order.test.ts` | 58 | ✅ |
| Payment | `payment/domain/__tests__/Payment.test.ts` | 7 | ✅ |
| POS | `pos/domain/__tests__/Shift.test.ts` | 9 | ✅ |
| Pricing | `pricing/domain/__tests__/PricingProfile.test.ts` | 9 | ✅ |
| Promotion | `promotion/domain/__tests__/Promotion.test.ts` | 35 | ✅ |
| Tax | `tax/domain/__tests__/AdjustmentPipeline.test.ts` | 12 | ✅ |
| Tax | `tax/domain/__tests__/ModifierEngine.test.ts` | 11 | ✅ |
| Tax | `tax/domain/__tests__/PricingEngine.test.ts` | 43 | ✅ |
| Tax | `tax/domain/__tests__/RoundingEngine.test.ts` | 9 | ✅ |
| Tax | `tax/domain/__tests__/TaxConfiguration.test.ts` | 14 | ✅ |
| Tax | `tax/domain/__tests__/TaxEngine.test.ts` | 14 | ✅ |
| Tax | `tax/domain/__tests__/TaxPolicy.test.ts` | 3 | ✅ |
| Tax | `tax/domain/__tests__/TaxRule.test.ts` | 22 | ✅ |
| Tax | `tax/domain/__tests__/TaxScope.test.ts` | 17 | ✅ |
| Tenant | `tenant/domain/__tests__/Tenant.test.ts` | 17 | ✅ |

## Layer 2 — Application Services (256 tests) ✅

| Module | Test File | Tests | Status |
|--------|-----------|-------|--------|
| Identity | `AuthService.test.ts` | 15 | ✅ |
| Identity | `UserService.test.ts` | 6 | ✅ |
| Tenant | `TenantService.test.ts` | 10 | ✅ |
| Catalog | `ProductService.test.ts` | 18 | ✅ |
| Inventory | `InventoryService.test.ts` | 40 | ✅ |
| Inventory | `WarehouseService.test.ts` | 11 | ✅ |
| Promotion | `PromotionService.test.ts` | 16 | ✅ |
| Customer | `CustomerService.test.ts` | 18 | ✅ |
| Ordering | `OrderService.test.ts` | 26 | ✅ |
| Payment | `PaymentService.test.ts` | 22 | ✅ |
| Payment | `PaymentService.qris.test.ts` | 12 | ✅ |
| POS | `ShiftService.test.ts` | 13 | ✅ |
| POS | `VoidApprovalService.test.ts` | 6 | ✅ |
| Reports | `ReportService.test.ts` | 10 | ✅ |
| Reports | `ReportExportService.test.ts` | 9 | ✅ |
| QRIS | `QrisGatewayService.test.ts` | 24 | ✅ |

## Layer 3 — Repository Testing (66 tests) ✅

| Module | Test File | Tests | Status |
|--------|-----------|-------|--------|
| Ordering | `MongoOrderRepository.test.ts` | 11 | ✅ |
| POS | `MongoShiftRepository.test.ts` | 9 | ✅ |
| Payment | `MongoPaymentRepository.test.ts` | 7 | ✅ |
| Identity | `MongoUserRepository.test.ts` | 10 | ✅ |
| Tenant | `MongoTenantRepository.test.ts` | 8 | ✅ |
| Catalog | `MongoProductRepository.test.ts` | 12 | ✅ |
| Inventory | `MongoStockRepository.test.ts` | 9 | ✅ |

## Layer 4 — API Testing (34 tests) ✅

| Module | Test File | Tests | Status |
|--------|-----------|-------|--------|
| Auth | `auth.routes.test.ts` | 8 | ✅ |
| Orders | `order.routes.test.ts` | 6 | ✅ |
| Payments | `payment.routes.test.ts` | 10 | ✅ |
| Tax/pricing | `tax.routes.test.ts` | 10 | ✅ |

## Layer 5 — Integration Testing (23 tests) ✅

| Test File | Tests | Status |
|-----------|-------|--------|
| `order-payment-flow.test.ts` | 10 | ✅ |
| `tenant-isolation.test.ts` | 11 | ✅ |
| `void-item.test.ts` | 2 | ✅ |

> All three integration files run on the rewritten shared harness `tests/helpers/integration.ts` (correct modern service wiring — PaymentService 14 args, OrderController 24 args, tax mock rebuilds the 12% VAT pipeline) against real MongoDB (memory-server). `tenant-isolation` uses `ISOLATION_PERMS` (order/payment/shift routes are `authenticate`-only, product/inventory mutations now require `products:write`/`inventory:write`).

## Layer 6 — E2E Critical Paths (5 tests) ✅

| Test File | Tests | Status |
|-----------|-------|--------|
| `critical-path-flows.test.ts` | 5 | ✅ |

Real HTTP flows through the actual Express stack (`buildIntegrationApp({ enforceShift: true, permissions })`) with full service wiring:
1. **Money loop**: open shift → create product → stock-in → pay cash → assert totals/rounding/paymentBreakdown → stock decremented → **`GET /orders/:id/invoice`** (seeded standard invoice template → base64 PDF + `INV-…`) → close shift (expectedCash = openingBalance formula).
2. **Shift enforcement**: `pay-cash` without open shift → 400 "Buka shift…".
3. **Carried-over held bill**: hold → close shift → `carriedOverBills` snapshot → next shift → `/shifts/carried-bills` lists it → pay as new sale → `/orders/:id/close-bill` cancelled → carried-bills count 0 → stock reconciled.
4. **Void restores stock**: paid order void → qty returned to stock (via `restockForVoid`).
5. **Tenant isolation**: cross-tenant order/product/stock reads rejected, `current` shift null, order list empty.

## Layer 7 — Document Engine & Template (138 tests) ✅

### Document Engine (101 tests)

| Test File | Tests | Status |
|-----------|-------|--------|
| `expression-evaluator.test.ts` | 9 | ✅ |
| `formatters.test.ts` | 15 | ✅ |
| `variable-resolver.test.ts` | 16 | ✅ |
| `registries.test.ts` | 14 | ✅ |
| `template-engine.test.ts` | 9 | ✅ |
| `thermal-layout.test.ts` | 8 | ✅ |
| `condition-evaluator.test.ts` | 11 | ✅ |
| `template-validator.test.ts` | 8 | ✅ |
| `section-sorter.test.ts` | 4 | ✅ |
| `defaults.test.ts` | 7 | ✅ |

### Template & Print Services (37 tests)

| Test File | Tests | Status |
|-----------|-------|--------|
| `TemplateAPI.test.ts` | 9 | ✅ |
| `Template.test.ts` | 7 | ✅ |
| `InvoiceRenderService.test.ts` | 9 | ✅ |
| `ReceiptRenderService.test.ts` | 6 | ✅ |
| `PrintService.test.ts` | 6 | ✅ |

## Frontend (76 tests) ✅

| Test File | Tests | Status |
|-----------|-------|--------|
| `posStore.test.ts` (incl. void cleanup) | 11 | ✅ |
| `taxCalculator.test.ts` | 14 | ✅ |
| `paymentLabels.test.ts` | 4 | ✅ |
| `TransactionHistory.test.tsx` | 9 | ✅ |
| `VoidOrderModal.test.tsx` | 7 | ✅ |
| `VoidItemModal.test.tsx` | 7 | ✅ |
| `VoidPayment.test.tsx` | 7 | ✅ |
| `UserListPage.test.tsx` | 7 | ✅ |
| `useInventorySummaryReport.test.tsx` | 2 | ✅ |
| `useProfitLossReport.test.tsx` | 2 | ✅ |
| `useQrisPayment.test.ts` | 6 | ✅ |

## Test Infrastructure (2026-08-30)

- **No Docker needed**: `tests/helpers/db.ts` runs `mongodb-memory-server` (mongod 7.3.4, aarch64 binary from `~/.cache/mongodb-binaries`, selected by `resolveSystemBinary()` or env `MONGO_SYSTEM_BINARY`); falls back to external `MONGO_URI` if set. `teardownTestDb()` stops the server. `.env.test` has `MONGO_URI` commented (memory-server default).
- **Deterministic parallel mode**: `vitest.config.ts` → `pool: 'forks'`, `poolOptions.forks { maxForks: 1, minForks: 1 }` (RAM-bound box; raises can be tuned on CI).
- **Harness rebuilt**: `tests/helpers/integration.ts` wires every service to its current constructor signature; `IntegrationTestContext` exposes repos/models/services/token/tenantId. `buildTaxServiceMock()` reproduces the 12% VAT exclusif pipeline (base = taxable×11/12).
- Commands:
  - Backend: `cd backend && pnpm test` (vitest run, full, no docker), `pnpm test:watch`, `pnpm test:coverage`
  - Type-check: `cd backend && npx tsc --noEmit` (clean)

## Next Priority

1. **Load testing** — k6 script up as an artifact (`backend/loadtest/`), drill against a live/deployed backend
2. **Browser E2E (Playwright/Cypress)** for the POS UI (login → open shift → ring up → pay → print), optionally with WebUSB printer stubbing
3. Full local stack boot smoke test (`pnpm dev` + frontend against memory/real Mongo)