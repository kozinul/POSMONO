# Part IV — Rounding Engine

## 7.1 Responsibility

Memastikan semua nilai uang dibulatkan secara konsisten. Digunakan di setiap engine (discount, charge, tax) untuk pembulatan final.

## 7.2 Strategi

| Strategy | Method | Contoh (12.6) | Contoh (-12.6) |
|----------|--------|--------------|----------------|
| `round` | `Math.round()` | 13 | -13 |
| `floor` | `Math.floor()` | 12 | -13 |
| `ceil` | `Math.ceil()` | 13 | -12 |

## 7.3 Precision

| Precision | Deskripsi | Contoh |
|-----------|-----------|--------|
| 0 | Integer (default) | 12345 |
| 2 | Dua desimal (internal) | 12345.67 |

Sistem menyimpan nilai dalam integer penuh (precision 0) karena:
1. Mata uang Rupiah tidak memiliki pecahan sen
2. Menghindari floating point error
3. Simplifikasi audit trail

Internal calculation tetap menggunakan 2 desimal via `Math.round(value * 100) / 100`, kemudian output diinteger-kan.

## 7.4 API

```typescript
function round(value: number, mode: RoundingMode, precision?: number): number
```

```typescript
enum RoundingMode {
  ROUND = 'round',
  FLOOR = 'floor',
  CEIL = 'ceil',
}
```

## 7.5 Rounding Edge Cases

| Input | round | floor | ceil |
|-------|-------|-------|------|
| 0 | 0 | 0 | 0 |
| 0.4 | 0 | 0 | 1 |
| 0.6 | 1 | 0 | 1 |
| -0.4 | 0 | -1 | 0 |
| -0.6 | -1 | -1 | 0 |
| 100 | 100 | 100 | 100 |
| 99.99 (precision 0) | 100 | 99 | 100 |
| 99.99 (precision 2) | 99.99 | 99.99 | 99.99 |
| 100.001 (precision 2) | 100 | 100 | 100.01 |

## 7.6 Penggunaan di Engine

| Engine | Default Rounding | Konfigurasi |
|--------|-----------------|-------------|
| Discount | `round` | per-policy |
| Charge | `round` | per-rule |
| Tax | `round` | per-rule |
| Grand Total | `round` | global config |
