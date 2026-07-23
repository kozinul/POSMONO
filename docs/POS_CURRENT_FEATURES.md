# POS System - Ringkasan Fitur Lengkap

> Dokumentasi lengkap fitur sistem POS saat ini, sebagai referensi untuk rewrite ke **Modular Monolith + Domain-Driven Design (DDD)**.

---

## Arsitektur Saat Ini

```
Monorepo (pnpm + Turborepo)
├── @pos/api          → Express.js REST API (MVC-like, port 5000)
├── @pos/cashier      → React SPA POS Terminal (Vite, port 3001)
├── @pos/dashboard    → React SPA Admin Panel (Vite, port 3000)
├── @pos/shared       → TypeScript interfaces (shared types)
└── @pos/ui           → Component library (planned, empty)
```

**Database:** MongoDB (Mongoose 8 ODM)
**Auth:** JWT (jsonwebtoken) + bcryptjs
**Validation:** Zod
**Image Processing:** Sharp
**File Uploads:** Multer

---

## Daftar Domain / Module

| # | Domain | Model | Route Prefix | Status |
|---|--------|-------|-------------|--------|
| 1 | Auth | User | `/api/auth` | ✅ |
| 2 | User | User | `/api/users` | ✅ |
| 3 | Role (RBAC) | Role | `/api/roles` | ✅ |
| 4 | Outlet | Outlet | `/api/outlets` | ✅ |
| 5 | Family | Family | `/api/families` | ✅ |
| 6 | Category | Category | `/api/categories` | ✅ |
| 7 | Product | Product | `/api/products` | ✅ |
| 8 | Modifier | Modifier | `/api/modifiers` | ✅ |
| 9 | Member | Member | `/api/members` | ✅ |
| 10 | Tax | Tax, TaxRule | `/api/taxes` | ✅ |
| 11 | Discount | Discount | `/api/discounts` | ✅ |
| 12 | Promotion | Promotion | `/api/promotions` | ✅ |
| 13 | Payment Method | PaymentMethod | `/api/payment-methods` | ✅ |
| 14 | Order | Order | `/api/orders` | ✅ |
| 15 | Closing (Shift) | Closing | `/api/closings` | ✅ |
| 16 | Report | (aggregation) | `/api/reports` | ✅ |
| 17 | Summary | (aggregation) | `/api/summary` | ✅ |
| 18 | Setting | Setting | `/api/settings` | ✅ |
| 19 | Upload | (file) | `/api/upload` | ✅ |

---

## 1. Domain: Auth

### Models
- **User** (`User.ts`)
  - `userId` (string, unique) — ID login
  - `name` (string)
  - `email` (string, unique)
  - `password` (string, hashed)
  - `role` ('admin' | 'cashier')
  - `roleRef` (ObjectId → Role)
  - `outlets` (ObjectId[] → Outlet)
  - `defaultStartingCash` (number)

### API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | ❌ | Login, return JWT + user info |
| GET | `/api/auth/me` | ✅ | Get current user profile |
| POST | `/api/auth/verify-supervisor` | ❌ | Verify supervisor for void action |

### Business Logic
- JWT token expiry: 7 days
- Login by `userId` (bukan email)
- Supervisor verification: cek role admin OR permission `sales.void`

---

## 2. Domain: User

### API Endpoints
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/users` | ✅ | admin | List all users |
| POST | `/api/users` | ✅ | admin | Create user |
| PUT | `/api/users/:id` | ✅ | admin | Update user |
| DELETE | `/api/users/:id` | ✅ | admin | Delete user |

### Business Logic
- Password di-hash dengan bcrypt (rounds: 10)
- Assign role (roleRef) dan outlets saat create/update
- `defaultStartingCash` untuk shift management

---

## 3. Domain: Role (RBAC)

### Models
- **Role** (`Role.ts`)
  - `name` (string, unique)
  - `description` (string)
  - `permissions` (Permission[]) — 30+ granular permissions
  - `isSystem` (boolean) — system roles tidak bisa dihapus

### Permissions (30+)
```
sales.create, sales.void, sales.view, sales.discount
products.view, products.create, products.edit, products.delete
categories.view, categories.edit
members.view, members.edit
promotions.view, promotions.edit
reports.sales, reports.finance
settings.edit
users.view, users.edit
outlets.view, outlets.edit
modifiers.view, modifiers.edit
taxes.view, taxes.edit
payment-methods.view, payment-methods.edit
families.view, families.edit
```

### API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/roles` | ✅ admin | List all roles |
| GET | `/api/roles/:id` | ✅ admin | Get role detail |
| POST | `/api/roles` | ✅ admin | Create role |
| PUT | `/api/roles/:id` | ✅ admin | Update role |
| DELETE | `/api/roles/:id` | ✅ admin | Delete role |

