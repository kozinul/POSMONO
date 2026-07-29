# Part IV — Tax Engine

## 6.1 Responsibility

Menghitung kewajiban pajak dari transaksi.

Mendukung:
- **Multi-tier tax**: PPN + PPh + Pajak Daerah dalam satu transaksi
- **Inclusive pricing**: Pajak sudah termasuk harga (display)
- **Modifier**: Fraction, multiplier, fixed deduction (untuk DPP fraction PPN 12%)
- **Rounding per rule**: Setiap tax rule punya rounding sendiri
- **Priority**: Urutan kalkulasi bisa diatur

## 6.2 Flow

```
                       ┌─────────────────────┐
                       │  afterDiscount      │
                       │  + chargeInTaxBase  │
                       └──────────┬──────────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │  DPP AWAL           │
                       │  = afterDiscount    │
                       │    + chargeInTaxBase │
                       └──────────┬──────────┘
                                  │
                                  ▼
             ┌─────────────────────────────────────┐
             │            MODIFIER                  │
             │  fraction: DPP × numerator/denominator│
             │  multiplier: DPP × config            │
             │  fixed_deduction: DPP - config       │
             └────────────────┬────────────────────┘
                              │
                              ▼
             ┌─────────────────────────────────────┐
             │           TAX RULES                  │
             │  For each active rule (by priority):  │
             │    taxAmount = DPP × rate/100         │
             │    (inclusive: taxAmount = price -    │
             │     price × 100/(100+rate))           │
             └────────────────┬────────────────────┘
                              │
                              ▼
             ┌─────────────────────────────────────┐
             │        ROUNDING (per-rule)           │
             │  round/floor/ceil, precision 0/2     │
             └─────────────────────────────────────┘
```

## 6.3 Exclusive vs Inclusive Pricing

### Exclusive (+++)
```
Harga Menu:        Rp 100.000
Diskon:            Rp  50.000
DPP:               Rp  50.000
PPN 12%:           Rp   6.050  (= 50.000 × 11/12 × 12%)  ← fraction modifier
Service Charge 10%: Rp   5.000
Grand Total:       Rp  61.050
```

### Inclusive (includes tax)
```
Harga Menu:        Rp 100.000  ← sudah termasuk PPN
Perhitungan:
  DPP:             Rp 100.000 × 100/(100+12) × 12/11  ← invers fraction
  PPN:             Rp 100.000 - DPP
Grand Total:       Rp 100.000
```

### Perbedaan Flow

```typescript
if (pricingMode === 'INCLUSIVE') {
  // PPN sudah termasuk harga → hitung mundur
  dpp = price * 100 / (100 + taxRate);
  // Fraction modifier diterapkan terbalik
  if (modifier.type === 'fraction') {
    dpp = dpp * modifier.denominator / modifier.numerator;
  }
  taxAmount = price - dpp;
} else {
  // EXCLUSIVE: PPN dihitung dari DPP
  dpp = price;
  // Fraction: dpp = dpp * numerator / denominator
  taxAmount = dpp * taxRate / 100;
}
```

**PENTING**: Inclusive mode HANYA untuk display. Di database tetap disimpan sebagai exclusive. Inclusive formatting terjadi di frontend.

## 6.4 Modifier: Fraction (PPN 12% Case)

PPN 12% di Indonesia memiliki keunikan: **DPP fraction 11/12**.

Artinya:
- Untuk barang yang kena PPN 12%, PPN dihitung sebagai `(DPP × 11/12) × 12%`
- Atau setara dengan `DPP × 11%`
- Sehingga tarif efektif: **11%**

```
DPP original:    Rp 100.000
Modifier 11/12:  Rp 100.000 × 11/12 = Rp 91.667
PPN 12%:         Rp 91.667 × 12% = Rp 11.000
Efektif:         Rp 11.000 / 100.000 = 11%
```

### Modifier Config

```json
{
  "type": "fraction",
  "config": {
    "numerator": 11,
    "denominator": 12
  }
}
```

## 6.5 TaxRule Schema

```typescript
interface TaxRule {
  id: string;
  name: string;                   // "PPN 12%"
  taxType: TaxType;               // 'PPN' | 'PPh' | 'PAJAK_DAERAH' | 'CUSTOM'
  rate: number;                   // 12
  rateType: 'percentage';         // future: 'amount' | 'formula'
  priority: number;               // 1 = dihitung pertama
  isActive: boolean;
  scope: RuleScope;               // ALL / CATEGORY / PRODUCT
  modifier: ModifierConfig;       // none, fraction, multiplier, fixed_deduction
  roundingMode: RoundingMode;     // 'round' | 'floor' | 'ceil'
  precision: number;              // 0 = integer
  taxGroup?: string;              // group untuk reporting
  metadata?: Record<string, unknown>;
}
```

## 6.6 Tax Implementation Flow

```
TaxEngine.calculate()
  │
  ├── 1. Sort active rules by priority
  │
  ├── 2. For each item i:
  │       a. Cari rules yang scopenya match
  │       b. Urutkan: PPN → PPh → Pajak Daerah
  │       c. Hitung DPP = item unitPrice × qty (after discount)
  │       d. Apply modifier → modifiedDPP
  │       e. taxAmount = modifiedDPP × rate/100
  │       f. Round per-rule
  │       g. Jika inclusive: taxAmount = price - (price × 100/(100+rate))
  │
  ├── 3. Aggregate hasil per item → per taxType
  │
  └── 4. Return { taxLines[], totalTax, adjustments[] }
```

## 6.7 Perhitungan Multi-Item Tax

```
Item A (kopi):   qty=2, unitPrice=25000,   lineTotal=50000
Item B (nasi):   qty=1, unitPrice=50000,   lineTotal=50000
Diskon: 50% off (scope: category='cat-kopi') → diskon=25000 (applied ke A)

Perhitungan PPN 12%:

Item A:
  linePriceAfterDiscount = 50000 - 25000 = 25000
  modifier: fraction 11/12 = 25000 × 11/12 = 22917
  taxA = 22917 × 12% = 2750

Item B:
  linePriceAfterDiscount = 50000
  modifier: fraction 11/12 = 50000 × 11/12 = 45833
  taxB = 45833 × 12% = 5500

Total PPN = 2750 + 5500 = 8250
```

## 6.8 Edge Cases

| Skenario | Penanganan |
|----------|------------|
| Tax rate 0% | Rule diabaikan |
| DPP = 0 setelah diskon | Tax = 0 |
| Tidak ada tax rule aktif | Tax = 0 |
| Modifier dengan denominator 0 | Skip modifier, pakai DPP asli |
| Inclusive mode dengan modifier | Modifier diterapkan terbalik (invers) |
| PPN + PPh dalam satu transaksi | Keduanya dihitung dari DPP yang sama |
