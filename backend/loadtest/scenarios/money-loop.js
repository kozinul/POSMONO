// k6 load test — POS money-critical loop.
// Drive the full pay-cash path (shift enforcement, order create, rounding,
// payment, stock decrement, receipt render) for N concurrent VUs.
//
// Run: see loadtest/README.md (pnpm loadtest --env ...).
import http from 'k6/http';
import { check } from 'k6';
import { sleep, SharedArray } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const EMAIL = __ENV.EMAIL || 'cashier@test.com';
const PASSWORD = __ENV.PASSWORD || 'password123';
const PRODUCT_ID = __ENV.PRODUCT_ID || '';
const VU_QUANTITY = __ENV.QTY || 'variable';
const DURATION = __ENV.DURATION || '60s';
const RATE = __ENV.RATE || '20';

const options = {
  scenarios: {
    money_loop: {
      executor: 'constant-arrival-rate',
      duration: DURATION,
      preAllocatedVUs: parseInt(__ENV.VUS || '20', 10),
      rate: parseInt(RATE, 10),
      timeUnit: '1s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300'],
    'http_req_duration{name:pay_cash}': ['p(95)<300', 'p(99)<750'],
    payment_ok: ['rate>0.99'],
  },
};

// SharedArray of unique product IDs (fall back to PRODUCT_ID env).
const productIds = new SharedArray('products', () => {
  const curated = (PRODUCT_ID || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (curated.length > 0) return curated;
  // No explicit product — a seeded listing can be added here later.
  return ['MISSING_PRODUCT_ID'];
});

function itemCount() {
  if (VU_QUANTITY === 'variable') return 1 + (Number(__VU) % 3); // 1..3
  return Math.max(1, parseInt(VU_QUANTITY, 10));
}

export function setup() {
  const login = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(login, { 'login 200': (r) => r.status === 200 });
  const token = login.json('data.token') || login.json('data.accessToken') || '';
  if (!token) throw new Error('login failed — check EMAIL/PASSWORD/seed');

  const shift = http.post(
    `${BASE_URL}/shifts/open`,
    JSON.stringify({ openingBalance: 100000 }),
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
  );
  check(shift, { 'open shift 201': (r) => r.status === 201 });
  return { token, shiftId: shift.json('data.id') };
}

export default function (ctx) {
  const pid = productIds[__VU % __TOT_VU];
  const qty = itemCount();
  const unitPrice = 25000;
  const total = qty * unitPrice;
  const amountPaid = Math.ceil(total / 5000) * 5000;

  const res = http.post(
    `${BASE_URL}/payments/pay-cash`,
    JSON.stringify({
      items: [{ productId: pid, quantity: qty, unitPrice }],
      amountPaid,
      shiftId: ctx.shiftId,
    }),
    { tags: { name: 'pay_cash' }, headers: { Authorization: `Bearer ${ctx.token}`, 'Content-Type': 'application/json' } },
  );

  const ok = res.status === 200;
  if (!ok) console.error(`pay-cash ${res.status}: ${res.body.slice(0, 200)}`);

  check(res, { 'pay-cash 200': () => ok });

  sleep(0.1);
}

export function handleSummary(data) {
  const pay = data.metrics['http_req_duration{name:pay_cash}'];
  return {
    stdout: `
Pay-cash (${__ENV.VUS ?? 20} VUs, ${RATE}/s):
  requests ......... ${pay ? Math.round(pay.values.count) : 'n/a'}
  p95 .............. ${pay ? pay.values['p(95)'].toFixed(0) + 'ms' : 'n/a'}
  p99 .............. ${pay ? pay.values['p(99)'].toFixed(0) + 'ms' : 'n/a'}
  failed % ......... ${data.metrics.http_req_failed.values.rate.toFixed(3) * 100}%
${JSON.stringify(data.metrics.aborted_by_user, null, 2)}
`,
  };
}