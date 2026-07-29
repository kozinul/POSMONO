# Part II: Domain Model

## 2.1 Aggregate Overview

```
┌────────────────────────────────────────────────────────────┐
│                     PRICING SERVICE                         │
│  (Application Service — orchestrator)                       │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Discount     │  │ Pricing      │  │ TaxConfiguration │  │
│  │ Service      │──│ Engine       │──│ Repository       │  │
│  │ Adapter      │  │              │  │                  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────┘  │
│         │                 │                                 │
│         ▼                 ▼                                 │
│  ┌──────────────┐  ┌──────────────────┐                    │
│  │ Discount     │  │ Adjustment       │                    │
│  │ Engine       │  │ Pipeline         │                    │
│  └──────────────┘  └──────────────────┘                    │
└────────────────────────────────────────────────────────────┘
```

## 2.2 Aggregate: TaxConfiguration

```
┌─────────────────────────────────────────────────┐
│  TaxConfiguration  (AGGREGATE ROOT)              │
│─────────────────────────────────────────────────│
│  - tenantId: string                              │
│  - taxEnabled: boolean                           │
│  - pricingMode: 'inclusive' | 'exclusive'        │
│  - countryCode: string (default: 'ID')           │
│  - currency: string (default: 'IDR')             │
│  - versions: TaxVersion[]                        │
│  - metadata: Record<string, unknown>             │
│                                                 │
│  + enable() / disable()                          │
│  + addRule(rule) / removeRule(id) / updateRule() │
│  + addCharge(charge) / removeCharge(id)          │
│  + getActiveRules(): TaxRule[]                   │
│  + getActiveCharges(): Charge[]                  │
│  + isTaxEnabled(): boolean                       │
│  + getPricingMode(): string                      │
└─────────────────────────────────────────────────┘
         │
         ├──┐
         │  │
         ▼  ▼
┌──────────────┐  ┌─────────────────┐
│  TaxRule     │  │  Charge         │
│──────────────│  │─────────────────│
│  ENTITY      │  │  ENTITY         │
│──────────────│  │─────────────────│
│  id          │  │  id             │
│  name        │  │  name           │
│  taxType     │  │  rate | amount  │
│  scope       │  │  includeInTax   │
│  policy      │  │   Base: boolean │
│  modifier    │  │  scope          │
│  priority    │  │  priority       │
│  conditions  │  │  isActive       │
│  isActive    │  │                 │
│              │  │  + calculate()  │
│  + calculate │  │  + calculate    │
│    Tax()     │  │   Inclusive()   │
└──────────────┘  └─────────────────┘
```

### TaxVersion (Value Object)

```typescript
interface TaxVersion {
  id: string;
  versionNumber: number;
  status: 'active' | 'draft' | 'deprecated';
  effectiveDate: Date;
  rules: TaxRule[];
  charges: Charge[];
}
```

## 2.3 Aggregate: DiscountConfiguration

