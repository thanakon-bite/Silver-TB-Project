# Handoff: Silver Thief Bug, session 3 (2026-10-11)

Repo: `C:\Users\bitel\Desktop\FileME\Programing\silver-tb-project\Silver-TB-Project`, branch `fix/checkout-polish`.
**Nothing is committed. Do not commit or push (the user does). Reply in Thai.** Use CONTEXT.md terms. Never edit migrations 001–005; schema changes go in 006 (every UPDATE/DELETE needs a WHERE). Write a test for every change.

Read first: `C:\Users\bitel\AppData\Local\Temp\handoff-silver-tb-2026-10-11.md` (session 2), README.md, CONTEXT.md, design.md, docs/adr/0002, 0004, 0005, `.scratch/categories-stock-history-stacking/spec.md`.

## Done in session 3 (all tested; suites green at the last full run except the one open test below)

Round 1 (from the session-2 "Still open" list):
- LINE sent once per customer confirm: claim column `orders.received_notified_at` (006), `services/orders.js notifyAdminsOrderReceived`.
- "Add to cart" at the Available cap: card button says "ครบจำนวนแล้ว", product modal shows a note and stays open (`useAddToCart` in `component/products/ProductCard.tsx`, `pages/Products.tsx`).
- spec.md, ticket 18, CONTEXT.md updated to "one Promotion option for the whole Order".
- LINE Recipients (user request): table `line_contacts` (006), webhook learns 1:1 friends (`services/lineContacts.js`), Admin ticks recipients in Payments & LINE (`component/admin/AdminSettings.tsx`). ADR 0002 amended, CONTEXT "LINE Recipient", README.
- /code-review fixes: Promotion pick keyed per user and cleared with the Cart (`lib/promotionChoice.ts`, `CartContext`), option cards hidden when only one option; card says "ของแถมหมด" (`gift_out` in `lib/pricing.js`); `/rules/promotions` leaves out gift products with Available 0; Hero photo credit no longer under slide controls on phones; ticket 01 ticked.

