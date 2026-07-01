# BACKLOG

> Features and modules NOT planned for MVP.
> Do NOT build anything on this list until MVP is live with real users.

---

## Priority Levels

| Label | Meaning |
|-------|---------|
| 🔴 DO NOT BUILD NOW | Explicitly deferred. Build only when MVP is validated. |
| 🟡 MEDIUM | Nice to have in next 6 months. |
| 🟢 LOW | Future consideration. |

---

## MVP Features (Status)

> See `PROJECT_ROADMAP.md` for detailed status.

- `[x]` POS cart engine
- `[x]` Checkout & order processing
- `[x]` Cash payment
- `[x]` Basic reporting (daily sales)
- `[x]` Bug fixing & polish
- `[~]` Receipt printing *(WIP — thermal integration pending)*
- `[~]` MVP deployment
- `[ ]` Barcode scanning
- `[ ]` Discount & promo engine
- `[ ]` Split bill
- `[ ]` Hold / recall order

---

## Post-MVP Features

### 🔴 DO NOT BUILD NOW — Restaurant Module

| Item | Priority | Notes |
|------|----------|-------|
| `[ ]` Kitchen display / printer | 🔴 | Requires thermal printer integration |
| `[ ]` Table management | 🔴 | Table mapping + floor plan |
| `[ ]` Online ordering | 🔴 | Customer-facing ordering portal |
| `[ ]` Menu management (variants) | 🔴 | Complicated by modifiers/groups |

### 🔴 DO NOT BUILD NOW — Villa / Hospitality Module

| Item | Priority | Notes |
|------|----------|-------|
| `[ ]` Reservation calendar | 🔴 | Date-range booking system |
| `[ ]` Check-in / check-out | 🔴 | Housekeeping workflow |
| `[ ]` Room management | 🔴 | Room inventory + status |
| `[ ]` Guest portal | 🔴 | Self-service for guests |

### 🔴 DO NOT BUILD NOW — Offline & Mobile

| Item | Priority | Notes |
|------|----------|-------|
| `[ ]` Offline-first architecture | 🔴 | Local-first with background sync — major engineering effort |
| `[ ]` Mobile app (Capacitor) | 🔴 | Wraps PWA; only if customers demand native |
| `[ ]` Desktop app (Electron) | 🔴 | Offline desktop POS; only if thermal printing requires it |

---

## Long-Term Features

### 🟡 MEDIUM — Payments & Commerce

| Item | Priority | Notes |
|------|----------|-------|
| `[ ]` QRIS payment | 🟡 | Standard QR code payment in Indonesia |
| `[ ]` GoPay / OVO integration | 🟡 | E-wallet integrations |
| `[ ]` Bank transfer auto-confirmation | 🟡 | Webhook-based confirmation |
| `[ ]` Invoice / billing portal | 🟡 | Customer-facing invoice portal |
| `[ ]` Subscription billing | 🟡 | Recurring billing for SaaS itself |

### 🟡 MEDIUM — Hardware Integration

| Item | Priority | Notes |
|------|----------|-------|
| `[ ]` Bluetooth ESC/POS printer | 🟡 | Portable receipt printing |
| `[ ]` Barcode scanner (hardware) | 🟡 | USB/Bluetooth scanner support |
| `[ ]` Cash drawer | 🟡 | Automatic drawer open on payment |
| `[ ]` Customer-facing display | 🟡 | Second screen for checkout |

### 🟢 LOW — Platform Features

| Item | Priority | Notes |
|------|----------|-------|
| `[ ]` Public REST API | 🟢 | For 3rd-party integrations |
| `[ ]` Webhook system | 🟢 | Push notifications to external services |
| `[ ]` Marketplace | 🟢 | App/plugin store |
| `[ ]` Plugin runtime | 🟢 | Isolated plugin sandbox |
| `[ ]` Multi-language (i18n) | 🟢 | English + Indonesian |
| `[ ]` Multi-currency | 🟢 | For tourism/hospitality |
| `[ ]` Theme system | 🟢 | Customizable UI themes |

### 🟢 LOW — AI & Automation

| Item | Priority | Notes |
|------|----------|-------|
| `[ ]` Auto stock reorder | 🟢 | ML-based reorder suggestions |
| `[ ]` Sales prediction | 🟢 | Predict slow/fast movers |
| `[ ]` Smart categorization | 🟢 | Auto-categorize products |
| `[ ]` Anomaly detection | 🟢 | Detect unusual transactions |
| `[ ]` Chatbot support | 🟢 | Customer service bot |

### 🟢 LOW — Analytics & Insights

| Item | Priority | Notes |
|------|----------|-------|
| `[ ]` Advanced reporting dashboard | 🟢 | Drill-down analytics |
| `[ ]` Export to PDF / Excel | 🟢 | Report exports |
| `[ ]` Email reports | 🟢 | Scheduled report delivery |
| `[ ]` Customer 360 view | 🟢 | Full customer history |
| `[ ]` Inventory forecasting | 🟢 | Predict stock needs |

---

## Future Modules (Architecture Stubs Exist)

| Module | Directory | Content | Status |
|--------|-----------|---------|--------|
| Retail | `backend/src/modules/retail/` | Manifest only | Stub |
| Restaurant | `backend/src/modules/restaurant/` | Manifest only | Stub |
| Hospitality | `backend/src/modules/hospitality/` | Manifest only | Stub |

These modules have placeholders in the codebase but ZERO implementation. They are ready for when the core platform stabilizes.

---

## Deleted / Cancelled Ideas

| Idea | Reason | Date |
|------|--------|------|
| *None yet* | | |

---

*Last updated: 2026-06-30*
