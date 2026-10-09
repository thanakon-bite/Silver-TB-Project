# Silver Thief Bug Project

Exotic beetle shop — React (CRA + TypeScript + Tailwind) storefront, Node/Express API, Supabase
(Postgres, Auth, Storage), Stripe payments and LINE OA admin notifications.

- [x] **Phase 1: Foundation & Design System**
- [x] **Phase 2: Database & Authentication** — Supabase Auth sessions, roles from the DB, RLS hardened (migration 001)
- [x] **Phase 3: Core Features (User-Facing)** — cart & favourites persist across refreshes
- [x] **Phase 4: Admin Dashboard** — overview + 14-day revenue chart, products (Storage image upload, atomic stock), orders & fulfilment, refunds, customers, payments log, LINE settings
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
                                                 ├──▶ Stripe (Checkout Sessions, refunds)
Stripe ──signed webhook──▶ /api/payments/webhook ┘──▶ LINE Messaging API push → LINE_OWNER_USER_ID
LINE   ──signed webhook──▶ /api/notifications/line/webhook (verified, acknowledged only)
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
| `pending` | `create_order` | Stock reserved, awaiting payment (expires) |
| `paid` | Stripe webhook only | Paid — the owner gets a LINE alert |
| `shipped` | Admin (carrier + tracking required) | |
| `delivered` | Admin | |
| `cancelled` | Customer/admin (unpaid), expiry job, or admin refund | Stock released (refunds: optional) |

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
│   └── admin/                   ← Overview, Products, Orders, Customers, Settings
└── pages/                       ← Home, Products, Favorites, Login, ResetPassword, Checkout,
                                   Orders, OrderDetail, Account, AdminDashboard
```

---

## Setup

### 1. Supabase
1. **SQL Editor** → run `backend/src/db/schema.sql` (new projects only), then `seed.sql` (optional sample products).
2. **SQL Editor** → run the migrations in order: `001_secure_commerce.sql`, `002_spec_alignment.sql`,
   `003_product_categories.sql`, `004_favorites_rls.sql` (all in `backend/src/db/migrations/`). Each is idempotent and
   keeps existing data. 003 moves Rhinoceros/Stag/Flower into `attributes.family` and turns other old categories into
   `gear` — review those products afterwards.
3. Seed Thai addresses (≈7,400 subdistricts): `cd backend && npm run seed:thai-geo`
4. **Authentication → Providers → Email**: keep *Confirm email* ON. Set minimum password length to 8.
5. **Authentication → URL Configuration**: Site URL = your storefront URL; add `http://localhost:3000/**` and
   `https://your-domain/**` to Redirect URLs (needed for email confirmation and password reset).
6. Create your account in the app, then promote yourself:
   ```sql
   UPDATE public.profiles SET role = 'admin'
   WHERE id = (SELECT id FROM auth.users WHERE email = 'you@example.com');
   ```
   After that, manage admins from **Admin → Customers**.

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
3. Optional: webhook URL `https://<api-host>/api/notifications/line/webhook` (signature-checked, nothing else happens
   there). Alert recipients come only from env vars ([ADR 0002](docs/adr/0002-line-target-from-env-only.md)).
   LINE Notify is discontinued and not used.
4. Admin → **Payments & LINE** → *Send test message*.

### 4. Run
```bash
cd backend  && npm install && cp .env.example .env   # fill in values
npm run dev                                           # http://localhost:5000
npm test && npm run test:db                           # unit + database tests

cd frontend && npm install && cp .env.example .env
npm start                                             # http://localhost:3000
```

## Environment variables

**backend/.env** (server only)

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | ✅ | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server only. Bypasses RLS. |
| `STRIPE_SECRET_KEY` | ✅ | `sk_test_…` in dev, `sk_live_…` only in production |
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
| `GET /api/orders/admin/all`, `PATCH /api/orders/:id/status`, `PATCH /api/orders/:id/admin`, `POST /api/orders/:id/refund` | admin | fulfilment |
| `POST /api/payments/checkout-session` | user | one hosted Checkout Session per order → `{ url }` |
| `POST /api/payments/webhook` | Stripe | signed |
| `GET /api/admin/stats`, `/customers[/:id]`, `PATCH /customers/:id/role`, `GET /payments` | admin | dashboard |
| `GET /api/notifications/line/status`, `POST /line/test`, `POST /broadcast` | admin | LINE |
| `POST /api/notifications/line/webhook` | LINE | signed |

Removed: `POST /api/auth/signup` and `/login` (Supabase Auth from the browser), `POST /api/payments/create-qr` and
`GET /api/payments/status/:id`, `POST /api/payments/create-payment-intent` (Stripe Checkout handles card and
PromptPay; status comes from `GET /api/orders/:id`).
