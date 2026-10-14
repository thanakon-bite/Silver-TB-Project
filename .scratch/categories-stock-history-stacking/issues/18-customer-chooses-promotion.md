# 18: Customer chooses the Order's Promotion option

**What to build:** One option for the whole Order (amended 2026-10-11, see ADR 0004): one Exclusive Promotion, or every Stackable Promotion together; products the option does not cover pay the normal price. When the Order has more than one option, the Cart page (`/cart`, opened from the drawer's expand icon) and the product modal show option cards with what each saves or gives, pre-selected on the best for the whole Order. The choice is remembered with the Cart (`stb_promotion_choice`) and sent as `promotion_choice` to price-preview and checkout; the server re-checks it and falls back to the best when missing or no longer valid.

**Blocked by:** 17, 03

**Status:** done (2026-10-11, uncommitted)

- [x] Option cards for the Order only when there is a choice, TH/EN (Cart page and product modal)
- [x] Choice persisted in the Cart and sent to pricing and checkout
- [x] Server validation and fallback
- [x] Page test and pricing test
