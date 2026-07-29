# Part VII — Database

## 10.1 MongoDB Collections

### tax_configurations

```json
{
  "_id": ObjectId,
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
      "effectiveDate": ISODate("2025-01-01T00:00:00Z"),
      "rules": [
        {
          "id": "rule-ppn-12",
          "name": "PPN 12%",
          "taxType": "PPN",
          "rate": 12,
          "rateType": "percentage",
          "priority": 1,
          "isActive": true,
          "scope": {
            "type": "ALL",
            "entityId": null,
            "entityName": null
          },
          "modifier": {
            "type": "fraction",
            "config": {
              "numerator": 11,
              "denominator": 12
            }
          },
          "roundingMode": "round",
          "precision": 0,
          "taxGroup": null,
          "metadata": {}
        }
      ],
      "charges": [
        {
          "id": "charge-sc",
          "name": "Service Charge",
          "rate": 10,
          "isActive": true,
          "priority": 1,
          "scope": {
            "type": "ALL",
            "entityId": null,
            "entityName": null
          },
          "includeInTaxBase": true,
          "roundingMode": "round",
          "precision": 0
        }
      ]
    }
  ],
  "metadata": {},
  "createdAt": ISODate("2025-01-01T00:00:00Z"),
  "updatedAt": ISODate("2025-06-15T10:30:00Z")
}
```

**Index**: `{ tenantId: 1 }` (unique)

### discount_configurations

```json
{
  "_id": ObjectId,
  "tenantId": "tenant-001",
  "enabled": true,
  "rules": [
    {
      "id": "rule-promo-kopi-50",
      "name": "Promo Kopi 50%",
      "priority": 1,
      "stackable": false,
      "active": true,
      "scope": {
        "type": "category",
        "entityId": "cat-kopi",
        "entityName": "Kopi"
      },
      "policy": {
        "type": "percentage",
        "value": 50,
        "maxCap": null,
        "application": "per_order"
      },
      "conditions": [
        {
          "type": "date_range",
          "config": {
            "startDate": "2025-06-01T00:00:00Z",
            "endDate": "2025-12-31T23:59:59Z"
          }
        },
        {
          "type": "product_match",
          "config": {
            "productIds": ["prod-kopi-susu-001", "prod-kopi-002"]
          }
        }
      ],
      "effects": [
        {
          "type": "percentage_off",
          "config": {
            "rate": 50,
            "maxCap": 25000,
            "target": "scope_items"
          }
        }
      ],
      "promoCodeId": "KOPI50",
      "maxUsageCount": 1000,
      "currentUsageCount": 0,
      "startDate": ISODate("2025-06-01T00:00:00Z"),
      "endDate": ISODate("2025-12-31T23:59:59Z")
    }
  ],
  "createdAt": ISODate("2025-01-01T00:00:00Z"),
  "updatedAt": ISODate("2025-06-15T10:30:00Z")
}
```

**Index**: `{ tenantId: 1 }` (unique)

### promotions (source of truth)

```json
{
  "_id": ObjectId,
  "tenantId": "tenant-001",
  "name": "Promo Kopi 50%",
  "code": "KOPI50",
  "description": "Diskon 50% untuk semua menu kopi",
  "type": "discount",
  "priority": 1,
  "isActive": true,
  "validFrom": ISODate("2025-06-01T00:00:00Z"),
  "validUntil": ISODate("2025-12-31T23:59:59Z"),
  "usageLimit": 1000,
  "usedCount": 5,
  "rules": [
    {
      "type": "product_match",
      "config": {
        "productIds": ["prod-kopi-susu-001", "prod-kopi-002"]
      }
    },
    {
      "type": "category_match",
      "config": {
        "categoryIds": ["cat-kopi"]
      }
    }
  ],
  "effects": [
    {
      "type": "percentage",
      "config": {
        "rate": 50
      }
    }
  ]
}
```

## 10.2 Caching Strategy

### Tahap 1: Cache saat load config

```
POST /api/v1/pricing/calculate
│
├── PricingService
│     ├── Check cache (Redis)
│     ├── miss? → load from MongoDB
│     ├── Parse & validate
│     └── Store to cache (TTL: 5 menit)
│
├── DiscountEngine.calculate()
│     └── uses cached config
│
└── TaxEngine.calculate()
      └── uses cached config
```

### Tahap 2: Cache terpusat (future)

```
┌─────────────────┐     ┌─────────────┐
│  Config Service  │────▶│  Redis       │
│  (write-through) │     │  {tenant}:   │
└─────────────────┘     │  taxConfig   │
                        │  discountCfg │
                        └─────────────┘
                               │
                               ├▶ Pricing Service
                               ├▶ Discount Service
                               └▶ Tax Service
```

## 10.3 Data Migration Path

| Version | Tanggal | Perubahan |
|---------|---------|-----------|
| v1 | 2025-01-01 | Initial: 1 version, PPN 11%, SC 5%, no modifier |
| v2 | 2025-03-01 | Add fraction modifier for PPN 12% |
| v3 | 2025-04-01 | PPN rate: 11% → 12%, add modifier 11/12 |
| v4 | Future | PPN rate: 12% → 13% (direncanakan) |

Migration strategy:
- **Additive**: Menambah version baru, tidak mengubah yang lama
- **Backward compatible**: Version lama tetap bisa dipakai untuk laporan
- **Scheduled**: Setiap perubahan menggunakan effectiveDate
- **Version bump**: Number di-increment otomatis
