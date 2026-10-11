# 18: Customer chooses a line's Promotion option

**What to build:** In the Cart, a line with more than one option shows a radio list (each Exclusive Promotion, or the Stackable set) with what each saves or gives, pre-selected on the best. The choice is remembered in the Cart and sent at checkout; the server re-checks it and falls back to the best when no longer valid.

**Blocked by:** 17, 03

**Status:** done (2026-10-11, uncommitted)

- [x] Radio list per line only when there is a choice, TH/EN
- [x] Choice persisted in the Cart and sent to pricing and checkout
- [x] Server validation and fallback
- [x] Page test and pricing test
