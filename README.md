# Silver Thief Bug Project

Exotic beetle shop — React (CRA + TypeScript + Tailwind) storefront, Node/Express API, Supabase
(Postgres, Auth, Storage), Stripe payments and LINE OA admin notifications.

- [x] **Phase 1: Foundation & Design System**
- [x] **Phase 2: Database & Authentication** — Supabase Auth sessions, roles from the DB, RLS hardened (migration 001)
- [x] **Phase 3: Core Features (User-Facing)** — cart & favourites persist across refreshes
- [x] **Phase 4: Admin Dashboard** — overview + 14-day revenue chart, products (Storage image upload, atomic stock), orders & fulfilment, customers, payments log, LINE settings
- [x] **Phase 5: Payment & External Integration** — Stripe Checkout (hosted; card / PromptPay), webhook-verified payments, LINE owner alerts
- [x] **Shipping** — saved addresses + cascading จังหวัด → อำเภอ/เขต → ตำบล/แขวง with postal-code autofill
- [ ] **Phase 6: Final Polish** — image optimisation, code splitting, responsive QA, real About/Contact/Policy pages

---

## How it fits together

```
Browser (React) ──Supabase Auth (sign-in/up, reset)──▶ Supabase Auth
   │  └─ admin image upload ─────────────────────────▶ Supabase Storage (admin-only RLS)
   │
   └─ Authorization: Bearer <Supabase JWT> ─▶ Express API ──service role──▶ Postgres (RLS on)
                                                 │   ├─ create_order()     atomic stock reservation
                                                 │   ├─ mark_order_paid()  only from Stripe webhook
                                                 │   └─ cancel_order()     releases stock
                                                 ├──▶ Stripe (Checkout Sessions)
Stripe ──signed webhook──▶ /api/payments/webhook ┘──▶ LINE Messaging API push → LINE_OWNER_USER_ID
LINE   ──signed webhook──▶ /api/notifications/line/webhook (verified; lists 1:1 friends for Admins to tick)
```

**Security model**
- The browser only ever holds public values (Supabase URL + anon key). Customers pay on Stripe's hosted Checkout page.
- Every API call is authenticated with the user's Supabase access token; the role is read from `profiles` on the server.
- Users cannot change their own role (column privileges), insert orders directly, or call the order functions (service-role only).
- Prices and totals are always computed in Postgres from `products`; the client sends only product ids and quantities.
- An order becomes **paid only** when a signature-verified Stripe webhook (or a server-side Stripe lookup) reports the Checkout Session / PaymentIntent as paid with the exact amount and currency.
- Stock is reserved atomically at checkout with row locks; unpaid orders expire after `ORDER_RESERVATION_MINUTES` and release stock (their Stripe Checkout Session is expired first). Opening checkout can extend a reservation, but never past 2 hours after the order was created ([ADR 0001](docs/adr/0001-stripe-hosted-checkout.md)).
- Re-submitting the same checkout returns the same order (`client_request_id` idempotency key); starting a new checkout releases the customer's previous unpaid one.

### Order lifecycle

| Status | Set by | Meaning |
|---|---|---|
| `awaiting_payment` | `create_order` | Stock reserved, awaiting payment (expires) |
| `paid` | Stripe webhook only | Paid — the owner gets a LINE alert. Moves straight on to `waiting_shipping` until the LINE OA hand-off is automated |
| `waiting_shipping` | `mark_order_paid` | Being packed |
| `shipping` | Admin (carrier + tracking required) | Handed to the carrier |
| `confirmed` | Customer, admin, or 7 days after shipping | Received; final step |
| `cancelled` | Customer (unpaid), admin (before Shipping; a paid order is not refunded for now), or expiry job | Stock released |

There is no separate payment status: `paid_at` and `refunded_at` record the money.

---

## Project structure

