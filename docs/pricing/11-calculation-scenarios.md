# Part VI — Calculation Scenarios

## 11.1 Pricing Scenarios Matrix

### Legend
- `sc` = Service Charge
- `ppn` = PPN (VAT)
- `mod` = Modifier
- `inc` = Inclusive pricing
- `gratis` = Discount 100%

| # | Skenario | Item | Qty | Price | Discount | SC | PPN | Mod | Expected GT | Deskripsi |
|---|----------|------|-----|-------|----------|----|-----|-----|-------------|-----------|
| 1 | Normal | Kopi | 2 | 25.000 | - | - | - | - | 50.000 | Hanya subtotal |
| 2 | Diskon full | Kopi | 2 | 25.000 | **100%** | - | - | - | 0 | Gratis |
| 3 | SC saja | Kopi | 2 | 25.000 | - | **10%** | - | - | 55.000 | |
| 4 | PPN saja | Kopi | 2 | 25.000 | - | - | **12%** | 11/12 | 55.000 | PPN efektif 11% |
| 5 | Diskon + SC | Kopi | 2 | 25.000 | **50%** | **10%** | - | - | 27.500 | |
| 6 | Diskon + PPN | Kopi | 2 | 25.000 | **50%** | - | **12%** | 11/12 | 27.750 | PPN dari 25.000 × 11/12 × 12% |
| 7 | Full stack | Kopi | 2 | 25.000 | **50%** | **10%** | **12%** | 11/12 | 30.525 | Semua aktif |
| 8 | SC include DPP | Kopi | 2 | 25.000 | **50%** | **10%** | **12%** | 11/12 | 30.525 | SC 2.500 masuk DPP |
| 9 | SC exclude DPP | Kopi | 2 | 25.000 | **50%** | **10%** | **12%** | 11/12 | 30.250 | SC 2.500 TIDAK masuk DPP |
| 10 | Inclusive PPN | Kopi | 2 | 28.000 | - | - | **12%** | 11/12 | 56.000 | Harga termasuk PPN |
| 11 | Multi-item | Kopi+Nasi | - | 25k+50k | **50%** (kopi) | **10%** | **12%** | 11/12 | 61.050 | Diskon per kategori |
| 12 | Multi SC | Kopi | 2 | 25.000 | - | **10%+5%** | - | - | 57.500 | Dua charge berbeda |
| 13 | PPN+PPh | Kopi | 2 | 25.000 | - | - | **12%+2%** | 11/12 | 56.500 | Multi tax |
| 14 | Diskon 100% | Kopi | 2 | 25.000 | **100%** | **10%** | **12%** | 11/12 | 0 | Gratis penuh |
| 15 | SC 0% | Kopi | 2 | 25.000 | **50%** | **0%** | **12%** | 11/12 | 27.750 | SC di-skip |
| 16 | PPN 0% | Kopi | 2 | 25.000 | **50%** | **10%** | **0%** | - | 27.500 | PPN di-skip |
| 17 | Nominal disc | Kopi | 2 | 25.000 | **Rp 10.000** | **10%** | **12%** | 11/12 | 48.525 | |
| 18 | Mixed | Kopi+Nasi | 2+1 | 25k+50k | **50% nominal 20k** | **10%** | **12%** | 11/12 | 71.575 | Stack 2 rules |

## 11.2 Detailed Calculation: Scenario 7 (Full Stack)

### Input
```
Item: Kopi x2 @Rp25.000
Diskon: 50% (category: kopi)
Service Charge: 10% (includeInTaxBase=true)
PPN: 12% (modifier fraction 11/12)
```

### Step-by-step

| Step | Kalkulasi | Running |
|------|-----------|---------|
| Subtotal | 2 × 25.000 = **50.000** | 50.000 |
| Diskon 50% | matchingSubtotal=50.000, amount=50.000×50%=-**25.000** | 25.000 |
| SC 10% | base=25.000, amount=25.000×10%=**2.500** | 27.500 |
| PPN 12% | DPP=25.000+2.500=27.500, mod=27.500×11/12=25.208, tax=25.208×12%=**3.025** | 30.525 |
| Pembulatan | 30.525 → round → **30.525** | 30.525 |
| **Grand Total** | | **30.525** |

### Adjustment Array

```json
[
  { "type": "DISCOUNT", "name": "50%", "base": 50000, "rate": 50, "amount": -25000 },
  { "type": "CHARGE",   "name": "SC 10%", "base": 25000, "rate": 10, "amount": 2500 },
  { "type": "TAX",      "name": "PPN 12%", "base": 27500, "rate": 12, "amount": 3025 },
  { "type": "ROUNDING", "name": "Round",  "base": 30525, "amount": 0 },
]
```

### Verifikasi

```
Subtotal:    50.000
+ DISCOUNT: -25.000
+ CHARGE:     2.500
+ TAX:        3.025
+ ROUNDING:       0
= GrandTotal 30.525 ✓

GTPP (Grand Total harus = subtotal + Σadj):
50.000 + (-25.000 + 2.500 + 3.025 + 0) = 30.525 ✓
```

## 11.3 Detailed Calculation: Scenario 11 (Multi-item)

### Input
```
Item A (Kopi):   x2 @25.000, categoryId='cat-kopi'
Item B (Nasi):   x1 @50.000, categoryId='cat-food'
Diskon 50%: scope='category', entityId='cat-kopi'
SC 10%: includeInTaxBase=true
PPN 12%: modifier 11/12
```

### Step-by-step

| Step | Kalkulasi | Running |
|------|-----------|---------|
| Subtotal | A:50.000 + B:50.000 = **100.000** | 100.000 |
| Diskon 50% | scope='cat-kopi'→ **A saja**, matching=50.000, disc=50.000×50%=-**25.000** | 75.000 |
| SC 10% | base=75.000, amount=75.000×10%=**7.500** | 82.500 |
| PPN | DPP=75.000, mod=75.000×11/12=68.750, tax=68.750×12%=**8.250** | 90.750 |
| **GT** | | **90.750** |

### Verifikasi dengan Test

```javascript
// Test assertion example
expect(result.grandTotal).toBe(90750);
expect(result.discount).toBe(25000);
expect(result.charges[0].amount).toBe(7500);
expect(result.taxAmount).toBe(8250);
expect(result.adjustments.length).toBe(4);
```

## 11.4 Scenario 17: Nominal Discount with SC + PPN

### Input
```
Item: Kopi x2 @Rp25.000
Diskon: Rp10.000 nominal off
SC 10% (includeInTaxBase=true)
PPN 12% (modifier 11/12)
```

### Step-by-step

| Step | Kalkulasi | Running |
|------|-----------|---------|
| Subtotal | 2 × 25.000 = **50.000** | 50.000 |
| Diskon Rp10k | base=50.000, amount=-**10.000** | 40.000 |
| SC 10% | base=40.000, amount=40.000×10%=**4.000** | 44.000 |
| PPN 12% | DPP=40.000+4.000=44.000, mod=44.000×11/12=40.333, tax=40.333×12%=**4.840** | 48.840 |
| Pembulatan | 48.840 → round → **48.840** | 48.840 |
| **GT** | | **48.840** |
