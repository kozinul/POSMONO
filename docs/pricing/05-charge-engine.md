# Part IV — Charge Engine

## 5.1 Responsibility

Menghitung biaya tambahan (service charge, biaya layanan, dll) yang bukan pajak.

Charge di sini berbeda dengan pajak — charge bukan kewajiban ke negara, melainkan biaya ke merchant. Bedanya:

| Aspek | Charge | Tax |
|-------|--------|-----|
| Penerima | Merchant | Negara |
| Sifat | Optional | Wajib (jika diatur) |
| Bisa include di DPP | Ya (via includeInTaxBase) | Tidak |
| Bisa dinonaktifkan | Ya | Conditional |
| Rate bisa 0 | Ya | Tidak (rate = 0 → skip) |

## 5.2 Algoritma

```
function calculateCharges(items, discount, adjustments):
  1. Filter active charges
  2. Sort by priority (ascending)
  3. Initial: totalCharge = 0
  4. For each charge:
     a. Hitung base = subtotal items (bisa include/exclude diskon)
     b. amount = base × rate%
     c. totalCharge += amount
     d. If charge.includeInTaxBase:
        - accumulatedChargeInTaxBase += amount
     e. Catat sebagai adjustment
  5. Return { totalCharge, chargeInTaxBase, chargeItems, adjustments }
```

## 5.3 Charge Schema

```typescript
interface Charge {
  id: string;
  name: string;
  rate: number;
  isActive: boolean;
  priority: number;
  scope: {
    type: 'ALL' | 'CATEGORY' | 'PRODUCT' | 'OUTLET';
    entityId?: string;
  };
  includeInTaxBase: boolean;
  // Misal: includeInTaxBase=true → SC masuk DPP sebelum kena PPN
}
```

## 5.4 Terminologi: Service Charge vs Charge

Dalam sistem, "Service Charge" hanyalah salah satu jenis Charge dengan `name: 'Service Charge'`. Secara logika:

- **Service Charge**: Biaya pelayanan (biasanya 5-10%, wajib di restoran tertentu)
- **Other Charges**: Biaya tambahan lain (misal: biaya live music, biaya parkir valet)
- **Charge**: Parent konsep untuk semua biaya tambahan non-pajak

Sistem tidak membedakan SC dengan charge lain secara khusus — keduanya diperlakukan sama dengan `includeInTaxBase` dan `priority`.

## 5.5 Service Charge di Indonesia

Berdasarkan peraturan perpajakan:
- Service Charge termasuk dalam **DPP PPN**
- Service Charge dikenakan **PPh Pasal 23** (jika > Rp 2juta/bulan)
- Tarif SC biasanya 5-10% dari tagihan
- `includeInTaxBase: true` untuk Service Charge

## 5.6 Edge Cases

| Skenario | Penanganan |
|----------|------------|
| Charge dinonaktifkan mendadak | Sudah di-cache di config, billing tidak berubah tengah jalan |
| Dua charge dengan nama sama | Dibedakan oleh id dan priority |
| Charge rate 0% | Skip (rate <= 0 → abort charge) |
| Base charge termasuk diskon atau tidak | Parameter setelah atau sebelum diskon |
| Charge untuk item tertentu | Scope filtering (CATEGORY / PRODUCT) |
