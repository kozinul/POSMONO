# Appendix A — Mathematical Formula

## A.1 Notation

| Simbol | Makna |
|--------|-------|
| `n` | Jumlah item |
| `q_i` | Quantity item ke-i |
| `p_i` | Unit price item ke-i |
| `d_j` | Nilai diskon rule ke-j |
| `c_k` | Rate charge ke-k |
| `t_l` | Rate tax ke-l |
| `M` | Modifier function |

## A.2 Subtotal

```
subtotal = Σ(i=1 to n) q_i × p_i
```

## A.3 Discount

### Percentage off

```
discount_j = min(
  matchingSubtotal × rate_j / 100,
  maxCap_j                  // jika ada
)
```

### Nominal off

```
discount_j = min(nominalAmount_j, remainingSubtotal)
  where remainingSubtotal = subtotal - Σ(prev discounts)
```

### Total discount (capped)

```
totalDiscount = min(
  Σ discount_j,
  subtotal        // tidak boleh melebihi subtotal
)
```

### Capped percentage

```
discount_j = min(
  matchingSubtotal × rate_j / 100,
  maxCap_j,
  subtotal - alreadyDiscounted
)
```

## A.4 After Discount

```
afterDiscount = subtotal - totalDiscount
```

## A.5 Service Charge

```
chargeIncludedInTaxBase = 0
totalCharge = 0

for each charge k:
  base_k = afterDiscount    // atau subtotal (tergantung konfig)
  chargeAmount_k = base_k × rate_k / 100

  if includeInTaxBase_k:
    chargeIncludedInTaxBase += chargeAmount_k

  totalCharge += chargeAmount_k
```

## A.6 Tax Base (DPP)

```
dpp = afterDiscount + chargeIncludedInTaxBase
```

## A.7 Modifier

### Fraction (PPN 12% case)

```
M(dpp) = dpp × numerator / denominator

Contoh: M(100.000) = 100.000 × 11/12 = 91.667
```

### Multiplier

```
M(dpp) = dpp × multiplier
```

### Fixed deduction

```
M(dpp) = dpp - deduction
```

### None

```
M(dpp) = dpp
```

## A.8 Tax (Exclusive Mode)

```
for each tax rule l (sorted by priority):
  dpp_modified = M_l(dpp)

  taxAmount_l = round(
    dpp_modified × rate_l / 100,
    roundingMode_l
  )

  totalTax += taxAmount_l
```

## A.9 Tax (Inclusive Mode)

```
// Harga sudah termasuk pajak
// Hitung mundur: cari dpp dari price

for each inclusive tax rule l:
  dpp_l = price × 100 / (100 + rate_l)

  // Inverse modifier jika ada
  if modifier.type === 'fraction':
    dpp_l = dpp_l × denominator / numerator

  taxAmount_l = price - dpp_l

  totalTax += taxAmount_l
```

## A.10 Modifier Fraction Inverse (Inclusive Mode)

Untuk menghitung mundur dari harga inclusive:

```
dpp = price × 100 / (100 + rate)

// Dengan fraction modifier (11/12):
// DPP asli sudah termasuk fraction
// Maka fraction di-invers:
dpp_before_modifier = dpp × denominator / numerator
                     = dpp × 12/11

tax = price - dpp_before_modifier
```

## A.11 Grand Total

```
grandTotal = round(
  afterDiscount + totalCharge + totalTax,
  roundingMode
)
```

## A.12 Verifikasi

```
grandTotal === subtotal - totalDiscount + totalCharge + totalTax + rounding
```

### Adjustment Balance

```
Σ adj.amount (where affectsGrandTotal = true) + subtotal === grandTotal
```

## A.13 Rounding

```
round(value, mode, precision):
  factor = 10 ^ precision  // precision=0 → 1, precision=2 → 100
  scaled = value × factor

  switch(mode):
    'round': result = Math.round(scaled)
    'floor': result = Math.floor(scaled)
    'ceil':  result = Math.ceil(scaled)

  return result / factor
```
