# 17: Stackable / Exclusive Promotions: pricing

**What to build:** Admins mark each Promotion Stackable or Exclusive (default Exclusive; existing ones Exclusive; locked once redeemed like other benefit fields). An order line gets one Exclusive Promotion or all Stackable ones together, whichever is worth more, chosen automatically in Cart and at checkout. Stacked percentages compound, baht come straight off, never below zero, every Gift earned. One Redemption per Promotion an Order uses. See ADR 0004.

**Blocked by:** 14, 15

**Status:** done (2026-10-11, uncommitted)

- [x] Column with default and lock
- [x] Pricing module computes per-line options and picks the best; stack maths as above
- [x] Order creation records one Redemption per used Promotion; a used-up Promotion drops out of the stack
- [x] Editor radio and list tag
- [x] Pricing unit tests, DB test for redemptions
