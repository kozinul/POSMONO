# Part IV — Discount Engine

## 4.1 Responsibility

Menghitung total diskon yang berlaku untuk suatu order berdasarkan:
- Rule yang aktif (dari DiscountConfiguration)
- Kondisi yang harus dipenuhi (min purchase, category match, dll)
- Scope rule (all / category / product)
- Efek diskon (% off, nominal off, free item, dll)
- Stackability (bisa ditumpuk atau tidak)

## 4.2 Algoritma

```
function calculate():
  1. Filter rules: active only
  2. Sort by priority (ascending)
  3. For each rule:
     a. Skip jika expired
     b. Skip jika promoCodeId != input.promoCode
     c. Evaluate conditions via ConditionEvaluator
        - AND logic: semua kondisi harus true
        - Jika ada kondisi yang false → skip rule
     d. Resolve scope items:
        - scope='all' → semua item
        - scope='category' → item dengan categoryId = entityId
        - scope='product' → item dengan productId = entityId
        - Jika tidak ada item match → skip rule
     e. Calculate matchingSubtotal dari scope items
     f. Apply effects dengan matchingSubtotal sebagai base
     g. Accumulate totalDiscount
     h. Jika tidak stackable → stop
  4. Cap totalDiscount ≤ subtotal
  5. Round totalDiscount
  6. Return result
```

## 4.3 Condition Strategies

| Conditions | Config | Evaluasi |
|------------|--------|----------|
| `min_purchase` | `{ minAmount }` | `subtotal >= minAmount` |
| `min_items` | `{ minItems }` | `totalQty >= minItems` |
| `category_match` | `{ categoryIds[] }` | `items.some(i => categoryIds.includes(i.categoryId))` |
| `product_match` | `{ productIds[] }` | `items.some(i => productIds.includes(i.productId))` |
| `day_of_week` | `{ days[] }` | `days.includes(now.getDay())` |
| `date_range` | `{ startDate, endDate }` | `startDate <= now <= endDate` |
| `time_range` | `{ fromHour, fromMinute, toHour, toMinute }` | `time in range` |
| `quantity_threshold` | `{ productId, minQuantity }` | `item.qty >= minQuantity` |
| `customer_tag` | `{ tags[] }` | `customerTags.some(t => tags.includes(t))` |

Semua kondisi menggunakan **AND logic**. Jika ruleLogic=OR (dari Promotion), maka evaluasi berubah: **cukup satu kondisi true**.

## 4.4 Effect Strategies

| Effect | Config | Kalkulasi |
|--------|--------|-----------|
| `percentage_off` | `{ rate, maxCap?, target? }` | `matchingSubtotal × rate/100` (cap di maxCap). Jika target=remaining, base = subtotal - appliedDiscounts |
| `nominal_off` | `{ amount }` | `min(amount, max(0, subtotal - appliedDiscounts))` |
| `free_item` | `{ productId, quantity }` | Tidak menghasilkan diskon tunai, menghasilkan `freeItems[]` |
| `fixed_price` | `{ productId, fixedPrice }` | `(unitPrice - fixedPrice) × qty` |
| `bundle_price` | `{ productIds[], bundlePrice }` | `originalTotal - bundlePrice` |
| `buy_x_pay_y` | `{ minQty, payQty }` | Mirip free item tapi item "gratis" dihitung dengan price 0 — hasil diskon = `unitPrice × (minQty - payQty) × qualifyingSets` |

## 4.5 Scope Resolution

```
Rule: {'category', entityId='cat-kopi'}

Cart items:
  A: { productId: 'kopi-susu', categoryId: 'cat-kopi',  qty: 2, price: 25000 }
  B: { productId: 'nasi-goreng', categoryId: 'cat-food', qty: 1, price: 50000 }

resolveScopeItems:
  matchingItems = [A]  // hanya item dengan categoryId = 'cat-kopi'
  matchingSubtotal = 2 × 25000 = 50000

Effect: percentage_off 50%
  base = matchingSubtotal = 50000
  amount = 50000 × 50% = 25000
  totalDiscount = 25000
```

## 4.6 Integration: Promotion → Discount

```
PromotionService.create()
  │
  ├── save promotion to MongoDB
  │
  └── syncToDiscountConfig()
        │
        ├── promotionToDiscountRule(promotion)
        │     ├── mapRules() → conditions[]
        │     ├── mapEffects() → effects[]
        │     └── determineScope() → scope
        │
        └── save to discount_configurations collection
```

### Mapping Logic

| Promotion Field | Discount Rule |
|----------------|---------------|
| `code` | `promoCodeId` (uppercase) |
| `rules[].category_match` | `conditions[].category_match` + `scope.category` |
| `rules[].product_match` | `conditions[].product_match` + `scope.product` |
| `effects[].percentage` | `effects[].percentage_off` |
| `effects[].nominal` | `effects[].nominal_off` |
| `validFrom/validUntil` | `startDate/endDate` + `condition.date_range` |
| `isActive` | `active` |
| `priority` | `priority` |
| `stackable` | `stackable` |
| `usageLimit` | `maxUsageCount` |
| `usedCount` | `currentUsageCount` |

## 4.7 Class Diagram

```
┌──────────────────────────┐
│  DiscountEngine          │
├──────────────────────────┤
│  - conditionEvaluator    │
│  - effectApplier         │
│  - roundingEngine        │
├──────────────────────────┤
│  + applyDiscounts()      │
│  - resolveScopeItems()   │
└──────────────────────────┘
         │
         ├──► ConditionEvaluator
         │     ├── MinPurchaseCondition
         │     ├── MinItemsCondition
         │     ├── CategoryMatchCondition
         │     ├── ProductMatchCondition
         │     ├── DayOfWeekCondition
         │     ├── DateRangeCondition
         │     ├── TimeRangeCondition
         │     ├── QuantityThresholdCondition
         │     └── CustomerTagCondition
         │
          └──► EffectApplier
                ├── PercentageOffEffect
                ├── NominalOffEffect
                ├── FreeItemEffect
                ├── FixedPriceEffect
                ├── BundlePriceEffect
                └── BuyXPayYEffect
```
