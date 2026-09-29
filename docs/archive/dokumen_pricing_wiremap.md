# Wiremap Sistem Pricing POS

## Arsitektur Aliran Data

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (React + Zustand)                                 │
│                                                             │
│  PosPage                                                    │
│  ├── useDiscountConfiguration() → GET /discount             │
│  ├── ProductCard (tampilkan badge diskon)                   │
│  ├── CartItemRow (tampilkan harga + diskon per-item)        │
│  ├── PaymentModal → POST /payments/pay-cash                 │
│  └── useEffect → recalculate()                              │
│       └── POST /pricing/calculate                           │
│            ├── items[{productId, categoryId, qty, price}]   │
│            ├── promoCode?                                    │
│            └── manualDiscount?                               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  BACKEND API (Express Router)                               │
│                                                             │
│  pricing.routes.ts                                          │
│  └── POST /pricing/calculate                                │
│       └── PricingController.calculate()                     │
│            └── PricingService.calculate()                    │
│                                                             │
│  discount.routes.ts                                         │
│  ├── GET  /discount          — ambil konfigurasi            │
│  ├── PUT  /discount/toggle   — enable/disable               │
│  ├── POST /discount/rules    — tambah rule                  │
│  ├── POST /discount/calculate— hitung diskon                │
│  └── POST /discount/validate-promo — validasi kode promo    │
│                                                             │
│  promotion.routes.ts                                        │
│  ├── POST /promotions        — buat promo                   │
│  └── ...CRUD promotions                                     │
│                                                             │
│  tax.routes.ts                                              │
│  ├── GET  /tax/config        — ambil konfigurasi pajak      │
│  ├── PUT  /tax/config        — update konfigurasi           │
│  ├── POST /tax/rules         — tambah rule pajak            │
│  ├── POST /tax/charges       — tambah charge (SC)           │
│  └── POST /tax/calculate     — hitung pajak                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. DISCOUNT ENGINE

### Flow Kalkulasi Diskon

```
PricingService.calculate()
  │
  ├── DiscountServiceAdapter.apply()
  │     │
  │     ├── DiscountConfigurationRepository.findByTenantId()
  │     │     └── MongoDB: discount_configurations collection
  │     │
  │     └── DiscountEngine.applyDiscounts()
  │           │
  │           ├── Filter rules: active + sort by priority
  │           ├── Check expired (startDate/endDate/usageCount)
  │           ├── Check promoCode match
  │           ├── Check scope → filter matching items
  │           │     ├── scope=all → semua item
  │           │     ├── scope=category → hanya item kategori tertentu
  │           │     └── scope=product → hanya item produk tertentu
  │           ├── ConditionEvaluator.evaluate()
  │           │     ├── min_purchase     → subtotal >= minAmount
  │           │     ├── min_items        → total qty >= minItems
  │           │     ├── category_match   → item dalam kategori
  │           │     ├── product_match    → item adalah produk tertentu
  │           │     ├── day_of_week      → hari ini sesuai
  │           │     ├── date_range       → dalam rentang tanggal
  │           │     ├── time_range       → dalam rentang jam
  │           │     ├── quantity_threshold → qty >= threshold
  │           │     └── customer_tag     → customer punya tag
  │           │
  │           └── EffectApplier.apply()
  │                 ├── percentage_off  → base × (rate/100)
  │                 │     └── base = matchingSubtotal (bukan seluruh cart)
  │                 ├── nominal_off     → min(amount, remaining)
  │                 ├── free_item       → gratis item (qty)
  │                 ├── fixed_price     → (originalPrice - fixedPrice) × qty
  │                 └── bundle_price    → originalTotal - bundlePrice
  │                 └── buy_x_pay_y     → unit gratis → freeItems[] (line item 0)
  │                 └── buy_x_get_y     → freeItems[] / generatedLineItems[]
  │
  └── Distribusi diskon ke line items
        └── Setiap paid item dapat discount = (lineTotal/paidSubtotal) × totalDiscount
```

### Struktur Rule Diskon

