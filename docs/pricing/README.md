# Pricing Engine — Technical Design Document

**Kuire POS — Modular SaaS Platform**

Dokumen ini adalah **spesifikasi resmi (living specification)** Pricing Engine. Menjadi satu-satunya sumber kebenaran untuk seluruh logic pricing: diskon, service charge, pajak, pembulatan, dan adjustment.

## Target Pembaca

| Peran | Fokus |
|-------|-------|
| Backend Engineer | Domain model, pipeline, API, algoritma |
| Frontend Engineer | API contract, DTO, sequence diagram |
| QA Engineer | Test matrix, edge cases, calculation scenarios |
| Product Owner | Business concepts, batasan sistem, roadmap |

## Struktur Dokumen

```
docs/pricing/
│
├── Part I: Business Concepts
│   ├── 01-overview.md          — Filosofi, tujuan, batasan sistem
│
├── Part II: Domain Model
│   ├── 02-domain-model.md      — Aggregate, entity, value object
│
├── Part III: Architecture
│   ├── 03-pricing-pipeline.md  — Pipeline architecture & adjustment model
│
├── Part IV: Engine Components
│   ├── 04-discount-engine.md   — Discount engine detail
│   ├── 05-charge-engine.md     — Service charge & additional charges
│   ├── 06-tax-engine.md        — Tax rules, modifier, DPP
│   ├── 07-rounding-engine.md   — Rounding strategies
│   ├── 08-adjustment-model.md  — Adjustment pipeline & step
│
├── Part V: Integration
│   ├── 09-api.md               — REST API + DTO
│   ├── 10-database.md          — MongoDB schema & migration
│
├── Part VI: Behaviour
│   ├── 11-calculation-scenarios.md — Skenario kalkulasi lengkap
│   ├── 12-sequence-diagrams.md     — Sequence diagrams + class diagrams
│
├── Part VII: Quality
│   ├── 13-error-handling.md    — Error handling & fallback
│   ├── 14-performance.md       — Performance characteristics
│   ├── 15-testing.md           — Test strategy & matrix
│
└── Appendix
    ├── A-mathematical-formula.md   — Rumus matematika
    ├── B-indonesian-tax.md         — Contoh pajak Indonesia
    └── C-erp-comparison.md         — Perbandingan dengan sistem lain
```

## Konvensi

- `Rp` = Rupiah (IDR)
- `DPP` = Dasar Pengenaan Pajak (tax base)
- `PPN` = Pajak Pertambahan Nilai (VAT)
- `SC` = Service Charge
- Semua nilai uang dalam satuan rupiah penuh (`Math.round()`)
- Akurasi 2 desimal untuk internal, output dibulatkan ke integer