```
backend/
├── server.js                    ← Express app, raw-body webhooks, rate limits, background job
├── scripts/seed-thai-geo.js     ← loads provinces/districts/subdistricts into Supabase
├── src/
│   ├── config/{supabase,stripe}.js
│   ├── middleware/auth.js       ← verifies Supabase JWT, loads role from profiles
│   ├── lib/                     ← validation, HTTP errors, order rules, LINE client, Thai address format
│   ├── services/                ← order/payment lifecycle (shared by routes, webhook, job), addresses
│   ├── routes/                  ← auth, products, orders, payments, addresses, geo, admin, notifications
│   └── db/
│       ├── schema.sql           ← base schema (run first)
│       ├── seed.sql             ← sample products
│       ├── migrations/001_secure_commerce.sql
│       └── data/thai_geo.json   ← kongvut/thai-province-data (MIT)
└── test/
    ├── unit/                    ← npm test
    └── db/                      ← npm run test:db (runs the SQL against embedded Postgres)

frontend/src/
├── lib/                         ← supabaseClient, api (sends Supabase token), types, format
├── contexts/                    ← Auth (Supabase sessions), Cart & Favorites (localStorage)
├── component/
│   ├── auth/RouteGuards.tsx     ← RequireAuth / RequireAdmin
│   ├── address/                 ← ThaiAddressPicker, AddressForm
│   ├── checkout/PaymentStep.tsx ← Stripe PaymentElement
│   └── admin/                   ← Overview, Products (+ Stock History), Orders, Categories, Members, Rules, Settings, Pager
└── pages/                       ← Products (the shop, at /), About, Favorites, Login, ResetPassword, Checkout,
                                   Orders, OrderDetail, Account, AdminDashboard
```

---

## Setup

