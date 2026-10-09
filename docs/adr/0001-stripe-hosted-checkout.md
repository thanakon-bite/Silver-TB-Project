# Pay through Stripe-hosted Checkout, not embedded Elements

Customers pay on Stripe's hosted Checkout page (card + PromptPay) instead of an embedded Payment Element. Stripe hosts the card and PromptPay QR UI, the frontend needs no Stripe key or SDK, and an order becomes Paid only from the signature-verified webhook (`checkout.session.completed` / `checkout.session.async_payment_succeeded`) via the idempotent `mark_order_paid` function.

## Consequences

- A Checkout Session must live at least 30 minutes (Stripe rule), longer than the default stock reservation. Creating a session extends the order's reservation to cover it, but never past 2 hours after the order was created, so nobody can park a one-of-a-kind beetle by reopening checkout.
- Before cancelling or expiring an unpaid order, the backend expires its Checkout Session so it can no longer be paid.
