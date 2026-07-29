# Part VIII — Sequence & Class Diagrams

## 12.1 Pricing Flow — Full Sequence

```
User/Frontend          PricingService         DiscountEngine        ChargeEngine         TaxEngine          RoundingEngine
     │                       │                      │                    │                  │                  │
     │  POST /calculate      │                      │                    │                  │                  │
     │──────────────────────▶│                      │                    │                  │                  │
     │                       │                      │                    │                  │                  │
     │                       │  loadTaxConfig()     │                    │                  │                  │
     │                       │──────────────────────│────────────────────│──────────────────│──────────────────│
     │                       │◀─────────────────────│────────────────────│──────────────────│──────────────────│
     │                       │                      │                    │                  │                  │
     │                       │  loadDiscountConfig()│                    │                  │                  │
     │                       │─────────────────────▶│                    │                  │                  │
     │                       │◀─────────────────────│                    │                  │                  │
     │                       │                      │                    │                  │                  │
     │                       │  calculate()         │                    │                  │                  │
     │                       │─────────────────────▶│                    │                  │                  │
     │                       │                      │                    │                  │                  │
     │                       │                      │  filterActive()    │                  │                  │
     │                       │                      │  sortByPriority()  │                  │                  │
     │                       │                      │  evaluateCond()    │                  │                  │
     │                       │                      │  forEach rule:     │                  │                  │
     │                       │                      │    scopeMatch()    │                  │                  │
     │                       │                      │    calcMatchingSub │                  │                  │
     │                       │                      │    applyEffect()   │                  │                  │
     │                       │                      │  capDiscount()     │                  │                  │
     │                       │                      │  round()           │                  │                  │
     │                       │                      │                    │                  │                  │
     │                       │◀─adj[DISCOUNT]───────│                    │                  │                  │
     │                       │                      │                    │                  │                  │
     │                       │  calculateCharges()  │                    │                  │                  │
     │                       │──────────────────────────────────────────▶│                  │                  │
     │                       │                      │                    │                  │                  │
     │                       │                      │                    │  filterActive()  │                  │
     │                       │                      │                    │  calcBase()      │                  │
     │                       │                      │                    │  applyRate()     │                  │
     │                       │                      │                    │  round()         │                  │
     │                       │                      │                    │                  │                  │
     │                       │◀─adj[CHARGE]──────────────────────────────│                  │                  │
     │                       │                      │                    │                  │                  │
     │                       │  calculateTax()      │                    │                  │                  │
     │                       │────────────────────────────────────────────────────────────▶│                  │
     │                       │                      │                    │                  │                  │
     │                       │                      │                    │                  │  filterRules()  │
     │                       │                      │                    │                  │  calcDPP()       │
     │                       │                      │                    │                  │  applyModifier() │
     │                       │                      │                    │                  │  calcTax()       │
     │                       │                      │                    │                  │  round()         │
     │                       │                      │                    │                  │                  │
     │                       │◀─adj[TAX]────────────────────────────────────────────────────│                  │
     │                       │                      │                    │                  │                  │
     │                       │  roundGrandTotal()   │                    │                  │                  │
     │                       │─────────────────────────────────────────────────────────────────────────────▶│
     │                       │◀─────────────────────────────────────────────────────────────────────────────│
     │                       │                      │                    │                  │                  │
     │                       │  buildResult()       │                    │                  │                  │
     │                       │                      │                    │                  │                  │
     │  ◀────200 OK──────────│                      │                    │                  │                  │
     │  { result }           │                      │                    │                  │                  │
     │                       │                      │                    │                  │                  │
```

## 12.2 Frontend → Backend Flow

```
PosPage                    posStore               pricingApi              backend
  │                          │                        │                     │
  │ user clicks "add item"   │                        │                     │
  │─────────────────────────▶│                        │                     │
  │                          │                        │                     │
  │                          │ addItem(product)        │                     │
  │                          │ updateCart()            │                     │
  │                          │ recalculate()           │                     │
  │                          │────────────────────────▶│                     │
  │                          │                         │                     │
  │                          │                         │ POST /calculate    │
  │                          │                         │────────────────────▶│
  │                          │                         │                     │
  │                          │                         │ ◀───200 OK─────────│
  │                          │                         │                     │
  │                          │◀────────result──────────│                     │
  │                          │                         │                     │
  │                          │ update items[]          │                     │
  │                          │ update summary          │                     │
  │                          │                         │                     │
  │◀─────re-render───────────│                         │                     │
  │                          │                         │                     │
```

## 12.3 Promotion → Discount Sync Sequence