```
IDiscountRule {
  id            : string
  name          : string
  priority      : number        — semakin kecil semakin didahulukan
  stackable     : boolean       — bisa ditumpuk dengan rule lain?
  active        : boolean
  scope         : { type: 'all'|'category'|'product', entityId, entityName }
  policy        : { type, value, maxCap, application, roundingMode, precision }
  conditions    : IDiscountCondition[]
  effects       : IDiscountEffect[]
  promoCodeId   : string?       — jika diisi, harus cocok dengan input
  startDate     : string?
  endDate       : string?
  maxUsageCount : number?
}
```

### Wiremap Diskon

```
                      ┌──────────────┐
                      │  User Setup  │
                      │  50% Kopi    │
                      └──────┬───────┘
                             │
              ┌──────────────▼──────────────┐
              │  PromotionService.create()   │
              │  → PromotionToDiscountMapper │
              │  → syncToDiscountConfig()    │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │  MongoDB: discount_configs  │
              │  rules: [{                 │
              │    scope: {type:'category', │
              │      entityId:'kopi-id'},  │
              │    conditions: [            │
              │      {type:'category_match',│
              │       config:{categoryIds:  │
              │         ['kopi-id']}}],     │
              │    effects: [               │
              │      {type:'percentage_off',│
              │       config:{rate:50}}]    │
              │  }]                         │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │  Cart → recalculate()       │
              │  → POST /pricing/calculate   │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │  PricingService.calculate()  │
              │  → DiscountServiceAdapter   │
              │    → DiscountEngine         │
              │      → scope 'category'     │
              │        filter item kopi     │
              │      → category_match pass  │
              │      → percentage_off 50%   │
              │        base = subtotal kopi │
              │      → totalDiscount = X    │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │  Distribusi ke line items   │
              │  → item kopi: discount = X  │
              │  → lineTotal = original - X │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │  Frontend CartItemRow       │
              │  → tampilkan coret harga    │
              │  → tampilkan harga diskon   │
              │  → badge "DISKON 50%"       │
              └─────────────────────────────┘
```

---

## 2. SERVICE CHARGE (CHARGE)

### Flow Kalkulasi SC

```
Charge termasuk dalam TaxConfiguration, dihitung oleh PricingEngine.

┌─────────────────────────────────────────────────────────┐
│  Charge (SC)                                            │
│  ─────────────────────────────────────────────────────  │
│  Jenis: rate (%) atau flat amount                       │
│  includeInTaxBase: boolean (apakah SC masuk DPP pajak)  │
│  scope: bisa di-filter per outlet/kategori/dll          │
│  priority: urutan kalkulasi                             │
│                                                         │
│  Rumus (mode EXCLUSIVE):                                │
│    chargeAmount = charge.calculate(afterDiscount)       │
│    if includeInTaxBase → DPP += chargeAmount            │
│                                                         │
│  Rumus (mode INCLUSIVE):                                │
│    chargeAmount = price - price / (1 + rate/100)        │
│    remaining = price - chargeAmount                     │
│    → diekstrak dari harga, grandTotal tetap             │
└─────────────────────────────────────────────────────────┘
```

### Wiremap SC

```
                    ┌──────────────────────┐
                    │  Settings → SC       │
                    │  name, rate,         │
                    │  includeInTaxBase    │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  TaxConfiguration    │
                    │  → MongoDB:          │
                    │    tax_configurations│
                    │    charges: [{       │
                    │      name: "SC 10%", │
                    │      rate: 10,       │
                    │      includeInTPP:   │
                    │        true,         │
                    │      priority: 5     │
                    │    }]                │
                    └──────────┬───────────┘
                               │
              ┌────────────────▼────────────────┐
              │  PricingEngine.calculate()       │
              │                                   │
              │  EXCLUSIVE:                      │
              │  ┌───────────────────────────┐   │
              │  │ afterDiscount = 90.000    │   │
              │  │ SC = 90.000 × 10% = 9.000 │   │
              │  │ DPP = 90.000 + 9.000      │   │
              │  │      = 99.000 (jika inc)  │   │
              │  │ GrandTotal = 90.000       │   │
              │  │   + 9.000 + pajak         │   │
              │  └───────────────────────────┘   │
              │                                   │
              │  INCLUSIVE:                      │
              │  ┌───────────────────────────┐   │
              │  │ Harga = 100.000           │   │
              │  │ SC = 100.000 -            │   │
              │  │   100.000/(1+10%) = 9.091 │   │
              │  │ Remaining = 90.909        │   │
              │  │ GrandTotal = 100.000      │   │
              │  └───────────────────────────┘   │
              └────────────────┬────────────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Hasil ke Frontend   │
                    │  serviceCharge: 9000 │
                    │  serviceChargeName:  │
                    │    "Service Charge"  │
                    └─────────────────────┘
```

