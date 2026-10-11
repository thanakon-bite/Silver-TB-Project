# 09: Notifications when an Order is Confirmed (+ LINE)

**What to build:** Customer confirms receipt -> every active Admin gets a bell Notification and the Owner gets a LINE message (ADR 0002 targets; a LINE failure is logged, never fails the request). Admin confirms for the customer -> the customer's bell. Automatic confirmation -> both the customer's and every Admin's bell, no LINE.

**Blocked by:** None (can start immediately)

**Status:** done (2026-10-11, uncommitted)

- [x] New notification types; order notification uniqueness includes the recipient
- [x] Trigger routes by confirmed_by as above
- [x] LINE message builder; sent only on customer confirm
- [x] Bell renders the new types TH/EN, linking to the Order
- [x] DB tests for each confirmed_by; unit test for the LINE message
