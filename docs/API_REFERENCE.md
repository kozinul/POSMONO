# API Reference

> **Base URL:** `http://localhost:4000`
> **Response Envelope:**
> ```json
> { "success": true, "data": <payload>, "meta": { "total": 100, "page": 1, "limit": 50 } }
> ```

**Auth:** All endpoints except `/health`, `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`, `/api/auth/logout`, `GET /api/tenants/slug/:slug`, and **WebSocket (Socket.io)** connections require a JWT in the `Authorization: Bearer <token>` header.

**Outlet header (multi-outlet):** Endpoint transaksi POS (payment, order mutations, shift mutations) juga divalidasi terhadap `X-Outlet-Id` header oleh middleware `resolveOutlet`. Header diisi dari `activeOutletId` di frontend; bila user punya `outletIds = []` (semua outlet) header bebas/opsional, selain itu harus ∈ `outletIds` user (403 bila tidak). Nilai header **menjadi sumber `outletId` service** (dibaca `req.outletId` → di-forward ke service); bila header tidak ada, service fallback ke outlet shift terbuka (`assertOpenShift`/`CreateOrderService` mencari shift per outlet bila `outletId` diberikan, tanpa filter bila null — backward-compatible). Body `outletId` TIDAK lagi diterima di `POST /shifts/open` (sumber resmi = header `X-Outlet-Id`).

**Platform session (Terminal Center):** Semua endpoint `/api/platform` memakai JWT terpisah dengan klaim `tenant: 'platform'` (dari session Platform Super Admin). Token tenant biasa → **401**. Cukup via `POST /api/auth/login` dengan header `X-Tenant-Id: platform`.

---

## WebSocket (Socket.io)

Server socket tersedia di path `/socket.io/` pada port yang sama. Klien harus mengirim JWT sebagai `auth.token` saat koneksi.

### Event: `domain-event`

Diterima oleh klien saat ada perubahan data. Event name ada di payload `event.eventName`.

**Contoh event:**
```json
{
  "eventName": "catalog.product.created",
  "aggregateId": "uuid",
  "aggregateType": "Product",
  "occurredAt": "2026-07-29T12:00:00.000Z"
}
```

**Event yang didukung:**

| Event Name | Trigger | Auto-refresh POS |
|------------|---------|-----------------|
| `catalog.product.created` | Produk baru dibuat | ✅ |
| `catalog.product.updated` | Produk diupdate | ✅ |
| `catalog.product.deleted` | Produk dinonaktifkan | ✅ |
| `discount.config.updated` | Promosi di-sync atau dihapus | ✅ |
| `tax.config.updated` | Konfigurasi pajak diubah | ✅ |

Klien frontend cukup menggunakan hook `useRealtimeSync()` yang otomatis listen dan invalidate React Query caches.

---

## Health

### `GET /health`

No auth. Returns server status.

**Response 200:**
```json
{ "success": true, "data": { "status": "ok", "timestamp": "2026-06-30T12:00:00.000Z" } }
```

---

## Auth (`/api/auth`)

### `POST /api/auth/login`

Login with email + password.

**Body:**
```json
{ "email": "owner@test.com", "password": "password123", "tenantSlug": "cabang-kuta" }
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "id": "uuid", "email": "owner@test.com", "displayName": "Owner", "role": "admin" }
  }
}
```

### `POST /api/auth/register`

Register a new user under current tenant. Requires auth.

**Body:**
```json
{ "email": "cashier@test.com", "password": "password123", "displayName": "Cashier Satu", "roleId": "role-id" }
```

**Response 201:** `{ "success": true, "data": { "id": "uuid", "email": "...", "displayName": "...", "roleId": "..." } }`

### `POST /api/auth/refresh`

Exchange a refresh token for a new access token.

**Body:** `{ "refreshToken": "eyJ..." }`

**Response 200:** `{ "success": true, "data": { "accessToken": "...", "refreshToken": "..." } }`

### `POST /api/auth/logout`

No auth required. Invalidates refresh token.

**Body (optional):** `{ "refreshToken": "..." }`

**Response:** `204 No Content`

### `GET /api/auth/me`

Get current authenticated user's profile.

**Response 200:**
```json
{
  "success": true,
  "data": { "id": "uuid", "email": "...", "displayName": "...", "role": "admin", "isActive": true, "lastLoginAt": "2026-06-30T12:00:00.000Z" }
}
```

---

## Tenants (`/api/tenants`)

### `GET /api/tenants/slug/:slug`

Public. Check if a tenant slug is available / resolve slug to tenant.

**Response 200 (found):** `{ "success": true, "data": { "id": "uuid", "name": "Cabang Kuta", "slug": "cabang-kuta", "businessType": "restaurant" } }`

**Response 200 (not found):** `{ "success": true, "data": null }`

### `POST /api/tenants`

Create a new tenant.

**Body:**
```json
{
  "name": "Cabang Kuta",
  "slug": "cabang-kuta",
  "businessType": "restaurant",
  "config": { "timezone": "Asia/Makassar", "currency": "IDR", "locale": "id" }
}
```

**Response 201:** `{ "success": true, "data": { "id": "uuid", "name": "...", "slug": "...", "businessType": "...", "config": { ... } } }`

### `GET /api/tenants/current`

Get current tenant based on JWT tenantId.

**Response 200:** Full tenant object (name, slug, status, plan, config, modules, etc.).

### `PATCH /api/tenants/current/settings`

Update tenant settings (timezone, currency, locale).

**Body:** `{ "timezone": "Asia/Jakarta", "currency": "IDR" }` (all fields optional)

**Response 200:** `{ "success": true, "data": { "id": "uuid", "config": { ... } } }`

---

## Products (`/api/products`)

### `GET /api/products`

List products. Accepts `page`, `limit`, `categoryId`, `search` query params.

**Response 200:**
```json
{
  "success": true,
  "data": [{ "id": "uuid", "tenantId": "...", "sku": "SKU-001", "barcode": "...", "name": "Kopi Gula Aren", "description": "...", "categoryId": "...", "basePrice": 25000, "modifierGroupIds": ["mod-size"], "imageUrls": [], "tags": ["kopi"], "isActive": true, "createdAt": "...", "updatedAt": "..." }],
  "meta": { "total": 10, "page": 1, "limit": 50 }
}
```

### `POST /api/products`

Create a product.

**Body:**
```json
{ "sku": "SKU-001", "name": "Kopi Gula Aren", "categoryId": "cat-id", "basePrice": 25000, "barcode": "...", "description": "...", "imageUrls": ["https://..."], "tags": ["kopi"], "modifierGroupIds": ["mod-size"], "country": "ID", "region": "Bali", "currency": "IDR" }
```

**Response 201:** Full product object.

### `GET /api/products/:id`

Get product by ID.

**Response 200:** Full product object.

### `PUT /api/products/:id`

Update product fields (all optional).

**Body:** `{ "name": "New Name", "basePrice": 30000 }`

**Response 200:** Full product object.

### `DELETE /api/products/:id`

**Response:** `204 No Content`

---

## Categories (`/api/categories`)

### `GET /api/categories`

List all categories.

**Response 200:** `{ "success": true, "data": [{ "id": "...", "tenantId": "...", "name": "Kopi", "familyId": "fam-id", "parentId": null, "sortOrder": 1, "isActive": true, "createdAt": "...", "updatedAt": "..." }] }`

### `GET /api/categories/by-family/:familyId`

List categories filtered by family.

**Response 200:** Array of category objects.

### `POST /api/categories`

**Body:** `{ "name": "Minuman", "familyId": "fam-id", "parentId": null, "sortOrder": 1 }`

**Response 201:** Full category object.

### `PUT /api/categories/:id`

