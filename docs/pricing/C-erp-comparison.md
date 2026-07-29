# Appendix C — ERP Comparison

## C.1 Perbandingan dengan Sistem Lain

| Fitur | Kuire POS | Odoo POS | Shopify POS | Toast POS |
|-------|-----------|----------|-------------|-----------|
| Pipeline adjustment | ✅ Ya | ❌ Manual | ❌ No | ⚠️ Limited |
| Multi-tier tax | ✅ Ya (priority-based) | ⚠️ Limited | ✅ Yes | ⚠️ Per-location |
| Modifier fraction 11/12 | ✅ Ya | ❌ No | ❌ No | ❌ No |
| Inclusive/exclusive per-item | ✅ Ya | ❌ No | ⚠️ Per-order | ❌ No |
| Discount scope (cat/prod) | ✅ Ya | ⚠️ Partial | ✅ Category | ✅ Category |
| Condition evaluator (day, time, qty) | ✅ Ya | ⚠️ Limited | ❌ No | ✅ Limited |
| Audit trail (adjustment) | ✅ Ya (pipeline) | ❌ No | ❌ No | ⚠️ Partial |
| Rounding mode per-rule | ✅ Ya | ❌ No | ❌ No | ⚠️ Fixed |
| Cache strategy | ✅ Redis planned | ✅ Odoo cache | ❌ Direct | ✅ Built-in |
| Versioned tax config | ✅ Yes | ❌ No | ❌ No | ❌ No |

## C.2 Keunggulan Kuire

### 1. Adjustment Pipeline
Tidak ada sistem POS lain yang memiliki pipeline adjustment selengkap Kuire. Ini memungkinkan:
- Audit trail penuh dari subtotal ke grand total
- Debugging cepat jika ada selisih
- Transparency ke customer

### 2. Modifier Fraction
Dirancang khusus untuk menangani PPN 12% Indonesia dengan DPP fraction 11/12.
Sistem lain harus:
- Hardcode tarif 11% (tidak akurat)
- Atau meminta developer mengubah code setiap ada perubahan tarif

### 3. Multi-tier Tax dengan Priority
Bisa menangani: PPN + PPh + Pajak Daerah sekaligus dengan urutan yang bisa diatur.
Sistem lain biasanya hanya support satu tax rule per transaksi.

### 4. Config without Code
Semua perubahan pricing bisa dilakukan via database/cache — tanpa deploy.
- Ubah tarif PPN: update MongoDB → cache TTL 5 menit → berlaku
- Tambah pajak daerah baru: insert rule → langsung aktif
- Nonaktifkan SC: set isActive=false → skip

## C.3 Keterbatasan vs Competitor

| Keterbatasan | Dampak | Roadmap |
|--------------|--------|---------|
| Belum ada tax report | Merchant perlu manual rekonsiliasi | Q3 2026 |
| Belum support multi-currency | Hanya IDR | Q4 2026 |
| Belum support tax exemption | B2B dengan SKB PPN | Q3 2026 |
| Belum ada discount approval flow | Manager override not tracked | Q1 2027 |
| Belum ada real-time tax rate sync | Perlu update manual | Q2 2027 |

## C.4 Arsitektur Comparison Detail

### Odoo POS

```
Odoo:
  sale.order.line (manual discount)
  account.tax (flat rate)
  Tidak ada pipeline adjustment
  Discount dihitung per-line, bukan per-order
```

### Kuire POS

```
Kuire:
  AdjustmentPipeline (DISCOUNT → CHARGE → TAX → ROUNDING)
  Discount: condition-based + scope-based
  Tax: priority-based, multi-tier, modifier
  Full audit: setiap adjustment tercatat
```

## C.5 Competitor Feature Map

```
                  Adjustment   Multi-tax   Fraction   Inclusive   Condition
                  Pipeline                 Modifier   per-item    Engine
Kuire                ✅          ✅          ✅          ✅          ✅
Odoo                 ❌          ⚠️          ❌          ❌          ❌
Shopify              ❌          ✅          ❌          ❌          ❌
Toast                ❌          ⚠️          ❌          ❌          ⚠️
Lightspeed           ❌          ❌          ❌          ❌          ❌
Lavu                 ❌          ❌          ❌          ❌          ❌
```

## C.6 Lessons Learned

### Dari implementasi:

1. **Discount != Promotion**: Memisahkan Discount Engine dari Promotion Service memungkinkan:
   - Discount bisa di-test tanpa perlu mock promotion
   - Discount bisa diaktifkan manual tanpa campaign
   - Promotion bisa sync tanpa mengganggu kalkulasi

2. **Pipeline lebih baik dari monolithic**: Dengan pipeline, setiap engine punya tanggung jawab tunggal. Debugging lebih mudah karena adjustment menunjukkan step mana yang salah.

3. **Rounding harus eksplisit**: Jangan asumsi Math.round(). Setiap step harus explicit rounding strategy karena bisnis mungkin minta floor atau ceil.

4. **Scope != Condition**: Scope menentukan **item mana** yang kena, condition menentukan **apakah** rule berlaku. Jangan campur keduanya.