---

## 3. TAX (PAJAK)

### Flow Kalkulasi Pajak

```
TaxConfiguration menyimpan tax rules dengan modifier DPP.

┌─────────────────────────────────────────────────────────┐
│  TaxRule                                                │
│  ─────────────────────────────────────────────────────  │
│  taxType: 'vat' | 'withholding' | 'custom' | 'exemption'│
│  policy: { type, value, roundingMode, precision }       │
│  modifier: { type: 'fraction' | 'multiplier' |          │
│              'fixed_deduction' | 'none', config }       │
│  scope: outlet/kategori/produk/transaksi/customer       │
│  priority: urutan aplikasi                              │
│                                                         │
│  Modifier fraction 11/12 (PPN 12% Indonesia):           │
│    DPP = amount × 11/12                                 │
│    Tax = DPP × 12%                                      │
│    Effective rate = 11%                                 │
└─────────────────────────────────────────────────────────┘
```

### Wiremap Pajak

```
                    ┌──────────────────────┐
                    │  Settings → Pajak    │
                    │  enable/disable      │
                    │  pricingMode         │
                    │   (inclusive/excl)   │
                    │  PPN rate (default   │
                    │   11% UI, 12% backend│
                    │   dgn modifier 11/12)│
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  TaxConfiguration    │
                    │  → MongoDB:          │
                    │    tax_configurations│
                    │    rules: [{         │
                    │      name: "PPN 12%"│
                    │      taxType: "vat", │
                    │      modifier: {     │
                    │        type:"fraction"│
                    │        config:{       │
                    │          numerator:11 │
                    │          denominator: │
                    │            12         │
                    │        }             │
                    │      },              │
                    │      policy: {       │
                    │        type:"rate",  │
                    │        value: 12     │
                    │      }               │
                    │    }]                │
                    └──────────┬───────────┘
                               │
              ┌────────────────▼────────────────┐
              │  PricingEngine.calculate()       │
              │                                   │
              │  EXCLUSIVE (default):            │
              │  ┌───────────────────────────┐   │
              │  │ DPP = afterDiscount + SC  │   │
              │  │      (jika SC in DPP)     │   │
              │  │ modifiedDPP = DPP × 11/12 │   │
              │  │ PPN = modifiedDPP × 12%   │   │
              │  │ GrandTotal = subtotal     │   │
              │  │   - diskon + SC + PPN     │   │
              │  └───────────────────────────┘   │
              │                                   │
              │  INCLUSIVE:                      │
              │  ┌───────────────────────────┐   │
              │  │ Harga = 100.000           │   │
              │  │ Extract SC → 4.762        │   │
              │  │ Remaining = 95.238        │   │
              │  │ DPP = 95.238 × 11/12      │   │
              │  │      = 87.302             │   │
              │  │ PPN = 87.302 -            │   │
              │  │   87.302/(1+12%) = 9.354  │   │
              │  │ GrandTotal = 100.000      │   │
              │  │   (tidak berubah)         │   │
              │  └───────────────────────────┘   │
              └────────────────┬────────────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Hasil ke Frontend   │
                    │  tax: 10.890         │
                    │  taxName: "PPN 12%"  │
                    │  taxRate: 12         │
                    │  taxBase: 99.000     │
                    │  modifier: {         │
                    │    type: "11/12",   │
                    │    before: 99000,    │
                    │    after: 90750      │
                    │  }                   │
                    └─────────────────────┘
```

