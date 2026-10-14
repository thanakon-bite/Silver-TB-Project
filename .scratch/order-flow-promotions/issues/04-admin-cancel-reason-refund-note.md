# 04: Admin cancels with a Cancel Reason (and refund); Admin Note column

**What to build:** On orders that are Awaiting Payment, Paid or Waiting Shipping, an Admin can Cancel through a dialog that requires a Cancel Reason. A paid order is refunded in full through Stripe first; if the refund fails, the order is left unchanged and the error is shown. Unpaid orders that run out of time are cancelled with the system reason "Payment time expired" (shown in the reader's language). Customers see the Cancel Reason on their order. The admin orders table has an inline-editable Admin Note column.

**Blocked by:** 01

**Status:** done

- [x] Cancel requires a reason; no Cancel on Shipping / Confirmed
- [x] Cancelling a Paid / Waiting Shipping order refunds via Stripe, then cancels; a failed refund leaves the order as is
- [x] Expired orders carry the system reason
- [x] The customer order detail shows the reason and refunded state
- [x] Admin Note visible and editable in the orders table
- [x] Tests at unit, HTTP and frontend seams (Stripe mocked)
