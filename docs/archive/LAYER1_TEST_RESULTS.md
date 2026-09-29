# Layer 1 — Domain Test Results

> **Date:** 2026-06-30
> **Tool:** Vitest v1.6.1
> **Files:** 9 · **Tests:** 93 ✅ · **Duration:** 221ms

---

## `@shared/domain` — AggregateRoot

**File:** `src/@shared/domain/__tests__/AggregateRoot.test.ts` · **Tests: 5**

| Test | Result |
|------|--------|
| initially has no domain events | ✅ |
| returns added domain events | ✅ |
| returns a copy of domain events (immutable) | ✅ |
| clears events after clearEvents() | ✅ |
| can add events again after clearing | ✅ |

**Edge cases covered:** empty state, mutation protection, reusability after clear.

---

## `core/identity` — User

**File:** `src/core/identity/domain/__tests__/User.test.ts` · **Tests: 14**

| Test | Result |
|------|--------|
| creates an active user with given fields | ✅ |
| generates a unique id | ✅ |
| emits platform.user.registered domain event | ✅ |
| throws on empty email | ✅ |
| throws on empty display name | ✅ |
| throws on invalid email format | ✅ |
| recordLogin updates lastLoginAt | ✅ |
| deactivate sets isActive to false | ✅ |
| isActiveUser returns false after deactivation | ✅ |
| activate sets isActive to true | ✅ |
| isActiveUser returns true for active user | ✅ |
| isActiveUser returns false for deactivated user | ✅ |
| serialize returns all user properties | ✅ |
| hydrate restores a user from persisted data | ✅ |

**Invariants tested:** email validation (empty + format), display name required, idempotent activate/deactivate, hydrate preserves state.

---

## `core/tenant` — Tenant

**File:** `src/core/tenant/domain/__tests__/Tenant.test.ts` · **Tests: 17**

| Test | Result |
|------|--------|
| creates a tenant with given fields | ✅ |
| emits platform.tenant.created domain event | ✅ |
| isActive returns true for active status | ✅ |
| isActive returns true for trial status | ✅ |
| isActive returns false for suspended status | ✅ |
| isActive returns false for cancelled status | ✅ |
| suspend sets status to suspended | ✅ |
| suspend emits platform.tenant.suspended event with reason | ✅ |
| activate sets status to active | ✅ |
| enableModule adds a module | ✅ |
| enableModule does not duplicate existing module | ✅ |
| disableModule removes a module | ✅ |
| hasModule returns correct boolean | ✅ |
| updateConfig merges partial config | ✅ |
| updateConfig updates updatedAt timestamp | ✅ |
| serialize returns all tenant properties | ✅ |
| hydrate restores a tenant from persisted data | ✅ |

**Invariants tested:** status transitions (all 4), module deduplication, partial config merge, hydrate after suspend.

---

## `core/catalog` — Product

**File:** `src/core/catalog/domain/__tests__/Product.test.ts` · **Tests: 10**

| Test | Result |
|------|--------|
| creates a product with given fields | ✅ |
| generates a unique id | ✅ |
| emits catalog.product.created domain event | ✅ |
| updates provided fields | ✅ |
| does not change fields not provided | ✅ |
| updates tags when provided | ✅ |
| updates updatedAt timestamp | ✅ |
| can deactivate a product | ✅ |
| serialize returns all product properties | ✅ |
| hydrate restores a product from persisted data | ✅ |

**Invariants tested:** partial update isolation (unprovided fields unchanged), array copy for tags, active/inactive toggle.

---

## `core/inventory` — Stock

**File:** `src/core/inventory/domain/__tests__/Stock.test.ts` · **Tests: 14**

| Test | Result |
|------|--------|
| creates a stock record with given fields | ✅ |
| availableQuantity returns quantity minus reservedQuantity | ✅ |
| availableQuantity reflects changes after reserve | ✅ |
| reserve increases reservedQuantity | ✅ |
| reserve throws if insufficient available quantity | ✅ |
| release decreases reservedQuantity | ✅ |
| release does not go below zero | ✅ |
| adjust increases quantity on positive delta | ✅ |
| adjust decreases quantity on negative delta | ✅ |
| adjust emits inventory.stock.adjusted event | ✅ |
| adjust emits low_alert when quantity at or below minLevel | ✅ |
| adjust does not emit low_alert when quantity is above minLevel | ✅ |
| serialize returns all stock properties | ✅ |
| hydrate restores stock from persisted data | ✅ |

**Invariants tested:** reserve prevents oversell, release clamps at zero, low_alert boundary condition, dual event emission on adjust+low.

---

## `core/inventory` — StockMovement

**File:** `src/core/inventory/domain/__tests__/StockMovement.test.ts` · **Tests: 4**

| Test | Result |
|------|--------|
| creates a stock movement with given fields | ✅ |
| has no state-changing methods (immutable) | ✅ |
| serialize returns all stock movement properties | ✅ |
| hydrate restores a stock movement from persisted data | ✅ |

**Invariants tested:** immutability (no methods beyond constructor/serialize).

---

## `core/ordering` — Order

**File:** `src/core/ordering/domain/__tests__/Order.test.ts` · **Tests: 15**

| Test | Result |
|------|--------|
| creates an order with draft status | ✅ |
| generates a unique order number | ✅ |
| emits ordering.order.created domain event | ✅ |
| clears events after clearEvents() | ✅ |
| transitions from draft to confirmed | ✅ |
| throws if order is not in draft status | ✅ |
| emits ordering.order.confirmed event | ✅ |
| markPaid sets status to paid and paymentStatus to completed | ✅ |
| markPaymentFailed sets paymentStatus to failed | ✅ |
| transitions from draft to cancelled | ✅ |
| throws if order is already paid | ✅ |
| throws if order is already refunded | ✅ |
| emits ordering.order.cancelled event with reason | ✅ |
| serialize returns all order properties | ✅ |
| hydrate restores an order from persisted data | ✅ |

**Invariants tested:** status machine (draft → confirmed → paid), payment status (pending → completed/failed), cancel protection (paid/refunded), unique order number.

---

## `core/payment` — Payment

**File:** `src/core/payment/domain/__tests__/Payment.test.ts` · **Tests: 7**

| Test | Result |
|------|--------|
| creates a payment with pending status | ✅ |
| complete sets status to completed and records paidAt | ✅ |
| complete emits payment.transaction.completed event | ✅ |
| fail sets status to failed | ✅ |
| fail emits payment.transaction.failed event with reason | ✅ |
| serialize returns all payment properties | ✅ |
| hydrate restores a payment from persisted data | ✅ |

**Invariants tested:** complete/fail mutually exclusive, paidAt only set on complete, event payload contains orderId+amount+method.

---

## `core/pos` — Shift

**File:** `src/core/pos/domain/__tests__/Shift.test.ts` · **Tests: 7**

| Test | Result |
|------|--------|
| creates a shift with open status | ✅ |
| emits pos.shift.opened domain event | ✅ |
| transitions from open to closed | ✅ |
| emits pos.shift.closed event with totals | ✅ |
| throws if shift is already closed | ✅ |
| serialize returns all shift properties | ✅ |
| hydrate restores a shift from persisted data | ✅ |

**Invariants tested:** double-close prevention, status transition (open → closed), null fields before close.

---

## Summary

| Metric | Value |
|--------|-------|
| Test files | 9 |
| Total tests | 93 |
| Passed | 93 |
| Failed | 0 |
| Duration | 221ms |
| Modules covered | 8 (shared, identity, tenant, catalog, inventory×2, ordering, payment, pos) |
| Domain events tested | 10 event types across all aggregates |
