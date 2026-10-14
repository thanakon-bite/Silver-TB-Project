# 12: Notifications reference their Promotion by foreign key

**What to build:** Notifications get a promotion column with a foreign key to Promotions (cascade on delete), back-filled from the JSON data; a Customer gets each Promotion Notification type once.

**Blocked by:** None (can start immediately)

**Status:** done (2026-10-11, uncommitted)

- [x] Column, FK, back-fill and per-recipient uniqueness
- [x] Announcement job writes the column
- [x] Deleting an unredeemed Promotion removes its Notifications
- [x] DB test
