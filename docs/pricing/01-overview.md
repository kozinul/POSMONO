# Part I: Business Concepts — Overview

## 1.1 Philosophy

### Kenapa Pricing Engine dibuat?

Pricing Engine adalah **inti dari sistem POS**. Setiap transaksi — baik itu di restoran, retail, atau hospitality — melewati engine ini. Kesalahan hitung = kesalahan uang. Maka engine harus:

- **Correct** — Hasil hitung sesuai ekspektasi bisnis dan pajak
- **Deterministic** — Input sama → output sama, selalu
- **Auditable** — Setiap sen bisa dilacak asal-usulnya (via Adjustment)
- **Configurable** — Tanpa deploy code, bisa ubah pajak, SC, diskon
- **Testable** — Setiap skenario bisa diuji secara unit

### Apa yang ingin diselesaikan?

| Masalah | Solusi |
|---------|--------|
| Pajak multi-tier (PPN, PPh, pajak daerah) | Tax rules dengan priority & scope |
| Service charge masuk/keluar DPP | Charge.includeInTaxBase flag |
| Promo & diskon dari berbagai sumber | Discount Engine + sync dari Promotion |
| Mode harga inclusive (sudah termasuk pajak) vs exclusive (+++) | Per-item pricingMode override |
| DPP fraction untuk PPN 12% Indonesia | ModifierEngine (fraction 11/12) |
| Pembulatan yang konsisten | RoundingEngine (round/floor/ceil) |
| Audit trail setiap perubahan harga | Adjustment pipeline |

### Kenapa Discount dipisah dari Pricing?

Discount punya siklus hidup sendiri:
- Bisa di-create dari modul Promotions (auto-sync)
- Bisa di-create manual via Discount API
- Punya kondisi kompleks (min purchase, day of week, time range, dll)
- Punya efek beragam (%, nominal, free item, fixed price, bundle)
- Perlu evaluasi scope sebelum apply

Memisahkan Discount Engine membuat:
- **Separation of concern** — Discount fokus ke "berapa besar diskon"
- **Reusability** — Bisa dipakai tanpa pricing (misal: tampilkan badge di product card)
- **Testability** — Discount engine di-test terpisah dari tax

### Kenapa memakai Pipeline?

Pricing mengikuti urutan tetap: **Diskon → Charge → Pajak → Pembulatan**.

```
subtotal → afterDiscount → afterCharge → taxBase → grandTotal
```

Pipeline adjustment memastikan:
- Urutan eksekusi terjamin (sequence number)
- Setiap langkah punya konteks (base, rate, amount)
- Hasil akhir bisa diaudit (array of adjustments)

### Kenapa ada Adjustment?

Adjustment adalah **bukti audit**. Setiap perubahan pada harga tercatat sebagai adjustment:

```json
{
  "type": "DISCOUNT",
  "name": "Promo Kopi 50%",
  "base": 100000,
  "rate": 50,
  "amount": -50000
}
```

Dari adjustment ini, siapapun bisa merekonstruksi:
1. Berapa harga awal → subtotal
2. Apa yang terjadi pertama → discount
3. Berapa charge yang ditambahkan → SC
4. Berapa pajak → tax
5. Berapa pembulatan → rounding
6. Berapa grand total → hasil akhir

## 1.2 Batasan Sistem

| Batasan | Nilai |
|---------|-------|
| Rounding precision | 0 atau 2 desimal |
| Discount max rate | 100% (di-cap di calcDiscount) |
| Jumlah item per request | Tidak dibatasi (O(n) per item) |
| Jumlah rule pajak | Tidak dibatasi (O(r) per item) |
| Jumlah charge | Tidak dibatasi |
| Pricing mode | `exclusive` (default) atau `inclusive` per-item |
| Modifier type | `none`, `fraction`, `multiplier`, `fixed_deduction` |
| Adjustment sequence | DISCOUNT=10, CHARGE=20, TAX=30, ROUNDING=40 |

## 1.3 Glossary

| Istilah | Definisi |
|---------|----------|
| **DPP** | Dasar Pengenaan Pajak — nilai yang dikenakan pajak |
| **PPN** | Pajak Pertambahan Nilai (Value Added Tax) |
| **PPh** | Pajak Penghasilan (Withholding Tax) |
| **Service Charge** | Biaya pelayanan (tidak sama dengan tip) |
| **Modifier** | Pengubah DPP sebelum kalkulasi pajak (misal: fraction 11/12) |
| **Adjustment** | Catatan perubahan harga dalam pipeline |
| **Pricing Mode** | Cara harga ditampilkan: inclusive (sudah termasuk pajak) atau exclusive (pajak ditambahkan) |
| **Scope** | Target rule (all / category / product / outlet / customer) |
| **Stackable** | Apakah rule bisa ditumpuk dengan rule lain |
| **Exclusive** | Pajak/charge ditambahkan ke harga |
| **Inclusive** | Pajak/charge sudah termasuk dalam harga |