**Body:** `{ "name": "New Name", "familyId": "fam-id", "isActive": false }` (all optional)

**Response 200:** Full category object.

### `DELETE /api/categories/:id`

**Response:** `204 No Content`

---

## Families (`/api/families`)

### `GET /api/families`

List all families for current tenant.

**Response 200:** `{ "success": true, "data": [{ "id": "...", "tenantId": "...", "name": "Western", "description": "Masakan Barat", "sortOrder": 1, "isActive": true, "createdAt": "...", "updatedAt": "..." }] }`

### `POST /api/families`

**Body:** `{ "name": "Western", "description": "Masakan Barat", "sortOrder": 1 }`

**Response 201:** Full family object.

### `PUT /api/families/:id`

**Body:** `{ "name": "Asian", "isActive": false }` (all optional)

**Response 200:** Full family object.

### `DELETE /api/families/:id`

**Response:** `204 No Content`

---

## Modifiers / Modifier Groups (`/api/modifiers`)

Modifier adalah **group opsi produk**. Group bisa global (`productId=null`, `familyId=null`), terikat family, terikat produk tertentu, atau di-attach eksplisit ke produk lewat `Product.modifierGroupIds`.

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/modifiers` | authenticate | List semua modifier group tenant |
| GET | `/api/modifiers/global` | authenticate | List group global |
| GET | `/api/modifiers/product/:productId` | authenticate | List group yang berlaku untuk produk (product/family/global/attached group) |
| GET | `/api/modifiers/family/:familyId` | authenticate | List group family |
| POST | `/api/modifiers` | `products:write` | Create modifier group |
| PUT | `/api/modifiers/:id` | `products:write` | Update modifier group |
| DELETE | `/api/modifiers/:id` | `products:write` | Delete modifier group |

**Shape:**

```json
{
  "id": "mod-size",
  "tenantId": "tenant-id",
  "productId": null,
  "familyId": null,
  "name": "Ukuran",
  "displayType": "radio",
  "minSelections": 1,
  "maxSelections": 1,
  "required": true,
  "isActive": true,
  "options": [
    { "id": "small", "name": "Small", "priceAdjustment": 0, "isActive": true },
    { "id": "large", "name": "Large", "priceAdjustment": 5000, "isActive": true }
  ]
}
```

`displayType`: `radio | checkbox | stepper`. Backend `ModifierValidationService` memvalidasi required/min/max, opsi aktif, dan group availability saat create order/payment. Field lama `options[].price` masih diterima sebagai alias input, tetapi output canonical memakai `priceAdjustment`.

---

## Payment Methods (`/api/payment-methods`)

### `GET /api/payment-methods`

List all payment methods for current tenant.

**Response 200:**
```json
{
  "success": true,
  "data": [{ "id": "...", "tenantId": "...", "name": "Tunai", "code": "cash", "description": "Pembayaran tunai", "icon": "💵", "color": "#22C55E", "sortOrder": 1, "isActive": true, "requiresReference": false, "config": {}, "createdAt": "...", "updatedAt": "..." }]
}
```

### `GET /api/payment-methods/active`

List only active payment methods (for POS display).

**Response 200:** Array of active payment method objects.

### `GET /api/payment-methods/:id`

Get payment method by ID.

**Response 200:** Single payment method object.

### `POST /api/payment-methods`

Create a payment method.

**Body:**
```json
{ "name": "Tunai", "code": "cash", "description": "Pembayaran tunai", "icon": "💵", "color": "#22C55E", "sortOrder": 1, "requiresReference": false }
```

**Response 201:** Full payment method object.

### `PUT /api/payment-methods/:id`

Update payment method fields (all optional).

**Body:** `{ "name": "Cash", "isActive": false }`

**Response 200:** Full payment method object.

### `DELETE /api/payment-methods/:id`

**Response:** `204 No Content`

---

## Inventory (`/api/inventory`)

> **Dual stock-tracking scheme:** a product is **tracked** when its stock record has `quantity > 0`; it is **untracked** when there is no stock record or `quantity == 0`. Untracked products sell unlimited (sales are only counted — stock is never deducted); tracked products are validated and decremented on payment. Once a tracked product sells down to `0`, it automatically becomes untracked and stays sellable.

### `GET /api/inventory`

List stock records for current tenant.

**Response 200:**
```json
{
  "success": true,
  "data": [{ "id": "uuid", "tenantId": "...", "productId": "...", "variantId": null, "warehouseId": "...", "quantity": 50, "reservedQuantity": 0, "minLevel": 5, "maxLevel": 100, "updatedAt": "...", "availableQuantity": 50 }]
}
```

### `GET /api/inventory/movements`

List stock movements. Accepts `productId`, `type`, `page`, `limit`.

**Response 200:** Array of stock movement records + pagination meta.

### `GET /api/inventory/low-stock`

Get products below minimum stock level.

**Response 200:** Array of stock records (same shape as GET /api/inventory).

### `GET /api/inventory/:productId`

Get stock for a specific product.

**Response 200:** Single stock record.

### `POST /api/inventory/stock-in`

Add stock (positive adjustment).

**Body:** `{ "productId": "uuid", "quantity": 10, "reason": "Restock from supplier", "warehouseId": "..." }`

**Response 200:** Updated stock record.

### `POST /api/inventory/stock-out`

Remove stock (negative adjustment).

**Body:** `{ "productId": "uuid", "quantity": 5, "reason": "Sold", "warehouseId": "..." }`

**Response 200:** Updated stock record.

### `POST /api/inventory/adjust`

Arbitrary stock adjustment (positive or negative delta).

**Body:** `{ "productId": "uuid", "delta": -10, "reason": "Stock opname correction", "warehouseId": "..." }`

**Response 200:** Updated stock record.

### `POST /api/inventory/reserve`

Reserve stock for an order (increments `reservedQuantity`).

**Body:** `{ "productId": "uuid", "quantity": 5, "referenceId": "order-id" }`

**Response 200:** Updated stock record.

### `POST /api/inventory/release`

Release previously reserved stock (decrements `reservedQuantity`).

**Body:** `{ "productId": "uuid", "quantity": 5, "referenceId": "order-id" }`

**Response 200:** Updated stock record.

### `POST /api/inventory/import`

Bulk import stock levels from CSV data.

**Body:** `{ "data": [{ "productId": "uuid", "quantity": 100 }] }`

**Response 200:** `{ "success": true, "imported": 5 }`

### `POST /api/inventory/export`

Export current stock levels as CSV.

**Response 200:** CSV file download.

---

## Warehouses (`/api/warehouses`)

### `GET /api/warehouses`

List all warehouses.

**Response 200:** `{ "success": true, "data": [{ "id": "...", "tenantId": "...", "name": "Gudang Utama", "address": "Jl. ..., address": "...", "isActive": true, "createdAt": "...", "updatedAt": "..." }] }`

### `GET /api/warehouses/:id`

Get warehouse by ID.

**Response 200:** Single warehouse object.

### `POST /api/warehouses`

**Body:** `{ "name": "Gudang Utama", "address": "Jl. Sunset Road No. 1" }`

**Response 201:** Full warehouse object.

### `PUT /api/warehouses/:id`

**Body:** `{ "name": "New Name", "isActive": false }` (all optional)

**Response 200:** Full warehouse object.

### `DELETE /api/warehouses/:id`

**Response:** `204 No Content`

---

## Roles (`/api/roles`)

### `GET /api/roles`

List all roles.

**Response 200:** `{ "success": true, "data": [{ "id": "...", "tenantId": "...", "name": "Cashier", "description": "...", "permissions": ["pos.order.create", "pos.order.read"], "isSystem": false, "createdAt": "..." }] }`

### `GET /api/roles/:id`

Get role by ID.

### `POST /api/roles`

**Body:** `{ "name": "Cashier", "description": "Can process orders", "permissions": ["pos.order.create"] }`

**Response 201:** Full role object.

### `PUT /api/roles/:id`

**Body:** `{ "name": "Senior Cashier", "permissions": ["pos.order.create", "pos.order.cancel"] }` (all optional)

**Response 200:** Full role object.

### `DELETE /api/roles/:id`

Deletes role. System roles (admin, owner) are protected from deletion.

**Response:** `204 No Content`

---

## Users (`/api/users`)

### `GET /api/users`

List all users in tenant.

**Response 200:** Array of user objects (passwordHash excluded).

### `GET /api/users/:id`

Get user by ID.

### `PUT /api/users/:id`

Update user. All fields optional.

**Body:** `{ "displayName": "New Name", "roleId": "new-role-id", "isActive": true }`

**Response 200:** Updated user object.

### `POST /api/users/:id/deactivate`

Deactivate a user.

**Response 200:** `{ "success": true, "data": { "id": "uuid", "isActive": false } }`

### `POST /api/users/:id/activate`

Activate a user.

**Response 200:** `{ "success": true, "data": { "id": "uuid", "isActive": true } }`

---

## Permissions (`/api/permissions`)

### `GET /api/permissions`

List all available permission codes.

**Response 200:**
```json
{
  "success": true,
  "data": [
    { "key": "USERS_READ", "code": "users.read", "module": "users" },
    { "key": "POS_ORDER_CREATE", "code": "pos.order.create", "module": "pos" }
  ]
}
```

---

## Orders (`/api/orders`)

### `GET /api/orders`

List orders. Accepts `status`, `page`, `limit`.

**Response 200:** Array of order objects + pagination meta.

### `GET /api/orders/:id`

Get order by ID. Validates tenant ownership.

### `POST /api/orders`

Create a new order.

**Body:**
```json
{
  "items": [{
    "productId": "uuid",
    "productName": "Kopi Gula Aren",
    "quantity": 2,
    "unitPrice": 25000,
    "totalPrice": 50000,
    "modifiers": [{ "name": "Less Ice", "price": 0 }],
    "tax": { "rate": 0, "amount": 0 }
  }],
  "notes": "",
  "source": "pos"
}
```

**Response 201:** Full order object with generated `orderNumber`.

### `POST /api/orders/:id/close-bill`

Cancel an **unpaid** held bill (belum dibayar) — idempotent, tidak butuh PIN (bill unpaid tidak menyentuh uang). Dipakai POS dan halaman Orders untuk membersihkan bill yang nyangkut setelah dibayar/ganti shift. Melepas stok reserved (best-effort) dan mem-publish event `ordering.order.cancelled`.

**Body:**
```json
{
  "reason": "Bill tidak terbayar"
}
```
`reason` opsional.

**Behavior:**
- Bill `status='held'` → `status='cancelled'` + release reserved stock.
- Sudah dibayar / cancelled / voided / refunded → no-op (aman di-retry).
- Tenant mismatch / tidak ditemukan → 404.

### `POST /api/orders/:id/void`

Void entire order. Approver harus punya `order:void` **atau** mengirim `managerPin` yang valid (`VoidApprovalService`).

**Body:**
```json
{
  "reason": "Kasir salah input",
  "voidedByName": "Nama Kasir",
  "managerPin": "123456"
}
```

### `POST /api/orders/:id/void-item`

Void satu item (opsional `quantity` untuk void parsial). Policy approval sama seperti void order.

**Body:**
```json
{
  "itemIndex": 0,
  "quantity": 1,
  "reason": "Salah menu",
  "voidedByName": "Nama Kasir",
  "managerPin": "123456"
}
```

### `POST /api/orders/:id/void-payment`

Void satu metode pembayaran pada order (kembali ke cart). Policy approval sama.

**Body:**
```json
{
  "paymentIndex": 0,
  "reason": "Transaksi ganda",
  "voidedByName": "Nama Kasir",
  "managerPin": "123456"
}
```

### `POST /api/orders/:id/apply-discount`

Terapkan diskon ke order yang belum dibayar (draft/held). Body: `{ discountBreakdown: [{ id, name, type, amount, appliedTo }] }`.

---

## Shifts (`/api/shifts`)

### `GET /api/shifts`

List all shifts.

### `GET /api/shifts/current`

Get current open shift for authenticated user. Returns `null` if no open shift.

### `POST /api/shifts/open`

Open a new shift.

**Body:** `{ "registerId": "register-1", "openingBalance": 500000 }`

**Response 201:** Full shift object (status: "open").

### `POST /api/shifts/:id/close`

Close a shift.

**Body:** `{ "expectedTotal": 1500000, "actualTotal": 1480000 }`

**Response 200:** Full shift object (status: "closed").

---

## Payments (`/api/payments`)

### `GET /api/payments`

List all payments.

### `GET /api/payments/:orderId`

Get payment by order ID.

### `POST /api/payments/pay-cash`

Process a cash payment with optional promo code and manual discount.

**Body:**
```json
{
  "items": [{ "productId": "...", "quantity": 2, "unitPrice": 15000 }],
  "amountPaid": 50000,
  "discount": 10,
  "discountType": "percentage",
  "promoCode": "HEMAT10"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| items | array | yes | Cart items with productId, quantity, unitPrice, and optional `isFreeItem` |
| amountPaid | number | yes | Amount tendered by customer |
| discount | number | no | **Manual** discount only — NOT the promo discount (default 0) |
| discountType | string | no | `"percentage"` or `"nominal"` (default nominal) |
| promoCode | string | no | Promo code to apply (validated against discount engine) |
| splitIndex | number | no | Portiion index when performing split payment (e.g. 1, 2) |
| splitBaseOrderNumber | string | no | Base order number for split payment receipts |

**Response 200:**
```json
{
  "success": true,
  data: {
    "payment": { "id": "...", "orderId": "...", "amount": 50000, "status": "completed", "method": "cash", "metadata": { "promoCode": "HEMAT10", "promoDiscount": 3000, "manualDiscount": 0 } },
    "order": { "id": "...", "status": "paid", "subtotal": 30000, "discount": 3000, "total": 27000, "promotions": [{ "id": "...", "name": "...", "code": "HEMAT10", "totalDiscount": 3000 }], "discountBreakdown": [...] }
  }
}
```

> Response juga menyertakan `receipt` dengan `layout`/`thermal`/`pdf`/`templateName`/`viewModel` (sama seperti `POST /api/print/receipt`).

**Discount flow:**
1. `discount` is the cashier's **manual** discount only. Do **not** send `promotionDiscount` from `/pricing/calculate` in this field — the backend recomputes it.
2. Backend calls `DiscountServiceAdapter.apply()` which evaluates all active auto-apply rules + `promoCode` exactly once → `promoDiscount`
3. Promo discount + manual discount combined (capped to subtotal)
4. Combined discount passed to `TaxService.calculate()` (discount before tax)
5. Order stores `promotions[]` and `discountBreakdown[]` for receipt/reporting

> ⚠️ **Contract:** sending the pre-computed `promotionDiscount` here AND a `promoCode` (or having auto-apply rules) causes the discount to be applied **twice**, producing a receipt total that is lower than the cart total. Only the manual discount belongs in `discount`.

**Stock deduction side-effect:**

After a successful `pay-cash`, the backend automatically deducts stock per paid item (see Inventory → dual scheme). Free items (`isFreeItem`) are never sent here, so they never deduct stock.

| Condition | Behavior |
|---|---|
| Product has no stock record, or `quantity == 0` | **Untracked** — stock is NOT deducted; product sells unlimited (sales only counted) |
| Product stock `quantity > 0` | **Tracked** — stock deducted by item quantity; if quantity exceeds available stock, payment is rejected with `ValidationError` ("Insufficient stock") |

Same deduction applies on `POST /api/payments/process` (first full payment only), `pay-open-bill`, and `split-bill` when the order transitions from unpaid → paid. On `POST /api/payments/:id/refund`, stock is restored only for single-payment orders.

### QRIS Gateway (`/api/payments/qris/*`)

Pembayaran **QRIS dinamis** (QR berisi nominal) melalui gateway pihak ketiga. Semua route hanya perlu `authenticate`. Gateway dikonfigurasi per tenant (Pengaturan → QRIS Gateway): `qrisGatewayEnabled`, `qrisGatewayBaseUrl`, `qrisGatewayApiKey`, `qrisGatewayMerchantId`.

| Method | Path | Fungsi |
|---|---|---|
| POST | `/api/payments/qris/initiate` | Buat invoice + dapat QR (`{ amount }` integer > 0, rupiah) |
| GET | `/api/payments/qris/status/:referenceNumber` | Cek status invoice → `{ status: pending\|paid\|expired\|cancelled\|unknown, paidAt, amount }` |
| POST | `/api/payments/qris/confirm` | Finalisasi pembayaran (dipanggil frontend saat status `paid`) |
| POST | `/api/payments/qris/test-config` | Uji koneksi (buat invoice Rp 10.000 lalu void) |
| POST | `/api/payments/qris/:referenceNumber/cancel` | Batalkan invoice |

**initiate response:** `{ referenceNumber: "QRIS-<12 hex>", qrString, qrImage (dataURL|null), amount, expiresAt }`

**confirm body:**
```json
{
  "referenceNumber": "QRIS-ABCDEF123456",
  "amount": 27000,
  "items": [{ "productId": "...", "quantity": 2, "unitPrice": 15000 }]
}
```

`orderId` **atau** `items` wajib: `orderId` untuk open bill (finalisasi via jalur `processByOrderId`), `items` untuk penjualan baru langsung dari cart POS (jalur `payCash`). Field opsional lain: `discount`, `discountType`, `promoCode`, `cashierName`, `shiftId` (**tidak dipercaya** — server selalu resolve shift kasir sendiri). Response sama seperti `/process`: `{ payment, order, receipt }`.

**Guard `confirmQrisPayment`:** gateway harus ter-wire → order milik tenant & belum dibayar (double-pay) → `referenceNumber` belum pernah dipakai → status gateway harus `paid` → nominal gateway harus sama dengan tagihan → shift wajib terbuka (`assertOpenShift`). Non-cash → pembulatan tunai dilewati; payment tercatat dengan `paymentBreakdown[0].code = referenceNumber` sehingga laporan shift/realtime ikut benar.

---

## Printers (`/api/printers`)

> **Hybrid transport:** printer `network` dicetak server-side via TCP socket (`net.Socket`); printer `usb`/`bluetooth` dikirim sebagai base64 buffer untuk dicetak klien via WebUSB/WebBluetooth.

### `GET /api/printers`

List printers untuk tenant. Permission: cukup `authenticate` (kasir perlu membaca daftar printer untuk WebUSB/Bluetooth); mutasi tetap `printers:write`.

**Response 200:**
```json
{
  "success": true,
  "data": [{ "id": "...", "tenantId": "...", "name": "Printer Dapur", "connectionType": "network", "ip": "192.168.1.50", "port": 9100, "paperSize": "thermal58", "purpose": "kot", "copies": 1, "isDefault": true, "enabled": true, "bluetoothName": "", "usbVendorId": "", "usbProductId": "", "createdAt": "...", "updatedAt": "..." }]
}
```

### `GET /api/printers/:id`

Get printer by ID. Permission: cukup `authenticate`.

**Response 200:** Single printer object.

### `POST /api/printers`

Create printer. Permission: `printers:write`.

**Body:**
```json
{ "name": "Printer Kasir", "connectionType": "network", "ip": "192.168.1.50", "port": 9100, "paperSize": "thermal58", "purpose": "receipt", "copies": 1, "isDefault": true, "enabled": true }
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | yes | Nama printer |
| connectionType | string | yes | `network` \| `usb` \| `bluetooth` |
| ip | string | hanya network | IP printer (wajib saat `connectionType='network'`) |
| port | number | hanya network | Port TCP (default 9100) |
| paperSize | string | no | `thermal58` \| `thermal80` \| `a4-portrait` |
| purpose | string | no | `receipt` \| `kot` (default receipt) |
| copies | number | no | Jumlah salinan (default 1) |
| isDefault | boolean | no | Default per `purpose` (partial unique index) |
| enabled | boolean | no | Aktif/nonaktif |
| bluetoothName | string | no | Nama perangkat Bluetooth |
| usbVendorId / usbProductId | string | no | Vendor/product ID USB (hex) |

**Response 201:** Full printer object.

### `PUT /api/printers/:id`

Update printer (all optional). Permission: `printers:write`. Menghapus default lama otomatis jika `isDefault` dipindah; re-assign default saat default dihapus/nonaktif.

**Body:** `{ "name": "Printer Baru", "isDefault": true }`

**Response 200:** Full printer object.

### `DELETE /api/printers/:id`

Hapus printer. Permission: `printers:write`. Default printer lain di-purpose yang sama otomatis di-assign.

**Response:** `204 No Content`

### `POST /api/printers/:id/test`

Cetak halaman uji (test buffer ESC/POS). Permission: `printers:write`.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "dispatched": true,
    "clientPrint": false,
    "printer": { "id": "...", "connectionType": "network", "ip": "192.168.1.50", "port": 9100, "...": "..." },
    "error": null
  }
}
```

---

## Print (`/api/print`)

### `POST /api/print/receipt`

Cetak ulang struk pembayaran (ESC/POS thermal). Auth required (tidak butuh permission khusus; kasir boleh print ulang).

**Body:** `{ "orderId": "uuid", "paymentId": "uuid?", "printerId": "uuid?" }`

Jika `paymentId` tidak diberikan, backend memakai payment `status:'completed'` pertama dari order.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "dispatched": false,
    "clientPrint": true,
    "printer": { "id": "...", "connectionType": "usb", "...": "..." },
    "buffer": "<base64 thermal buffer>",
    "payload": {
      "layout": "...",
      "thermal": "<base64>",
      "pdf": "<base64>",
      "paper": "thermal58",
      "templateId": "...",
      "templateName": "...",
      "viewModel": { "store": { "name": "...", "outlet": "...", "address": "...", "phone": "..." }, "order": { "documentNumber": "ORD-...", "referenceNumber": "INV-ORD-..." }, "items": [...], "summary": { "subtotal": 0, "serviceCharge": 0, "serviceChargeRate": 0, "dpp": 0, "dppLabel": "DPP", "taxes": [...], "rounding": 0, "grandTotal": 0, "change": 0 }, "payments": [{ "method": "qris", "methodLabel": "QRIS", "amount": 0, "referenceLine": "Ref: QRIS-..." }], "promotions": [...], "footer": "..." }
    }
  }
}
```

> **Receipt Contract Kuire (2026-08-29; final 2026-09-16):** `payload.layout`/`thermal`/`pdf`/`viewModel` kini dihasilkan dari satu sumber kebenaran — `ReceiptAssembler` (rounding-aware: `roundedPayable || total`; pajak berlabel `PPN 12%` / `PPN 12% (DPP 11/12)` untuk Nilai Lain; header `Ref:` = `order.invoiceNumber` bila ada; baris pembayaran non-cash punya `payment.referenceLine` seperti `Ref: QRIS-...`; date/time `dd/MM/yyyy HH:mm` sesuai timezone tenant; modifier harga 0 tampil `GRATIS`; outlet dari `OutletRepository`; footer default `Terima kasih telah berbelanja di {outlet}`). `viewModel` dikirim agar frontend dapat merekonstruksi struk tanpa logika bisnis. Skema yang sama dipakai `POST /api/payments/pay-cash` (response `receipt.viewModel`).

### `POST /api/print/kot/:orderId`

Cetak Kitchen Order Ticket (KOT). Auth required.

**Body:** `{ "printerId": "uuid?" }`

**Response 200:** Sama seperti `print/receipt` (buffer/payload KOT dari template default `kot`).

---

## Pricing (`/api/pricing`)

### `POST /api/pricing/calculate`

Unified pricing calculation — single source of truth for all frontend totals. Returns the complete pricing breakdown: originalSubtotal → promotion/discount → netSubtotal → service charge → tax → rounding → grandTotal.

**Body:**
```json
{
  "items": [
    { "productId": "uuid", "productName": "Kopi Hitam", "categoryId": "cat-id", "quantity": 2, "unitPrice": 8000, "pricingMode": "exclusive" }
  ],
  "promoCode": "HEMAT10",
  "manualDiscount": 5000,
  "manualDiscountType": "nominal",
  "customerGroupId": "group-id"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| items | array | yes | Cart items with productId, productName, categoryId, quantity, unitPrice, pricingMode |
| promoCode | string | no | Promo code to apply |
| manualDiscount | number | no | Manual discount value (default 0) |
| manualDiscountType | string | no | `"percentage"` or `"nominal"` (default nominal) |
| customerGroupId | string | no | Customer group for tier-based promos |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "originalSubtotal": 16000,
    "promotionDiscount": 1600,
    "netSubtotal": 14400,
    "serviceCharge": 720,
    "serviceChargeName": "Service Charge",
    "taxBase": 15120,
    "tax": 1663,
    "taxName": "PPN",
    "taxRate": 12,
    "rounding": 0,
    "grandTotal": 16783,
    "roundedPayable": 16783,
    "lineItems": [
      {
        "productId": "uuid",
        "productName": "Kopi Hitam",
        "categoryId": "cat-id",
        "quantity": 2,
        "unitPrice": 8000,
        "originalUnitPrice": 8000,
        "discount": 1600,
        "lineTotal": 14400,
        "isFreeItem": false
      }
    ],
    "appliedRules": [
      { "ruleId": "rule-1", "ruleName": "Hemat 10%", "discountAmount": 1600, "description": "10% off all items" }
    ],
    "adjustments": [
      { "id": "adj-1", "type": "DISCOUNT", "name": "Hemat 10%", "sequence": 10, "base": 16000, "rate": 10, "amount": 1600, "affectsTaxBase": true, "affectsGrandTotal": true }
    ]
  }
}
```

**Pipeline order:**
1. **Original Subtotal** — sum of unitPrice × quantity for all items
2. **Promotion/Discount** — promo code, auto-apply, manual discount, free items
3. **Net Subtotal** — originalSubtotal - promotionDiscount
4. **Service Charge** — percentage of netSubtotal (from Charge entity)
5. **Tax** — calculated on (netSubtotal + serviceCharge)
6. **Rounding** — configurable rounding to nearest value
7. **Grand Total** — netSubtotal + serviceCharge + tax + rounding
8. **roundedPayable** — pembulatan total ke denominasi Rupiah genap (config tenant: `roundingEnabled`/`roundingMode`/`roundingDenomination`); **hanya relevan untuk metode tunai (cash)** — non-cash memakai `grandTotal` asli

**Free items:** When a promo produces free items, the response includes them in `lineItems[]` with `isFreeItem: true`, `discount: unitPrice`, and `lineTotal: 0`.

---

## Outlets (`/api/outlets`)

Multi-outlet operational boundaries. Tenant otomatis punya **Outlet Utama** + **Warehouse Utama** (`provisionDefaults` boot). Outlet 1:1 ke Warehouse.

**Pembuatan & penghapusan outlet hanya via Terminal Center** (`POST /api/platform/outlets`, Platform Super Admin `outlet:manage`). Owner/tenant hanya dapat **meng-update info** outlet (nama/alamat/telepon/status) dan membaca.

| Method | Path | Auth | Permission |
|--------|------|------|------------|
| GET | `/api/outlets` | ✓ | — (list, outlet-scoped) |
| GET | `/api/outlets/:id` | ✓ | — |
| PUT | `/api/outlets/:id` | ✓ | `outlet:manage` |

**Response** (GET list): array outlet `{ id, tenantId, name, code, warehouseId, isActive, createdAt, updatedAt }`.

Catatan: ganti outlet membutuhkan re-login bila `outletIds` di JWT berubah; assign outlet via Users page.

---

## Hubs (`/api/hubs`)

Hub = grouping non-tenant di atas tenant (`hubId` di Tenant; null = standalone). CRUD & assign tenant goto Platform Super Admin (`platform.hubs.manage`). Hub **tidak menyentuh data bisnis** — murni grouping.

| Method | Path | Auth | Permission |
|--------|------|------|------------|
| GET | `/api/hubs` | ✓ | `platform.hubs.manage` |
| GET | `/api/hubs/:id` | ✓ | `platform.hubs.manage` |
| POST | `/api/hubs` | ✓ | `platform.hubs.manage` |
| PUT | `/api/hubs/:id` | ✓ | `platform.hubs.manage` |
| DELETE | `/api/hubs/:id` | ✓ | `platform.hubs.manage` |
| POST | `/api/hubs/:hubId/tenants/:tenantId` | ✓ | `platform.hubs.manage` (assign) |
| DELETE | `/api/hubs/:hubId/tenants/:tenantId` | ✓ | `platform.hubs.manage` (unassign) |
| GET | `/api/hubs/:hubId/tenants` | ✓ | `platform.hubs.manage` |

**Body** POST/PUT: `{ name, description? }`. Assign tenant = set `tenant.hubId` (via `HubService.assignTenant`).

---

## Terminal Center — Platform Layer (`/api/platform`)

> Layer terpisah dari auth tenant. Super-admin login: `POST /api/auth/login` dengan `X-Tenant-Id: platform` (seeded `platform@demo.com`/`admin123`). Semua endpoint di bawah **wajib token `tenant='platform'`** (`platformAuthenticate`), dipasang di grup route terpisah (`createPlatformRoutes`), bukan `/api/*` tenant.

**Scope query params** (semua list/summary): `tenantId` → scope satu tenant; `hubId` → semua tenant dalam hub; kosong → semua tenant.

| Method | Path | Auth | Permission |
|--------|------|------|------------|
| GET | `/api/platform/health` | platform | — (diagnostik) |
| GET | `/api/platform/hubs` | platform | `platform.hubs.manage` |
| GET | `/api/platform/hubs/:hubId` | platform | `platform.hubs.manage` |
| GET | `/api/platform/tenants` | platform | `platform.tenants.read` |
| GET | `/api/platform/tenants/:tenantId` | platform | `platform.tenants.read` |
| GET | `/api/platform/users` | platform | `platform.tenants.read` |
| GET | `/api/platform/audit` | platform | `platform.audit.read` |
| POST | `/api/platform/provision/tenant` | platform | `platform.hubs.manage` |
| GET | `/api/platform/outlets` | platform | `platform.tenants.read` |
| POST | `/api/platform/outlets` | platform | `outlet:manage` |
| GET | `/api/platform/shifts/summary` | platform | `platform.reports.read` |
| GET | `/api/platform/payments/summary` | platform | `platform.reports.read` |
| GET | `/api/platform/hubs/:hubId/consolidated` | platform | `platform.reports.read` |
| GET | `/api/platform/plans` | platform | `platform.plans.read` |
| GET | `/api/platform/plans/:id` | platform | `platform.plans.read` |
| POST | `/api/platform/plans` | platform | `platform.plans.manage` |
| PUT | `/api/platform/plans/:id` | platform | `platform.plans.manage` |
| DELETE | `/api/platform/plans/:id` | platform | `platform.plans.manage` |
| GET | `/api/platform/tenants/:tenantId/subscription` | platform | `platform.tenants.read` |
| POST | `/api/platform/tenants/:tenantId/subscription` | platform | `platform.tenants.manage` |
| POST | `/api/platform/tenants/:tenantId/subscription/cancel` | platform | `platform.tenants.manage` |
| GET | `/api/platform/tenants/:tenantId/entitlement` | platform | `platform.tenants.read` |

**Query params:**

- `GET /api/platform/tenants?page=&limit=&hubId=&search=` → `{ items, total, page, limit }`; tiap baris tenant dilengkapi `hubName` (nama hub, `null` bila standalone) oleh `PlatformController.withHubNames` — UI tidak perlu menampilkan `hubId` mentah
- `GET /api/platform/users?search=&tenantId=&hubId=&isActive=true|false&page=&limit=` → **pencarian user lintas-tenant** (dipakai picker anggota hub): `{ data[{ id, displayName, email, tenantId, tenantName, roleId, roleName, isActive, isHubMember }], total, page, limit }`. `search` cocok ke `displayName`/`email`/`_id` case-insensitive (regex di-escape, jadi `.*` tidak match semua); `tenantId`/`hubId` memakai `resolvePlatformScope` yang sama dengan list tenant/outlet; `roleName` di-dekorasi satu lookup per role unik; `isHubMember` **hanya terisi true/false bermakna bila `hubId` dikirim** (tanpa scope hub selalu `false`, karena keanggotaan hub berbeda-beda). **Scope yang resolve ke nol tenant menghasilkan `total: 0`, bukan semua user** — `MongoUserRepository.searchAcrossTenants` membedakan `tenantIds: []` (tidak ada yang cocok) dari `tenantIds` di-omit (semua tenant), jadi picker anggota hub tidak pernah menampilkan user tenant lain saat hub belum punya tenant.
- `GET /api/platform/audit?action=&tenantId=&actorEmail=&from=&to=&page=&limit=` → **Platform Audit Log**: `{ items[{ id, action, actorId, actorEmail, actorRole, tenantId?, before?, after?, reason?, ip?, requestId?, createdAt }], total, page, limit }`. Permission `platform.audit.read` (super admin yang sudah login harus re-login agar JWT memuat permission). Rekaman bersifat best-effort: kegagalan menulis audit tidak menggagalkan operasi utama. Catatan: path endpoint adalah `/api/platform/audit` (bukan `/audit-logs`) — path yang tidak terdaftar dilayani SPA fallback HTML dengan status 200, jadi please pakai path di atas.
- `GET /api/platform/outlets?tenantId=&hubId=&isActive=true|false` → outlets lintas-tenant + `tenantName`
- `POST /api/platform/outlets` → **buat outlet baru untuk tenant existing** (`{ tenantId, name, address?, phone? }`); `PlatformController.createOutlet` memastikan tenant ada (404), lalu `OutletService.createWithWarehouse` membuat **Outlet + Warehouse 1:1** ("Warehouse {name}") dan melink `outlet.warehouseId`. Duplikat nama per tenant → 409. Response menyertakan `tenantName`.
- `GET /api/platform/shifts/summary?dateFrom=&dateTo=&hubId=&tenantId=` → per tenant + per outlet (jumlah shift, durasi, total)
- `GET /api/platform/payments/summary?dateFrom=&dateTo=&hubId=&tenantId=` → total + breakdown metode pembayaran lintas-tenant
- `GET /api/platform/hubs/:hubId/consolidated?dateFrom=&dateTo=` → **Hub Consolidated Report**: `{ hub, tenantCount, tenants[{ tenantId, tenantName, totals, outlets[{ outletId, outletName, shifts, payments }] }], totals }`

Response shifts/payments summary menambahkan `tenantName` per tenant (dari `resolvePlatformScope.tenantNameById`).

### Provision Tenant (`POST /api/platform/provision/tenant`)

`ProvisionTenantService` membuat Tenant + Owner User + Outlet Utama + Warehouse Utama secara **atomik** (MongoDB transaction; fallback non-transaction pada standalone non-replicaset) dengan memakai `OutletService.ensureDefault` yang sama dengan boot provisioning. Hub **opsional** — bila `hubId` diberikan, tenant ditautkan ke hub existing (tidak pernah membuat hub baru).

**Body:**

```json
{
  "tenant": { "name": "Kopi Bali Sejahtera", "businessType": "restaurant" },
  "owner": { "name": "Budi", "email": "budi@kopibali.com", "password": "temporary-password" },
  "outlet": { "name": "Kopi Bali Sanur", "address": "Jl. Danau Tamblingan", "phone": "08123456789" },
  "hubId": null
}
```

**Header opsional:** `Idempotency-Key: <uuid>` — request yang sama dikirim ulang dengan key yang sama tidak membuat tenant kedua (dikembalikan result yang sama).

**Response `201 Created`:**

```json
{
  "success": true,
  "data": {
    "success": true,
    "tenant": { "id": "…", "name": "Kopi Bali Sejahtera", "hubId": null },
    "owner": { "id": "…", "name": "Budi", "email": "budi@kopibali.com" },
    "outlet": { "id": "…", "name": "Kopi Bali Sanur", "warehouseId": "utama" },
    "warehouse": { "id": "utama", "name": "Warehouse Utama" },
    "status": "ready"
  }
}
```

**Errors:** `400` `TENANT_NAME_REQUIRED` / `OWNER_NAME_REQUIRED` / `OWNER_EMAIL_INVALID` / `OUTLET_NAME_REQUIRED` · `404` Hub tidak ditemukan (HUB_NOT_FOUND) · `409` `OWNER_EMAIL_ALREADY_EXISTS` (owner email sudah terdaftar) / konflik idempotency · `401/403` non-platform user.

**Catatan:** role Owner/Manager/Cashier dibuat bersama tenant (default roles), owner memakai role Owner dengan `outletIds: []`, outlet ↔ warehouse ter-link 1:1 (`Outlet.warehouseId ↔ Warehouse.outletId`), dan password TIDAK pernah dikembalikan response.

---

## Billing — Plans & Subscriptions (`/api/platform/plans`, `/api/platform/tenants/:tenantId/subscription`)

> **Keputusan produk**: self-service **nonaktif** — pembuatan/pengubahan plan dan assign plan ke tenant hanya oleh Platform Super Admin (Terminal Center → tab Plans / TenantDetailModal). Sistem monetisasi modular: `basePrice` + `addOns[]` (module/limit) + `limits` per plan. Default plans di-seed: **Trial** (gratis), **Starter** (Rp199K/bln), **Pro** (Rp499K/bln), **Enterprise** (Rp999K/bln).

**Plan shape** (lihat `shared/src/types/domain/billing.ts`):

```json
{
  "id": "plan-pro",
  "name": "Pro",
  "description": "…",
  "basePrice": 499000,
  "billingCycle": "monthly",
  "isActive": true,
  "isPublic": true,
  "isDefault": false,
  "sortOrder": 30,
  "modules": ["products", "orders", "payments", "shifts", "reports", "promotions", "multi-outlet", "qr-printing"],
  "limits": { "maxUsers": 10, "maxProducts": -1, "maxCategories": -1, "maxOutlets": 3, "maxOrdersPerMonth": -1, "maxInventoryItems": -1, "maxWarehouses": 3 },
  "addOns": [ { "id": "hk", "name": "Hospitality Kit", "description": "…", "price": 200000, "type": "module", "value": "hospitality" } ]
}
```

- `POST /api/platform/plans` → `201` create (`PlanController.create` → `this.created`); nama duplikat → `400`; `limits` nilai `-1` = unlimited.
- `DELETE /api/platform/plans/:id` → **plan default tidak bisa dihapus** (`400`); non-default → `200`.
- `POST /api/platform/tenants/:tenantId/subscription` body `{ planId, billingCycle? }` → assign atau ganti plan (wajib `planId` eksplisit, **tidak ada fallback default**), return `200` (`this.ok`); tenant/plan tidak ditemukan → `404`.
- `POST /api/platform/tenants/:tenantId/subscription/cancel` → `SubscriptionService.cancelSubscription` → **tenant di-deactivate** (`status='deactivated'`), `200`.
- `GET /api/platform/tenants/:tenantId/entitlement` → entitlement per tenant (plan yang dipakai untuk menilai izin module/limit).
- `GET /api/tenants/current/entitlement` (`authenticate` saja, merchant scope) → plan ter-resolve untuk tenant pemanggil: subscription → plan; tanpa subscription → fallback **entitlement Trial** hardcoded.

**Entitlement shape:**

```json
{
  "tenantId": "…",
  "planId": "plan-starter",
  "subscription": { "id": "…", "status": "active", "billingCycle": "monthly", "currentPeriodStart": "…", "currentPeriodEnd": "…" },
  "modules": ["products", "orders", "payments", "shifts"],
  "limits": { "maxUsers": 3, "maxProducts": 50, "…": "…" }
}
```

---

## HubMembership (`/api/hub-memberships`)

User lintas-tenant (Group Admin). Role: `owner` | `admin` | `viewer`; unique `{hubId, userId}`. Mutasi & list per hub hanya Platform Super Admin (`platform.hubs.manage`); `/me` & `/me/tenants` siapa pun terautentikasi.

| Method | Path | Auth | Permission |
|--------|------|------|------------|
| POST | `/api/hub-memberships` | ✓ | `platform.hubs.manage` |
| GET | `/api/hub-memberships/hub/:hubId` | ✓ | `platform.hubs.manage` (list + nama/email user + `userTenantName`) |
| PUT | `/api/hub-memberships/:hubId/:userId` | ✓ | `platform.hubs.manage` (ganti role) |
| DELETE | `/api/hub-memberships/:hubId/:userId` | ✓ | `platform.hubs.manage` |
| GET | `/api/hub-memberships/me` | ✓ | — (membership milik user) |
| GET | `/api/hub-memberships/me/tenants` | ✓ | — (tenant yang bisa diakses via membership) |

**Body** POST: `{ hubId, userId, role }`; PUT: `{ role }`. Errors: 400 invalid role, 404 hub/user/membership tidak ada, 409 duplikat.

Response `GET /hub-memberships/hub/:hubId` dekorasi `displayName`/`email`/`userTenantId` + **`userTenantName`** (nama tenant asal anggota, satu lookup per tenant unik; `null` bila tenant sudah terhapus).

---

## Auth — Session Lintas-Tenant (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/auth/accessible-tenants` | ✓ | Tenant yang bisa diakses user via hub memberships `{ tenantId, tenantName, hubId, hubName, role }` |
| POST | `/api/auth/switch-tenant` | ✓ | `{ tenantId }` → token access+refresh baru scope target; `role: 'hub-'+membershipRole`, permissions `HUB_MEMBER_ROLE_PERMS`, `outletIds: []`; 403 bila tidak tercakup membership |

Permissions hub member: `owner` = full Owner; `admin` = Manager-level + `users:read` + `reports:read`; `viewer` = read-only (`reports/orders/products/customers/inventory/shifts/payments:read`).

---

## Domain Entity Shapes

### Product
```
id, tenantId, sku, barcode, name, description, categoryId, basePrice, imageUrls[], tags[], isActive, createdAt, updatedAt
```

### Order
```
id, tenantId, orderNumber (ORD-XXXX), status (draft|confirmed|paid|...), items[], subtotal, discount, tax, total, paymentStatus, cashierId, source, paidAt, createdAt, updatedAt
```

### Payment
```
id, tenantId, orderId, amount, status (pending|completed|failed), method (cash|qris|...), referenceNumber, paidAt, createdAt
```

### Shift
```
id, tenantId, registerId, cashierId, status (open|closed), openingBalance, closingBalance, expectedTotal, actualTotal, openedAt, closedAt
```

### Stock
```
id, tenantId, productId, warehouseId, quantity, reservedQuantity, minLevel, maxLevel, availableQuantity (computed), updatedAt
```

### User
```
id, tenantId, email, displayName, roleId, isActive, lastLoginAt, createdAt, updatedAt
```
*(passwordHash excluded from API responses)*

---

## Route Summary

> Catatan 2026-09-20: tabel ini adalah index ringkas manual, bukan sumber kontrak lengkap. Detail per-section di atas dan file route backend tetap authoritative; endpoint baru harus ditambahkan di sini saat docs sync berikutnya.

| # | Method | Path | Auth |
|---|--------|------|------|
| 1 | GET | `/health` | — |
| 2 | POST | `/api/auth/login` | — |
| 3 | POST | `/api/auth/register` | ✓ |
| 4 | POST | `/api/auth/refresh` | — |
| 5 | POST | `/api/auth/logout` | — |
| 6 | GET | `/api/auth/me` | ✓ |
| 7 | GET | `/api/tenants/slug/:slug` | — |
| 8 | POST | `/api/tenants` | ✓ |
| 9 | GET | `/api/tenants/current` | ✓ |
| 10 | PATCH | `/api/tenants/current/settings` | ✓ |
| 11 | GET | `/api/products` | ✓ |
| 12 | POST | `/api/products` | ✓ |
| 13 | GET | `/api/products/:id` | ✓ |
| 14 | PUT | `/api/products/:id` | ✓ |
| 15 | DELETE | `/api/products/:id` | ✓ |
| 16 | GET | `/api/categories` | ✓ |
| 17 | POST | `/api/categories` | ✓ |
| 18 | PUT | `/api/categories/:id` | ✓ |
| 19 | DELETE | `/api/categories/:id` | ✓ |
| 20 | GET | `/api/inventory` | ✓ |
| 21 | GET | `/api/inventory/movements` | ✓ |
| 22 | GET | `/api/inventory/low-stock` | ✓ |
| 23 | GET | `/api/inventory/:productId` | ✓ |
| 24 | POST | `/api/inventory/stock-in` | ✓ |
| 25 | POST | `/api/inventory/stock-out` | ✓ |
| 26 | POST | `/api/inventory/adjust` | ✓ |
| 27 | POST | `/api/inventory/reserve` | ✓ |
| 28 | POST | `/api/inventory/release` | ✓ |
| 29 | POST | `/api/inventory/import` | ✓ |
| 30 | POST | `/api/inventory/export` | ✓ |
| 31 | GET | `/api/warehouses` | ✓ |
| 32 | GET | `/api/warehouses/:id` | ✓ |
| 33 | POST | `/api/warehouses` | ✓ |
| 34 | PUT | `/api/warehouses/:id` | ✓ |
| 35 | DELETE | `/api/warehouses/:id` | ✓ |
| 36 | GET | `/api/roles` | ✓ |
| 37 | GET | `/api/roles/:id` | ✓ |
| 38 | POST | `/api/roles` | ✓ |
| 39 | PUT | `/api/roles/:id` | ✓ |
| 40 | DELETE | `/api/roles/:id` | ✓ |
| 41 | GET | `/api/users` | ✓ |
| 42 | GET | `/api/users/:id` | ✓ |
| 43 | PUT | `/api/users/:id` | ✓ |
| 44 | POST | `/api/users/:id/deactivate` | ✓ |
| 45 | POST | `/api/users/:id/activate` | ✓ |
| 46 | GET | `/api/permissions` | ✓ |
| 47 | GET | `/api/orders` | ✓ |
| 48 | GET | `/api/orders/:id` | ✓ |
| 49 | POST | `/api/orders` | ✓ |
| 49b | POST | `/api/orders/:id/close-bill` | ✓ |
| 49c | POST | `/api/orders/:id/void` | ✓ |
| 49d | POST | `/api/orders/:id/void-item` | ✓ |
| 49e | POST | `/api/orders/:id/void-payment` | ✓ |
| 49f | POST | `/api/orders/:id/apply-discount` | ✓ |
| 50 | GET | `/api/shifts` | ✓ |
| 51 | GET | `/api/shifts/current` | ✓ |
| 52 | POST | `/api/shifts/open` | ✓ |
| 53 | POST | `/api/shifts/:id/close` | ✓ |
| 54 | GET | `/api/payments` | ✓ |
| 55 | GET | `/api/payments/:orderId` | ✓ |
| 56 | POST | `/api/payments/pay-cash` | ✓ |
| 57 | GET | `/api/tax/config` | ✓ |
| 58 | PUT | `/api/tax/config` | ✓ |
| 59 | POST | `/api/tax/calculate` | ✓ |
| 60 | GET | `/api/tax/rules` | ✓ |
| 57 | POST | `/api/tax/rules` | ✓ |
| 58 | PUT | `/api/tax/rules/:id` | ✓ |
| 59 | DELETE | `/api/tax/rules/:id` | ✓ |
| 60 | POST | `/api/tax/charges` | ✓ |
| 61 | DELETE | `/api/tax/charges/:chargeId` | ✓ |
| 62 | GET | `/api/discount/:tenantId` | ✓ |
| 61 | POST | `/api/discount/:tenantId` | ✓ |
| 62 | PUT | `/api/discount/:tenantId` | ✓ |
| 63 | DELETE | `/api/discount/:tenantId/:ruleId` | ✓ |
| 64 | POST | `/api/discount/:tenantId/validate-promo` | ✓ |
| 65 | GET | `/api/promotions` | ✓ |
| 66 | GET | `/api/promotions/:id` | ✓ |
| 67 | POST | `/api/promotions` | ✓ |
| 68 | PUT | `/api/promotions/:id` | ✓ |
| 69 | DELETE | `/api/promotions/:id` | ✓ |
| 70 | GET | `/api/payment-methods` | ✓ |
| 71 | GET | `/api/payment-methods/active` | ✓ |
| 72 | GET | `/api/payment-methods/:id` | ✓ |
| 73 | POST | `/api/payment-methods` | ✓ |
| 74 | PUT | `/api/payment-methods/:id` | ✓ |
| 75 | DELETE | `/api/payment-methods/:id` | ✓ |
| 76 | GET | `/api/pricing-profiles` | ✓ |
| 77 | POST | `/api/pricing-profiles` | ✓ |
| 78 | PUT | `/api/pricing-profiles/:id` | ✓ |
| 79 | DELETE | `/api/pricing-profiles/:id` | ✓ |
| 80 | POST | `/api/pricing/calculate` | ✓ |
| 81 | GET | `/api/printers` | ✓ |
| 82 | GET | `/api/printers/:id` | ✓ |
| 83 | POST | `/api/printers` | ✓ |
| 84 | PUT | `/api/printers/:id` | ✓ |
| 85 | DELETE | `/api/printers/:id` | ✓ |
| 86 | POST | `/api/printers/:id/test` | ✓ |
| 87 | POST | `/api/print/receipt` | ✓ |
| 88 | POST | `/api/print/kot/:orderId` | ✓ |
| 89 | GET | `/api/outlets` | ✓ |
| 90 | GET | `/api/outlets/:id` | ✓ outlet scope |
| 91 | PUT | `/api/outlets/:id` | ✓ `outlet:manage` (update info; create/delete platform-only) |
| 92 | GET | `/api/hubs` | ✓ `platform.hubs.manage` |
| 93 | GET | `/api/hubs/:id` | ✓ `platform.hubs.manage` |
| 94 | POST | `/api/hubs` | ✓ `platform.hubs.manage` |
| 95 | PUT | `/api/hubs/:id` | ✓ `platform.hubs.manage` |
| 96 | DELETE | `/api/hubs/:id` | ✓ `platform.hubs.manage` |
| 97 | POST | `/api/hubs/:hubId/tenants/:tenantId` | ✓ `platform.hubs.manage` |
| 98 | DELETE | `/api/hubs/:hubId/tenants/:tenantId` | ✓ `platform.hubs.manage` |
| 99 | GET | `/api/hubs/:hubId/tenants` | ✓ `platform.hubs.manage` |
| 100 | GET | `/api/platform/health` | platform |
| 101 | GET | `/api/platform/hubs` | platform `platform.hubs.manage` |
| 102 | GET | `/api/platform/hubs/:hubId` | platform `platform.hubs.manage` |
| 103 | GET | `/api/platform/tenants` | platform `platform.tenants.read` |
| 104 | GET | `/api/platform/tenants/:tenantId` | platform `platform.tenants.read` |
| 105 | GET | `/api/platform/users` | platform `platform.tenants.read` (pencarian user lintas-tenant) |
| 106 | GET | `/api/platform/outlets` | platform `platform.tenants.read` |
| 107 | POST | `/api/platform/outlets` | platform `outlet:manage` |
| 108 | GET | `/api/platform/shifts/summary` | platform `platform.reports.read` |
| 109 | GET | `/api/platform/payments/summary` | platform `platform.reports.read` |
| 110 | GET | `/api/platform/hubs/:hubId/consolidated` | platform `platform.reports.read` |
| 111 | POST | `/api/hub-memberships` | ✓ `platform.hubs.manage` |
| 112 | GET | `/api/hub-memberships/hub/:hubId` | ✓ `platform.hubs.manage` |
| 113 | PUT | `/api/hub-memberships/:hubId/:userId` | ✓ `platform.hubs.manage` (ganti role) |
| 113a | DELETE | `/api/hub-memberships/:hubId/:userId` | ✓ `platform.hubs.manage` |
| 114 | GET | `/api/hub-memberships/me` | ✓ |
| 116 | GET | `/api/hub-memberships/me/tenants` | ✓ |
| 117 | GET | `/api/tenants/current/entitlement` | ✓ |
| 118 | GET | `/api/platform/plans` | platform `platform.plans.read` |
| 119 | GET | `/api/platform/plans/:id` | platform `platform.plans.read` |
| 120 | POST | `/api/platform/plans` | platform `platform.plans.manage` |
| 121 | PUT | `/api/platform/plans/:id` | platform `platform.plans.manage` |
| 122 | DELETE | `/api/platform/plans/:id` | platform `platform.plans.manage` |
| 123 | GET | `/api/platform/tenants/:tenantId/subscription` | platform `platform.tenants.read` |
| 124 | POST | `/api/platform/tenants/:tenantId/subscription` | platform `platform.tenants.manage` |
| 125 | POST | `/api/platform/tenants/:tenantId/subscription/cancel` | platform `platform.tenants.manage` |
| 126 | GET | `/api/platform/tenants/:tenantId/entitlement` | platform `platform.tenants.read` |
| 117 | GET | `/api/auth/accessible-tenants` | ✓ |
| 118 | POST | `/api/auth/switch-tenant` | ✓ |