```
PromotionService         DiscountService         DiscountConfigRepo        DiscountEngine
     │                        │                        │                      │
     │  createPromotion()     │                        │                      │
     │───────┐                │                        │                      │
     │       │ save to DB     │                        │                      │
     │<──────┘                │                        │                      │
     │                        │                        │                      │
     │  syncToDiscountConfig()│                        │                      │
     │───────────────────────▶│                        │                      │
     │                        │                        │                      │
     │                        │  mapRules()             │                      │
     │                        │  mapEffects()           │                      │
     │                        │  determineScope()       │                      │
     │                        │                        │                      │
     │                        │  upsertRule()           │                      │
     │                        │────────────────────────▶│                      │
     │                        │◀───────ack─────────────│                      │
     │                        │                        │                      │
     │◀────────────ack────────│                        │                      │
     │                        │                        │                      │
     │                        │                        │  (selanjutnya         │
     │                        │                        │   setiap kalkulasi    │
     │                        │                        │   baca dr repo)       │
     │                        │                        │──────────────────────▶│
```

## 12.4 Class Diagram: Domain Model

```
┌──────────────────────────────┐
│  TaxConfiguration            │
├──────────────────────────────┤
│  + tenantId: string          │
│  + taxEnabled: boolean       │
│  + pricingMode: PricingMode  │
│  + countryCode: string       │
│  + currency: string          │
│  + versions: TaxVersion[]    │
├──────────────────────────────┤
│  + getActiveRules()          │
│  + getActiveCharges()        │
│  + addVersion(v)             │
│  + switchVersion(id)         │
└──────────────┬───────────────┘
               │
               │ 1..* versions
               ▼
┌──────────────────────────────┐
│  TaxVersion                  │
├──────────────────────────────┤
│  + id: string                │
│  + versionNumber: number     │
│  + status: VersionStatus     │
│  + effectiveDate: Date       │
│  + rules: TaxRule[]          │
│  + charges: Charge[]         │
└──────────────────────────────┘
               │
               ├── 0..* rules
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  TaxRule                                             │
├──────────────────────────────────────────────────────┤
│  + id, name, taxType, rate, rateType                  │
│  + priority, isActive, scope, modifier                │
│  + roundingMode, precision, taxGroup, metadata        │
├──────────────────────────────────────────────────────┤
│  + calculateTax(dpp): TaxResult                       │
│  + applyModifier(dpp): number                         │
│  + isScopeMatch(item): boolean                        │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  Charge                                              │
├──────────────────────────────────────────────────────┤
│  + id, name, rate, isActive, priority                 │
│  + scope, includeInTaxBase                            │
│  + roundingMode, precision                            │
├──────────────────────────────────────────────────────┤
│  + calculate(base): ChargeResult                      │
│  + isScopeMatch(item): boolean                        │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  DiscountRule                                        │
├──────────────────────────────────────────────────────┤
│  + id, name, priority, stackable, active              │
│  + scope: DiscountScope                               │
│  + policy: DiscountPolicy                             │
│  + conditions: IDiscountCondition[]                   │
│  + effects: IDiscountEffect[]                         │
│  + promoCodeId, maxUsageCount, usageCount             │
│  + startDate, endDate                                 │
├──────────────────────────────────────────────────────┤
│  + isExpired(): boolean                               │
│  + isStackable(): boolean                             │
│  + scopeMatches(context): boolean                     │
│  + calculate(subtotal): DiscountRuleResult            │
│  + evaluateConditions(context): boolean               │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  PricingEngine                                       │
├──────────────────────────────────────────────────────┤
│  - discountEngine: DiscountEngine                     │
│  - chargeEngine: ChargeEngine                         │
│  - taxEngine: TaxEngine                               │
│  - roundingEngine: RoundingEngine                     │
├──────────────────────────────────────────────────────┤
│  + calculate(request): PricingResult                  │
│  - buildContext(request): PricingContext              │
│  - applyAdjustments(ctx): PricingResult               │
│  - verifyResult(result): boolean                      │
└──────────────────────────────────────────────────────┘
```

## 12.5 Class Diagram: Pipeline

```
┌────────────────────────────────────────────┐
│  AdjustmentStep  (interface)                │
├────────────────────────────────────────────┤
│  + sequence: number                         │
│  + execute(ctx: PipelineContext): void       │
└────────────────────────────────────────────┘
          ▲
          │
  ┌───────┼───────────┬───────────────┐
  │       │           │               │
  ▼       ▼           ▼               ▼
┌──────┐ ┌────────┐ ┌───────┐ ┌────────────┐
│Disc  │ │Charge  │ │Tax    │ │Rounding    │
│Step  │ │Step    │ │Step   │ │Step        │
└──────┘ └────────┘ └───────┘ └────────────┘

┌────────────────────────────────────────────┐
│  PipelineContext                            │
├────────────────────────────────────────────┤
│  + items: TaxItem[]                         │
│  + subtotal: number                         │
│  + runningTotal: number                     │
│  + taxBase: number                          │
│  + adjustments: Adjustment[]                │
│  + metadata: Record<string, unknown>        │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│  PricingResult                              │
├────────────────────────────────────────────┤
│  + subtotal: number                         │
│  + adjustments: Adjustment[]                │
│  + discount: number                         │
│  + charges: ChargeItem[]                    │
│  + taxBase: number                          │
│  + modifier: ModifierInfo                   │
│  + taxes: TaxLineItem[]                     │
│  + taxAmount: number                        │
│  + grandTotal: number                       │
└────────────────────────────────────────────┘
```
