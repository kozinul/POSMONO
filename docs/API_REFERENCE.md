# API Reference

> **Base URL:** `http://localhost:4000`
> **Response Envelope:**
> ```json
> { "success": true, "data": <payload>, "meta": { "total": 100, "page": 1, "limit": 50 } }
> ```

**Auth:** All endpoints except `/health`, `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`, `/api/auth/logout`, and `GET /api/tenants/slug/:slug` require a JWT in the `Authorization: Bearer <token>` header.

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
  "data": [{ "id": "uuid", "tenantId": "...", "sku": "SKU-001", "barcode": "...", "name": "Kopi Gula Aren", "description": "...", "categoryId": "...", "basePrice": 25000, "imageUrls": [], "tags": ["kopi"], "isActive": true, "createdAt": "...", "updatedAt": "..." }],
  "meta": { "total": 10, "page": 1, "limit": 50 }
}
```

### `POST /api/products`

Create a product.

**Body:**
```json
{ "sku": "SKU-001", "name": "Kopi Gula Aren", "categoryId": "cat-id", "basePrice": 25000, "barcode": "...", "description": "...", "imageUrls": ["https://..."], "tags": ["kopi"], "country": "ID", "region": "Bali", "currency": "IDR" }
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

## Menu Types (`/api/menu-types`)

### `GET /api/menu-types`

List all menu types for current tenant.

**Response 200:** `{ "success": true, "data": [{ "id": "...", "tenantId": "...", "name": "Makanan", "sortOrder": 0, "isActive": true, "createdAt": "...", "updatedAt": "..." }] }`

### `POST /api/menu-types`

**Body:** `{ "name": "Makanan", "sortOrder": 0 }`

**Response 201:** Full menu type object.

### `PUT /api/menu-types/:id`

**Body:** `{ "name": "Makanan Updated", "sortOrder": 1, "isActive": false }` (all optional)

**Response 200:** Full menu type object.

### `PUT /api/menu-types/:id/rename`

Rename a menu type. Automatically updates all families using the old name.

**Body:** `{ "name": "New Name" }`

**Response 200:** Full menu type object.

### `DELETE /api/menu-types/:id`

Fails if any family still references this menu type.

**Response:** `204 No Content`

---

## Families (`/api/families`)

### `GET /api/families`

List all families for current tenant.

**Response 200:** `{ "success": true, "data": [{ "id": "...", "tenantId": "...", "name": "Western", "description": "Masakan Barat", "menuType": "Makanan", "sortOrder": 1, "isActive": true, "createdAt": "...", "updatedAt": "..." }] }`

### `GET /api/families/by-menu-type/:menuType`

List families filtered by menu type string.

**Response 200:** Array of family objects filtered by `menuType`.

### `POST /api/families`

**Body:** `{ "name": "Western", "description": "Masakan Barat", "menuType": "Makanan", "sortOrder": 1 }`

**Response 201:** Full family object.

### `PUT /api/families/:id`

**Body:** `{ "name": "Asian", "menuType": "Makanan", "isActive": false }` (all optional)

**Response 200:** Full family object.

### `DELETE /api/families/:id`

**Response:** `204 No Content`

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
| items | array | yes | Cart items with productId, quantity, unitPrice |
| amountPaid | number | yes | Amount tendered by customer |
| discount | number | no | Manual discount value (default 0) |
| discountType | string | no | `"percentage"` or `"nominal"` (default nominal) |
| promoCode | string | no | Promo code to apply (validated against discount engine) |

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

**Discount flow:**
1. If `promoCode` provided → `DiscountServiceAdapter.apply()` evaluates rules against cart
2. Promo discount + manual discount combined (capped to subtotal)
3. Combined discount passed to `TaxService.calculate()` (discount before tax)
4. Order stores `promotions[]` and `discountBreakdown[]` for receipt/reporting

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
| 27 | GET | `/api/warehouses` | ✓ |
| 28 | GET | `/api/warehouses/:id` | ✓ |
| 29 | POST | `/api/warehouses` | ✓ |
| 30 | PUT | `/api/warehouses/:id` | ✓ |
| 31 | DELETE | `/api/warehouses/:id` | ✓ |
| 32 | GET | `/api/roles` | ✓ |
| 33 | GET | `/api/roles/:id` | ✓ |
| 34 | POST | `/api/roles` | ✓ |
| 35 | PUT | `/api/roles/:id` | ✓ |
| 36 | DELETE | `/api/roles/:id` | ✓ |
| 37 | GET | `/api/users` | ✓ |
| 38 | GET | `/api/users/:id` | ✓ |
| 39 | PUT | `/api/users/:id` | ✓ |
| 40 | POST | `/api/users/:id/deactivate` | ✓ |
| 41 | POST | `/api/users/:id/activate` | ✓ |
| 42 | GET | `/api/permissions` | ✓ |
| 43 | GET | `/api/orders` | ✓ |
| 44 | GET | `/api/orders/:id` | ✓ |
| 45 | POST | `/api/orders` | ✓ |
| 46 | GET | `/api/shifts` | ✓ |
| 47 | GET | `/api/shifts/current` | ✓ |
| 48 | POST | `/api/shifts/open` | ✓ |
| 49 | POST | `/api/shifts/:id/close` | ✓ |
| 50 | GET | `/api/payments` | ✓ |
| 51 | GET | `/api/payments/:orderId` | ✓ |
| 52 | POST | `/api/payments/pay-cash` | ✓ |