---

## 4. PRICING MODE: EXCLUSIVE vs INCLUSIVE

### EXCLUSIVE (default "++")

```
subtotal       = Σ(qty × unitPrice)
afterDiscount  = subtotal - discount
SC             = afterDiscount × rateSC% (jika %)
DPP            = afterDiscount + SC (jika includeInTaxBase=true)
PPN            = DPP × modifier × ratePPN%
GrandTotal     = afterDiscount + SC + PPN

Contoh: Kopi 100.000, diskon 50% (kopi = 50.000), SC 10%, PPN 11%
  afterDiscount  = 50.000
  SC             = 50.000 × 10% = 5.000
  DPP            = 50.000 + 5.000 = 55.000
  PPN            = 55.000 × 11% = 6.050
  GrandTotal     = 50.000 + 5.000 + 6.050 = 61.050
```

### INCLUSIVE ("Nett")

```
Harga jual SUDAH termasuk pajak dan/atau SC.
  Extract SC  = price - price/(1 + rateSC%)
  Extract PPN = remaining - remaining/(1 + ratePPN%)
  GrandTotal  = price (tidak berubah)

Contoh: Kopi 100.000 (incl. PPN 11%), SC 10% (incl.)
  Extract SC    = 100.000 - 100.000/1,1 = 9.091
  Remaining     = 90.909
  Extract PPN   = 90.909 - 90.909/1,11 = 9.909
  DPP           = 100.000 - 9.091 - 9.909 = 81.000
  GrandTotal    = 100.000
```

---

## 5. ADJUSTMENT PIPELINE

```
Setiap kalkulasi menghasilkan daftar adjustment (urutan berdasarkan sequence):

Sequence  │ Type     │ Keterangan
──────────┼──────────┼──────────────────────
   10     │ DISCOUNT │ -amount (mengurangi base)
   20     │ CHARGE   │ +amount (bisa affectTaxBase)
   30     │ TAX      │ +amount (tidak affectTaxBase)
   40     │ ROUNDING │ +/- penyesuaian pembulatan
```

---

## 6. DATABASE SCHEMA (MongoDB)

### discount_configurations
```json
{
  "_id": "disc_cfg_tenant-1_...",
  "tenantId": "tenant-1",
  "enabled": true,
  "rules": [{
    "id": "promo_promo_xxx",
    "name": "Diskon Kopi 50%",
    "priority": 10,
    "stackable": false,
    "active": true,
    "scope": { "type": "category", "entityId": "cat-kopi", "entityName": "Kopi" },
    "policy": { "type": "percentage", "value": 50, "application": "per_order" },
    "conditions": [{ "type": "category_match", "config": { "categoryIds": ["cat-kopi"] } }],
    "effects": [{ "type": "percentage_off", "config": { "rate": 50 } }],
    "currentUsageCount": 0
  }]
}
```

### tax_configurations
```json
{
  "_id": "tax_cfg_tenant-1_...",
  "tenantId": "tenant-1",
  "taxEnabled": true,
  "pricingMode": "exclusive",
  "countryCode": "ID",
  "currency": "IDR",
  "versions": [{
    "id": "v1",
    "versionNumber": 1,
    "status": "active",
    "rules": [{
      "id": "rule_ppn",
      "name": "PPN 12%",
      "taxType": "vat",
      "scope": { "type": "all" },
      "policy": { "type": "rate", "value": 12, "roundingMode": "round", "precision": 0 },
      "modifier": { "type": "fraction", "config": { "numerator": 11, "denominator": 12 } },
      "priority": 10,
      "isActive": true
    }],
    "charges": [{
      "id": "charge_sc",
      "name": "Service Charge",
      "rate": 10,
      "includeInTaxBase": true,
      "priority": 5,
      "isActive": true
    }]
  }]
}
```

