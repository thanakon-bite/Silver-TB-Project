# 15: Promotions a customer can no longer redeem are not shown to them

**What to build:** The running-Promotions endpoint leaves out Promotions the signed-in Customer has used up, and Promotions that reached their Customer cap for anyone who has not already redeemed within their own cap. Card badges disappear with them.

**Blocked by:** None (can start immediately)

**Status:** done (2026-10-11, uncommitted)

- [x] Endpoint reads the optional token and filters with the existing redemption rules
- [x] Frontend sends the token when signed in
- [x] Route tests for guest, used-up customer, full Promotion
