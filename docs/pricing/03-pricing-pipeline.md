# Part III: Architecture — Pricing Pipeline

## 3.1 Pipeline Architecture

Pricing Engine menggunakan **Adjustment Pipeline** — serangkaian langkah yang dieksekusi berurutan:

```
                    ┌─────────────────┐
                    │  INPUT          │
                    │  items[]        │
                    │  discount       │
                    │  promoCode      │
                    └────────┬────────┘
                             │
                             ▼
               ┌─────────────────────────┐
               │  STEP 1: SUBTOTAL       │
               │  Σ(qty × unitPrice)     │
               └────────┬────────────────┘
                        │
                        ▼
               ┌─────────────────────────┐
               │  STEP 2: DISCOUNT       │
               │  seq=10                 │
               │  - hitung diskon       │
               │  - filter scope items   │
               └────────┬────────────────┘
                        │
                        ▼
               ┌─────────────────────────┐
               │  STEP 3: CHARGE         │
               │  seq=20                 │
               │  - Service Charge       │
               │  - includeInTaxBase?    │
               └────────┬────────────────┘
                        │
                        ▼
               ┌─────────────────────────┐
               │  STEP 4: TAX            │
               │  seq=30                 │
               │  - DPP = afterDiscount  │
               │    + chargeInDPP        │
               │  - apply modifier       │
               │  - apply rate           │
               └────────┬────────────────┘
                        │
                        ▼
               ┌─────────────────────────┐
               │  STEP 5: ROUNDING       │
               │  seq=40                 │
               │  - round grand total    │
               └────────┬────────────────┘
                        │
                        ▼
               ┌─────────────────────────┐
               │  OUTPUT                 │
               │  PricingResult          │
               │  + adjustments[]        │
               └─────────────────────────┘
```

## 3.2 Urutan Eksekusi

Setiap AdjustmentStep punya `sequence` number. Default:

| Sequence | Step | Tipe | affectTaxBase | affectGrandTotal |
|----------|------|------|---------------|-----------------|
| 10 | Discount | `DISCOUNT` | true | true |
| 20 | Charge | `CHARGE` | configurable | true |
| 30 | Tax | `TAX` | false | true |
| 40 | Rounding | `ROUNDING` | false | true |

Sequence bisa dikonfigurasi per-rule. Misal: charge dengan seq=5 jalan sebelum diskon.

## 3.3 Pipeline Context

```typescript
interface PipelineContext {
  items: TaxItem[];
  subtotal: number;
  runningTotal: number;    // terupdate setelah setiap step
  taxBase: number;         // base untuk kalkulasi pajak
  adjustments: Adjustment[];
  metadata: Record<string, unknown>;
}
```

## 3.4 Adjustment Model

Setiap step menghasilkan `Adjustment`:

```typescript
interface Adjustment {
  id: string;
  type: 'DISCOUNT' | 'CHARGE' | 'TAX' | 'ROUNDING';
  name: string;
  sequence: number;
  base: number;        // nilai sebelum adjustment
  rate?: number;       // persentase (jika berlaku)
  amount: number;      // nilai adjustment (+ atau -)
  affectsTaxBase: boolean;
  affectsGrandTotal: boolean;
  metadata?: Record<string, unknown>;  // modifier info, dll
}
```

### Contoh Adjustment Output

```json
[
  { "type": "DISCOUNT", "name": "Promo Kopi 50%", "seq": 10,
    "base": 100000, "rate": 50, "amount": -50000,
    "affectsTaxBase": true, "affectsGrandTotal": true },
  { "type": "CHARGE", "name": "Service Charge 10%", "seq": 20,
    "base": 50000, "rate": 10, "amount": 5000,
    "affectsTaxBase": true, "affectsGrandTotal": true },
  { "type": "TAX", "name": "PPN 12%", "seq": 30,
    "base": 55000, "rate": 12, "amount": 6050,
    "affectsTaxBase": false, "affectsGrandTotal": true,
    "metadata": { "modifier": "11/12", "modifierBefore": 55000, "modifierAfter": 50417 } }
]
```

## 3.5 PricingResult (Output)

```typescript
interface PricingResult {
  subtotal: number;              // Σ(qty × unitPrice)
  adjustments: Adjustment[];     // array audit
  discount: number;              // total diskon
  charges: ChargeItem[];         // [{name, amount, includeInTaxBase}]
  taxBase: number;               // DPP akhir
  modifier: {                    // info modifier
    type: string;
    before: number;              // DPP sebelum modifier
    after: number;               // DPP setelah modifier
  };
  taxes: TaxLineItem[];          // [{name, rate, amount}]
  taxAmount: number;             // total pajak
  grandTotal: number;            // nilai akhir setelah semua step
}
```

## 3.6 Class Diagram: Pipeline

```
┌───────────────────┐
│  Adjustment       │
│  (interface)      │
├───────────────────┤
│ + id: string      │
│ + type: string    │
│ + sequence: number│
│ + base: number    │
│ + amount: number  │
└───────────────────┘
         ▲
         │
         ├────────────────────────────────────────────┐
         │                                            │
┌────────────────┐  ┌──────────────┐  ┌───────────┐  ┌──────────────┐
│ DiscountStep   │  │ ChargeStep   │  │ TaxStep   │  │ RoundingStep │
│ (seq=10)       │  │ (seq=20)     │  │ (seq=30)  │  │ (seq=40)     │
├────────────────┤  ├──────────────┤  ├───────────┤  ├──────────────┤
│ -discount      │  │ -charge      │  │ -taxRules │  │ -rounding    │
│ -rules         │  │              │  │           │  │ -mode        │
└────────────────┘  └──────────────┘  └───────────┘  └──────────────┘
         │                    │              │               │
         └────────────────────┴──────────────┴───────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │  AdjustmentPipeline  │
                         ├─────────────────────┤
                         │  + steps: Step[]     │
                         │  + execute(context)  │
                         └─────────────────────┘
```
