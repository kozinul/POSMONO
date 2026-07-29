# Part VII — Error Handling

## 13.1 Error Taxonomy

```
ERROR
├── INPUT ERRORS (4xx)
│   ├── INVALID_ITEMS
│   ├── INVALID_AMOUNT
│   ├── NEGATIVE_PRICE
│   ├── EMPTY_CART
│   └── INVALID_PROMO_CODE
│
├── DOMAIN ERRORS (4xx)
│   ├── RULE_EXPIRED
│   ├── DISCOUNT_EXCEEDS_SUBTOTAL
│   ├── STACKING_CONFLICT
│   ├── SCOPE_MISMATCH
│   ├── USAGE_LIMIT_EXCEEDED
│   └── CONDITION_NOT_MET
│
├── CONFIGURATION ERRORS (4xx/5xx)
│   ├── TENANT_NOT_FOUND
│   ├── CONFIG_NOT_FOUND
│   ├── INVALID_MODIFIER
│   ├── INVALID_TAX_RATE
│   └── VERSION_CONFLICT
│
└── INTERNAL ERRORS (5xx)
    ├── CALCULATION_ERROR
    ├── PROMOTION_SYNC_FAILED
    ├── DATABASE_ERROR
    └── UNEXPECTED_ERROR
```

## 13.2 Error Recovery Strategy

| Error | Recovery |
|-------|----------|
| INVALID_ITEMS | Return 400, frontend show error toast |
| RULE_EXPIRED | Skip rule silently, tidak ada error ke user |
| DISCOUNT_EXCEEDS_SUBTOTAL | Cap discount = subtotal, tetap lanjut |
| USAGE_LIMIT_EXCEEDED | Skip rule, beri info "promo sudah habis" |
| TENANT_NOT_FOUND | Return 404, frontend redirect |
| CONFIG_NOT_FOUND | Return 404, gunakan default config |
| CALCULATION_ERROR | Log error, return 500, frontend tampilkan pesan |
| DATABASE_ERROR | Retry 3x, lalu fallback ke cache |

## 13.3 Specific Error Cases

### Diskon > Subtotal
```
Input: subtotal=50.000, discount=100.000
Output: discount capped at 50.000
Adjustment: { base: 50000, rate: -1, amount: -50000 }
No error thrown — sistem tetap menghasilkan grand total >= 0
```

### Promo Code Tidak Dikenali
```
Input: promoCode="INVALID"
Output: Tidak ada rule yang match
Adjustment: tidak ada adjustment DISCOUNT
grandTotal = subtotal (no discount applied)
Frontend menampilkan: "Kode promo tidak valid"
```

### Pajak Rate 0%
```
Config: tax rule dengan rate = 0
Treatment: rule di-skip dari kalkulasi
Tidak menghasilkan adjustment TAX
```

### Version Conflict
```
Situasi: Dua request update config di saat bersamaan
Mekanisme: Optimistic locking via versionNumber
Jika version mismatch: return 409 Conflict
```

## 13.4 Graceful Degradation

Jika Pricing Engine tidak bisa diakses (misal: service down):

| Component | Fallback |
|-----------|----------|
| Frontend | Hitung subtotal + diskon di client (tanpa pajak) |
| Backend | Return 503 dengan informasi "sedang dalam perbaikan" |
| POS Offline | Gunakan local config (cached dari sync terakhir) |
| Report | Gunakan data pricing yang sudah tersimpan di order |
