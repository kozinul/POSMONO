# Part IV — Adjustment Model

## 8.1 Filosofi

Adjustment adalah **bukti audit**. Setiap perubahan nilai dari subtotal hingga grand total dicatat sebagai adjustment:

```
subtotal (100.000)
  → -50.000 (DISCOUNT: Promo Kopi)
  → +5.000  (CHARGE: Service Charge)
  → +6.050  (TAX: PPN 11%)
  → 0       (ROUNDING)
  = 61.050  (grandTotal)
```

Dengan adjustment, siapapun bisa:
1. Lihat detail setiap perubahan
2. Rekonstruksi grand total dari subtotal
3. Validasi correctness (subtotal + Σadjustment = grandTotal)
4. Debug jika ada selisih

## 8.2 Adjustment Interface

```typescript
interface Adjustment {
  id: string;
  type: 'DISCOUNT' | 'CHARGE' | 'TAX' | 'ROUNDING';
  name: string;
  sequence: number;
  base: number;
  rate?: number;
  amount: number;
  affectsTaxBase: boolean;
  affectsGrandTotal: boolean;
  metadata?: Record<string, unknown>;
}
```

### Field Description

| Field | Deskripsi |
|-------|-----------|
| `type` | Jenis adjustment — menentukan pipeline step |
| `name` | Nama rule yang menghasilkan (untuk display) |
| `sequence` | Urutan eksekusi (harus unik per context) |
| `base` | Nilai sebelum adjustment |
| `rate` | Rate persentase (jika berlaku) |
| `amount` | Nilai adjustment (positif = nambah, negatif = ngurang) |
| `affectsTaxBase` | Apakah nilai ini mempengaruhi DPP? |
| `affectsGrandTotal` | Apakah nilai ini mempengaruhi grand total? |
| `metadata` | Info tambahan (modifier, breakdown per item, dll) |

## 8.3 Invariant

```
runningTotal[k] = runningTotal[k-1] + adjustment[k].amount

grandTotal = subtotal + Σ adjustment.amount
```

### Verifikasi

```typescript
function verifyAdjustments(result: PricingResult): boolean {
  const expected = result.adjustments.reduce(
    (sum, adj) => sum + (adj.affectsGrandTotal ? adj.amount : 0),
    result.subtotal
  );
  return expected === result.grandTotal;
}
```

## 8.4 Contoh Complete Adjustment

### Input
```
Items: Kopi x2 @25.000, Nasi x1 @50.000
Diskon: 50% off untuk kategori kopi
SC: 10%, includeInTaxBase=true
PPN: 12%, modifier fraction 11/12
```

### Pipeline

| Seq | Type | Name | Base | Rate | Amount | TaxBase | GrandTotal |
|-----|------|------|------|------|--------|---------|------------|
| - | - | Subtotal | - | - | - | - | 100.000 |
| 10 | DISCOUNT | Promo Kopi 50% | 50.000 | 50 | -25.000 | ✓ | ✓ |
| 20 | CHARGE | Service Charge 10% | 75.000 | 10 | 7.500 | ✓ | ✓ |
| 30 | TAX | PPN 12% (11/12) | 82.500 | 12 | 9.075 | ✓ | ✓ |
| 40 | ROUNDING | Pembulatan | 91.575 | - | 0 | ✓ | ✓ |
| - | - | Grand Total | - | - | - | - | **91.575** |

### Output Adjustments

```json
[
  {
    "id": "adj_discount_1",
    "type": "DISCOUNT",
    "name": "Promo Kopi 50%",
    "sequence": 10,
    "base": 50000,
    "rate": 50,
    "amount": -25000,
    "affectsTaxBase": true,
    "affectsGrandTotal": true
  },
  {
    "id": "adj_charge_1",
    "type": "CHARGE",
    "name": "Service Charge 10%",
    "sequence": 20,
    "base": 75000,
    "rate": 10,
    "amount": 7500,
    "affectsTaxBase": true,
    "affectsGrandTotal": true
  },
  {
    "id": "adj_tax_1",
    "type": "TAX",
    "name": "PPN 12%",
    "sequence": 30,
    "base": 82500,
    "rate": 12,
    "amount": 9075,
    "affectsTaxBase": false,
    "affectsGrandTotal": true,
    "metadata": {
      "modifier": {
        "type": "fraction",
        "numerator": 11,
        "denominator": 12,
        "before": 82500,
        "after": 75625
      }
    }
  },
  {
    "id": "adj_rounding_1",
    "type": "ROUNDING",
    "name": "Pembulatan",
    "sequence": 40,
    "base": 91575,
    "amount": 0,
    "affectsTaxBase": false,
    "affectsGrandTotal": true
  }
]
```

## 8.5 Data Flow

```
Frontend                        Backend
   │                               │
   │  POST /calculate              │
   │  { items, discount? }         │
   │                               │
   │                               ├── DiscountEngine.calculate()
   │                               │     → adjustments[DISCOUNT]
   │                               │
   │                               ├── ChargeEngine.calculate()
   │                               │     → adjustments[CHARGE]
   │                               │
   │                               ├── TaxEngine.calculate()
   │                               │     → adjustments[TAX]
   │                               │
   │                               ├── RoundingEngine.round()
   │                               │     → adjustments[ROUNDING]
   │                               │
   │                               └── PricingResult
   │                                     { subtotal,
   │                                       adjustments,
   │                                       grandTotal }
   │                               │
   │  ← 200 { result }             │
   │                               │
   │  Display per line:            │
   │  subtotal                     │
   │  - diskon                     │
   │  + SC                         │
   │  + PPN                        │
   │  ────────────────────────     │
   │  Grand Total: Rp XX.XXX       │
```
