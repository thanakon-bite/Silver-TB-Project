# 06: Stock History

**What to build:** A history icon after the edit icon on each product opens its Stock History, newest first and paged. Every Stock Change is recorded in the same transaction as the number it changes: opening balance (one per existing product at upgrade), product created, Admin set On Hand (with who and note), Order created (Available down, Gift lines included), Order Cancelled (Available back), Order Confirmed (On Hand down). Each entry shows kind, time, actor, Order Number, note, and On Hand / Available after.

**Blocked by:** 05

**Status:** done (2026-10-11, uncommitted)

- [x] Stock Change table with opening rows for every existing product
- [x] Create / cancel / confirm / set-on-hand / product-create each write one row per product affected, with correct deltas and after-values
- [x] Admin-only paged history endpoint with Order Number and actor name
- [x] History modal on the stock screen, TH/EN
- [x] DB tests for every kind; route test for admin-only access
