# 13: Announce new Promotions, then again when they start

**What to build:** When a Promotion is created (or first switched on) every active Customer is told it is coming, with its date range; on its start day they are told it has started. If both fall on the same Thai date only the start Notification is sent. Date edits never re-notify. The job runs right after create / switch-on, and on its interval.

**Blocked by:** 12

**Status:** done (2026-10-11, uncommitted)

- [x] Two-step announcement job, idempotent
- [x] Triggered after create and after update when switched on
- [x] Bell renders the 'coming' type with dates
- [x] DB tests: future start, same day, created off, re-run
