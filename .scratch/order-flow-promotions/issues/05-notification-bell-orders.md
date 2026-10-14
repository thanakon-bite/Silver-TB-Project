# 05: Notification bell with order notifications

**What to build:** Signed-in Members see a bell next to the theme switch with an unread count. Customers get notifications when an order is Awaiting Payment, goes Shipping (with Tracking Number), is still unconfirmed 3 days after Shipping (asking them to confirm receipt), or is Cancelled (with the Cancel Reason). Clicking one marks it read and opens the order; "อ่านทั้งหมด" clears all. The bell polls about every 60 seconds while the tab is visible. Text follows the current language.

**Blocked by:** 02, 04

**Status:** done

- [x] Notifications table with RLS: members read and mark only their own
- [x] Each of the 4 order events creates exactly one notification
- [x] Bell hidden for guests; unread count, mark read, mark all read and navigation work
- [x] TH/EN text built from type + payload
- [x] Tests at DB, HTTP and frontend seams
