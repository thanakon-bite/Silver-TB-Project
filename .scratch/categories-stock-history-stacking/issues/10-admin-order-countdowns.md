# 10: Countdowns on the Admin order list

**What to build:** Awaiting Payment Orders count down to the end of their Reservation; Shipping Orders count down to automatic Confirmed (shipped + the auto-confirm days the job uses). Warning colour under 1 hour / 1 day respectively; when past, it reads as processing, never negative. Ticks live.

**Blocked by:** None (can start immediately)

**Status:** done (2026-10-11, uncommitted)

- [x] Admin order list returns the deadline for each relevant Order from the same day-count config the job uses
- [x] Countdown cell with warning colour and expired state, TH/EN
- [x] Page test with fake timers