### Business Logic
- System roles (Admin, Kasir) tidak bisa dihapus
- Admin role otomatis dapat semua permissions
- Middleware `authorize(permissions)` check permission via `roleRef.permissions`

---

## 4. Domain: Outlet

### Models
- **Outlet** (`Outlet.ts`)
  - `name` (string)
  - `code` (string, unique)
  - `status` ('active' | 'inactive')

### API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/outlets` | ❌ | List outlets |
| GET | `/api/outlets/:id` | ❌ | Get outlet detail |
| POST | `/api/outlets` | ✅ admin | Create outlet |
| PUT | `/api/outlets/:id` | ✅ admin | Update outlet |
| DELETE | `/api/outlets/:id` | ✅ admin | Delete outlet |

### Business Logic
- Multi-outlet: produk, user, payment method, promosi, pajak bisa di-scoping per outlet
- Outlet status active/inactive

---

## 5. Domain: Family

### Models
- **Family** (`Family.ts`)
  - `name` (string, unique per tenant)
  - `description` (string)
  - `menuType` (`'food' | 'beverage'`) — top-level menu classification
  - `sortOrder` (number)
  - `isActive` (boolean)

### API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/families` | ❌ | List all families |
| GET | `/api/families/by-menu-type/:menuType` | ❌ | List families filtered by food/beverage |
| POST | `/api/families` | ✅ admin | Create family |
| PUT | `/api/families/:id` | ✅ admin | Update family |
| DELETE | `/api/families/:id` | ✅ admin | Delete family |

### Business Logic
- Top-level grouping untuk menu: **Food** (Makanan) atau **Beverage** (Minuman)
- Family mengelompokkan Category (misal: Western → Main Course, Appetizer)
- 3-level hierarchy: Menu Type → Family → Category → Product

---

## 6. Domain: Category

### Models
- **Category** (`Category.ts`)
  - `name` (string, unique per tenant)
  - `familyId` (string | null) — links to Family
  - `parentId` (string | null) — supports sub-categories
  - `sortOrder` (number)
  - `isActive` (boolean)

### API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/categories` | ❌ | List all categories |
| GET | `/api/categories/by-family/:familyId` | ❌ | List categories filtered by family |
| POST | `/api/categories` | ✅ admin | Create category |
| PUT | `/api/categories/:id` | ✅ admin | Update category |
| DELETE | `/api/categories/:id` | ✅ admin | Delete category |

---

## 7. Domain: Product

### Models
- **Product** (`Product.ts`)
  - `sku` (string, unique per tenant)
  - `barcode` (string) — EAN/UPC for scanner
  - `bc` (string) — additional barcode
  - `name` (string)
  - `description` (string)
  - `categoryId` (string → Category)
  - `basePrice` (number)
  - `pricingProfileId` (string | null)
  - `imageUrls` (string[])
  - `tags` (string[])
  - `country` (string)
  - `region` (string)
  - `currency` (string)
  - `isActive` (boolean)
  - `metadata` (Record<string, unknown>)

### API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/products` | ❌ | List products (paginated, filter by categoryId, search) |
| GET | `/api/products/by-barcode/:barcode` | ❌ | Lookup product by barcode (POS scanner) |
| GET | `/api/products/:id` | ❌ | Get product detail |
| POST | `/api/products` | ✅ admin | Create product |
| PUT | `/api/products/:id` | ✅ admin | Update product |
| DELETE | `/api/products/:id` | ✅ admin | Soft-delete (set isActive: false) |

### Business Logic
- SKU uniqueness enforced per tenant
- Barcode lookup for POS scanner
- Soft-delete: `DELETE` sets `isActive: false`, product hidden from POS
- Image upload via `/api/upload` endpoint (multer + sharp)
- Tags for flexible product tagging
- Search by name, SKU, or barcode
- Stock management: bisa di-disable per produk
- Barcode auto-generate atau manual input
- Popular products: berdasarkan jumlah order

---

## 8. Domain: Modifier

### Models
- **Modifier** (`Modifier.ts`)
  - `name` (string)
  - `options` (IModifierOption[]) — `{ name, price }`
  - `productId` (ObjectId → Product) — optional, per produk
  - `family` (ObjectId → Family) — optional, per family
  - `required` (boolean)

### API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/modifiers` | ❌ | List modifiers |
| POST | `/api/modifiers` | ✅ admin | Create modifier |
| PUT | `/api/modifiers/:id` | ✅ admin | Update modifier |
| DELETE | `/api/modifiers/:id` | ✅ admin | Delete modifier |