### promotions
```json
{
  "id": "promo_xxx",
  "tenantId": "tenant-1",
  "name": "Promo Kopi 50%",
  "code": "",
  "priority": 10,
  "stackable": false,
  "isActive": true,
  "rules": [{ "type": "category_match", "params": { "categoryIds": ["cat-kopi"] } }],
  "effects": [{ "type": "percentage", "value": 50, "target": "order" }],
  "usageLimit": null,
  "usedCount": 0,
  "minPurchase": 0
}
```

---

## 7. FILE REFERENCE

### Backend (src/core/)

| Path | Fungsi |
|------|--------|
| `pricing/application/services/PricingService.ts` | Orchestrator: diskon + SC + pajak |
| `pricing/domain/PricingProfile.ts` | Profil pricing per tenant |
| `tax/domain/PricingEngine.ts` | Engine utama kalkulasi harga |
| `tax/domain/Charge.ts` | Service Charge / biaya tambahan |
| `tax/domain/TaxRule.ts` | Rule pajak dengan modifier DPP |
| `tax/domain/TaxConfiguration.ts` | Konfigurasi pajak (rules + charges) |
| `tax/domain/ModifierEngine.ts` | Modifier DPP (fraction/multiplier/deduction) |
| `tax/domain/RoundingEngine.ts` | Pembulatan (round/floor/ceil) |
| `tax/domain/AdjustmentPipeline.ts` | Pipeline adjustment (disc→charge→tax→round) |
| `discount/domain/DiscountEngine.ts` | Engine diskon: kondisi + efek |
| `discount/domain/DiscountRule.ts` | Rule diskon (scope, policy, conditions, effects) |
| `discount/domain/DiscountScope.ts` | Scope diskon (all/category/product) |
| `discount/domain/EffectApplier.ts` | Aplikasi efek diskon |
| `discount/domain/ConditionEvaluator.ts` | Evaluasi kondisi diskon |
| `discount/domain/strategies/effects/PercentageOffEffect.ts` | Efek % off (gunakan matchingSubtotal) |
| `discount/domain/strategies/conditions/CategoryMatchCondition.ts` | Kondisi category match |
| `discount/application/services/DiscountServiceAdapter.ts` | Adapter diskon untuk pricing |
| `promotion/application/services/PromotionService.ts` | Service promo + sync ke discount config |
| `promotion/infrastructure/sync/PromotionToDiscountMapper.ts` | Mapping promo → discount rule |

### Frontend (src/)

| Path | Fungsi |
|------|--------|
| `core/pos/store/posStore.ts` | State cart + recalculate → POST /pricing/calculate |
| `core/pos/pages/PosPage.tsx` | Halaman POS utama |
| `core/pos/components/CartItemRow.tsx` | Baris item cart (tampilkan diskon) |
| `core/pos/components/PaymentModal.tsx` | Modal pembayaran |
| `@shared/hooks/usePricing.ts` | Hook pricing API |
| `@shared/hooks/useDiscountConfiguration.ts` | Hook diskon API |
| `@shared/utils/discountCalculator.ts` | Kalkulator diskon client-side |
| `@shared/utils/taxCalculator.ts` | Kalkulator pajak client-side |
| `core/settings/pages/GeneralSettingsPage.tsx` | Settings: pajak, SC, diskon limit |

---

## 8. BUG FIXES YANG DILAKUKAN