Round 2 (user's latest list):
1. Delete a Notification: `DELETE /api/notifications/:id` (own only, returns `{unread}`), X button per item in `component/layout/NotificationBell.tsx`. Done.
2. Full Cart page shrinks back to the drawer: Minimize icon in `pages/CartPage.tsx` (returns to the page it was expanded from via router state `from`). Done.
3. Refunds paused: an Admin cancelling a Paid/Waiting Shipping order is a plain cancel. 006 `cancel_order` gets `p_keep_payment` (old 3-arg version dropped), `services/orders.js cancelPaidOrder`, `lib/orderStatus.js` (`paid` / `paid_on_cancel` replace `refund` / `refund_on_cancel`; `checkRefund` and `refundAndCancel` removed), AdminOrders shows a "not refunded automatically" note. Done. **CONTEXT.md (Cancelled, Refund) not yet updated for this.**
4. LINE list empty: cause is 006 not run + LINE webhooks can't reach localhost. Added "ดึงรายชื่อเพื่อนจาก LINE" (`POST /api/notifications/line/contacts/sync`, `line.getFollowerIds`; LINE allows it only for verified/premium OAs → 409 `LINE_FOLLOWERS_UNAVAILABLE` with advice). Done.
5. Recent Stripe events card rewritten as "Recent Stripe payments": readable event and result per row, order link `/admin?order=<id>`, amount, repeats/ignored behind "show all", empty state explains the webhook / `stripe listen`. Done.
6. Change password: `PasswordSection` in `pages/Account.tsx`, `changePassword(current, next)` in `contexts/AuthContext.tsx` (re-checks the current password with signInWithPassword), "forgot current" sends the reset email. Forgot password already existed (Login → /reset-password). **IN PROGRESS: `src/pages/Account.test.tsx` has 1 of 4 tests failing; find which and fix (likely the short/mismatch test or the success-notice text).**

## Status after the follow-up (same day, later)
All six "Still to do" items are done: Account test fixed; CONTEXT.md/README updated; `backend/src/db/scripts/clear_products.sql`, `seed_demo_products.sql` (100 products, 145 Wikimedia Commons photos, every URL checked 200) and `demo_photo_credits.md`, tested by `backend/test/db/demoData.test.mjs`; browser-checked bell delete, Cart shrink, paid-cancel note, LINE sync (this OA is not verified, so it shows the webhook advice), Stripe card, password form. Suites: backend 113, test:db 3 files, frontend 209, tsc clean. The temporary `-alt` entries in `.claude/launch.json` were removed.

## Still to do (original list, kept for reference)
1. Fix the failing Account test, then run every suite:
   - `cd backend && npm test` and `npm run test:db`
   - `cd frontend && npx tsc --noEmit -p .` and `CI=true npx react-scripts test --watchAll=false` (via react-scripts, not plain jest)
2. CONTEXT.md: Cancelled/Refund (refunds paused; Admin cancel of a paid order keeps the money, refund by hand in Stripe), Notification (a Member can delete their own), Cart (Cart page shrinks back to the drawer). README API table: `DELETE /api/notifications/:id`, `POST /line/contacts/sync`.
3. SQL script (not a migration), e.g. `backend/src/db/scripts/clear_products.sql`: delete all products. FKs: order_items.product_id ON DELETE SET NULL (orders keep their snapshot), favorites / promotion_products / promotion_gift_products / stock_changes cascade. Wrap in a transaction, every DELETE with a WHERE (e.g. `WHERE TRUE` is not allowed by pg-safeupdate; use `WHERE id IS NOT NULL`). Optional commented section to also clear orders. Images in Storage must be removed in the dashboard. Keep categories and beetle_families.
4. SQL seed of 100 realistic products (`backend/src/db/scripts/seed_demo_products.sql`) for a client demo: columns name, name_th, description, description_th, price, category (slug: beetle/food/log/gear), attributes (beetles only: family from beetle_families e.g. Rhinoceros/Stag/Flower, species, locality, sex male|female|pair|trio|unsexed, stage egg|L1|L2|L3|pupa|adult, size_mm), images TEXT[] (≤10, real working URLs; Wikimedia Commons `Special:FilePath/<file>` checked with curl, credit noted), on_hand = available, is_best_seller, is_active. The stock trigger writes a "created" Stock History entry on insert. Insert any missing families into beetle_families first.
5. Browser check (servers: `frontend-alt` on 3000 pointing at `backend-alt` on 5001 in `.claude/launch.json`; port 5000 is blocked by another chat's registration). The user must sign in (the 15-minute idle timer signs them out). Check: bell delete, Cart shrink, Admin cancel note, LINE sync button, Stripe card, Account password form.
6. Final summary in Thai: what is done, what is left, what the user must do.

## The user must do
- Re-run migration 006 in Supabase (idempotent): needed for line_contacts, received_notified_at, cancel_order with p_keep_payment, Realtime bell.
- LINE: set the Webhook URL (needs a public URL; ngrok when local) or use the sync button (verified/premium OA only).
- Stripe: webhook endpoint, or `stripe listen --forward-to localhost:5000/api/payments/webhook` locally.
- Decide: SweetAlert remove-confirm in the Cart (spec) vs design.md (no popups on customer pages).
- Commit; suggest separating the leftover "Round 5" work.

## Gotchas
- Files are mostly CRLF, some LF, a few mixed. Edit big changes with a Python script written by the Write tool (open with `newline=''`, keep each file's ending). Bash heredocs mangle quotes.
- Locales: load/dump JSON with `ensure_ascii=False, indent=2` + trailing newline; TH and EN keys must match.
- Jest: CRA resets mocks between tests; call `resetCatalogue()`; don't advance fake timers past the 15-minute idle logout.
