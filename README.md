# POSMono

Modular SaaS Platform untuk Point of Sale (POS), dirancang untuk restoran, retail, dan hospitality.

## Fitur Utama

- **Multi-Tenant**: Database-per-tenant, data terisolasi sepenuhnya
- **Multi-Outlet**:dukungan beberapa cabang dengan konfigurasi per outlet
- **POS Terminal**: Transaksi cepat dengan product grid, cart, split payment
- **Promosi**: 14 tipe rule evaluator, auto-apply, promo code
- **Pajak**: DPP Fraction 11/12 (PPN 12% efektif 11%), service charge, pricing modes
- **Inventory**: Multi-gudang, stock movement tracking, low stock alerts
- **Shift Management**: Open/close shift, cash pickup, cashier reports
- **Laporan**: Sales, finance, cashier performance reports
- **RBAC**: 30+ granular permissions, system roles

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, Tailwind CSS, Zustand, Tanstack Query |
| Backend | Node.js, Express, TypeScript, MongoDB (Mongoose) |
| Monorepo | pnpm workspaces, Turborepo |
| Auth | JWT (access + refresh tokens) |
| Validation | Zod |
| DI Container | Awilix |
| Real-time | Socket.IO |

## Struktur Project

```
posmono/
├── backend/                    # Express REST API
│   └── src/
│       ├── core/               # Bounded Contexts (DDD)
│       │   ├── identity/       # Auth, Users, Roles
│       │   ├── catalog/        # Products, Categories, Families
│       │   ├── ordering/       # Orders, Cart
│       │   ├── inventory/      # Stock, Warehouses
│       │   ├── pos/            # Registers, Shifts
│       │   ├── payment/        # Payments, Methods
│       │   ├── tax/            # Tax Rules, Pricing Engine
│       │   ├── discount/       # Discount Engine
│       │   ├── promotion/      # Promotion Rules
│       │   ├── customer/       # Members, Loyalty
│       │   ├── reporting/      # Reports, Analytics
│       │   └── settings/       # Tenant Settings
│       ├── bootstrap/          # DI, Routes, Server setup
│       └── @shared/            # Shared Kernel (DDD base classes)
│
├── frontend/                   # React SPA
│   └── src/
│       ├── core/               # Feature modules
│       │   ├── pos/            # POS Terminal
│       │   ├── products/       # Product Management
│       │   ├── promotions/     # Promotion Management
│       │   ├── settings/       # Settings (Tax, Discount, SC)
│       │   └── ...
│       ├── @shared/            # Shared hooks, utils, services
│       ├── layouts/            # Page layouts
│       └── app/                # Router, providers
│
├── shared/                     # Shared types, validation
└── docs/                       # Documentation
```

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- MongoDB (local atau Atlas)

### Installation

```bash
# Clone repo
git clone <repo-url>
cd posmono

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret

# Seed database
pnpm db:seed

# Start development
pnpm dev
```

### Development URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:4000 |
| MongoDB | mongodb://localhost:27017 |

## API Endpoints

Lihat [docs/API_REFERENCE.md](docs/API_REFERENCE.md) untuk dokumentasi lengkap.

### Highlights

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/login` | Login |
| `GET /api/products` | List products |
| `POST /api/orders` | Create order |
| `POST /api/payments/pay-cash` | Process payment |
| `POST /api/tax/calculate` | Calculate tax |
| `POST /api/discount/:tenantId/validate-promo` | Validate promo code |
| `POST /api/promotions` | Create promotion |

## Tax Engine

POSMono mendukung perhitungan pajak Indonesia dengan DPP Fraction:

```
DPP = Harga × (Pembilang / Penyebut)
Pajak = DPP × Tarif%

Contoh PPN 12% dengan DPP 11/12:
DPP = Rp 11.000 × (11/12) = Rp 10.083
Pajak = Rp 10.083 × 12% = Rp 1.210
Pajak Efektif = 11%
```

### Pricing Modes

- **Inclusive**: Harga sudah termasuk pajak (pajak di-extract)
- **Exclusive**: Pajak ditambahkan di atas harga

## Promotion Engine

14 tipe rule evaluator:

| Tipe | Deskripsi |
|------|-----------|
| `percentage` | Diskon persentase |
| `nominal` | Diskon nominal (Rp) |
| `special_price` | Harga spesial |
| `quantity_range` | Diskon berdasarkan range qty |
| `min_quantity` | Minimal qty tertentu |
| `nth_item` | Diskon item ke-N |
| `bundle` | Bundle price |
| `buy_x_get_y` | Beli X gratis Y |
| `buy_x_pay_y` | Beli X bayar Y |
| `free_gift` | Gratis hadiah |
| `min_spend` | Minimal total belanja |
| `multiplier` | Pengali harga |
| `member_tier` | Berdasarkan tier member |
| `payment_method` | Berdasarkan metode pembayaran |

## Development

### Scripts

```bash
pnpm dev              # Start all services
pnpm dev:api          # Start backend only
pnpm dev:web          # Start frontend only
pnpm build            # Build all
pnpm test             # Run all tests
pnpm lint             # Lint all
pnpm typecheck        # Type check all
```

### Testing

```bash
# Backend tests (requires Docker for MongoDB)
cd backend
pnpm test

# Frontend tests
cd frontend
pnpm test
```

## Deployment

### Docker

```bash
# Production
docker compose -f docker/docker-compose.yml up -d

# Development
docker compose -f docker/docker-compose.dev.yml up -d
```

### Manual

```bash
pnpm build
cd backend && pnpm start
cd frontend && pnpm preview
```

## Dokumentasi

- [Arsitektur](docs/ARCHITECTURE.md)
- [API Reference](docs/API_REFERENCE.md)
- [Keputusan Teknis](docs/DECISIONS.md)
- [Fitur POS](docs/POS_CURRENT_FEATURES.md)
- [Bug Tracker](docs/BUG_TRACKER.md)

## License

Proprietary — All rights reserved.