### 1. Supabase
1. **SQL Editor** → run `backend/src/db/schema.sql` (new projects only), then `seed.sql` (optional sample products).
2. **SQL Editor** → run the migrations in order: `001_secure_commerce.sql`, `002_spec_alignment.sql`,
   `003_product_categories.sql`, `004_favorites_rls.sql`, `005_order_flow.sql`,
   `006_categories_stock_history_stacking.sql` (all in `backend/src/db/migrations/`).
   Each is idempotent and keeps existing data; once 005 has run, don't re-run 001–004 (005 removes `payment_status`).
   006 adds Admin-managed Categories and beetle Families (seeded from today's products), Stock History
   (one opening entry per product), Stackable / Exclusive Promotions (existing ones become Exclusive),
   the Confirmed and Promotion-announcement Notifications, and publishes `notifications` to Supabase
   Realtime so the bell updates at once, the LINE Recipients list (`line_contacts`) and a once-only LINE claim for a
   customer's confirm (`orders.received_notified_at`). Run it before deploying the matching backend and frontend. 003 moves Rhinoceros/Stag/Flower into `attributes.family` and turns other old categories into
   `gear` — review those products afterwards.
   The Shipping Rule lives in the `shipping_tiers` table (one row per Shipping Tier) plus the
   `free_shipping_threshold` key in `app_settings`; edit it in Admin → Rules, which saves both at once
   through `set_shipping_rule()`. 005 moves an older `app_settings.shipping_rule` JSON into the table.
3. Seed Thai addresses (≈7,400 subdistricts): `cd backend && npm run seed:thai-geo`
4. **Authentication → Providers → Email**: keep *Confirm email* ON. Set minimum password length to 8.
5. **Authentication → URL Configuration**: Site URL = your storefront URL; add `http://localhost:3000/**` and
   `https://your-domain/**` to Redirect URLs (needed for email confirmation, password reset and Member invitations,
   which all land on `/reset-password`).
5a. **Reset / invitation emails (custom SMTP).** Supabase's built-in mailer sends only a few emails per hour and
   often lands in spam, so "forgot password" seems broken. Set up a real sender:
   1. Create an SMTP account with a provider (e.g. Resend, Brevo, Mailgun, Amazon SES) and verify your domain there
      (it gives you DNS records — SPF/DKIM — to add at your domain host).
   2. Supabase → **Authentication → Emails → SMTP Settings** → *Enable custom SMTP*: host, port (587), username,
      password from the provider, sender email (e.g. `no-reply@your-domain`) and sender name (`Silver Thief Bug`).
   3. **Authentication → Rate Limits**: raise "emails per hour" to what you need.
   4. Optional: **Authentication → Emails → Templates** → *Reset Password* / *Invite user*: write the text in Thai.
   5. Test: on `/login` choose *ลืมรหัสผ่าน?*, enter your own email, open the link — it should open
      `/reset-password` with the new-password form. If it says the link is invalid, check step 5's Redirect URLs.
6. Create your account in the app, then promote yourself:
   ```sql
   UPDATE public.profiles SET role = 'admin'
   WHERE id = (SELECT id FROM auth.users WHERE email = 'you@example.com');
   ```
   After that, create Members and change roles from **Admin → Members**, and manage the shop's
   Categories and beetle Families in **Admin → Categories** (the beetle Category can be renamed, never deleted).

### 2. Stripe
1. Use **test mode** (`sk_test_…`) in development. Only the secret key is needed (backend); the frontend has no Stripe key.
2. Dashboard → Settings → Payment methods: enable **Cards** and **PromptPay** (THB account required for PromptPay).
3. Webhook endpoint `https://<api-host>/api/payments/webhook` with events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
   `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`.
   Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Local development: `stripe listen --forward-to localhost:5000/api/payments/webhook` and use the `whsec_…` it prints.

### 3. LINE Official Account
1. LINE Developers → your Messaging API channel: copy the **channel access token** and **channel secret** into the backend `.env`.
2. Same channel → **Basic settings** → copy **Your user ID** (`U…`) into `LINE_OWNER_USER_ID`, and add the OA as a
   friend from that LINE account (push messages only reach friends).
3. Webhook URL `https://<api-host>/api/notifications/line/webhook`, with **Use webhook** on (signature-checked).
   Whoever follows the OA, or messages it 1:1, is listed in Admin → **Payments & LINE**; an Admin ticks who gets
   order alerts, as many as needed, on top of the env recipients ([ADR 0002](docs/adr/0002-line-target-from-env-only.md),
   amended). Following alone never makes anyone a recipient; groups are ignored. LINE Notify is discontinued and not used.
4. Admin → **Payments & LINE** → *Send test message*.

### Demo data (optional)
Hand-run scripts in `backend/src/db/scripts/`, for the Supabase SQL Editor after migration 006:
- `clear_products.sql` deletes every product with its Stock History, Favorites and Promotion links. Past Orders keep
  their copied names and prices; an optional block at the end also clears Orders. Product photos in Storage are not touched.
- `seed_demo_products.sql` adds 100 demo products (64 live beetles, 12 food, 12 logs & substrate, 12 gear) with Thai
  and English text and Wikimedia Commons photos. Safe to re-run. Credit the photos as listed in `demo_photo_credits.md`,
  or replace them with the shop's own before selling.
Both are tested against a migrated database by `npm run test:db` (`test/db/demoData.test.mjs`).

### 4. Run
From the repo root, one command starts both (backend :5000 with nodemon, frontend :3000):
```bash
npm run install-all   # first time only
npm start
```
It refuses to start if port 3000 or 5000 is already taken. It also sets `NODE_EXTRA_CA_CERTS` to Avast's
certificate when that file exists, because Avast Web Shield intercepts HTTPS to Supabase.

Or each part on its own:
```bash
cd backend  && npm install && cp .env.example .env   # fill in values
npm run dev                                           # http://localhost:5000
npm test && npm run test:db                           # unit + database tests

cd frontend && npm install && cp .env.example .env
npm start                                             # http://localhost:3000
```

## Deploy
Free hosting (Render for the API via `render.yaml`, Vercel for the shop via `frontend/vercel.json`): step by step in [docs/deploy.md](docs/deploy.md).

## Environment variables

**backend/.env** (server only)

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | ✅ | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server only. Bypasses RLS. |
| `STRIPE_SECRET_KEY` | ✅ | `sk_test_…` in dev, `sk_live_…` only in production (the server refuses a live key unless `NODE_ENV=production` or `ALLOW_LIVE_STRIPE=1`) |
| `STRIPE_WEBHOOK_SECRET` | ✅ | `whsec_…` |
| `FRONTEND_URL` | ✅ | CORS allow-list (comma-separated) and admin links in LINE messages |
| `LINE_CHANNEL_ACCESS_TOKEN` | for LINE | |
| `LINE_CHANNEL_SECRET` | for LINE | Verifies LINE webhook signatures |
| `LINE_OWNER_USER_ID` | for LINE | Owner's LINE user ID (`U…`) — receives every paid-order alert |
| `LINE_ADMIN_TARGET_IDS` | optional | Extra recipients (user/group IDs), comma-separated |
| `SHIPPING_FEE_THB` | optional | Default `0` |
| `ORDER_RESERVATION_MINUTES` | optional | Default `30` |
| `PORT`, `NODE_ENV`, `TRUST_PROXY`, `RATE_LIMIT_MAX`, `DISABLE_JOBS` | optional | |
| ~~`JWT_SECRET`~~ | removed | Auth now uses Supabase sessions — delete it |

**frontend/.env** (public — bundled into the site)

| Variable | Notes |
|---|---|
| `REACT_APP_SUPABASE_URL` | |
| `REACT_APP_SUPABASE_ANON_KEY` | anon/publishable key only |
| `REACT_APP_API_URL` | e.g. `https://api.example.com/api` |

## API overview

| Method & path | Who | Purpose |
|---|---|---|
| `GET /api/auth/me`, `PATCH /api/auth/profile` | user | profile |
| `GET /api/products[/:id\|/categories\|/best-sellers]` | public | catalogue |
| `GET /api/products/admin/all`, `POST/PATCH/DELETE /api/products[/:id]`, `POST /api/products/:id/stock` | admin | catalogue & inventory |
| `GET/POST/PATCH/DELETE /api/addresses[/:id]`, `POST /api/addresses/:id/default` | user | address book |
| `GET /api/geo/provinces`, `/provinces/:id/districts`, `/districts/:id/subdistricts`, `/postal/:code` | public | Thai address data |
| `POST /api/orders`, `GET /api/orders[/:id]`, `POST /api/orders/:id/cancel` | user | checkout & history |
| `GET /api/orders/admin/all`, `PATCH /api/orders/:id/status`, `PATCH /api/orders/:id/admin` | admin | fulfilment (cancelling a paid order does not refund it for now) |
| `POST /api/payments/checkout-session` | user | one hosted Checkout Session per order → `{ url }` |
| `POST /api/payments/webhook` | Stripe | signed |
| `GET /api/admin/stats`, `/customers[/:id]`, `POST /customers` (invite a Member), `PATCH /customers/:id/role`, `GET /payments` | admin | dashboard & Members |
| `GET /api/notifications`, `POST /read-all`, `POST /:id/read`, `DELETE /:id` | user | the Member's own bell |
| `GET /api/notifications/line/status`, `POST /line/test`, `POST /broadcast` | admin | LINE |
| `GET /api/notifications/line/contacts`, `POST /line/contacts/sync`, `PATCH /line/contacts/:lineUserId` | admin | LINE Recipients: list the OA's friends (sync pulls followers from LINE; verified/premium OAs only), tick `receives_alerts` |
| `POST /api/notifications/line/webhook` | LINE | signed |

Removed: `POST /api/auth/signup` and `/login` (Supabase Auth from the browser), `POST /api/payments/create-qr` and
`GET /api/payments/status/:id`, `POST /api/payments/create-payment-intent` (Stripe Checkout handles card and
PromptPay; status comes from `GET /api/orders/:id`).
