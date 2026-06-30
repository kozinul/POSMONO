# Engineering Execution Strategy

> **Platform:** POSMono — Modular Business Operating System
> **Status:** Execution Planning
> **Role:** Solo Developer / Startup CTO
> **Principle:** Ship first. Scale later. Validate before building.

---

## Table of Contents

1. [The Hard Truth](#1-the-hard-truth)
2. [MVP Boundary](#2-mvp-boundary)
3. [Development Phases](#3-development-phases)
4. [What NOT to Build](#4-what-not-to-build)
5. [Testing Strategy](#5-testing-strategy)
6. [Technical Debt Strategy](#6-technical-debt-strategy)
7. [Solo Developer Strategy](#7-solo-developer-strategy)
8. [Product Validation Strategy](#8-product-validation-strategy)
9. [Cost Optimization Strategy](#9-cost-optimization-strategy)
10. [First Customer Strategy](#10-first-customer-strategy)
11. [Final MVP Architecture](#11-final-mvp-architecture)

---

## 1. The Hard Truth

### 1.1 The Architecture Documents Are a North Star, Not a Blueprint

The architecture you've designed (`ARCHITECTURE.md`, `DOMAIN_ARCHITECTURE.md`, `DATABASE_ARCHITECTURE.md`, `TRANSACTION_SYSTEM_ARCHITECTURE.md`, `INFRASTRUCTURE_ARCHITECTURE.md`) is valuable as a **long-term vision**.

But if you try to build ALL of it before shipping, you will:

- Burn out in 3-6 months with nothing in production
- Build infrastructure for 10,000 tenants when you have 0
- Implement distributed systems patterns for a single-process app
- Design plugin runtimes before you have a single user

**The architecture documents are your compass. The execution strategy below is your map for the next 3 months.**

### 1.2 Your Real Advantage

As a solo developer building for UMKM in Indonesia:

- Your cost structure is near-zero (no salaries, no offices)
- You can move faster than any team (no meetings, no approvals)
- You can personally talk to every early customer
- Your first 10 customers will tell you what to build next

Do NOT waste these advantages building infrastructure for 100,000 tenants from day one.

### 1.3 The Rule

```
FOR EVERY FEATURE, ASK:
  "Does this help me get my first paying customer faster?"
  If NO → Do NOT build it.
  If YES → Build the simplest version that works.
```

---

## 2. MVP Boundary

### 2.1 MVP Scope

```
MVP = Minimum VIABLE Product (not Minimum "Enterprise" Product)

VIABLE means: A real UMKM store can use it to replace their current cash register.

WHAT A REAL UMKM STORE NEEDS:
──────────────────────────────
  • Cashier can select products and create order
  • Customer can pay via QRIS or cash
  • Receipt prints (even simple thermal)
  • Owner can see daily sales total
  • Products can be added/managed

WHAT A REAL UMKM STORE DOES NOT NEED:
───────────────────────────────────────
  • Restaurant module (they are not a restaurant)
  • Offline sync (they have internet, or they use a book)
  • Multi-device real-time sync (one device is enough)
  • Advanced reporting (they want total uang masuk hari ini)
  • Loyalty points (they know their customers by name)
  • n8n automation (they use WhatsApp manually)
  • Electron desktop (browser is fine)
  • Mobile app (browser on phone is fine)
  • Printer service abstraction layer (one printer type is fine)
  • Event sourcing (an audit log is fine)
  • CQRS (simple CRUD is fine for MVP)
  • Kubernetes (Docker Compose is overkill for MVP — just use PM2)
```

### 2.2 MVP Feature List

```
MVP — BUILD THESE ONLY:
════════════════════════

AUTHENTICATION:
  ✅ Email + password login
  ✅ JWT session (8h expiry, no refresh token for MVP)
  ✅ One role: Owner (sees everything)

TENANT:
  ✅ Single tenant per installation (no multi-tenant UI for MVP)
  ✅ Simple onboarding: register → create store → done

PRODUCT CATALOG:
  ✅ Add product (name, price, category)
  ✅ Edit product
  ✅ Delete product (soft delete)
  ✅ Categories (name only)
  ✅ Simple product grid on POS screen

POS TRANSACTION:
  ✅ Create order (select products, set quantity)
  ✅ Cart view (see items, total)
  ✅ Choose payment method (cash or QRIS)
  ✅ Complete order
  ✅ Cancel order (before payment)

PAYMENT:
  ✅ Cash (record amount, calculate change)
  ✅ QRIS via Midtrans (generate QR, poll status)
  ✅ Basic payment record

RECEIPT:
  ✅ Simple thermal receipt (58mm) via browser print
  ✅ Receipt number, items, total, payment method, date

BASIC REPORTING:
  ✅ Today's sales total
  ✅ Today's order count
  ✅ Simple order list (filter by date)

INVENTORY (SIMPLIFIED):
  ✅ Stock quantity on product
  ✅ Decrement when order is paid
  ✅ Show "out of stock" on product grid
  ✅ Manual stock adjustment

CASHIER SHIFT:
  ✅ Open shift (starting balance)
  ✅ Close shift (count cash, show expected vs actual)
  ✅ Track which cashier (even if just one)

EXCLUDED FROM MVP — BUILD LATER:
══════════════════════════════════
  ❌ Multi-tenant SaaS admin panel
  ❌ Offline sync
  ❌ Multiple payment gateways
  ❌ Restaurant module
  ❌ Hospitality module
  ❌ Advanced reporting (charts, export)
  ❌ Customer management
  ❌ Loyalty points
  ❌ n8n automation
  ❌ WhatsApp notifications
  ❌ Capacitor mobile app
  ❌ Electron desktop app
  ❌ Bluetooth/USB printer
  ❌ Kitchen Display System
  ❌ Multi-warehouse
  ❌ Purchase orders
  ❌ Supplier management
  ❌ Barcode scanner
  ❌ Discount/coupon system
  ❌ Tax calculation
  ❌ Multi-language
  ❌ Dark mode
  ❌ Email notifications
  ❌ RBAC (one role is enough)
  ❌ API rate limiting
  ❌ CI/CD pipeline
  ❌ Prometheus/Grafana monitoring
  ❌ Loki logging stack
  ❌ Database backups to S3
  ❌ Dead letter queues
  ❌ Saga orchestration
  ❌ Event store
```

### 2.3 What MVP Looks Like in Practice

```
BACKEND FILES NEEDED:
══════════════════════
  • server.ts (Express app, ~50 lines)
  • routes/auth.ts (login, register)
  • routes/products.ts (CRUD)
  • routes/orders.ts (create, list, detail)
  • routes/payments.ts (QRIS, cash)
  • routes/reports.ts (daily sales)
  • routes/shifts.ts (open, close)
  • middleware/auth.ts (JWT verify)
  • models/ (Mongoose schemas — 6-8 models)
  • services/midtrans.ts (API client)

  That's it. ~15 files. NOT 200 files.

FRONTEND FILES NEEDED:
══════════════════════
  • LoginPage.tsx
  • PosPage.tsx (product grid + cart + payment)
  • ProductListPage.tsx
  • ProductFormPage.tsx
  • OrderListPage.tsx
  • ShiftPage.tsx
  • DailyReportPage.tsx
  • App.tsx (router)

  That's it. ~12 pages. NOT 50 pages.

DATABASE COLLECTIONS:
═════════════════════
  • users
  • products
  • orders
  • payments
  • shifts
  • no separate tenant DB (single DB for MVP)
  • no audit_log collection (just console.log for now)
  • no event store
  • no outbox collection
```

---

## 3. Development Phases

### 3.1 Phase Breakdown for Solo Developer

```
PHASE 0 — VALIDATION (Week 1-2)
═════════════════════════════════
  GOAL: Confirm someone will pay before you build.

  ACTIONS:
  • Visit 3-5 UMKM stores in your area
  • Ask: "How do you manage sales now?"
  • Ask: "What's the hardest part?"
  • Ask: "Would you pay Rp 100k/month for something better?"
  • If YES: Get their phone number. Tell them you'll show them in 2 weeks.

  OUTCOME: You know EXACTLY what problem you're solving.

PHASE 1 — CORE BACKEND (Week 3-4)
══════════════════════════════════
  GOAL: Working API that can handle orders.

  BUILD ORDER:
  1. Express server with one route: GET /health
  2. MongoDB connection (single database, one connection)
  3. User model + auth route (login, register)
  4. Product model + CRUD routes
  5. Order model + order creation route
  6. Payment model + Midtrans QRIS generation
  7. Order completion flow (create → pay → complete)
  8. Basic shift tracking

  DELIVERABLE: curl commands work end-to-end.

PHASE 2 — MINIMAL FRONTEND (Week 5-6)
══════════════════════════════════════
  GOAL: Cashier can use the POS.

  BUILD ORDER:
  1. Login page (email + password)
  2. POS page (product grid from API)
  3. Cart panel (add items, see total)
  4. Payment modal (choose cash or QRIS)
  5. QRIS QR code display + poll for completion
  6. Cash payment (enter amount, show change)
  7. Receipt display (browser print)

  DELIVERABLE: First test transaction end-to-end.
  (Open browser → login → click products → pay → receipt printed)

PHASE 3 — MANAGEMENT FEATURES (Week 7-8)
══════════════════════════════════════════
  GOAL: Owner can manage the store.

  BUILD ORDER:
  1. Product list page (with search)
  2. Product form (add/edit)
  3. Order list page (filter by date)
  4. Daily sales summary
  5. Shift open/close flow
  6. Basic stock tracking (show on POS)

  DELIVERABLE: Owner can add products, see sales, close shift.

PHASE 4 — FIRST CUSTOMER DEPLOYMENT (Week 9-10)
═════════════════════════════════════════════════
  GOAL: A real store uses your system.

  ACTIONS:
  1. Deploy to cheapest VPS ($6/month)
  2. Set up domain + SSL (Let's Encrypt)
  3. Deploy with PM2 (not Docker for now)
  4. Onboard first customer (sit with them for 1 day)
  5. Fix everything they complain about
  6. Watch them use it. Take notes.

  DELIVERABLE: First paying customer.

PHASE 5 — ITERATE (Week 11+)
═════════════════════════════
  GOAL: Keep existing customers happy, get more.

  BUILD IN THIS ORDER (customer-driven):
  1. Fix bugs (they WILL find bugs)
  2. Missing features they ask for
  3. Small quality-of-life improvements
  4. ONLY THEN: build new features from your roadmap

  Note: Phase 5 IS the product. Everything before was preparation.
```

### 3.2 Time Budget

```
WEEK     PHASE               HOURS/DAY     FOCUS
────  ──────────────  ────────────────  ──────────────────────────────
1-2   Validation      2-3                Talk to customers
3-4   Backend         6-8                Build API
5-6   Frontend        6-8                Build POS UI
7-8   Features        6-8                Management + shifts
9-10  First customer  8-10               Deploy + support
11+   Iterate         4-6                Fix + improve + sell

TOTAL TO MVP: 8-10 WEEKS. NOT 6 MONTHS.

If you're not done in 10 weeks, cut more features.
Your MVP is already too big. Cut until it fits in 10 weeks.
```

---

## 4. What NOT to Build

### 4.1 The "Not Now" List

```
EVERYTHING BELOW IS FORBIDDEN UNTIL YOU HAVE 10 PAYING CUSTOMERS:
═══════════════════════════════════════════════════════════════════

ARCHITECTURE OVERHEAD:
───────────────────────
  ❌ Separate worker process (API process handles queues)
  ❌ Separate Socket.IO server (polling is fine for MVP)
  ❌ BullMQ (in-process queue or just direct execution)
  ❌ Redis (unless you need it for Midtrans session — even then, in-memory map works)
  ❌ Event bus (direct function calls between services)
  ❌ Outbox pattern (just publish synchronously)
  ❌ Dead letter queue (if it fails, log the error and show the user)
  ❌ CQRS (just use the same model for read and write)
  ❌ Repository pattern (Mongoose models directly)
  ❌ DI container (just import what you need)
  ❌ Domain events (just update the data directly)
  ❌ Saga pattern (if payment succeeds, deduct stock. If it fails, don't.)

DATABASE:
─────────
  ❌ Database-per-tenant (single database with tenantId field)
  ❌ MongoDB replica set (single instance)
  ❌ Event store collection
  ❌ Outbox collection
  ❌ Separate audit log collection (log to file, not DB)

INFRASTRUCTURE:
───────────────
  ❌ Docker (PM2 or just node server.js)
  ❌ Docker Compose
  ❌ Kubernetes
  ❌ Terraform / Ansible
  ❌ CI/CD pipeline (git push → ssh → pm2 restart)
  ❌ Prometheus + Grafana (console.log + pm2 monit)
  ❌ Loki + Promtail (just log to file with timestamp)
  ❌ S3-compatible storage (save files to local disk)
  ❌ Load balancer (1 server, 1 process)
  ❌ SSL via Nginx (use Express directly with Let's Encrypt cert)

FRONTEND:
─────────
  ❌ React Query / TanStack Query (useState + useEffect + fetch)
  ❌ Zustand (just prop drilling or context)
  ❌ PWA service worker
  ❌ Offline support (show "no internet" message)
  ❌ Electron desktop app (browser is fine)
  ❌ Capacitor mobile app (browser on phone is fine)
  ❌ Design system (just use Tailwind utility classes)
  ❌ Storybook
  ❌ E2E tests (Playwright)

BUSINESS FEATURES:
──────────────────
  ❌ Restaurant module (tables, kitchen, waiter)
  ❌ Hospitality module (booking, housekeeping)
  ❌ Multi-tenant SaaS admin (admin panel for you)
  ❌ Customer management (name + phone is enough)
  ❌ Loyalty points
  ❌ Coupon / discount system
  ❌ Multi-warehouse inventory
  ❌ Purchase orders
  ❌ Supplier management
  ❌ Barcode scanner integration
  ❌ WhatsApp notifications (show on screen, cashier sends manually)
  ❌ Email notifications
  ❌ n8n automation
  ❌ Advanced reporting (just show numbers, no charts)
  ❌ Data export (CSV)
  ❌ Multi-language
  ❌ Tax calculation (fixed 11% if needed, not configurable)
  ❌ Audit log UI
  ❌ User permissions (one role: owner)
  ❌ Multiple payment gateways (Midtrans QRIS only)
  ❌ Refund flow (just cancel order + give cash back)

TESTING:
────────
  ❌ Unit tests (for MVP)
  ❌ Integration tests (for MVP)
  ❌ E2E tests (for MVP)
  ❌ Test coverage requirements
  ❌ Test CI pipeline

  Yes, really. For the first 10 weeks, testing = manual testing.
  You are the QA team. You have 0 users. If something breaks, fix it.
  Add tests in Phase 5 when customers depend on stability.
```

### 4.2 Why These Decisions Are Correct

```
OBJECTION: "But what about future scalability?"

RESPONSE:
  • You have 0 customers. Scalability is irrelevant.
  • When you have 100 customers, you can refactor in a weekend.
  • Every hour you spend on "scalability" is an hour NOT finding customers.
  • The architecture documents exist. You know the right way. Build it LATER.

OBJECTION: "But without tests, things will break!"

RESPONSE:
  • Things WILL break. That's fine. You have 1 customer.
  • They call you. You fix it in 10 minutes. They're happy.
  • Writing tests BEFORE you have customers is premature optimization.
  • When you have 10 customers, write tests for the critical paths.

OBJECTION: "But the code will be messy!"

RESPONSE:
  • Good. The first version SHOULD be messy.
  • Messy code that customers use is INFINITELY better than
    clean code that nobody uses.
  • You'll rewrite it when you know what customers actually need.
```

---

## 5. Testing Strategy

### 5.1 MVP Testing (Phase 1-4)

```
TESTING PHILOSOPHY FOR SOLO DEVELOPER MVP:
════════════════════════════════════════════

  YOU DO NOT NEED AUTOMATED TESTS FOR MVP.

  WHY:
  ───
  • You have 0 users. If something breaks, nobody notices.
  • Manual testing is faster to write than automated tests.
  • Every hour writing tests is an hour not building features customers need.
  • You WILL rewrite most code anyway when you learn what customers need.

  WHAT TO DO INSTEAD:
  ───────────────────
  1. Test manually after every feature
     • Open Postman (or browser) and click through the flow
     • Takes 5 minutes
     • Catches 90% of bugs

  2. Add console.log statements
     • Log every API request: method, path, status, duration
     • Log every error with stack trace
     • When something breaks, you can trace it from the logs

  3. Keep a test document
     • Google Doc with test scenarios
     • "Create order → pay cash → verify stock decremented"
     • Run through it before deploying

  4. Use TypeScript
     • TypeScript catches 50% of bugs at compile time
     • This is your best "test" for MVP
```

### 5.2 Testing After MVP (Phase 5+)

```
WHEN TO ADD TESTS:
──────────────────

  Add tests WHEN (and only when):
    1. You have 5+ paying customers
    2. A bug caused a real problem (lost data, incorrect totals)
    3. You're tired of manually testing the same flow repeatedly

  WHAT TO TEST FIRST:
  ───────────────────
  1. Payment flow (money-related — highest risk)
     • Create order → Pay QRIS → Verify Midtrans callback
     • Create order → Pay cash → Verify change calculation

  2. Order creation
     • Product selection, quantity, total calculation

  3. Stock deduction
     • Order paid → stock decreases
     • Order cancelled → stock increases

TESTING STACK TO ADD (in order):
─────────────────────────────────
  1. Vitest (faster than Jest, works with Vite)
     • Unit tests for utility functions (price calculation, formatters)

  2. Supertest (HTTP integration tests)
     • Test API endpoints with real MongoDB (test database)
     • Test: create product → create order → verify response

  3. Playwright (E2E tests — only for critical paths)
     • Login → Create order → Pay → Verify receipt
     • Run before every deployment
```

### 5.3 Manual Testing Checklist

```
BEFORE EVERY DEPLOYMENT (MVP):
═══════════════════════════════

  AUTH:
  □ Can register new account
  □ Can login with registered account
  □ Invalid login returns error

  PRODUCTS:
  □ Can create product (name + price)
  □ Created product appears in POS grid
  □ Can edit product price
  □ Deleted product disappears from POS

  ORDERS:
  □ Can select products and see in cart
  □ Total calculates correctly
  □ Can remove item from cart
  □ Can cancel order

  PAYMENT:
  □ Cash: enter amount, verify change
  □ QRIS: QR code displays, poll works
  □ Payment completed → order status = paid

  STOCK:
  □ Stock decrements after paid order
  □ Product shows "out of stock" when stock = 0

  SHIFT:
  □ Can open shift with starting balance
  □ Can close shift, verify totals

  REPORT:
  □ Today's sales shows correct total
  □ Order list shows today's orders
```

---

## 6. Technical Debt Strategy

### 6.1 Acceptable vs Unacceptable Debt

```
ACCEPTABLE DEBT (take it, move fast):
══════════════════════════════════════
  ✅ No automated tests
  ✅ No separation of concerns (fat controllers)
  ✅ No error handling on every line (catch at top level)
  ✅ Hardcoded config values
  ✅ No pagination on lists
  ✅ Direct Mongoose calls in route handlers
  ✅ No input validation beyond TypeScript
  ✅ No logging library (console.log is fine)
  ✅ Single database, single collection for all tenants
  ✅ No proper error responses (just { error: message })
  ✅ No TypeScript strict mode
  ✅ Inline styles in JSX (no CSS modules)
  ✅ No loading states (just wait)
  ✅ No type definitions (any is fine for MVP)

  REASON: These save hours per feature and are easy to fix later.
  Fix them when you have customers and they complain about specific issues.

UNACCEPTABLE DEBT (fix it NOW):
════════════════════════════════
  ❌ Plaintext passwords (use bcrypt)
  ❌ No authentication on API routes
  ❌ SQL injection / NoSQL injection vulnerabilities
  ❌ Storing Midtrans secret key in client-side code
  ❌ Trusting client-side price/amount for payment
  ❌ No input sanitization (XSS)
  ❌ No data validation before database write
  ❌ Not recording financial transactions immutably

  REASON: These cause REAL damage (data loss, financial issues, security).
  Fix these as you build, not later.
```

### 6.2 Refactoring Schedule

```
WEEK 1-10  — NO REFACTORING. Just ship.
  ────────────
  If code works, leave it. Don't clean it. Don't optimize it.
  Ship feature → move to next feature.

WEEK 11-12 — FIRST REFACTORING SPRINT
  ────────────
  After first customer is using the system:
  1. Refactor payment flow (highest risk, most important to get right)
  2. Add basic error handling (catch + log + return friendly message)
  3. Move config to .env (hardcoded values are annoying now)
  4. Add pagination if lists are slow

WEEK 20+   — REGULAR REFACTORING CADENCE
  ────────────
  Every 4-6 weeks, spend 1 day on technical debt.
  Fix what's causing the most pain RIGHT NOW.
  Not what "might" cause pain in the future.
```

### 6.3 Code Review (for yourself)

```
SELF-CODE-REVIEW CHECKLIST:
═══════════════════════════

  Before considering a feature "done":

  1. READ YOUR OWN CODE
     • Would you understand this in 2 weeks?
     • If not, add a comment (yes, comments are OK for solo dev)

  2. CHECK FOR HARDCODED VALUES
     • Move to constants file or .env
     • Exception: MVP hardcoded values are OK

  3. CHECK FOR ERROR HANDLING
     • What happens if MongoDB is down?
     • What happens if Midtrans API returns error?
     • What happens if user sends invalid data?
     • For MVP: try/catch around every route handler, return { error }

  4. CHECK FOR SECURITY
     • Did I expose the Midtrans secret key?
     • Did I trust user input for price/amount?
     • Did I validate the request body?

  5. COMMIT AND MOVE ON
     • Don't over-polish. Don't refactor. Don't optimize.
     • Write commit message that explains WHY, not WHAT.
     • Push. Deploy. Get feedback.
```

### 6.4 Dependency Management

```
RULES FOR ADDING DEPENDENCIES:
═══════════════════════════════

  For every npm package, ask:
    "Can I write this in 50 lines of code myself?"

  If YES:
    • Write it yourself.
    • One less dependency to manage.
    • One less vulnerability to track.
    • One less breaking change to handle.

  If NO (it's complex, well-maintained, and essential):
    • Use it.
    • Pin the exact version.
    • Check for updates monthly.

  MVP DEPENDENCIES:
  ──────────────────
  express          ✅ (web framework — essential)
  mongoose         ✅ (MongoDB ODM — essential)
  jsonwebtoken     ✅ (JWT — essential)
  bcryptjs         ✅ (password hashing — essential)
  cors             ✅ (CORS — essential, write in 10 lines but use it)
  dotenv           ✅ (env vars — essential)
  axios            ✅ (HTTP client for Midtrans — essential)
  zod              ✅ (validation — saves time)
  react            ✅ (UI — essential)
  react-dom        ✅ (essential)
  vite             ✅ (build tool — essential)
  tailwindcss      ✅ (styling — essential)
  react-router     ✅ (routing — essential)

  AVOID FOR MVP:
  ──────────────
  bullmq           ❌ (in-process queue is simpler)
  ioredis          ❌ (no Redis needed for MVP)
  socket.io        ❌ (polling is fine)
  winston/pino     ❌ (console.log is fine)
  prom-client      ❌ (no monitoring needed)
  aws-sdk          ❌ (no S3 needed)
  node-cron        ❌ (setTimeout is fine for MVP)
  agendajs         ❌ (no scheduled jobs needed)
  helmet           ❌ (security header — nice to have, not essential)
  compression      ❌ (1 user doesn't need compression)
  rate-limiter     ❌ (1 user can't DOS themselves)
  express-validator ❌ (zod covers this)
  multer           ❌ (no file uploads in MVP)
  sharp            ❌ (no image processing)
  pino-pretty      ❌ (console.log is fine)
```

---

## 7. Solo Developer Strategy

### 7.1 Avoiding Burnout

```
SOLO DEVELOPER REALITIES:
══════════════════════════

  YOUR LIMITING FACTOR IS ENERGY, NOT TIME.
  ──────────────────────────────────────────
  You can work 16 hours/day for 1 week.
  You can work 8 hours/day for 4 weeks.
  You can work 4 hours/day for 12 weeks.

  The MVP takes 10 weeks. You need a SUSTAINABLE pace.

  RULES:
  ──────
  1. Work 4-6 hours of REAL coding per day
     • Not "sitting at computer" — actual focused coding
     • The other 2-4 hours are: thinking, reading, planning

  2. Take Sunday OFF completely
     • No coding. No thinking about code. No reading about code.
     • Your brain needs to rest to solve hard problems.

  3. Stop at 6 PM
     • Coding after 6 PM creates bugs.
     • Bugs found at 11 PM take 3x longer to fix.

  4. When stuck, go for a walk
     • Walking solves more problems than staring at code.
     • Seriously. Try it.

  5. ONE feature at a time
     • Do NOT multitask.
     • "Finish" means: deployed and working.
     • Do not start Feature B until Feature A is deployed.
```

### 7.2 Decision Framework

```
WHEN FACING A DECISION:
════════════════════════

  STEP 1: Ask "Does this matter for my first customer?"
    NO → Skip it.
    YES → Continue.

  STEP 2: Ask "Is there a simpler way?"
    • "Should I use Redis?" → "Can I use a JavaScript Map?"
    • "Should I use BullMQ?" → "Can I use setTimeout + array?"
    • "Should I use Docker?" → "Can I use PM2?"
    • "Should I use Socket.IO?" → "Can I use polling?"
    • "Should I use React Query?" → "Can I use fetch in useEffect?"

  STEP 3: Ask "Can I postpone this?"
    • If it works without it today, postpone it.
    • You can always add it later.
    • Adding things is easy. Removing things is hard.

  STEP 4: Do the simplest thing
    • Write the code.
    • Deploy it.
    • If it breaks, fix it.
    • If it's slow, optimize it.
    • Don't solve problems you don't have yet.
```

### 7.3 What a Typical Day Looks Like

```
SOLO DEVELOPER DAILY RHYTHM:
═════════════════════════════

  07:00 - 08:00  Wake up, coffee, check messages
  08:00 - 09:00  Plan today's ONE feature
                 • What am I building?
                 • What's the simplest version?
                 • What could go wrong?

  09:00 - 12:00  BUILD (3 focused hours)
                 • No phone. No email. No social media.
                 • Just code.

  12:00 - 13:00  Lunch break (walk outside)

  13:00 - 15:00  BUILD (2 focused hours)
                 • Finish the feature
                 • Manual test
                 • Deploy

  15:00 - 17:00  Flexible time
                 • Fix bugs found during testing
                 • Answer any customer messages
                 • Learn something new (30 min)
                 • Write documentation / notes

  17:00          STOP. Done for the day.
                 • Log what you built today
                 • Write tomorrow's plan (one sentence)
                 • Close laptop

  5-6 hours of real coding per day.
  In 10 weeks: 300-360 hours of focused work.
  That is MORE than enough for a solid MVP.
```

### 7.4 When to Ask for Help

```
ASK FOR HELP WHEN:
═══════════════════

  YOU'RE STUCK ON THE SAME PROBLEM FOR > 4 HOURS
  ────────────────────────────────────────────────
  • Post on Stack Overflow (include minimal reproduction)
  • Ask in a Discord community (Express.js, MongoDB, React)
  • Take a break first (walk, sleep, come back fresh)

  THE PROBLEM IS OUTSIDE YOUR EXPERTISE
  ──────────────────────────────────────
  • Payment integration issues → Midtrans docs + support
  • Deployment/Nginx issues → DigitalOcean tutorials
  • Complex database queries → MongoDB community

  YOU NEED ACCOUNTABILITY
  ────────────────────────
  • Find a "solo dev buddy" (another solo founder)
  • Weekly 15-minute call: "What did you ship this week?"
  • Knowing someone will ask keeps you accountable
```

---

## 8. Product Validation Strategy

### 8.1 Validate BEFORE Writing Code

```
WEEK 1-2: TALK TO 5 UMKM OWNERS
═════════════════════════════════

  FIND THEM:
  ─────────
  • Go to a traditional market (pasar)
  • Go to a food court
  • Go to small shops in your neighborhood
  • Ask friends/family if they know store owners

  ASK THESE QUESTIONS:
  ────────────────────
  1. "How do you record sales now?"
     • Buku catatan? Kertas? HP notes? Already using software?
     • If they already use software → they're not your customer

  2. "What's the most frustrating thing about your current system?"
     • Listen for pain points, not feature requests
     • "Susah hitung total" → POS with auto-calc
     • "Susah liat untung" → Basic reporting
     • "Pelanggan minta QRIS" → Midtrans integration

  3. "If I build something that fixes this, would you try it?"
     • If they hesitate → not a real problem
     • If they say yes → "Can I show you a demo in 2 weeks?"

  4. "Would you pay Rp 100,000/month for it?"
     • If they say no → ask what they WOULD pay
     • If they say yes → "Great, I'll build it. You're my first customer."

  SIGNS YOU'RE ON THE RIGHT TRACK:
  ────────────────────────────────
  • They tell you about their CURRENT pain without prompting
  • They ask "when can I use it?"
  • They offer to pay upfront

  SIGNS YOU'RE BUILDING THE WRONG THING:
  ──────────────────────────────────────
  • They don't understand why they need it
  • They say "maybe" or "I'll think about it"
  • They're happy with their current system (notebook + calculator)
```

### 8.2 Fake Door Test (Before Building)

```
BEFORE WRITING A SINGLE LINE OF CODE:
══════════════════════════════════════

  1. Create a landing page (1 hour with Tailwind):
     • Headline: "POS Digital untuk UMKM — Rp 100rb/bulan"
     • Features: 3 bullet points (not 20)
     • "Daftar Sekarang" button

  2. Run Facebook/Instagram ad (Rp 50,000/day for 3 days):
     • Target: Indonesian small business owners
     • Budget: Rp 150,000 total ($10)

  3. Measure:
     • How many people click the button?
     • How many fill out the form?
     • How many respond when you follow up?

  IF < 10 people sign up → Your messaging or pricing is wrong. Iterate.
  IF > 10 people sign up → You have demand. Build for them.

  Note: You don't need a real product yet. Just see if people are interested.
  This is called "fake door testing" and it saves months of wasted effort.
```

### 8.3 Pilot Customer Program

```
YOUR FIRST 3 CUSTOMERS:
════════════════════════

  TERMS:
  ──────
  • Free for the first 3 months (or until you fix all their bugs)
  • They agree to:
    1. Use the system for ALL transactions (no notebook backup)
    2. Give feedback every week (15 min call)
    3. Report any bugs immediately
    4. Allow you to sit in their store and observe

  WHAT YOU GET:
  ─────────────
  • REAL usage data (what features do they actually use?)
  • REAL bugs (you'll find things you never expected)
  • REAL testimonials (for selling to next customers)
  • REAL revenue insights (what features justify the price?)

  WHAT THEY GET:
  ──────────────
  • Free POS system that saves them time
  • Direct access to the developer (you fix things in hours, not weeks)
  • They shape the product (their feedback becomes features)

  AFTER 3 MONTHS:
  ───────────────
  • If they're happy → convert to paid (maybe they even insist on paying earlier)
  • If they're not happy → fix the problems, extend free period
  • Either way → you learned what works
```

### 8.4 Pricing Strategy

```
UMKM PRICING IN INDONESIA:
═══════════════════════════

  REFERENCE POINTS:
  ─────────────────
  • Buku catatan + kalkulator: Rp 0
  • Excel: Rp 0 (if they already have laptop)
  • Moka POS: Rp 250,000 - 500,000/bulan
  • IPOS: Rp 500,000 - 2,000,000 (one-time)
  • Kledo: Rp 100,000 - 300,000/bulan

  SUGGESTED PRICING:
  ──────────────────
  • Rp 100,000/bulan  (~$7/month)
  • Atau Rp 1,000,000/tahun (~$70/year) — diskon 2 bulan

  WHY THIS PRICE:
  ───────────────
  • Under Moka/IPOS — easy decision to switch
  • Above "free" — they take it seriously (free = no commitment)
  • Affordable for UMKM — 1-2x makan di warteg
  • Profitable at 50 customers (~$350/month > infra costs)

  WHEN TO RAISE PRICES:
  ─────────────────────
  • When you have features competitors don't (offline, restaurant, etc.)
  • When you have 100+ customers and proven value
  • When customers say "this is too cheap" (seriously, they will)
```

---

## 9. Cost Optimization Strategy

### 9.1 MVP Infrastructure (Months 1-6)

```
MONTHLY COST TARGET: $10-20/month
══════════════════════════════════

  SERVER:
  ───────
  • 1 VPS from DigitalOcean / Hetzner / Vultr
  • Cheapest plan: 1 vCPU, 1GB RAM, 25GB SSD
  • Cost: $4-6/month
  • What runs on it: Express API + React build (served as static files)
  • PM2 process manager (NOT Docker)

  DATABASE:
  ─────────
  • MongoDB Atlas free tier (512MB storage)
  • Or: MongoDB on same VPS (saves $0, but simpler)
  • Cost: $0
  • Single database (not per-tenant)

  DOMAIN:
  ───────
  • 1 domain: posmono.app (or similar)
  • Cost: $10/year = ~$1/month
  • SSL via Let's Encrypt (free)

  EXTERNAL SERVICES:
  ──────────────────
  • Midtrans: free to integrate (they take % per transaction)
  • GitHub: free
  • Cloudflare: free tier (DNS + DDoS protection)
  • Sentry: free tier (error tracking — nice to have)

  TOTAL MONTHLY COST: ~$7-10/month
  ──────────────────────────────────
  That's less than a domain coffee every day.

  Compare this to the architecture you designed:
  • 3 VPS × $80 = $240/month
  • S3 storage = $10/month
  • MongoDB Atlas = $57/month
  • Redis = $15/month
  
  Your designed infrastructure is $322/month.
  Your MVP needs $7-10/month.
  Save $300/month until you have customers.
```

### 9.2 What to Delay (Cost Reasons)

```
SERVICE              MONTHLY COST    DELAY UNTIL
──────────────────  ──────────────  ────────────────────────
Redis                  $0-15          After 10 customers
                                     (if you need queues)
Docker + Compose      $0             After 5 customers
                                     (when you need repeatable deploys)
MongoDB Atlas         $57            After 20 customers
                                     (when single VPS is not enough)
2nd VPS               $80            After 50 customers
                                     (when you need HA)
S3 storage            $10            After 100 customers
                                     (when local disk is full)
SSL certificate       $0             Day 1 (Let's Encrypt is free)
Domain                $1             Day 1
Monitoring stack      $0             After 20 customers
(Prometheus/Grafana)                 (console.log is fine for now)
CI/CD pipeline        $0             After 10 customers
(GitHub Actions)                     (manual deploy is fine for now)
```

### 9.3 Extreme Cost Saving Tips

```
TIPS TO KEEP COSTS NEAR ZERO:
═════════════════════════════

  1. Serve frontend from the same Express server
     • Build React → put in backend/public/
     • Serve static files from Express
     • No separate CDN, no separate hosting

  2. Use SQLite instead of MongoDB (if you want $0 DB cost)
     • SQLite = no server process, just a file
     • better-sqlite3 is fast and simple
     • But MongoDB is fine on same VPS (MongoDB is $0)

  3. Use PM2, not Docker
     • PM2 starts on boot, restarts on crash, zero config
     • Docker adds complexity and resource overhead

  4. No Redis
     • In-memory Map for sessions
     • setTimeout for delayed tasks (print queue, etc.)
     • Redis is amazing, but you don't need it yet

  5. No file uploads
     • Products don't need images for MVP
     • Text-only POS is perfectly functional

  6. Deploy via git push + webhook
     • Simple script on server: git pull → pm2 restart
     • No CI/CD pipeline, no Docker registry

  7. Use Cloudflare free tier
     • DNS, DDoS protection, CDN cache
     • All free
```

### 9.4 When to Spend Money

```
SPEND MONEY WHEN (and only when):
══════════════════════════════════

  IT GENERATES REVENUE:
  ─────────────────────
  • Facebook/Instagram ads to find customers: Rp 50,000/day
  • Better domain name (if needed)
  • Printing flyers to distribute to stores

  IT PREVENTS CUSTOMER LOSS:
  ──────────────────────────
  • Server is too slow → Upgrade VPS ($20/month)
  • Database crashes → Upgrade to MongoDB Atlas ($57/month)
  • No backups → Add backup service ($5/month)

  IT SAVES YOU TIME (YOUR TIME IS VALUABLE):
  ───────────────────────────────────────────
  • Sentry error tracking: $0 (free tier)
  • Uptime monitoring: $0 (free tier — Better Uptime or similar)
  • Good IDE/license: $0 (VS Code is free)

  NOTE: Most "essential" tools have FREE tiers for solo developers.
  Don't pay for anything until you have paying customers.
```

---

## 10. First Customer Strategy

### 10.1 Finding Your First Customer

```
CHANNELS TO FIND FIRST 3 CUSTOMERS:
════════════════════════════════════

  CHANNEL 1: DIRECT WALK-IN (highest conversion)
  ────────────────────────────────────────────────
  • Go to warungs, coffee shops, small stores near you
  • Buy something first (build rapport)
  • Ask: "Mas/Mbak, catatannya masih pake buku?"
  • Show demo on your laptop
  • Offer free trial for 1 month

  CHANNEL 2: FAMILY & FRIENDS
  ────────────────────────────
  • Does anyone in your family own a small business?
  • Do your friends know store owners?
  • Offer: "I built this POS system. Can I set it up for free?"
  • Starting with someone who trusts you = safer first deployment

  CHANNEL 3: ONLINE COMMUNITIES
  ───────────────────────────────
  • Facebook groups: "UKM Indonesia", "Bisnis Online"
  • WhatsApp groups for small business owners
  • Post: "I built a POS system for UMKM. Free for first 10 users."
  • Include: what it does, screenshot, your WhatsApp number

  CHANNEL 4: PARTNERSHIPS
  ────────────────────────
  • Printer/computer shops that sell to UMKM
  • Offer: "Refer me to your customer who needs POS, I'll give you 10%"
  • Distributor sembako/kelontong — they visit 50 stores/day

  AVOID FOR FIRST CUSTOMER:
  ─────────────────────────
  • Cold email (nobody opens)
  • Instagram ads before product is validated
  • Landing page alone (UMKM don't search for "POS system")
```

### 10.2 First Customer Onboarding

```
ONBOARDING YOUR FIRST CUSTOMER:
════════════════════════════════

  DAY 1 — SETUP (1-2 hours in their store):
  ───────────────────────────────────────────
  • Bring your laptop (or use their computer)
  • Open browser → go to your app URL
  • Create their account (store name, owner name)
  • Input their products (ask them to tell you, you type)
  • Show them how to create an order
  • Have them try it themselves
  • Note: Don't judge their workflow. Just observe.

  DAY 2-3 — FIRST DAYS OF USAGE:
  ───────────────────────────────
  • Check in via WhatsApp: "How is it going?"
  • Fix any issues immediately (drop everything)
  • Note: Everything they do "wrong" is actually your design being wrong

  DAY 7 — FIRST REVIEW:
  ─────────────────────
  • Visit them again
  • Ask: "What do you like?" "What's annoying?" "What's missing?"
  • Show them ONE new feature (don't overwhelm)

  DAY 30 — CONVERSION:
  ────────────────────
  • If they're using it daily → ask for payment
  • If they're not using it → ask what's wrong
  • Either way: valuable data
```

### 10.3 Handling First Customer Requests

```
RULES FOR EARLY CUSTOMER REQUESTS:
═══════════════════════════════════

  CATEGORY 1: "This doesn't work" (BUG)
  ──────────────────────────────────────
  • Fix immediately (within hours)
  • This is your #1 priority
  • A bug for 1 customer is a bug for all future customers

  CATEGORY 2: "I need this feature to use your system" (BLOCKER)
  ───────────────────────────────────────────────────────────────
  • If 1 customer asks: build it (they might leave if you don't)
  • If 1 customer asks and it's very hard: tell them "2 weeks"
  • After building: ask yourself "Is this useful for other customers too?"

  CATEGORY 3: "It would be nice if..." (NICE TO HAVE)
  ────────────────────────────────────────────────────
  • Say: "Great idea! I'll add it to my list."
  • If 3+ customers ask for the same thing → build it
  • If only 1 customer asks → don't build it yet

  IMPORTANT: You are NOT a service provider building custom features.
  You are building a PRODUCT. Every feature should serve MULTIPLE customers.
```

---

## 11. Final MVP Architecture

### 11.1 Simplified System Architecture

```
                      MVP ARCHITECTURE
                      ════════════════

┌──────────────────────────────────────────────────────┐
│                 SINGLE VPS ($6/month)                 │
│                                                       │
│  PM2 ── manages 2 processes:                         │
│                                                       │
│  ┌─────────────────────────────────────────────┐     │
│  │  PROCESS 1: Express API (api/index.js)       │     │
│  │                                              │     │
│  │  │  GET  /api/health                         │     │
│  │  │  POST /api/auth/login                     │     │
│  │  │  POST /api/auth/register                  │     │
│  │  │  GET  /api/products                       │     │
│  │  │  POST /api/products                       │     │
│  │  │  PUT  /api/products/:id                   │     │
│  │  │  DELETE /api/products/:id                 │     │
│  │  │  POST /api/orders                         │     │
│  │  │  GET  /api/orders                         │     │
│  │  │  GET  /api/orders/:id                     │     │
│  │  │  POST /api/orders/:id/pay                 │     │
│  │  │  POST /api/midtrans/webhook               │     │
│  │  │  GET  /api/shifts/current                 │     │
│  │  │  POST /api/shifts/open                    │     │
│  │  │  POST /api/shifts/close                   │     │
│  │  │  GET  /api/reports/daily                  │     │
│  │  │                                              │     │
│  │  │  // Also serves React static build           │     │
│  │  │  app.use(express.static('public'))           │     │
│  └─────────────────────────────────────────────┘     │
│                                                       │
│  ┌─────────────────────────────────────────────┐     │
│  │  DATABASE: MongoDB (local)                   │     │
│  │                                              │     │
│  │  Collections:                                │     │
│  │  • users          ({ email, password, name })│     │
│  │  • products       ({ name, price, stock })   │     │
│  │  • orders         ({ items, total, status }) │     │
│  │  • payments       ({ orderId, amount, method })│   │
│  │  • shifts         ({ cashierId, balance })   │     │
│  └─────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────┘

FRONTEND (React SPA, served by Express):
══════════════
  / → Login → /pos (main POS page)
  /pos      → Product grid + cart + payment
  /orders   → Order history
  /products → Product management
  /reports  → Daily sales
  /shift    → Open/close shift

EXTERNAL:
═════════
  Midtrans API → for QRIS payment processing
  Let's Encrypt → free SSL certificate
```

### 11.2 Code Organization

```
posmono/
│
├── backend/
│   ├── src/
│   │   ├── index.js              ← Express app entry point (serve + API)
│   │   ├── config.js             ← .env config
│   │   ├── db.js                 ← MongoDB connection
│   │   │
│   │   ├── middleware/
│   │   │   └── auth.js           ← JWT verification
│   │   │
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Product.js
│   │   │   ├── Order.js
│   │   │   ├── Payment.js
│   │   │   └── Shift.js
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── products.js
│   │   │   ├── orders.js
│   │   │   ├── payments.js
│   │   │   ├── shifts.js
│   │   │   └── reports.js
│   │   │
│   │   └── services/
│   │       └── midtrans.js       ← Midtrans API client
│   │
│   ├── public/                   ← React build output
│   ├── package.json
│   └── ecosystem.config.js       ← PM2 config
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── PosPage.jsx
│   │   │   ├── ProductListPage.jsx
│   │   │   ├── ProductFormPage.jsx
│   │   │   ├── OrderListPage.jsx
│   │   │   ├── ReportPage.jsx
│   │   │   └── ShiftPage.jsx
│   │   ├── components/
│   │   │   ├── ProductGrid.jsx
│   │   │   ├── CartPanel.jsx
│   │   │   ├── PaymentModal.jsx
│   │   │   └── ReceiptView.jsx
│   │   └── api.js                ← fetch wrapper (not axios for MVP)
│   ├── package.json
│   └── vite.config.js
│
├── .env                          ← MONGO_URI, JWT_SECRET, MIDTRANS_KEY
├── .gitignore
├── package.json                  ← Root package.json (scripts for dev)
└── README.md
```

### 11.3 Key Simplifications from Enterprise Architecture

```
ENTERPRISE DESIGN                    →  MVP REALITY
═══════════════════════════════════════════════════════════════════
Multi-tenant SaaS with admin panel  →  Single tenant, manual setup
Database-per-tenant                 →  Single database with tenantId field
MongoDB replica set                 →  Single MongoDB instance
Redis for cache + queues            →  In-memory Map + setTimeout
BullMQ for background jobs          →  Direct execution in request handler
Separate worker process             →  Same process as API
Socket.IO for real-time             →  Polling (or nothing)
Event bus + outbox + DLQ            →  Direct function calls
CQRS + Repository pattern           →  Mongoose models directly
DI container (Awilix)               →  Direct imports
Domain events + aggregates          →  Just update the database
Saga orchestration                  →  If error, show error to user
Separate Socket.IO server           →  Not needed
S3 file storage                     →  Local disk (or no file uploads)
Docker + Docker Compose             →  PM2
Nginx reverse proxy                 →  Express serves everything
Prometheus + Grafana                →  console.log + pm2 monit
Loki + Promtail                     →  File logging with timestamp
CI/CD pipeline                      →  git pull → pm2 restart
Kubernetes                          →  You're not Google. You have 0 users.
Plugin runtime system               →  Just write code for features
Printer abstraction layer           →  Browser window.print()
Offline sync architecture           →  "No internet" message
Module manifest system              →  Not needed for 1 product
```

### 11.4 What You Lose (and Why It's OK)

```
YOU LOSE:                                   WHY IT'S OK:
──────────────────────────────────  ────────────────────────────────────────────
Zero-downtime deployments            You have 0 users. 10s downtime = nobody cares.
Horizontal scaling                   1 user doesn't need 10 servers.
Automatic failover                   You can restart the server manually in 2 min.
Data isolation per tenant            1 tenant = 1 database. Can migrate later.
Queued background jobs               Print receipt takes 100ms. No queue needed.
Real-time push notifications         Cashier refreshes the page. Works fine.
Full audit trail                     You have 1 user. Invoice is the audit trail.
Event sourcing replay                If data is lost, restore from backup.
Plugin system for modules            You're building 1 product. Not a platform.
Service independence                 One process = one deploy = one thing to monitor.
Microservice readiness               You will rewrite anyway when you have customers.

NONE OF THESE MATTER FOR MVP.
ALL OF THEM ARE SOLVED BY:
  1. Having customers (they tell you what matters)
  2. Having money (you pay for infrastructure)
  3. Having time (you refactor when needed)
```

### 11.5 Final Word

```
══════════════════════════════════════════════════════════════════
                    FINAL EXECUTION CHECKLIST
══════════════════════════════════════════════════════════════════

  BEFORE YOU BUILD:
  □ Talk to 5 UMKM owners (Week 1-2)
  □ Validate the problem is real
  □ Get 1 commitment: "I'll try it when it's ready"

  WHILE YOU BUILD (Week 3-10):
  □ 1 feature at a time
  □ Deploy after every feature
  □ No infrastructure that isn't essential
  □ No library you could write yourself in 50 lines
  □ No refactoring
  □ No premature optimization
  □ TypeScript only (catches 50% of bugs for free)

  AFTER FIRST SHIP (Week 10):
  □ First customer is using it daily
  □ You fixed every bug they found
  □ You know what to build next (they told you)

  REMEMBER:
  ────────
  • The architecture documents exist. You know the right path.
  • Build the WRONG path first (simple, messy, functional).
  • The RIGHT path (clean, scalable, enterprise) is for V2.
  • V1 ships in 10 weeks. V2 is forever.

  "The first 90% of the code accounts for the first 90% of
   the development time. The remaining 10% of the code accounts
   for the other 90% of the development time."
  — Tom Cargill, Bell Labs

  You've spent the first 90% of time designing.
  Now build the simple version in 10 weeks.
  The enterprise version will take the other 90%.

  START. SHIP. LEARN. ITERATE.
══════════════════════════════════════════════════════════════════
```

---

## Appendix: Comparison — Designed Architecture vs MVP

```
LAYER             DESIGNED ARCHITECTURE              MVP REALITY
────────────  ────────────────────────────────  ──────────────────────────────
Backend        Node.js + Express + TypeScript   Node.js + Express + JavaScript
               CQRS + Repository + DI            Direct Mongoose in routes
               Domain events + Saga              Function calls + try/catch
               BullMQ + Outbox + DLQ             Direct execution + error log
               Socket.IO + Redis                 Polling API calls

Frontend       React + TypeScript + Tailwind     React + JavaScript + Tailwind
               Zustand + React Query + PWA        useState + useEffect + fetch
               Capacitor + Electron              Browser-only
               Design system + Storybook          Tailwind utility classes

Database       MongoDB + per-tenant DB           MongoDB + single DB
               Replica set + sharding            Single instance
               Event store + audit log           Orders collection only
               Outbox collection                 No outbox

Infrastructure Docker + Compose + Swarm          PM2
               Nginx + Cloudflare + SSL          Express serves all
               Prometheus + Grafana + Loki       console.log
               S3 storage                        Local disk
               3+ VPS with load balancer         1 VPS ($6/month)

CI/CD          GitHub Actions + Docker Build     git pull + pm2 restart
               Blue-green deployment             Manual deploy
               Canary + rollback                 git revert + pm2 restart

Business       Multi-tenant SaaS admin           Single tenant, manual
               Restaurant module                 Not in MVP
               Hospitality module                Not in MVP
               Offline sync                      Not in MVP
               Plugin runtime                    1 product, no plugins
               n8n automation                    Not in MVP
               WhatsApp notifications            Not in MVP
               Loyalty points                    Not in MVP
               Customer management               Name + phone only
```
