# BUG TRACKER

> Technical issues and regressions.

---

## Template

Use this template when reporting a new bug:

```markdown
---

### BUG-XXX

**Problem:**
*

**Severity:**
🔴 CRITICAL | 🟡 HIGH | 🟠 MEDIUM | 🟢 LOW

**Environment:**
Local | Staging | Production

**Steps to Reproduce:**
1.
2.
3.

**Expected Behavior:**
*

**Actual Behavior:**
*

**Possible Cause:**
*

**Workaround:**
*

**Status:**
OPEN | IN PROGRESS | FIXED | CANCELLED

**Reported:** YYYY-MM-DD
**Assigned:** YYYY-MM-DD
**Fixed:** YYYY-MM-DD
**Fixed in commit:** `abc1234`
```

---

## Active Bugs

*No active bugs yet.*

---

## Fixed Bugs

---

### BUG-001

**Problem:**
Promo not working in POS — auto-apply promos were not being evaluated because backend only ran discount engine when `promoCode` was provided.

**Severity:**
🔴 CRITICAL

**Environment:**
Local

**Steps to Reproduce:**
1. Create a promotion with auto-apply (no `requiresCode`)
2. Add items to POS cart
3. Observe no promo discount applied

**Expected Behavior:**
Auto-apply promos should be evaluated and applied to cart.

**Actual Behavior:**
No promo discount applied because `PaymentService` only called `DiscountServiceAdapter.apply()` when `promoCode` was provided.

**Root Cause:**
`PaymentService.processPayment()` had `if (promoCode)` guard around discount engine call.

**Fix:**
Removed `if (promoCode)` guard — discount engine is always called.

**Status:**
FIXED

**Reported:** 2026-07-26
**Fixed:** 2026-07-26

---

### BUG-002

**Problem:**
Promo sync to discount rules missing `promoCodeId` — POS couldn't validate promo codes for synced promotion rules.

**Severity:**
🟡 HIGH

**Environment:**
Local

**Steps to Reproduce:**
1. Create a promotion with `requiresCode: true` and a code
2. Try to apply promo code in POS
3. Observe validation failure

**Expected Behavior:**
POS should validate promo code against synced promotion rules.

**Actual Behavior:**
Validation failed because `promoCodeId` was not set on synced discount rules.

**Root Cause:**
`PromotionToDiscountMapper` did not set `promoCodeId` on synced rules.

**Fix:**
`PromotionToDiscountMapper` now sets `promoCodeId` on synced discount rules.

**Status:**
FIXED

**Reported:** 2026-07-26
**Fixed:** 2026-07-26

---

### BUG-003

**Problem:**
Decimal display artifacts (,6) in POS — `toLocaleString('id-ID')` produced floating point artifacts.

**Severity:**
🟠 MEDIUM

**Environment:**
Local

**Steps to Reproduce:**
1. Add items to cart
2. Observe prices showing decimals like Rp 10.000,6

**Expected Behavior:**
All monetary values should display as whole numbers (no decimals).

**Actual Behavior:**
Some values showed decimal artifacts from floating point arithmetic.

**Root Cause:**
`toLocaleString('id-ID')` was used without rounding, causing floating point display issues.

**Fix:**
Created `formatIDR` helper that rounds to integer before formatting. POS store now rounds all monetary values via `Math.round()`. All UI components use `formatIDR()`.

**Status:**
FIXED

**Reported:** 2026-07-26
**Fixed:** 2026-07-26

---

### BUG-004

**Problem:**
Manual percentage discount bug — backend converted frontend's manual percentage discount as nominal but then passed `discountType` again to tax engine causing double conversion.

**Severity:**
🟠 MEDIUM

**Environment:**
Local

**Steps to Reproduce:**
1. Apply 10% manual discount in POS
2. Check tax calculation
3. Observe incorrect tax amount

**Expected Behavior:**
Tax should be calculated on discounted amount.

**Actual Behavior:**
Tax was calculated incorrectly due to double conversion of discount type.

**Root Cause:**
`PaymentService` converted percentage to nominal but then passed `discountType: 'percentage'` to tax engine.

**Fix:**
Backend now always converts to nominal first and sends `discountType: 'nominal'` to tax engine.

**Status:**
FIXED

**Reported:** 2026-07-26
**Fixed:** 2026-07-26
