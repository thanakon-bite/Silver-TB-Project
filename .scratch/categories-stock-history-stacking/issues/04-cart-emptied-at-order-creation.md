# 04: Cart emptied when the Order is created

**What to build:** When the Customer continues to payment and the Order is created, the Cart empties at once (before redirecting to Stripe). From then on they pay or cancel from the Order. If Order creation fails, the Cart is untouched.

**Blocked by:** None (can start immediately)

**Status:** done (2026-10-11, uncommitted)

- [x] Cart is empty after a successful Order creation, before redirect
- [x] Cart unchanged after a failed Order creation
- [x] The old clear-on-paid in Order Detail is removed
- [x] Page test for success and failure
