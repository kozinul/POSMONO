# Part VI — API

## 9.1 REST API Endpoints

### Calculate Pricing

```
POST /api/v1/pricing/calculate
```

#### Request

```json
{
  "items": [
    {
      "productId": "prod-kopi-susu-001",
      "name": "Kopi Susu",
      "categoryId": "cat-kopi",
      "quantity": 2,
      "unitPrice": 25000
    }
  ],
  "discount": {
    "promoCode": "KOPI50",
    "customerGroup": "regular"
  },
  "metadata": {
    "outletId": "outlet-jkt-01"
  }
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "subtotal": 50000,
    "adjustments": [
      {
        "type": "DISCOUNT",
        "name": "Promo Kopi 50%",
        "sequence": 10,
        "base": 50000,
        "rate": 50,
        "amount": -25000,
        "affectsTaxBase": true,
        "affectsGrandTotal": true
      },
      {
        "type": "CHARGE",
        "name": "Service Charge 10%",
        "sequence": 20,
        "base": 25000,
        "rate": 10,
        "amount": 2500,
        "affectsTaxBase": true,
        "affectsGrandTotal": true
      },
      {
        "type": "TAX",
        "name": "PPN 12%",
        "sequence": 30,
        "base": 27500,
        "rate": 12,
        "amount": 3025,
        "affectsTaxBase": false,
        "affectsGrandTotal": true,
        "metadata": {
          "modifier": { "type": "fraction", "numerator": 11, "denominator": 12 }
        }
      }
    ],
    "discount": 25000,
    "discountItems": [],
    "charges": [{ "name": "Service Charge", "amount": 2500, "includeInTaxBase": true }],
    "taxBase": 27500,
    "modifier": { "type": "fraction", "before": 27500, "after": 25208 },
    "taxes": [{ "name": "PPN 12%", "rate": 12, "amount": 3025 }],
    "taxAmount": 3025,
    "grandTotal": 30525
  }
}
```

### Get Tax Configuration

```
GET /api/v1/tax-config/:tenantId
```

#### Response

```json
{
  "success": true,
  "data": {
    "tenantId": "tenant-001",
    "taxEnabled": true,
    "pricingMode": "exclusive",
    "countryCode": "ID",
    "currency": "IDR",
    "versions": [
      {
        "id": "v1",
        "versionNumber": 1,
        "status": "active",
        "effectiveDate": "2025-01-01T00:00:00Z",
        "rules": [
          {
            "id": "rule-ppn-12",
            "name": "PPN 12%",
            "taxType": "PPN",
            "rate": 12,
            "priority": 1,
            "isActive": true,
            "scope": { "type": "ALL" },
            "modifier": {
              "type": "fraction",
              "config": { "numerator": 11, "denominator": 12 }
            },
            "roundingMode": "round",
            "precision": 0
          }
        ],
        "charges": [
          {
            "id": "charge-sc",
            "name": "Service Charge",
            "rate": 10,
            "isActive": true,
            "priority": 1,
            "scope": { "type": "ALL" },
            "includeInTaxBase": true
          }
        ]
      }
    ]
  }
}
```

### Update Tax Configuration

```
PUT /api/v1/tax-config/:tenantId
```

Request body same as above.

### Get Discount Configuration

```
GET /api/v1/discount-config/:tenantId
```

### Create Discount Rule

```
POST /api/v1/discount-config/:tenantId/rules
```

### Sync Promotion

```
POST /api/v1/promotions/:promotionId/sync
```

Internal endpoint dipanggil oleh PromotionService saat promotion di-create/update.

## 9.2 DTOs

```typescript
// REQUEST DTOs
interface CalculatePricingRequest {
  items: PricingItemDto[];
  discount?: {
    promoCode?: string;
    customerGroup?: string;
    customerTags?: string[];
  };
  metadata?: {
    outletId?: string;
    transactionDate?: string;
    tenantId?: string;
  };
}

interface PricingItemDto {
  productId: string;
  name: string;
  categoryId: string;
  quantity: number;
  unitPrice: number;
}

// INTERNAL DTOs (backend-only)
interface TaxItem {
  productId: string;
  name: string;
  categoryId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  lineTotalAfterDiscount: number;
  appliedDiscount: number;
}

interface PricingContext {
  items: TaxItem[];
  subtotal: number;
  discount: number;
  matchingSubtotal: number;
  adjustments: Adjustment[];
  promoCode?: string;
  customerGroup?: string;
  customerTags?: string[];
  tenantId: string;
  outletId?: string;
}
```

## 9.3 Error Handling

| HTTP | Error Code | Description |
|------|------------|-------------|
| 400 | `INVALID_ITEMS` | Items array kosong atau item invalid |
| 400 | `INVALID_AMOUNT` | Nilai negatif atau tidak valid |
| 400 | `DISCOUNT_EXCEEDS_SUBTOTAL` | Diskon > subtotal (setelah cap) |
| 404 | `TENANT_NOT_FOUND` | Tenant tidak ditemukan |
| 404 | `CONFIG_NOT_FOUND` | TaxConfig atau DiscountConfig tidak ditemukan |
| 500 | `CALCULATION_ERROR` | Error internal saat kalkulasi |
| 500 | `PROMOTION_SYNC_FAILED` | Gagal sync promotion ke discount |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "INVALID_ITEMS",
    "message": "Items array is empty",
    "details": {
      "receivedCount": 0
    }
  }
}
```