### Business Logic
- Contoh: "Ukuran" → [Small +0, Medium +2000, Large +5000]
- Contoh: "Topping" → [Keju +3000, Saus +1000]
- Price modifier: ditambahkan ke harga item

---

## 9. Domain: Member

### Models
- **Member** (`Member.ts`)
  - `name` (string)
  - `phone` (string, unique)
  - `email` (string)
  - `tier` ('regular' | 'silver' | 'gold' | 'platinum')
  - `totalOrders` (number)
  - `totalSpend` (number)
  - `notes` (string)

### API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/members` | ❌ | List members |
| GET | `/api/members/search?phone=` | ❌ | Search by phone |
| GET | `/api/members/:id` | ❌ | Get member detail |
| POST | `/api/members` | ✅ admin | Create member |
| PUT | `/api/members/:id` | ✅ admin | Update member |
| DELETE | `/api/members/:id` | ✅ admin | Delete member |

### Business Logic
- Phone search untuk kasir memilih member
- Tier loyalty: regular → silver → gold → platinum
- Auto-increment totalOrders dan totalSpend setiap transaksi
- Text index pada name dan phone

---

## 10. Domain: Tax

### Models
- **Tax** (`Tax.ts`)
  - `name`, `code` (string, unique)
  - `rate` (number) — persentase atau nominal
  - `rateType` ('percentage' | 'nominal')
  - `taxType` ('vat' | 'withholding' | 'service_charge' | 'other')
  - `dppFormula` — `{ type: 'full' | 'fraction', fraction?: { numerator, denominator } }`
  - `rounding` ('math' | 'floor' | 'ceil')
  - `roundingPrecision` (number)
  - `scope` ('all' | 'category' | 'product' | 'transaction_type')
  - `categoryIds`, `productIds`, `transactionTypes`
  - `includedByDefault` (boolean) — apakah harga sudah termasuk pajak
  - `effectiveFrom`, `effectiveTo` (Date)
  - `priority` (number)
  - `outlets` (ObjectId[])
  - `exemptUpTo` (number)
  - `active` (boolean)

- **TaxRule** (`TaxRule.ts`)
  - `name`, `description`
  - `taxCode` (string) — reference ke Tax.code
  - `regulationReference` (string) — e.g. "PMK-131/2024"
  - `conditions` — `{ applicableFrom, applicableTo, minTransactionValue, maxTransactionValue, outletIds, categoryIds, productIds, transactionTypes, customerTiers }`
  - `actions` — `{ rateOverride, dppFractionOverride, roundingOverride, statusOverride, includedOverride }`
  - `priority` (number)
  - `active` (boolean)

### API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/taxes` | ❌ | List taxes |
| GET | `/api/taxes/:id` | ❌ | Get tax detail |
| POST | `/api/taxes` | ✅ admin | Create tax |
| PUT | `/api/taxes/:id` | ✅ admin | Update tax |
| DELETE | `/api/taxes/:id` | ✅ admin | Delete tax |
| POST | `/api/taxes/calculate` | ✅ | Calculate transaction tax |
| GET | `/api/taxes/product/display` | ❌ | Get product tax display |
| GET | `/api/taxes/validate/:id?` | ✅ admin | Validate tax config |
| GET | `/api/taxes/rules/list` | ❌ | List tax rules |
| GET | `/api/taxes/rules/:id` | ❌ | Get tax rule |
| POST | `/api/taxes/rules` | ✅ admin | Create tax rule |
| PUT | `/api/taxes/rules/:id` | ✅ admin | Update tax rule |
| DELETE | `/api/taxes/rules/:id` | ✅ admin | Delete tax rule |

### Business Logic (Tax Engine)
- **DPP Fraction 11/12**: PPN 12% dengan Dasar Pengenaan Pajak Nilai Lain
  - Rumus: `DPP × 12% × 11/12`
  - Efektif rate: 11%
- **Per-product tax**: produk bisa punya pajak berbeda
- **TaxRule overrides**: rate, DPP fraction, rounding bisa di-override berdasarkan kondisi
- **Effective date range**: pajak berlaku dari tanggal tertentu
- **Scope**: all, per kategori, per produk, per jenis transaksi (dine_in, takeaway, dll)
- **Rounding**: math (standard), floor, ceil
- **Exempt up to**: batas nilai transaksi bebas pajak

---

## 11. Domain: Discount

### Models
- **Discount** (`Discount.ts`)
  - `name`, `description`
  - `outlets` (ObjectId[])
  - `type` ('percentage' | 'nominal' | 'buy_x_get_y' | 'min_purchase')
  - `value` (number)
  - `scope` ('all' | 'category' | 'family')
  - `targetId` (ObjectId → Category/Family)
  - `targetModel` ('Category' | 'Family')
  - `buyQty`, `freeQty` (number) — untuk buy_x_get_y
  - `minAmount` (number) — untuk min_purchase
  - `discountValue`, `discountUnit` ('percentage' | 'nominal')
  - `startDate`, `endDate` (Date)
  - `active` (boolean)

