# Part XII — Testing

## 15.1 Test Strategy

```
TEST PYRAMID (Pricing Engine)
         ╱╲
        ╱  ╲
       ╱ E2E╲        ← 3-5 integration scenarios
      ╱──────╲
     ╱Integration╲    ← 10-20 scoped tests
    ╱────────────╲
   ╱   Unit Tests   ╲  ← 200+ tests (seluruh komponen)
  ╱──────────────────╲
```

### Ratio
| Level | Quantity | Coverage Target |
|-------|----------|-----------------|
| Unit | ~200 tests | 90%+ line coverage |
| Integration | ~15 tests | 70%+ scenario coverage |
| E2E | ~5 tests | Critical paths |

## 15.2 Unit Test Coverage Map

### DiscountEngine (~80 tests)

| Area | Tests | Description |
|------|-------|-------------|
| PercentageOffEffect | 15 | 10% / 50% / 100% / 0% / fractional |
| NominalOffEffect | 10 | Various amounts, cap, exceed subtotal |
| Scope: all | 5 | Semua item kena |
| Scope: category | 8 | Match/mismatch category |
| Scope: product | 8 | Match/mismatch product |
| Conditions | 25 | min_purchase, min_items, day_of_week, etc. |
| Stackable | 5 | Stack/non-stack rules |
| Priority | 4 | Urutan eksekusi |
| Edge cases | 10 | Empty items, expired rule, etc. |

### ChargeEngine (~30 tests)

| Area | Tests | Description |
|------|-------|-------------|
| Single charge | 5 | 10% SC |
| Multiple charges | 5 | SC + biaya lain |
| includeInTaxBase | 8 | true / false |
| Scope filtering | 5 | ALL / CATEGORY / PRODUCT |
| Zero rate | 3 | Skip jika rate = 0 |
| Edge cases | 4 | Empty charges, inactive, dll |

### TaxEngine (~60 tests)

| Area | Tests | Description |
|------|-------|-------------|
| Single tax rule | 10 | PPN 11% / 12% |
| Modifier fraction | 10 | 11/12 fraction |
| Modifier multiplier | 5 | |
| Modifier fixed_deduction | 5 | |
| Multi tax | 8 | PPN + PPh |
| Inclusive pricing | 10 | Hitung mundur |
| Rounding per-rule | 5 | round/floor/ceil |
| Edge cases | 7 | Zero rate, no rules, dll |

### RoundingEngine (~15 tests)

| Area | Tests | Description |
|------|-------|-------------|
| round | 5 | Positive, negative, zero |
| floor | 5 | Positive, negative, zero |
| ceil | 5 | Positive, negative, zero |

### PricingService (~15 tests)

| Area | Tests | Description |
|------|-------|-------------|
| Full pipeline | 10 | Discount + SC + PPN |
| Error handling | 3 | Invalid items, no config |
| Empty cart | 2 | |

### Frontend TaxCalculator (~14 tests)

| Area | Tests | Description |
|------|-------|-------------|
| Inclusive calculation | 7 | PPN in/exclusive |
| Display formatting | 7 | |
| Edge cases | | Zero, negative |

## 15.3 Integration Test Scenarios

| # | Skenario | Items | Discount | SC | PPN | Expected |
|---|----------|-------|----------|----|-----|----------|
| INT-01 | Full stack + multi item | 3 items | 50% cat | 10% | 12% | Sesuai |
| INT-02 | Stacking 2 discounts | 2 items | 50% + 10% | 10% | 12% | Sesuai |
| INT-03 | Nominal + percentage | 2 items | Rp10k + 50% | 10% | 12% | Sesuai |
| INT-04 | Inclusive pricing | 2 items | - | - | 12% | Sesuai |
| INT-05 | Empty discount | 2 items | - | 10% | 12% | Sesuai |
| INT-06 | Gratis (100%) | 2 items | 100% | 10% | 12% | 0 |
| INT-07 | Service Charge excluded | 2 items | 50% | 10%* | 12% | SC tdk masuk DPP |

## 15.4 E2E Test Scenarios

| # | Skenario | Path |
|---|----------|------|
| E2E-01 | Add item → calculate → display correct price | Frontend → API → Frontend |
| E2E-02 | Apply promo code → recalculate → discount applied | Frontend → API |
| E2E-03 | Multiple items with mixed categories → correct per-item pricing | Frontend → API → Display |
| E2E-04 | Remove item → recalculate → correct total | Frontend → API |

## 15.5 Running Tests

```bash
# Backend tests
cd backend && npm test

# Specific test file
cd backend && npx jest src/core/__tests__/pricing-engine.test.ts

# Frontend tax calculator tests
cd frontend && npm test -- --testPathPattern=taxCalculator

# Coverage
cd backend && npx jest --coverage
```

## 15.6 Test Fixtures

```typescript
// Common test fixture
const defaultFixture = {
  items: [
    { productId: 'kopi', name: 'Kopi Susu', categoryId: 'cat-kopi',
      quantity: 2, unitPrice: 25000 },
  ],
  discount: { promoCode: 'KOPI50', customerGroup: 'regular' },
  metadata: { outletId: 'outlet-jkt-01', tenantId: 'tenant-001' },
};

const taxConfig = {
  tenantId: 'tenant-001',
  taxEnabled: true,
  pricingMode: 'exclusive',
  versions: [{
    id: 'v1',
    versionNumber: 1,
    status: 'active',
    effectiveDate: new Date('2025-01-01'),
    rules: [{
      id: 'rule-ppn-12',
      name: 'PPN 12%',
      taxType: 'PPN',
      rate: 12,
      priority: 1,
      isActive: true,
      scope: { type: 'ALL' },
      modifier: {
        type: 'fraction',
        config: { numerator: 11, denominator: 12 },
      },
      roundingMode: 'round',
      precision: 0,
    }],
    charges: [{
      id: 'charge-sc',
      name: 'Service Charge',
      rate: 10,
      isActive: true,
      priority: 1,
      scope: { type: 'ALL' },
      includeInTaxBase: true,
      roundingMode: 'round',
      precision: 0,
    }],
  }],
};
```

## 15.7 Assertion Examples

```typescript
// Pricing result structure
expect(result).toHaveProperty('subtotal');
expect(result).toHaveProperty('adjustments');
expect(result).toHaveProperty('grandTotal');
expect(result.subtotal).toBeGreaterThanOrEqual(0);
expect(result.grandTotal).toBeGreaterThanOrEqual(0);

// Adjustment invariant
const adjSum = result.adjustments
  .filter(a => a.affectsGrandTotal)
  .reduce((s, a) => s + a.amount, 0);
expect(result.subtotal + adjSum).toBe(result.grandTotal);

// Discount cap
expect(result.discount).toBeLessThanOrEqual(result.subtotal);

// Tax accuracy (integer)
expect(Number.isInteger(result.taxAmount)).toBe(true);
expect(Number.isInteger(result.grandTotal)).toBe(true);
```