```
┌─────────────────────────────────────────────────┐
│  DiscountConfiguration  (AGGREGATE ROOT)         │
│─────────────────────────────────────────────────│
│  - id: string                                   │
│  - tenantId: string                              │
│  - enabled: boolean                              │
│  - rules: DiscountRule[]                         │
│  - createdAt / updatedAt: Date                   │
│                                                 │
│  + enable() / disable()                          │
│  + addRule(rule) / removeRule(id)               │
│  + getActiveRules(): DiscountRule[]              │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  DiscountRule  (ENTITY)                                  │
│─────────────────────────────────────────────────────────│
│  - id, name, priority, stackable, active                 │
│  - scope: DiscountScope                                  │
│  - policy: DiscountPolicy                                │
│  - conditions: IDiscountCondition[]                      │
│  - effects: IDiscountEffect[]                            │
│  - promoCodeId?, maxUsageCount?, startDate?, endDate?   │
│                                                         │
│  + isExpired(): boolean                                  │
│  + scopeMatches(context): boolean                        │
│  + calculate(subtotal): DiscountRuleResult               │
│  + isStackable(): boolean                                │
└─────────────────────────────────────────────────────────┘
         │
         ├──────┬──────────┬──────────────┐
         ▼      ▼          ▼              ▼
┌────────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐
│Discount    │ │Discount│ │Condition │ │Effect    │
│Scope       │ │Policy  │ │Strategy  │ │Strategy  │
│(VALUE OBJ) │ │(VALUE  │ │(STRATEGY)│ │(STRATEGY)│
│            │ │ OBJ)   │ │          │ │          │
│ all        │ │percent │ │ min_purch│ │percent_off│
│ category   │ │nominal │ │ min_items│ │nominal_off│
│ product    │ │maxCap  │ │ category │ │free_item  │
│ customer   │ │        │ │ product  │ │fixed_price│
│  _group    │ │        │ │ day_of   │ │bundle_price│
│ outlet     │ │        │ │  _week   │ │           │
│            │ │        │ │ date_range│ │           │
│            │ │        │ │ time_range│ │           │
│            │ │        │ │ cust_tag  │ │           │
│            │ │        │ │ qty_thresh│ │           │
└────────────┘ └────────┘ └──────────┘ └──────────┘
```

## 2.4 Value Objects

### TaxPolicy
```typescript
interface TaxPolicy {
  type: 'rate' | 'amount' | 'percentage_of_base' | 'formula';
  value: number;
  roundingMode: 'round' | 'floor' | 'ceil';
  precision: number; // 0 atau 2
}
```

### ModifierConfig
```typescript
interface ModifierConfig {
  type: 'none' | 'fraction' | 'multiplier' | 'fixed_deduction';
  config?: {
    numerator?: number;    // untuk fraction
    denominator?: number;  // untuk fraction
    multiplier?: number;   // untuk multiplier
    deduction?: number;    // untuk fixed_deduction
  };
}
```

### DiscountScope
```typescript
interface DiscountScope {
  type: 'all' | 'category' | 'product' | 'customer_group' | 'outlet';
  entityId: string;
  entityName: string;
}
```

### DiscountPolicy
```typescript
interface DiscountPolicy {
  type: 'percentage' | 'nominal';
  value: number;
  maxCap?: number;
  application: 'per_order';
  roundingMode: 'round' | 'floor' | 'ceil';
  precision: number;
}
```

## 2.5 Entity Lifecycles

### TaxRule Lifecycle
```
DRAFT ──activate──▶ ACTIVE ──deactivate──▶ INACTIVE
                     │
                     ├── expire ──▶ EXPIRED
                     └── update ──▶ ACTIVE (new version)
```

### Charge Lifecycle
```
ACTIVE ──deactivate──▶ INACTIVE
  │
  ├── update ──▶ ACTIVE
  └── expire ──▶ EXPIRED
```

### DiscountRule Lifecycle
```
ACTIVE ──deactivate──▶ INACTIVE
  │
  ├── maxUsage reached ──▶ EXPIRED
  ├── endDate passed ──▶ EXPIRED
  └── usage increment ──▶ ACTIVE (usage++)
```

## 2.6 Invariants

| Invariant | Berlaku untuk | Dilanggar jika |
|-----------|---------------|----------------|
| Subtotal >= 0 | Semua transaksi | Subtotal < 0 |
| Discount <= subtotal | DiscountRule.calculate | Discount > subtotal |
| Tax rate >= 0 | TaxRule | Rate < 0 |
| Grand total = subtotal + charge + tax - discount + rounding | Semua transaksi | Tidak sama |
| DPP + charge + tax = price (inclusive mode) | Inclusive pricing | Tidak sama |
| modifier fraction: denominator != 0 | FractionModifier | Denominator = 0 |
| priority unique per version | TaxConfiguration | Duplicate priority |