### API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/discounts` | ❌ | List discounts |
| POST | `/api/discounts` | ✅ admin | Create discount |
| PUT | `/api/discounts/:id` | ✅ admin | Update discount |
| DELETE | `/api/discounts/:id` | ✅ admin | Delete discount |

### Business Logic
- 4 tipe diskon: percentage, nominal, buy_x_get_y, min_purchase
- Scope: all (semua produk), per kategori, per family
- Date range validity

---

## 12. Domain: Promotion

### Models
- **Promotion** (`Promotion.ts`)
  - `name`, `code` (unique), `description`
  - `outlets` (ObjectId[])
  - `customerTiers` (string[]) — regular, silver, gold, platinum
  - `paymentMethodIds` (ObjectId[])
  - `priority` (number)
  - `exclusive` (boolean) — tidak bisa stack dengan promo lain
  - `stackable` (boolean) — bisa digabung dengan promo lain
  - `rules` (IRule[]) — array of rule conditions
  - `ruleLogic` ('AND' | 'OR')
  - `usageLimit` — `{ perPromotion, perCustomer }`
  - `usedCount` (number)
  - `minCartValue` (number)
  - `startDate`, `endDate` (Date)
  - `active` (boolean)
  - `requiresCode` (boolean) — promo harus pakai kode

### Rule Types (14 tipe)
| # | Rule Type | Deskripsi |
|---|-----------|-----------|
| 1 | `percentage` | Diskon persentase |
| 2 | `nominal` | Diskon nominal (Rp) |
| 3 | `special_price` | Harga spesial |
| 4 | `quantity_range` | Diskon berdasarkan range qty |
| 5 | `min_quantity` | Minimal qty tertentu |
| 6 | `nth_item` | Diskon item ke-N |
| 7 | `bundle` | Bundle price |
| 8 | `buy_x_get_y` | Beli X gratis Y |
| 9 | `buy_x_pay_y` | Beli X bayar Y |
| 10 | `free_gift` | Gratis hadiah |
| 11 | `min_spend` | Minimal total belanja |
| 12 | `multiplier` | Pengali harga |
| 13 | `member_tier` | Berdasarkan tier member |
| 14 | `payment_method` | Berdasarkan metode pembayaran |

### API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/promotions` | ❌ | List promotions |
| GET | `/api/promotions/code/:code` | ❌ | Get promotion by code |
| GET | `/api/promotions/:id` | ❌ | Get promotion detail |
| POST | `/api/promotions` | ✅ admin | Create promotion |
| PUT | `/api/promotions/:id` | ✅ admin | Update promotion |
| DELETE | `/api/promotions/:id` | ✅ admin | Delete promotion |

### Business Logic (Promotion Engine)
- **14 rule evaluators**: setiap tipe punya evaluator tersendiri
- **AND/OR logic**: rules bisa digabung dengan AND atau OR
- **Exclusive vs Stackable**: exclusive = tidak bisa digabung, stackable = bisa digabung
- **Promo code**: bisa require kode promo saat transaksi
- **Usage limits**: batas pemakaian per promo dan per customer
- **Date-based**: promo berlaku dari tanggal tertentu
- **Outlet-scoped**: promo hanya berlaku di outlet tertentu
- **Customer tier**: promo berdasarkan tier member
- **Payment method**: promo berdasarkan metode pembayaran
- **Time window**: promo berlaku di jam tertentu
- **Priority**: promo dengan priority lebih tinggi dijalankan lebih dulu

---

## 13. Domain: Payment Method

### Models
- **PaymentMethod** (`PaymentMethod.ts`)
  - `name` (string) — display name ("Tunai", "Kartu Kredit")
  - `code` (string, unique per tenant) — internal code ("cash", "card", "qris")
  - `description` (string)
  - `icon` (string) — emoji icon for UI
  - `color` (string) — hex color for UI
  - `sortOrder` (number)
  - `isActive` (boolean)
  - `requiresReference` (boolean) — true for card/transfer (need reference number)
  - `config` (Record<string, unknown>) — method-specific configuration

### API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/payment-methods` | ❌ | List all payment methods |
| GET | `/api/payment-methods/active` | ❌ | List active methods (for POS) |
| GET | `/api/payment-methods/:id` | ❌ | Get payment method by ID |
| POST | `/api/payment-methods` | ✅ admin | Create payment method |
| PUT | `/api/payment-methods/:id` | ✅ admin | Update payment method |
| DELETE | `/api/payment-methods/:id` | ✅ admin | Delete payment method |

