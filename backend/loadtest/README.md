# Load Test (k6)

Backend load-testing artifact for POSMono. Uses [k6](https://grafana.com/oss/k6/) (open source, no account needed).

Scenarios model the **money-critical POS loop** against a running backend instance (dev or deployed):

1. **setup** — one VU logs in as a cashier, opens a shift, fetches the first product, and passes its IDs (`__ENV`-driven) to all VUs.
2. **money loop (per VU)** — vary item count, then `POST /payments/pay-cash` (real shift enforcement, stock decrement, payment, receipt render).

## Thresholds (default)

- `http_req_failed` rate < 0.01 (no more than 1% of requests fail)
- `pay_cash` p95 latency < 300ms
- `pay_cash` p99 latency < 750ms
- `vue` (rate of successful pay-cash minus failed) > 0.99

These are *baselines* — tune to your actual hardware after the first run.

## Usage

Prereqs: a running backend with a seeded cashier + openable shift, and at least one product with sufficient stock. Set the values below to match.

```bash
cd backend
pnpm loadtest --env BASE_URL=http://localhost:4000 \
              --env EMAIL=cashier@test.com \
              --env PASSWORD=password123 \
              --env PRODUCT_ID=75f0... \
              --env VUS=20 \
              --env DURATION=60s
```

Or without pnpm (plain k6):

```bash
k6 run --env BASE_URL=http://localhost:4000 ... loadtest/scenarios/money-loop.js
```

### Suggested progression

```bash
# smoke — 1 VU, ~10s
pnpm loadtest --env VUS=1 --env DURATION=15s ...

# soak — small constant load over a few minutes
pnpm loadtest --env VUS=10 --env DURATION=5m ...

# capacity — ramp up and see where it breaks
pnpm loadtest-sweep ...
```

`loadtest-sweep` (defined in `package.json`) runs three escalating bursts (10 → 25 → 50 VUs × 60s) so you can find the practical ceiling of the deployed box.

## Honest scope

- This exercises the **HTTP + application + Mongo path once a product/stock already exist**. It does **not** cover: login flows at scale, QRIS gateway egress, printing/WebUSB, or browser-level POS interactions (those live in the E2E/integration suite).
- It writes real data to the target environment. Point it at the **staging/deployed** backend or a disposable dev instance — never production without a test tenant and throwaway product(s).
- `pay-cash` creates an order per iteration; expect `orders`/`payments`/`stock_movements` growth. Use a high-stock product or a test-only tenant.

## Output

`--summary` prints an aggregate; the `payment_ok` custom counter lets you assert the throughput of *successful* payments specifically (see `handleSummary`).