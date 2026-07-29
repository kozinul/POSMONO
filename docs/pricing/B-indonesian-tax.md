# Appendix B — Indonesian Tax Example

## B.1 Konteks Regulasi

Tarif PPN di Indonesia:

| Periode | Tarif | Dasar Hukum |
|---------|-------|-------------|
| s.d. 31 Mar 2022 | 10% | UU PPN |
| 1 Apr 2022 - 31 Mar 2024 | 11% | UU HPP |
| 1 Apr 2024 - sekarang | 12%* | UU HPP |

*) Tarif 12% berlaku mulai 2024, dengan **DPP fraction 11/12** sehingga tarif efektif tetap 11%.

## B.2 PPN Fraction 11/12

Aturan: PPN 12% dikenakan atas Dasar Pengenaan Pajak (DPP) berupa **nilai lain** sebesar 11/12 dari harga jual.

```
DPP PPN = harga_jual × 11/12
PPN Terutang = DPP PPN × 12%
            = (harga_jual × 11/12) × 12%
            = harga_jual × 11%
```

### Efeknya:

| Harga Jual | DPP (11/12) | PPN 12% | Efektif |
|------------|-------------|---------|---------|
| Rp100.000 | Rp91.667 | Rp11.000 | 11% |
| Rp250.000 | Rp229.167 | Rp27.500 | 11% |
| Rp1.000.000 | Rp916.667 | Rp110.000 | 11% |

### Implementasi: `ModifierConfig`

```json
{
  "type": "fraction",
  "config": {
    "numerator": 11,
    "denominator": 12
  }
}
```

### Deprecation Path

Pada masa depan, jika tarif efektif PPN naik ke 12% (tanpa fraction):

```json
{
  // Future: PPN 12% tanpa modifier
  "rate": 12,
  "modifier": { "type": "none" }
}
```

Sistem tinggal update config — tidak ada perubahan code.

## B.3 PPh Pasal 23

PPh Pasal 23 dikenakan atas:
- **Service Charge** → tarif 2% (jika > Rp 2 juta/bulan)
- **Hadiah undian** → tarif 25%
- **Sewa** → tarif 2%

### Contoh: PPN + PPh

```
Harga:              Rp 100.000
Service Charge 10%: Rp  10.000 (includeInTaxBase=true)
DPP:                Rp 110.000
PPN 12% (fraction): Rp  10.083  (110.000 × 11/12 × 12%)
PPh 2%:             Rp     220  (10.000 SC × 2%)
Total:              Rp 120.303
```

## B.4 Inclusive Pricing di Indonesia

Untuk transaksi B2C, harga sering ditampilkan **inclusive PPN**:

```
Harga Menu:     Rp 100.000 (sudah termasuk PPN 12%)
Perhitungan:
  DPP:          Rp 100.000 × 100/112 × 12/11 = Rp 97.403
  PPN:          Rp 100.000 - Rp 97.403 = Rp 2.597
Total:          Rp 100.000
```

## B.5 Multi-outlet Tax Configuration

Restoran dengan cabang di berbagai daerah:

| Outlet | PPN | Pajak Daerah | SC |
|--------|-----|--------------|----|
| Jakarta | 12% (11/12) | 10% | 5% |
| Surabaya | 12% (11/12) | - | 5% |
| Bandung | 12% (11/12) | 7% | 5% |

Setiap outlet punya `TaxConfiguration` sendiri dengan `tenantId` berbeda.

## B.6 Referensi Regulasi

| Regulasi | Isi |
|----------|-----|
| UU PPN No. 42/2009 | Tarif PPN 10% |
| UU HPP No. 7/2021 | PPN naik bertahap ke 11% (2022) dan 12% (maks 2025) |
| PMK-131/2024 | DPP nilai lain 11/12 untuk PPN 12% |
| PP 58/2021 | PPh Pasal 23 tarif 2% untuk service charge |
| PER-11/PJ/2022 | Pedoman pembuatan Faktur Pajak |