### Business Logic
- Code uniqueness enforced per tenant
- `requiresReference` flag enables UI to conditionally show reference input in POS
- Preset buttons for quick setup: Tunai, Kartu, QRIS, Transfer, E-Wallet, Kredit

---

## 14. Domain: Order

### Models
- **Order** (`Order.ts`)
  - `orderNumber` (string, unique, auto-generated)
  - `items` (IOrderItem[]) — `{ product, qty, price, subtotal, modifiers[] }`
  - `total`, `originalTotal`, `roundedPayable`, `roundingAdjustment`
  - `roundingMethod` (string)
  - `subtotal`, `discountTotal`, `dppTotal`, `taxTotal`
  - `taxDetails` (ITaxDetail[]) — detail per pajak
  - `serviceCharge`, `serviceChargeRate`
  - `promotions` (IPromotionBreakdown[]) — promo yang diterapkan
  - `paymentMethod` (ObjectId), `paymentMethodCode`, `paymentMethodName`
  - `paymentBreakdown` (IPaymentBreakdownEntry[]) — split payment detail
  - `cashAmount`, `change`
  - `cardLastFour`
  - `cashier` (ObjectId), `cashierName`
  - `outlet` (ObjectId), `outletName`
  - `member` (ObjectId), `memberName`, `memberTier`
  - `tableNumber`, `customerName`
  - `transactionType` ('dine_in' | 'takeaway' | 'delivery' | 'online')
  - `splitGroup`, `splitIndex`
  - `status` ('completed' | 'voided' | 'partially-voided' | 'open')
  - `voidedItems` (IVoidedItem[])
  - `voidedAt`, `voidedBy`, `voidedByName`, `voidReason`

### API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/orders` | ✅ | Create order (transaksi) |
| GET | `/api/orders` | ✅ | List orders (filter by date, outlet, status) |
| GET | `/api/orders/report/daily` | ✅ admin | Daily sales report |
| GET | `/api/orders/:id` | ✅ | Get order detail |
| POST | `/api/orders/:id/void` | ✅ | Void entire order |
| POST | `/api/orders/:id/void-item` | ✅ | Void individual item |
| POST | `/api/orders/:id/void-payment` | ✅ | Void payment (return to cart) |
| PUT | `/api/orders/:id/pay` | ✅ | Pay open bill |
| PATCH | `/api/orders/:id/close-open` | ✅ | Close open bill |
| POST | `/api/orders/:id/hold` | ✅ | Hold order (tahan pesanan) |
| PATCH | `/api/orders/:id/recall` | ✅ | Recall held order (panggil pesanan) |

### Business Logic
- **Order number auto-generated**: format `ORD-YYYYMMDD-XXXX`
- **Tax calculation**: hitung DPP + pajak per item, termasuk DPP fraction 11/12
- **Inclusive/exclusive pricing**: SC & PPN extracted from price (inclusive) or added on top (exclusive)
- **Promotion application**: terapkan promo rules ke cart
- **Split payment**: bayar dengan beberapa metode sekaligus
- **Split bill (pay one at a time)**: pilih item yang mau dibayar → bayar → sisa item tetap di cart → ulangi
- **Split order numbering**: receipt menampilkan `ORD-xxx/N` untuk split portions
- **Hold/Recall order**: tahan pesanan (instant, backend sync in background), panggil kapan saja
- **Void order**: batalkan seluruh transaksi (butuh supervisor auth)
- **Void item**: batalkan item tertentu dalam transaksi
- **Void payment**: batalkan pembayaran, kembali ke cart
- **Open bill**: transaksi belum dibayar, bisa dilanjutkan nanti
- **Customer name & table number**: field di atas cart, selalu terlihat
- **Transaction types**: dine_in, takeaway, delivery, online

---

## 15. Domain: Closing (Shift Management)

### Models
- **Closing** (`Closing.ts`)
  - `outlet` (ObjectId)
  - `cashier` (ObjectId)
  - `openedAt`, `closedAt` (Date)
  - `startingCash` (number) — uang awal kas
  - `physicalCash` (number) — uang fisik dihitung
  - `expectedCash` (number) — uang yang seharusnya
  - `totalCashPickups` (number)
  - `difference` (number) — selisih
  - `totalSales`, `cashSales`, `nonCashSales`
  - `totalTransactions`
  - `paymentBreakdown` (IPaymentBreakdown[]) — `{ method, code, total }`
  - `cashPickups` (ICashPickup[]) — `{ amount, reason, pickedAt, pickedBy, pickedByName }`
  - `status` ('open' | 'closed')

