# 01: One Order Status field, used everywhere

**What to build:** Orders move through Awaiting Payment → Paid → Waiting Shipping → Shipping (and Cancelled) as one status, with no separate payment status. When Stripe confirms payment the order moves straight on to Waiting Shipping (until the LINE OA alert is automated). An Admin ships an order only by entering its Tracking Number. Customers and Admins see the same statuses, in Thai and English, on the order list, the order detail timeline (starting with "สั่งซื้อ") and the admin orders table, which can filter by the new statuses. Existing orders are converted by migration 005.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Migration 005 (status part) applies on top of 001–004, is idempotent, and converts pending/paid/shipped/delivered/cancelled to awaiting_payment/waiting_shipping/shipping/confirmed/cancelled, recording the refunded time for refunded orders
- [x] Payment status is gone from the schema, APIs and UI; refunded orders still show ยกเลิกและคืนเงินแล้ว
- [x] The verified Stripe webhook moves an order to Waiting Shipping (idempotent; the "payment after cancel" admin note still works); no person can set Paid
- [x] Only legal transitions are accepted; Ship requires a Tracking Number
- [x] Order list, order detail timeline and admin orders table show the new statuses in TH/EN; the admin status filter uses them
- [x] DB, unit, HTTP and frontend tests updated and green
