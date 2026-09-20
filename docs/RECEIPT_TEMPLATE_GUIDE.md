# Panduan Lengkap Pembuatan & Kustomisasi Template Struk (Receipt Template Guide)

> **Modul:** Universal Document Template Engine (`@posmono/backend` & `@posmono/frontend`)  
> **Target:** Developer & Administrator Sistem Kuire POS  

---

## 1. Konsep Arsitektur Engine Struk

Pencetakan struk di Kuire POS menggunakan pendekatan **Universal Document Template Engine** yang memisahkan data bisnis (`ReceiptViewModel` / `DocumentData`) dari desain tata letak visual (`Template`). 

Dengan arsitektur ini:
1. **Satu Engine**: Menangani thermal printer 58mm, 80mm, hingga dokumen A4 (Invoices/Reports).
2. **Kustomisasi Tanpa Koding**: Administrator dapat mengubah section, urutan baris, visibilitas, hingga format teks melalui *Template Designer* atau file JSON template default.
3. **Multi-Column Justification**: Mesin pencetak otomatis meratakan teks kiri dan nominal/harga ke kanan (`justifyColumns`), mencegah teks harga terpotong atau bergeser di berbagai lebar kertas thermal.

---

## 2. Struktur Data Variabel (`DocumentData`)

Berikut adalah daftar namespace variabel yang dapat direferensikan di dalam template:

### A. Informasi Toko (`store`)
* `{{ store.name }}` — Nama badan usaha / merchant
* `{{ store.outlet }}` — Nama cabang / outlet operasional
* `{{ store.address }}` — Alamat lengkap outlet
* `{{ store.phone }}` — Nomor telepon / kontak outlet
* `{{ store.taxNumber }}` — Nomor NPWP / Pengusaha Kena Pajak (bila ada)
* `{{ store.logo }}` — URL logo toko (ditampilkan via komponen gambar)

### B. Informasi Transaksi (`order`)
* `{{ order.documentNumber }}` — Nomor order/transaksi (contoh: `ORD-20260920-001`)
* `{{ order.referenceNumber }}` — Nomor referensi / invoice ganti (contoh: `INV-0001`)
* `{{ order.type }}` — Tipe transaksi (`dine_in`, `takeaway`, dll.)
* `{{ order.table }}` — Nomor meja (bila ada)
* `{{ order.cashier }}` — Nama kasir yang bertugas
* `{{ order.date }}` — Tanggal transaksi format `DD/MM/YYYY`
* `{{ order.time }}` — Jam transaksi format `HH:MM`
* `{{ order.notes }}` — Catatan pesanan khusus

### C. Daftar Item Pesanan (`items` - Repeater)
Di dalam repeater `items`, gunakan prefix `item.`:
* `{{ item.qty }}` — Kuantitas produk
* `{{ item.name }}` — Nama produk
* `{{ item.unitPrice }}` — Harga satuan
* `{{ item.totalPrice }}` — Total harga baris (`qty * unitPrice`)
* `{{ item.isFreeItem }}` — Boolean penanda item gratis / promo
* `{{ item.modifierLines }}` — Teks ringkasan modifier (contoh: `+ Telur +Rp 5.000` atau `+ Extra Cheese GRATIS`)

### D. Ringkasan Finansial (`summary`)
* `{{ summary.subtotal }}` — Total kotor sebelum diskon & pajak
* `{{ summary.orderDiscount }}` — Total diskon transaksi
* `{{ summary.serviceCharge }}` — Nominal biaya layanan (Service Charge)
* `{{ summary.serviceChargeRate }}` — Persentase service charge (misal: 5 atau 10)
* `{{ summary.dppLabel }}` — Label DPP (misal: `DPP (11/12)`)
* `{{ summary.dpp }}` — Dasar Pengenaan Pajak
* `{{ summary.tax }}` — Total pajak
* `{{ summary.rounding }}` — Nilai pembulatan tunai
* `{{ summary.grandTotal }}` — Total akhir tagihan setelah pembulatan (`roundedPayable` / `grandTotal`)
* `{{ summary.change }}` — Nominal kembalian uang tunai

### E. Pajak & Pembayaran (Repeater `taxes` & `payments`)
* **Pajak (`taxes`)**: `{{ taxe.name }}`, `{{ taxe.label }}`, `{{ taxe.rate }}`, `{{ taxe.amount }}`
* **Pembayaran (`payments`)**: `{{ payment.methodLabel }}` (contoh: Tunai, QRIS), `{{ payment.amount }}`, `{{ payment.referenceLine }}` (contoh: `Ref: QRIS-12345`)

---

## 3. Format Layout Kolom Rata Kiri & Kanan (`columns`)

Untuk membuat baris dengan label di sebelah kiri dan nominal/harga di sebelah kanan (seperti subtotal, total, item pesanan), gunakan properti `columns`:

```json
{
  "id": "row-total",
  "type": "text",
  "columns": [
    { "text": "TOTAL", "align": "left" },
    { "text": "{{ summary.grandTotal | idr }}", "align": "right" }
  ],
  "style": { "font": { "size": 12, "weight": "bold" } }
}
```

### Algoritma Auto-Justify (`justifyColumns`)
Mesin thermal menghitung lebar karakter berdasarkan presetter kertas:
* **Thermal 58mm**: Lebar efektif ±32 karakter.
* **Thermal 80mm**: Lebar efektif ±48 karakter.
* Jika teks kiri atau kanan terlalu panjang, engine secara otomatis melakukan *word-wrapping* atau *hard-slice* agar tata letak tidak berantakan.

---

## 4. Daftar Formatter (Pipes)

Gunakan pipa `|` setelah ekspresi variabel untuk memformat tampilan:
* `| idr` — Format mata uang Rupiah (`15000` → `Rp 15.000`)
* `| idrSigned` — Format Rupiah bertanda untuk pembulatan (`184` → `+Rp 184`, `-50` → `-Rp 50`)
* `| number(0)` — Format angka bulat (`10` → `10`)
* `| uppercase` — Huruf besar semua
* `| lowercase` — Huruf kecil semua

---

## 5. Aturan Visibilitas (`visibility`)

Anda dapat menyembunyikan atau menampilkan baris tertentu secara dinamis berdasarkan nilai data:
```json
{
  "field": "summary.serviceCharge",
  "operator": "greater_than",
  "value": 0
}
```
Operator yang didukung:
* `exists` / `not_exists` : Cek ada/tidaknya data (misal: nomor referensi QRIS).
* `greater_than` / `less_than` : Perbandingan angka (misal: diskon > 0).
* `equals` / `not_equals` : Pencocokan nilai (misal: `item.isFreeItem equals true`).

---

## 6. Sinkronisasi Template ke Database (`Reseed`)

File default template didefinisikan di `backend/src/core/platform/defaults/templates.ts`. 
Apabila Anda melakukan perubahan kode pada file tersebut dan ingin menerapkannya ke database tenant yang sudah ada tanpa menghapus kustomisasi merchant lain, jalankan perintah reseed:

```bash
cd backend
MONGO_URI=mongodb://mongodb:27017/posmono pnpm reseed:templates
```
Script ini secara otomatis mendeteksi dan memperbarui template *default* (Struk Kasir Default & Standard Receipt 58mm) di seluruh tenant.