### API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/closings` | ✅ admin | List closings |
| GET | `/api/closings/active` | ✅ | Get active closing for current cashier |
| GET | `/api/closings/report` | ✅ | Get cashier report |
| POST | `/api/closings/open` | ✅ | Open shift (mulai kerja) |
| POST |PhysicalCash, `expectedCash`, `difference`
  - `totalSales`, `cashSales`, `nonCashSales`
  - `totalTransactions`
  - `paymentBreakdown` (IPaymentBreakdown[])
  - `cashPickups` (ICashPickup[])
  - `status` ('open' | 'closed')

### API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/closings` | ✅ admin | List closings |
| GET | `/api/closings/active` | ✅ | Get active closing |
| GET | `/api/closings/report` | ✅ | Get cashier report |
| POST | `/api/closings/open` | ✅ | Open shift |
| POST | `/api/closings/:id/close` | ✅ | Close shift |
| POST | `/api/closings/:id/pickup` | ✅ | Cash pickup |

### Business Logic
- **Open shift**: kasir mulai kerja, set starting cash
- **Close shift**: kasir akhir kerja, hitung fisik cash
  - `expectedCash = startingCash + cashSales - totalCashPickups`
  - `difference = physicalCash - expectedCash`
- **Cash pickup**: ambil uang dari kas (untuk setor ke bank)
- **Payment breakdown**: detail pembayaran per metode (cash, QRIS, debit, dll)

---

## 16. Domain: Report

### API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/reports/sales` | ✅ admin | Sales report (by date range, outlet) |
| GET | `/api/reports/finance` | ✅ admin | Finance report |
| GET | `/api/reports/cashier` | ✅ admin | Cashier performance report |

### Business Logic
- **Sales report**: total penjualan, jumlah transaksi, rata-rata per transaksi
- **Finance report**: pendapatan bersih, pajak, service charge
- **Cashier report**: per kasir, total transaksi, total penjualan

---

## 17. Domain: Summary (Dashboard)

### API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/summary` | ✅ admin | Dashboard summary |

### Business Logic
- Revenue hari ini
- Jumlah transaksi hari ini
- Outlet ranking (berdasarkan penjualan)
- Top products by family
- Active promos per outlet

---

## 18. Domain: Setting

### Models
- **Setting** (`Setting.ts`)
  - `key` (string, unique)
  - `value` (Mixed)
  - `description` (string)

### API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/settings` | ❌ | Get all settings |
| PUT | `/api/settings` | ✅ admin | Update settings |

### Business Logic
- Key-value store untuk pengaturan sistem
- Contoh: `roundingConfig` — konfigurasi pembulatan global

---

## 19. Domain: Upload

### API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/upload` | ❌ | Upload image (multipart/form-data) |

### Business Logic
- Upload gambar produk
- Resize ke 400×400px (cover)
- Convert ke WebP (quality 80%)
- Max file size: 5MB
- Hanya file image yang diizinkan
- Output: `/uploads/{timestamp}-{random}.webp`

---

## Frontend: Dashboard (Admin Panel)

### Tech Stack
- React 18 + React Router v6
- Vite 5
- Tailwind CSS (CDN) + Material Design 3 tokens
- Material Symbols Outlined (icons)
- SweetAlert2 (notifikasi)
- Context API (auth state)

### Layout
- **Sidebar** (280px width) — grouped navigation
- **Header** — user info, logout
- **Content** — `<Outlet />` (nested routes)

### Halaman (20 pages)

| # | Halaman | Route | Deskripsi |
|---|---------|-------|-----------|
| 1 | Dashboard (Ringkasan) | `/` | Revenue hari ini, transaksi, outlet ranking, top products, active promos |
| 2 | Produk | `/products` | CRUD produk, gambar, stock, tax assignment, outlet assignment |
| 3 | Kategori | `/categories` | CRUD kategori, linked to family |
| 4 | Family | `/families` | CRUD family produk |
| 5 | Member | `/members` | CRUD member, tier loyalty |
| 6 | Promosi | `/promotions` | CRUD promosi, rule builder |
| 7 | Pajak | `/taxes` | CRUD pajak + tax rules |
| 8 | Rounding Config | `/rounding-config` | Pengaturan pembulatan |
| 9 | Payment Methods | `/payment-methods` | CRUD metode pembayaran |
| 10 | Modifiers | `/modifiers` | CRUD modifier produk |
| 11 | Outlets | `/outlets` | CRUD outlet |
| 12 | Roles | `/roles` | CRUD role + permissions |
| 13 | Users | `/users` | CRUD user, assign role & outlets |
| 14 | Orders | `/orders` | List transaksi, detail, filter |
| 15 | Report Sales | `/reports/sales` | Laporan penjualan |
| 16 | Report Finance | `/reports/finance` | Laporan keuangan |
| 17 | Report Cashier | `/reports/cashier` | Laporan performa kasir |
| 18 | Settings | `/settings` | Pengaturan sistem |
| 19 | Login | `/login` | Autentikasi admin |
| 20 | Rounding Config | `/rounding-config` | Pengaturan pembulatan global |