| # | Bug | File | Fix |
|---|-----|------|-----|
| 1 | Silent catch di `syncToDiscountConfig()` — error sync tidak terlihat | `PromotionService.ts:37` | Tambah `console.error` di catch |
| 2 | Scope rule diskon tidak dievaluasi — rule dengan scope kategori diabaikan | `DiscountEngine.ts` | Tambah `resolveScopeItems()` — filter item sesuai scope |
| 3 | `PercentageOffEffect` apply ke seluruh subtotal, bukan hanya item yang match | `PercentageOffEffect.ts:11` | Gunakan `matchingSubtotal` dari EffectContext |
| 4 | `NominalOffEffect` apply ke seluruh subtotal | `NominalOffEffect.ts:9` | Gunakan `matchingSubtotal` |
| 5 | Line items selalu `discount: 0` — item cart tidak tampilkan diskon | `PricingService.ts:88-134` | Distribusi `totalDiscount` proporsional ke setiap paid item |
| 6 | `CartItemRow` selalu tampilkan harga asli | `CartItemRow.tsx:42-43` | Tampilkan `lineTotal` + coret harga asli + badge DISKON |
| 7 | `DiscountScope` tidak punya `getType()`/`getEntityId()` | `DiscountScope.ts` | Tambah method |
| 8 | `EffectContext` tidak punya `matchingSubtotal`/`matchingItems` | `EffectStrategy.ts` | Tambah field |
| 9 | `buy_x_pay_y` (beli 3 bayar 2) menghitung diskon tunai proporsional & mengabaikan free unit terpilih | `BuyXPayYEffect.ts` | Sekarang mengembalikan `freeItems[]` (line item harga 0) + `discountAmount: 0`; `PricingService` mengurangi `totalFreeItemValue` dari subtotal; `DiscountEngine` menambahkan `freeItemValue` |
| 10 | Cart POS tidak bisa melewati 1 set gratis pada promo beli-3-bayar-2 — qty macet, item gratis kedua tidak muncul | `posStore.ts` | `recalculate` mengirim total qty (paid + free) ke backend; `addItem`/`updateQuantity` hanya menaikkan baris paid (bukan baris free); guard `recalcToken` mencegah response basi menimpa input terbaru |

---

## 9. SKENARIO UJI

### Skenario 1: Diskon 50% Kategori Kopi + PPN 11% + SC 10% (EXCLUSIVE)

```
Item: Kopi Susu 1 × 100.000 (kategori: kopi)

Step 1: Diskon
  - scope = category (kopi) → matchingItems = [Kopi Susu]
  - matchingSubtotal = 100.000
  - condition category_match → pass
  - percentage_off 50% → 100.000 × 50% = 50.000
  - totalDiscount = 50.000

Step 2: Distribusi line item
  - Kopi Susu: discount = 50.000, lineTotal = 50.000

Step 3: Service Charge
  - afterDiscount = 50.000
  - SC = 50.000 × 10% = 5.000

Step 4: Pajak
  - DPP = 50.000 + 5.000 = 55.000
  - PPN = 55.000 × 11/12 × 12% = 6.050

Step 5: Grand Total
  - 50.000 + 5.000 + 6.050 = 61.050
```

### Skenario 2: Diskon 50% Kopi + Non-Kopi (campuran)

```
Item A: Kopi Susu 1 × 100.000 (kategori: kopi)
Item B: Nasi Goreng 1 × 50.000 (kategori: makanan)

Step 1: Diskon
  - scope = category (kopi) → matchingItems = [Kopi Susu]
  - matchingSubtotal = 100.000
  - percentage_off 50% → 100.000 × 50% = 50.000
  - totalDiscount = 50.000

Step 2: Distribusi
  - Kopi Susu: discount = 50.000, lineTotal = 50.000
  - Nasi Goreng: discount = 0, lineTotal = 50.000

Step 3: SC 10% → (100.000) × 10% = 10.000
Step 4: PPN 11% → (100.000 + 10.000) × 11/12 × 12% = 12.100
Step 5: Grand Total = 100.000 + 10.000 + 12.100 = 122.100
```

### Skenario 3: INCLUSIVE — SC + PPN dalam harga

```
Item: Kopi Susu 1 × 100.000 (inclusive)

Extract SC 5%:
  SC = 100.000 - 100.000/1,05 = 4.762

Extract PPN 12% (fraction 11/12):
  Remaining = 100.000 - 4.762 = 95.238
  DPP = 95.238 × 11/12 = 87.302
  PPN = 87.302 - 87.302/1,12 = 9.354

DPP = 100.000 - 4.762 - 9.354 = 85.884
GrandTotal = 100.000 (tidak berubah)
```
