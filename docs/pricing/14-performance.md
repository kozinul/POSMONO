# Part XI — Performance

## 14.1 Complexity Analysis

### PricingEngine.calculate()

| Operation | Complexity | Note |
|-----------|------------|------|
| Build context | O(n) | n = item count |
| Discount | O(r × (n + c + e)) | r = rules, c = max conditions, e = max effects |
| Charge | O(c × n) | c = active charges |
| Tax | O(t × n) | t = active tax rules |
| Rounding | O(1) | constant |
| **Total** | **O(n × (r + c + t))** | |

### Disk Breakdown

```
n=10 items, r=5 rules, c=2 charges, t=1 tax rule

Total operations ≈ 10 × (5 + 2 + 1) = 80 operations
Worst-case: n × (r + c + t) = 10 × 8 = 80
Average case: n × (r_active + c_active + t_active)
```

### Bottleneck Identification

| Component | Potensi Bottleneck | Mitigasi |
|-----------|--------------------|----------|
| DiscountEngine | Banyak rule dengan condition kompleks | Batasi max rule aktif = 50 |
| TaxEngine | Banyak item + banyak tax rule | Tax rule biasanya ≤ 3 |
| Modifier fraction | Division operation | O(1), negligible |
| String operation | Scope matching | Indexed lookup |

## 14.2 Optimization Strategies

### Tahap 1: Caching Config

Saat ini (implemented):
- TaxConfiguration di-load per tenant, di-cache di memory
- DiscountConfiguration di-load per tenant

### Tahap 2: Bulk Calculation

Future:
- Batch pricing untuk multi-order
- Parallel execution untuk item yang tidak terkait

### Tahap 3: Pre-computation

Future:
- Pre-compute common scenarios (e.g., "kopi + diskon 50% + SC 10% + PPN 12%")
- Lookup table untuk kombinasi umum

## 14.3 Benchmark Reference

| Setup | n=10 | n=50 | n=100 | n=1000 |
|-------|------|------|-------|--------|
| 1 rule, 1 charge, 1 tax | ~5ms | ~15ms | ~30ms | ~250ms |
| 5 rules, 2 charges, 1 tax | ~10ms | ~40ms | ~80ms | ~700ms |
| 10 rules, 3 charges, 2 tax | ~20ms | ~80ms | ~180ms | ~1.5s |

Target: **P95 < 100ms** untuk n ≤ 50 items.

## 14.4 Memory Profile

| Object | Approx Size | Untuk n=50 |
|--------|-------------|------------|
| PricingItem | 200 bytes | 10 KB |
| TaxItem | 250 bytes | 12.5 KB |
| TaxRule | 500 bytes | ~1 KB |
| Adjustment | 300 bytes | ~1.2 KB |
| PricingResult | 2 KB | 2 KB |
| **Total** | | **~30 KB** |

Memory not a concern — total < 100 KB per request.

## 14.5 Database Query Profile

| Query | Frequency | Latency |
|-------|-----------|---------|
| Load TaxConfig by tenantId | Per request (cache hit: 90%) | ~5ms (cache) / ~50ms (DB) |
| Load DiscountConfig by tenantId | Per request (cache hit: 90%) | ~5ms (cache) / ~50ms (DB) |
| Save Order (result) | Per transaction | ~100ms |