---

## Frontend: Cashier (POS Terminal)

### Tech Stack
- React 18 + React Router v6
- Vite 5
- Tailwind CSS (CDN)
- Material Symbols Outlined (icons)
- Context API (auth state)
- `fetch()` API (no axios)
- Print CSS untuk receipt & report

### Halaman (2 pages — monolitik)

| # | Halaman | Deskripsi |
|---|---------|-----------|
| 1 | Login | Autentikasi kasir |
| 2 | Cashier | Full POS terminal (~3179 lines) |

### Fitur Cashier.tsx (Monolitik)

#### A. Product Catalog
- Grid product cards
- Filter by Family (tab) → Category (sub-tab)
- Search by name/barcode
- Popular products section
- Product image display

#### B. Cart Management
- Add item to cart
- Select modifier (popup)
- Update quantity (+ / -)
- Remove item
- Item-level void (dengan supervisor auth)
- Subtotal per item & total

#### C. Member Selection
- Search member by phone
- Display member name & tier
- Auto-apply member-based promos

#### C. Customer & Table
- Customer name input (above cart, always visible)
- Table number input (above cart, always visible)
- Both passed to held orders and order creation

#### D. Hold/Recall Orders
- Hold button (requires name OR table number) → instant cart clear, backend sync in background
- Collapsible sidebar panel (left side, 280px) showing held orders
- Recall button restores items, customer name, table number
- Background sync to backend (POST create + POST hold, PATCH recall)

#### E. Promotion
- Apply promo code
- Auto-apply eligible promos
- Display promo breakdown

#### E. Tax Display
- Show per-item tax breakdown
- DPP calculation
- Total tax

#### F. Payment
- Single payment (cash, QRIS, debit, credit, transfer)
- Split bill — pay one at a time (item checkboxes, sequential partial payments)
- Split order numbering on receipt: `ORD-xxx/1`, `ORD-xxx/2`
- "Bayar Sisanya" button when items remain after partial payment
- Cash change calculation
- Rounding based on payment method policy
- Card last four for debit/credit

#### G. Transaction History
- List recent transactions
- Void full order (supervisor auth)
- Void individual item
- Void payment (return to cart)

#### H. Shift Management
- Open shift (set starting cash)
- Close shift (physical cash counting, difference calculation)
- Cash pickup

#### I. Cashier Reports
- Display cashier report
- Print report

#### J. Receipt Printing
- Print receipt (CSS print media)
- Receipt format with store info, items, totals, payment details

---

## HTML Files (Vite Entry Points)

> **Catatan:** Tidak ada file wiremap/wireframe di project ini. Berikut adalah HTML entry points yang ada:

### 1. Dashboard Entry HTML
**Path:** `apps/dashboard/index.html`

```html
<!DOCTYPE html>
<html class="light" lang="id">
<head>
  <meta charset="utf-8"/>
  <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
  <title>HQ Dashboard - POS Central System</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" crossorigin />
  <!-- Tailwind config dengan Material Design 3 color tokens -->
  <!-- 60+ custom colors (primary, secondary, tertiary, surface, error, outline) -->
  <!-- Custom spacing: sidebar_width(280px), container_gutter(24px), table_cell_padding, element_gap -->
  <!-- Custom font sizes: label-md, label-sm, display-sm, body-md, headline-sm, body-sm, section-header -->
  <style>
    body { font-family: 'Inter', sans-serif; background-color: #f8fafc; }
    .sidebar-active { background-color: #1e40af !important; color: #ffffff !important; border-left: 4px solid #ffffff; }
    .status-pill { padding: 2px 12px; border-radius: 9999px; font-weight: 600; font-size: 12px; }
    .status-active { background-color: #dcfce7; color: #166534; }
    .status-inactive { background-color: #f1f5f9; color: #475569; }
    .status-error { background-color: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

### 2. Cashier Entry HTML
**Path:** `apps/cashier/index.html`

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8"/>
  <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
  <title>POS System - Kasir</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" crossorigin />
  <style>
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: #F3F4F6; }
    .product-card { transition: transform 0.1s ease; }
    .product-card:active { transform: scale(0.98); }
    .order-list-container::-webkit-scrollbar { width: 4px; }
    @media print {
      body * { visibility: hidden; }
      #receipt-print, #receipt-print * { visibility: visible; }
      #receipt-print { position: fixed; top: 0; left: 0; width: 100%; }
      #report-print, #report-print * { visibility: visible; }
      #report-print { position: fixed; top: 0; left: 0; width: 100%; max-width: 600px; margin: 0 auto; padding: 20px; }
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

---

## Shared Types (@pos/shared)

**Path:** `packages/shared/src/index.ts`

```typescript
export interface IUser {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'cashier';
  createdAt: Date;
  updatedAt: Date;
}

export interface ICategory {
  _id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProduct {
  _id: string;
  name: string;
  barcode?: string;
  price: number;
  costPrice?: number;
  stock: number;
  category: ICategory | string;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrderItem {
  product: IProduct | string;
  qty: number;
  price: number;
  subtotal: number;
}

export interface IOrder {
  _id: string;
  items: IOrderItem[];
  total: number;
  paymentMethod: 'cash' | 'qris' | 'debit';
  cashAmount?: number;
  change?: number;
  cashier: IUser | string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateProductInput = {
  name: string;
  barcode?: string;
  price: number;
  costPrice?: number;
  stock: number;
  category: string;
  image?: string;
};

export type CreateOrderInput = {
  items: { product: string; qty: number; price: number }[];
  paymentMethod: 'cash' | 'qris' | 'debit';
  cashAmount?: number;
};
```

> **Note:** Shared types saat ini masih basic dan belum sync dengan model backend yang jauh lebih kompleks.

---

## Seed Data Default

| Data | Isi |
|------|-----|
| Admin | `admin@pos.com` / `admin` |
| Cashier | `kasir@pos.com` / `kasir` (starting cash: Rp 500.000) |
| Families | Makanan, Minuman, Merchandise |
| Categories | Makanan Berat, Camilan, Minuman, Kopi |
| Products | Nasi Goreng (15K), Mie Goreng (12K), Ayam Geprek (18K), Es Teh Manis (5K), Kopi Hitam (8K), Jus Jeruk (10K) |
| Taxes | PPN 12% (DPP 11/12), Service Charge 5%, Bebas Pajak (0%) |
| Tax Rules | PPN 12% - DPP Nilai Lain (PMK-131/2024) |
| Payment Methods | Tunai, QRIS, Kartu Debit, Kartu Kredit, Transfer Bank |

---

## Cross-Cutting Concerns

### Authentication
- JWT-based (7 days expiry)
- `authenticate` middleware: verify token
- `authorize(...permissions)` middleware: check permission via roleRef

### RBAC
- 30+ granular permissions
- System roles: Admin (all permissions), Kasir (limited)
- Permission check via `roleRef.permissions`

### Multi-Tenancy
- Multi-outlet support
- Products, users, payment methods, promotions, taxes can be outlet-scoped

### Infrastructure
- Docker Compose: 4 services (api, cashier, dashboard, mongodb)
- Dev Container support (VS Code Remote Containers)
- Turborepo for build caching

---

## Mapping ke DDD Modules (Rekomendasi)

Untuk rewrite ke Modular Monolith + DDD, berikut rekomendasi domain boundaries:

| DDD Module | Aggregate Root | Entities | Value Objects | Domain Events |
|------------|---------------|----------|---------------|---------------|
| **Identity** | User | User | Email, Password, UserId | UserCreated, UserUpdated |
| **Access Control** | Role | Role | Permission | RoleCreated, RoleUpdated |
| **Catalog** | Product | Product, Category, Family, Modifier | Barcode, Price, TaxEntry, ModifierOption | ProductCreated, ProductUpdated |
| **Inventory** | Stock | StockMovement | StockLevel | StockAdjusted, StockDepleted |
| **Sales** | Order | Order, OrderItem, VoidedItem | OrderNumber, OrderStatus, TaxDetail, PromotionBreakdown | OrderCreated, OrderPaid, OrderVoided |
| **Pricing** | Promotion | Promotion, Discount, Tax, TaxRule | Rule, RoundingPolicy, DppFormula | PromotionApplied, TaxCalculated |
| **Payment** | Payment | PaymentMethod | RoundingPolicy, CardLastFour | PaymentProcessed, PaymentRefunded |
| **Customer** | Member | Member | MemberTier, Phone | MemberRegistered, MemberTierUpgraded |
| **Organization** | Outlet | Outlet | OutletCode, OutletStatus | OutletCreated, OutletDeactivated |
| **Shift** | Closing | Closing, CashPickup | PaymentBreakdown, ShiftStatus | ShiftOpened, ShiftClosed, CashPickedUp |
| **Reporting** | Report | (read models) | DateRange, SalesSummary | ReportGenerated |
| **Configuration** | Setting | Setting | SettingKey, SettingValue | SettingUpdated |

---

*Dokumen ini dibuat sebagai referensi untuk rewrite POS System ke arsitektur Modular Monolith dengan Domain-Driven Design (DDD).*
