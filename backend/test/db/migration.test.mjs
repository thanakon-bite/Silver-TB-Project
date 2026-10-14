import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import fs from 'node:fs';
import assert from 'node:assert/strict';

import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/db');
const db = new PGlite({ extensions: { uuid_ossp } });

const stubs = `
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON storage.objects, storage.buckets TO anon, authenticated, service_role;
-- mimic Supabase default grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
`;

// Runs schema.sql + seed.sql + migrations against an in-process Postgres (PGlite) with
// minimal stand-ins for Supabase's auth/storage schemas, then exercises the order functions
// and RLS policies. Run with: npm run test:db
async function run(label, sql) {
  try { await db.exec(sql); console.log('OK  ', label); }
  catch (e) { console.error('FAIL', label, e.message, e.detail || '', e.where || ''); process.exit(1); }
}

await run('stubs', stubs);
await run('schema.sql', fs.readFileSync(`${ROOT}/schema.sql`, 'utf8'));
await run('seed.sql', fs.readFileSync(`${ROOT}/seed.sql`, 'utf8'));

// Pre-existing user + legacy order (with a malicious negative quantity line) BEFORE migration
const legacyUser = '11111111-1111-1111-1111-111111111111';
await db.exec(`INSERT INTO auth.users (id, email) VALUES ('${legacyUser}', 'old@example.com');
INSERT INTO profiles (id, full_name, role) VALUES ('${legacyUser}', 'Old User', 'user');`);
const prod = (await db.query(`SELECT id, price, stock, name FROM products ORDER BY name`)).rows;
await db.exec(`INSERT INTO orders (user_id, items, total, shipping_address) VALUES
 ('${legacyUser}', '[{"product_id":"${prod[0].id}","quantity":2,"price":${prod[0].price},"name":"${prod[0].name}"},{"product_id":"not-a-uuid","quantity":-3,"price":10,"name":"bad"}]', 100, '"some text address"')`);

const migration = fs.readFileSync(`${ROOT}/migrations/001_secure_commerce.sql`, 'utf8');
await run('migration 001 (1st run)', migration);
await run('migration 001 (re-run)', migration);
const migration2 = fs.readFileSync(`${ROOT}/migrations/002_spec_alignment.sql`, 'utf8');
await run('migration 002 (1st run)', migration2);
await run('migration 002 (re-run)', migration2);
const migration3 = fs.readFileSync(`${ROOT}/migrations/003_product_categories.sql`, 'utf8');
await run('migration 003 (1st run)', migration3);
await run('migration 003 (re-run)', migration3);
const migration4 = fs.readFileSync(`${ROOT}/migrations/004_favorites_rls.sql`, 'utf8');
await run('migration 004 (1st run)', migration4);
await run('migration 004 (re-run)', migration4);

// Orders in every old status, to check how 005 converts them
const legacyStatuses = [['pending', 'unpaid'], ['pending', 'failed'], ['paid', 'paid'], ['shipped', 'paid'], ['delivered', 'paid'], ['cancelled', 'unpaid'], ['cancelled', 'refunded']];
for (const [status, pay] of legacyStatuses) {
  await db.query(`INSERT INTO orders (user_id, subtotal, total, status, payment_status, admin_note) VALUES ($1, 10, 10, $2, $3, $4)`, [legacyUser, status, pay, `legacy ${status}/${pay}`]);
}
const migration5 = fs.readFileSync(`${ROOT}/migrations/005_order_flow.sql`, 'utf8');
{
  // Supabase runs pg-safeupdate for API calls (RPCs included): a DELETE or UPDATE with no WHERE is
  // refused there, though PGlite accepts it. Every one in 005 needs a WHERE (WHERE TRUE for "all rows").
  const sql = migration5.replace(/--[^\n]*/g, '');
  const bare = [...sql.matchAll(/\b(DELETE\s+FROM\s+\S+|UPDATE\s+public\.\w+\s+(\w+\s+)?SET)\b[^;]*;/gi)]
    .map((m) => m[0])
    .filter((st) => !/\bWHERE\b/i.test(st))
    .map((st) => st.split(/\s+/).slice(0, 4).join(' '));
  assert.deepEqual(bare, [], 'DELETE / UPDATE without WHERE (refused by Supabase pg-safeupdate)');
  console.log('OK   005: no DELETE / UPDATE without WHERE (pg-safeupdate)');
}
await run('migration 005 (1st run)', migration5);
await run('migration 005 (re-run)', migration5);
{
  const rows = (await db.query(`SELECT admin_note, status, refunded_at FROM orders WHERE admin_note LIKE 'legacy %' ORDER BY admin_note`)).rows;
  const got = Object.fromEntries(rows.map((x) => [x.admin_note.slice(7), [x.status, x.refunded_at !== null]]));
  assert.deepEqual(got, {
    'cancelled/refunded': ['cancelled', true],
    'cancelled/unpaid': ['cancelled', false],
    'delivered/paid': ['confirmed', false],
    'paid/paid': ['waiting_shipping', false],
    'pending/failed': ['awaiting_payment', false],
    'pending/unpaid': ['awaiting_payment', false],
    'shipped/paid': ['shipping', false],
  });
  const delivered = (await db.query(`SELECT confirmed_at IS NOT NULL AS at, confirmed_by FROM orders WHERE admin_note = 'legacy delivered/paid'`)).rows[0];
  assert.deepEqual([delivered.at, delivered.confirmed_by], [true, 'admin'], 'delivered orders become Confirmed by the admin');
  await expectError(() => db.query(`SELECT payment_status FROM orders LIMIT 1`), 'payment_status');
  await expectError(() => db.query(`UPDATE orders SET status='shipped' WHERE admin_note LIKE 'legacy %'`), 'orders_status_check');
  await db.query(`DELETE FROM orders WHERE admin_note LIKE 'legacy %'`);
  console.log('OK   005: old statuses converted, payment status removed');

  // Stock: Available = old stock; On Hand also counts units in orders still open
  const p0 = (await db.query(`SELECT on_hand, available FROM products WHERE id=$1`, [prod[0].id])).rows[0];
  assert.equal(p0.available, prod[0].stock, 'Available keeps the old stock');
  assert.equal(p0.on_hand, prod[0].stock + 2, 'On Hand adds the 2 units in the open legacy order');
  await expectError(() => db.query(`SELECT stock FROM products LIMIT 1`), 'stock');
  console.log('OK   005: stock split into On Hand and Available');
}
{
}

// Backfill checks
let r = await db.query(`SELECT order_number, subtotal FROM orders`);
assert.match(r.rows[0].order_number, /^STB-\d{6}-\d{5}$/);
r = await db.query(`SELECT product_id, quantity FROM order_items ORDER BY product_name`);
assert.equal(r.rows.length, 2);
assert.ok(r.rows.every((x) => x.quantity >= 1), 'backfill clamps quantity');
console.log('OK   backfill: order_number + order_items');

// Profile trigger
const u1 = '22222222-2222-2222-2222-222222222222';
const u2 = '33333333-3333-3333-3333-333333333333';
await db.exec(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('${u1}', 'a@example.com', '{"full_name":"Alice","phone":"0812345678"}'),
 ('${u2}', 'b@example.com', '{"full_name":"Bob","role":"admin"}')`);
r = await db.query(`SELECT full_name, role, email FROM profiles WHERE id IN ('${u1}','${u2}') ORDER BY full_name`);
assert.deepEqual(r.rows.map((x) => x.role), ['user', 'user'], 'role from metadata ignored');
console.log('OK   handle_new_user trigger (metadata role ignored)');

// Helper to call create_order as service (superuser here)
const p = (n) => prod.find((x) => x.name.startsWith(n));
const atlas = p('Chalcosoma'); // stock 7
const goliath = p('Goliathus'); // stock 1
const addr = JSON.stringify({ recipient_name: 'Alice', phone: '0812345678', address_line: '1 Road', subdistrict: 'x', postal_code: '10200' });

async function createOrder(user, items, reqId = null, fee = 0) {
  return (await db.query(`SELECT * FROM create_order($1, $2::jsonb, $3::jsonb, $4, $5)`, [user, JSON.stringify(items), addr, reqId, fee])).rows[0];
}
async function expectError(fn, msg) {
  try { await fn(); } catch (e) { assert.match(e.message, new RegExp(msg)); return e; }
  assert.fail(`expected error ${msg}`);
}
const stockOf = async (id) => (await db.query(`SELECT available FROM products WHERE id=$1`, [id])).rows[0].available;

// Negative quantity attack
await expectError(() => createOrder(u1, [{ product_id: atlas.id, quantity: 3 }, { product_id: goliath.id, quantity: -1 }]), 'INVALID_QUANTITY');
assert.equal(await stockOf(atlas.id), 7);
console.log('OK   negative quantity rejected, stock untouched');

// Duplicate lines are summed before the stock check
await expectError(() => createOrder(u1, [{ product_id: goliath.id, quantity: 1 }, { product_id: goliath.id, quantity: 1 }]), 'INSUFFICIENT_STOCK');
console.log('OK   duplicate lines aggregated for stock check');

// Happy path with server-side prices + shipping fee
const req1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const o1 = await createOrder(u1, [{ product_id: atlas.id, quantity: 2 }, { product_id: goliath.id, quantity: 1 }], req1, 50);
assert.equal(Number(o1.subtotal), Number(atlas.price) * 2 + Number(goliath.price));
assert.equal(Number(o1.total), Number(o1.subtotal) + 50);
assert.equal(await stockOf(atlas.id), 5);
assert.equal(await stockOf(goliath.id), 0);
assert.ok(o1.expires_at);
assert.equal(o1.status, 'awaiting_payment');
console.log('OK   create_order: DB prices, stock reserved, expiry set', o1.order_number);

// Idempotency
const o1b = await createOrder(u1, [{ product_id: atlas.id, quantity: 2 }, { product_id: goliath.id, quantity: 1 }], req1, 50);
assert.equal(o1b.id, o1.id);
assert.equal(await stockOf(atlas.id), 5);
console.log('OK   same client_request_id returns same order, no double reservation');

// Sold out for others
await expectError(() => createOrder(u2, [{ product_id: goliath.id, quantity: 1 }]), 'INSUFFICIENT_STOCK');
console.log('OK   last beetle cannot be oversold');

// mark_order_paid checks
const cents = Math.round(Number(o1.total) * 100);
let res = (await db.query(`SELECT mark_order_paid($1,'pi_1',$2,'thb') AS r`, [o1.id, cents - 1])).rows[0].r;
assert.equal(res, 'amount_mismatch');
await db.query(`UPDATE orders SET needs_attention=false, admin_note=null WHERE id=$1`, [o1.id]);
res = (await db.query(`SELECT mark_order_paid($1,'pi_1',$2,'THB') AS r`, [o1.id, cents])).rows[0].r;
assert.equal(res, 'paid');
res = (await db.query(`SELECT mark_order_paid($1,'pi_1',$2,'thb') AS r`, [o1.id, cents])).rows[0].r;
assert.equal(res, 'already_paid');
r = (await db.query(`SELECT status, paid_at IS NOT NULL AS paid, expires_at FROM orders WHERE id=$1`, [o1.id])).rows[0];
assert.deepEqual([r.status, r.paid, r.expires_at], ['waiting_shipping', true, null], 'paid moves straight on to Waiting Shipping');
console.log('OK   mark_order_paid: amount check, first-time "paid", idempotent');

// Cancel rules
await expectError(() => db.query(`SELECT * FROM cancel_order($1,'x')`, [o1.id]), 'REFUND_REQUIRED');
r = (await db.query(`SELECT * FROM cancel_order($1,'refunded by admin', true)`, [o1.id])).rows[0];
assert.equal(r.status, 'cancelled');
assert.ok(r.refunded_at, 'refunded time recorded');
assert.equal(await stockOf(goliath.id), 1);
assert.equal(await stockOf(atlas.id), 7);
r = (await db.query(`SELECT * FROM cancel_order($1,'again', true)`, [o1.id])).rows[0];
assert.equal(await stockOf(atlas.id), 7, 'idempotent restock');
console.log('OK   cancel_order: refund required for paid, restock once');

// Unpaid order expiry path + payment arriving after cancel
const o2 = await createOrder(u2, [{ product_id: goliath.id, quantity: 1 }], null);
await db.query(`SELECT * FROM cancel_order($1,'payment_timeout')`, [o2.id]);
assert.equal(await stockOf(goliath.id), 1);
res = (await db.query(`SELECT mark_order_paid($1,'pi_2',$2,'thb') AS r`, [o2.id, Math.round(Number(o2.total) * 100)])).rows[0].r;
assert.equal(res, 'paid_after_cancel');
r = (await db.query(`SELECT needs_attention, status FROM orders WHERE id=$1`, [o2.id])).rows[0];
assert.deepEqual([r.needs_attention, r.status], [true, 'cancelled']);
console.log('OK   late payment on cancelled order flagged for admin');

// Shipped orders cannot be cancelled
const o3 = await createOrder(u2, [{ product_id: atlas.id, quantity: 1 }], null);
await db.query(`UPDATE orders SET status='shipping' WHERE id=$1`, [o3.id]);
await expectError(() => db.query(`SELECT * FROM cancel_order($1,'x')`, [o3.id]), 'INVALID_STATUS');
console.log('OK   shipped orders cannot be cancelled');

// Confirmed: only from Shipping, once, remembering who confirmed
await expectError(() => db.query(`SELECT * FROM confirm_order($1, 'customer')`, [o2.id]), 'INVALID_STATUS');
await db.query(`UPDATE orders SET shipped_at = NOW() - INTERVAL '1 day' WHERE id=$1`, [o3.id]);
r = (await db.query(`SELECT * FROM confirm_order($1, 'customer')`, [o3.id])).rows[0];
assert.deepEqual([r.status, r.confirmed_by, r.confirmed_at !== null], ['confirmed', 'customer', true]);
r = (await db.query(`SELECT * FROM confirm_order($1, 'admin')`, [o3.id])).rows[0];
assert.equal(r.confirmed_by, 'customer', 'confirming twice changes nothing');
await expectError(() => db.query(`SELECT * FROM confirm_order($1, 'someone')`, [o3.id]), 'INVALID_CONFIRMER');
console.log('OK   confirm_order: Shipping only, idempotent, records who');

// Auto-confirm: Shipping orders older than N days
const o5 = await createOrder(u2, [{ product_id: atlas.id, quantity: 1 }], null);
const o6 = await createOrder(u2, [{ product_id: atlas.id, quantity: 1 }], null);
await db.query(`UPDATE orders SET status='shipping', shipped_at = NOW() - INTERVAL '8 days' WHERE id=$1`, [o5.id]);
await db.query(`UPDATE orders SET status='shipping', shipped_at = NOW() - INTERVAL '6 days' WHERE id=$1`, [o6.id]);
r = (await db.query(`SELECT auto_confirm_orders(7) AS n`)).rows[0];
assert.equal(r.n, 1);
r = (await db.query(`SELECT id, status, confirmed_by FROM orders WHERE id IN ($1, $2) ORDER BY shipped_at`, [o5.id, o6.id])).rows;
assert.deepEqual(r.map((x) => [x.status, x.confirmed_by]), [['confirmed', 'auto'], ['shipping', null]]);
assert.equal((await db.query(`SELECT auto_confirm_orders(7) AS n`)).rows[0].n, 0, 'auto-confirm is idempotent');
await asUser(u1, () => expectError(() => db.query(`SELECT auto_confirm_orders(7)`), 'permission denied'));
console.log('OK   auto_confirm_orders: only Shipping orders past the window');

// ---- RLS / privilege checks as an authenticated customer ----
async function asUser(uid, fn) {
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await fn(); } finally { await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false);`); }
}
await asUser(u1, async () => {
  await expectError(() => db.query(`UPDATE profiles SET role='admin' WHERE id='${u1}'`), 'permission denied');
  await db.query(`UPDATE profiles SET full_name='Alice B' WHERE id='${u1}'`);
  await expectError(() => db.query(`INSERT INTO orders (user_id, subtotal, total) VALUES ('${u1}', 1, 1)`), 'permission denied');
  await expectError(() => db.query(`SELECT * FROM create_order('${u1}', '[]'::jsonb, '{}'::jsonb, null)`), 'permission denied');
  await expectError(() => db.query(`SELECT mark_order_paid('${o1.id}', 'pi', 1, 'thb')`), 'permission denied');
  const mine = await db.query(`SELECT id FROM orders`);
  assert.ok(mine.rows.every(() => true));
  const others = await db.query(`SELECT id FROM orders WHERE user_id <> '${u1}'`);
  assert.equal(others.rows.length, 0, 'cannot see other users orders');
  const otherItems = await db.query(`SELECT oi.id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.user_id <> '${u1}'`);
  assert.equal(otherItems.rows.length, 0);
  await expectError(() => db.query(`SELECT * FROM payment_events`), 'permission denied');
  await expectError(() => db.query(`UPDATE products SET price = 1`).then(async (x) => { if (x.affectedRows === 0) throw new Error('permission denied (0 rows via RLS)'); }), 'permission denied');
  await expectError(() => db.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('product-images','x.png')`), 'row-level security|permission denied');
});
r = (await db.query(`SELECT full_name, role FROM profiles WHERE id='${u1}'`)).rows[0];
assert.deepEqual([r.full_name, r.role], ['Alice B', 'user']);
console.log('OK   RLS: no self-promotion, no direct orders/RPC, isolation between users, admin-only writes');

// Admin via is_admin()
await db.exec(`UPDATE profiles SET role='admin' WHERE id='${u2}'`);
await asUser(u2, async () => {
  const all = await db.query(`SELECT id FROM orders`);
  assert.ok(all.rows.length >= 3);
  await db.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ('product-images','x.png')`);
  const upd = await db.query(`UPDATE products SET is_best_seller = is_best_seller`);
  assert.ok(upd.affectedRows > 0);
});
console.log('OK   admin: sees all orders, can write products and product images');

// Addresses
await db.exec(`INSERT INTO th_provinces VALUES (1,'กรุงเทพมหานคร','Bangkok'); INSERT INTO th_districts VALUES (1001,1,'พระนคร','Phra Nakhon'); INSERT INTO th_subdistricts VALUES (100101,1001,'พระบรมมหาราชวัง','Phra Borom Maha Ratchawang','10200');`);
await asUser(u1, async () => {
  await db.query(`INSERT INTO addresses (user_id, recipient_name, phone, address_line, subdistrict_id, postal_code, is_default) VALUES ('${u1}','Alice','0812345678','1 Road',100101,'10200',true)`);
  await expectError(() => db.query(`INSERT INTO addresses (user_id, recipient_name, phone, address_line, subdistrict_id, postal_code, is_default) VALUES ('${u1}','Alice','0812345678','2 Road',100101,'10200',true)`), 'duplicate key');
  await expectError(() => db.query(`INSERT INTO addresses (user_id, recipient_name, phone, address_line, subdistrict_id, postal_code) VALUES ('${u2}','X','0812345678','2 Road',100101,'10200')`), 'row-level security');
  const prov = await db.query(`SELECT * FROM th_provinces`);
  assert.equal(prov.rows.length, 1);
});
console.log('OK   addresses: one default per user, cannot write for others; geo public read');

// Refund webhook may land before cancel_order(p_refunded): every cancel still returns Available (spec story 29)
const o4 = await createOrder(u2, [{ product_id: atlas.id, quantity: 1 }], null);
await db.query(`SELECT mark_order_paid($1,'pi_4',$2,'thb')`, [o4.id, Math.round(Number(o4.total) * 100)]);
const stockAfterSale = await stockOf(atlas.id);
await db.query(`UPDATE orders SET refunded_at=NOW() WHERE id=$1`, [o4.id]);
await db.query(`SELECT * FROM cancel_order($1,'refund', true)`, [o4.id]);
assert.equal(await stockOf(atlas.id), stockAfterSale + 1, 'a refunded cancel returns its unit to Available');
r = (await db.query(`SELECT array_agg(pg_get_function_identity_arguments(oid)) AS sigs FROM pg_proc WHERE proname = 'cancel_order'`)).rows[0];
assert.deepEqual(r.sigs, ['p_order_id uuid, p_reason text, p_refunded boolean'], 'one cancel_order, without p_restock');
console.log('OK   every cancel returns Available; cancel_order has no restock switch');

// adjust_product_stock
r = (await db.query(`SELECT * FROM adjust_product_stock($1, 3)`, [atlas.id])).rows[0];
const before = r.available;
await expectError(() => db.query(`SELECT * FROM adjust_product_stock($1, $2)`, [atlas.id, -(before + 1)]), 'STOCK_BELOW_ZERO');
assert.equal(await stockOf(atlas.id), before, 'failed adjustment rolled back');
await asUser(u1, () => expectError(() => db.query(`SELECT * FROM adjust_product_stock('${atlas.id}', 5)`), 'permission denied'));
console.log('OK   adjust_product_stock: atomic, never negative, service-only');

// On Hand / Available through a whole order life (ADR 0003)
{
  const stag = (await db.query(`INSERT INTO products (name, price, category, on_hand, available) VALUES ('Test Stag', 100, 'beetle', 5, 5) RETURNING id`)).rows[0].id;
  const both = async () => {
    const x = (await db.query(`SELECT on_hand, available FROM products WHERE id=$1`, [stag])).rows[0];
    return [x.on_hand, x.available];
  };
  const a = await createOrder(u2, [{ product_id: stag, quantity: 2 }], null);
  assert.deepEqual(await both(), [5, 3], 'ordering takes Available only');
  await db.query(`SELECT * FROM cancel_order($1, 'x')`, [a.id]);
  await db.query(`SELECT * FROM cancel_order($1, 'x')`, [a.id]);
  assert.deepEqual(await both(), [5, 5], 'cancelling returns Available once');

  const b = await createOrder(u2, [{ product_id: stag, quantity: 2 }], null);
  await db.query(`SELECT mark_order_paid($1,'pi_stag',$2,'thb')`, [b.id, Math.round(Number(b.total) * 100)]);
  await db.query(`UPDATE orders SET status='shipping', shipped_at=NOW() WHERE id=$1`, [b.id]);
  assert.deepEqual(await both(), [5, 3], 'Shipping still counts On Hand');
  await db.query(`SELECT * FROM confirm_order($1, 'customer')`, [b.id]);
  await db.query(`SELECT * FROM confirm_order($1, 'admin')`, [b.id]);
  assert.deepEqual(await both(), [3, 3], 'Confirmed takes On Hand once');

  await db.query(`SELECT * FROM adjust_product_stock($1, 4)`, [stag]);
  assert.deepEqual(await both(), [7, 7], 'receiving adds to both');
  await createOrder(u2, [{ product_id: stag, quantity: 3 }], null);
  await expectError(() => db.query(`SELECT * FROM adjust_product_stock($1, -5)`, [stag]), 'STOCK_BELOW_ZERO');
  assert.deepEqual(await both(), [7, 4], 'a correction cannot take reserved units');
  await expectError(() => db.query(`UPDATE products SET available = on_hand + 1 WHERE id=$1`, [stag]), 'products_available_within_on_hand');

  const c = await createOrder(u1, [{ product_id: stag, quantity: 1 }], null);
  await db.query(`SELECT mark_order_paid($1,'pi_stag_c',$2,'thb')`, [c.id, Math.round(Number(c.total) * 100)]);
  await db.query(`SELECT * FROM cancel_order($1, 'beetle died', true)`, [c.id]);
  assert.deepEqual(await both(), [7, 4], 'the cancel returns the unit to Available');
  await db.query(`SELECT * FROM adjust_product_stock($1, -1)`, [stag]);
  assert.deepEqual(await both(), [6, 3], 'a dead beetle is then written off with a correction of -1');
  console.log('OK   On Hand / Available: order, cancel, confirm, receive, correct, write off');
}

// 002: beetle attributes JSONB + "paid" status vocabulary + checkout session column
r = (await db.query(`SELECT attributes FROM products WHERE id=$1`, [atlas.id])).rows[0];
assert.deepEqual(r.attributes, { family: 'Rhinoceros' }, 'old family category moved into attributes');
r = (await db.query(`SELECT DISTINCT category FROM products ORDER BY 1`)).rows.map((x) => x.category);
assert.deepEqual(r, ['beetle'], 'seeded beetles recategorised');
await expectError(() => db.query(`UPDATE products SET category='Stag' WHERE id=$1`, [atlas.id]), 'products_category_check');
await db.query(`UPDATE products SET attributes='{"species":"Chalcosoma atlas","sex":"male","stage":"adult","size_mm":95}' WHERE id=$1`, [atlas.id]);
await expectError(() => db.query(`UPDATE products SET attributes='[1]' WHERE id=$1`, [atlas.id]), 'products_attributes_object');
await expectError(() => db.query(`UPDATE orders SET status='delivered' WHERE id=$1`, [o4.id]), 'orders_status_check');
await db.query(`SELECT stripe_checkout_session_id FROM orders LIMIT 1`);
console.log('OK   002: attributes JSONB, paid status, checkout session column');

// 004: favorites are private to their owner
await asUser(u1, async () => {
  await db.query(`INSERT INTO favorites (user_id, product_id) VALUES ('${u1}', $1)`, [goliath.id]);
  await expectError(() => db.query(`INSERT INTO favorites (user_id, product_id) VALUES ('${u2}', $1)`, [goliath.id]), 'row-level security');
});
await asUser(u2, async () => {
  const rows = (await db.query(`SELECT * FROM favorites`)).rows;
  assert.equal(rows.length, 0, "cannot see another user's favorites");
});
console.log('OK   004: favorites isolated per user');

// Notifications: one per order event, private to their Member
{
  const notes = async (orderId) =>
    (await db.query(`SELECT type, data, user_id FROM notifications WHERE order_id=$1 ORDER BY created_at, type`, [orderId])).rows;
  await db.query(`SELECT send_confirm_requests(3)`); // earlier tests left Shipping orders behind
  const n1 = await createOrder(u1, [{ product_id: atlas.id, quantity: 1 }], null);
  let rows = await notes(n1.id);
  assert.deepEqual(rows.map((x) => x.type), ['awaiting_payment']);
  assert.equal(rows[0].user_id, u1);
  assert.equal(rows[0].data.order_number, n1.order_number);

  await db.query(`SELECT mark_order_paid($1,'pi_n1',$2,'thb')`, [n1.id, Math.round(Number(n1.total) * 100)]);
  await db.query(`UPDATE orders SET status='shipping', shipped_at=NOW() - INTERVAL '4 days', carrier='Kerry Express', tracking_number='KEX9' WHERE id=$1`, [n1.id]);
  rows = await notes(n1.id);
  assert.deepEqual(rows.map((x) => x.type), ['awaiting_payment', 'shipping']);
  assert.equal(rows[1].data.tracking_number, 'KEX9');

  assert.equal((await db.query(`SELECT send_confirm_requests(3) AS n`)).rows[0].n, 1);
  assert.equal((await db.query(`SELECT send_confirm_requests(3) AS n`)).rows[0].n, 0, 'asked once only');
  assert.deepEqual((await notes(n1.id)).map((x) => x.type), ['awaiting_payment', 'shipping', 'confirm_request']);

  const n2 = await createOrder(u1, [{ product_id: atlas.id, quantity: 1 }], null);
  await db.query(`SELECT * FROM cancel_order($1, 'สินค้าหมด')`, [n2.id]);
  rows = await notes(n2.id);
  assert.deepEqual(rows.map((x) => x.type), ['awaiting_payment', 'cancelled']);
  assert.equal(rows[1].data.cancel_reason, 'สินค้าหมด');

  const n3 = await createOrder(u1, [{ product_id: atlas.id, quantity: 1 }], null);
  await db.query(`SELECT * FROM cancel_order($1, 'customer_cancelled')`, [n3.id]);
  rows = await notes(n3.id);
  assert.deepEqual(rows.map((x) => x.type), ['awaiting_payment', 'cancelled'], 'every cancellation is notified, your own too');
  assert.equal(rows[1].data.cancel_reason, 'customer_cancelled');

  await asUser(u2, async () => {
    const others = (await db.query(`SELECT id FROM notifications WHERE user_id <> '${u2}'`)).rows;
    assert.equal(others.length, 0, "cannot see another Member's notifications, even as an admin");
    const upd = await db.query(`UPDATE notifications SET read_at = NOW() WHERE user_id <> '${u2}'`);
    assert.equal(upd.affectedRows, 0);
  });
  await asUser(u1, async () => {
    const mine = (await db.query(`SELECT id FROM notifications`)).rows;
    assert.ok(mine.length >= 5);
    await db.query(`UPDATE notifications SET read_at = NOW() WHERE id=$1`, [mine[0].id]);
    await expectError(() => db.query(`UPDATE notifications SET type = 'shipping'`), 'permission denied');
    await expectError(() => db.query(`INSERT INTO notifications (user_id, type) VALUES ('${u1}', 'shipping')`), 'permission denied');
  });
  console.log('OK   notifications: order events, once each, private, read-only but read_at');
}

// Promotions: discounted lines, Redemptions counted at ordering, limits re-checked under lock, released on cancel
{
  const food = (await db.query(`INSERT INTO products (name, price, category, on_hand, available) VALUES ('Jelly', 100, 'food', 50, 50) RETURNING id`)).rows[0].id;
  const promoId = (await db.query(
    `INSERT INTO promotions (name_th, starts_at, ends_at, applies_to_all, discount_tiers, per_customer_limit, customer_limit)
     VALUES ('ลดรับหน้าฝน', NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 day', true, '[{"min_units":1,"type":"percent","value":10}]', 1, 1) RETURNING id`
  )).rows[0].id;
  const order = async (user, redeem, reqId = null) =>
    (await db.query(`SELECT * FROM create_order($1, $2::jsonb, $3::jsonb, $4, 0, 30, $5::uuid[])`, [
      user,
      JSON.stringify([{ product_id: food, quantity: 2, discount_per_unit: 10, promotion_id: promoId }]),
      addr,
      reqId,
      redeem,
    ])).rows[0];

  const a = await order(u1, [promoId]);
  assert.equal(Number(a.subtotal), 180, 'subtotal is after the discount');
  assert.equal(Number(a.discount_total), 20);
  assert.equal(Number(a.total), 180);
  const item = (await db.query(`SELECT list_price, unit_price, discount_per_unit, promotion_id, line_total FROM order_items WHERE order_id=$1`, [a.id])).rows[0];
  assert.deepEqual([Number(item.list_price), Number(item.unit_price), Number(item.discount_per_unit), item.promotion_id, Number(item.line_total)], [100, 90, 10, promoId, 180]);
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM promotion_redemptions WHERE promotion_id=$1 AND released_at IS NULL`, [promoId])).rows[0].n, 1);

  await expectError(() => order(u1, [promoId]), 'PROMOTION_LIMIT_REACHED');
  await expectError(() => order(u2, [promoId]), 'PROMOTION_LIMIT_REACHED');
  await db.query(`SELECT * FROM cancel_order($1, 'customer_cancelled')`, [a.id]);
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM promotion_redemptions WHERE promotion_id=$1 AND released_at IS NULL`, [promoId])).rows[0].n, 0, 'cancelling gives the Redemption back');
  await order(u2, [promoId]);

  await expectError(
    () => db.query(`SELECT * FROM create_order($1, $2::jsonb, $3::jsonb, null, 0, 30, '{}'::uuid[])`, [u1, JSON.stringify([{ product_id: food, quantity: 1, discount_per_unit: 101 }]), addr]),
    'INVALID_DISCOUNT'
  );
  await expectError(
    () => db.query(`SELECT * FROM create_order($1, $2::jsonb, $3::jsonb, null, 0, 30, '{}'::uuid[])`, [u1, JSON.stringify([{ product_id: food, quantity: 1, discount_per_unit: 10, promotion_id: promoId }]), addr]),
    'INVALID_DISCOUNT'
  );
  await db.query(`UPDATE promotions SET is_active = false WHERE id=$1`, [promoId]);
  await expectError(() => order(u1, [promoId]), 'PROMOTION_UNAVAILABLE');
  await asUser(u1, () => expectError(() => db.query(`SELECT * FROM promotions`), 'permission denied'));
  console.log('OK   promotions: discounted lines, redemptions, limits under lock, released on cancel');

  // Gifts: zero-price lines, may be a product not for sale, take Available, need their Promotion
  const sticker = (await db.query(`INSERT INTO products (name, price, category, on_hand, available, is_active) VALUES ('Sticker', 20, 'gear', 5, 5, false) RETURNING id`)).rows[0].id;
  const giftPromo = (await db.query(
    `INSERT INTO promotions (name_th, starts_at, ends_at, applies_to_all, gift_every, gift_quantity)
     VALUES ('ซื้อ 2 แถม 1', NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 day', true, 2, 1) RETURNING id`
  )).rows[0].id;
  const items = [
    { product_id: food, quantity: 2, promotion_id: giftPromo },
    { product_id: sticker, quantity: 1, is_gift: true, promotion_id: giftPromo },
  ];
  const g = (await db.query(`SELECT * FROM create_order($1, $2::jsonb, $3::jsonb, null, 0, 30, $4::uuid[])`, [u1, JSON.stringify(items), addr, [giftPromo]])).rows[0];
  assert.equal(Number(g.total), 200, 'the gift is free');
  const lines = (await db.query(`SELECT product_id, unit_price, is_gift, line_total FROM order_items WHERE order_id=$1 ORDER BY is_gift`, [g.id])).rows;
  assert.deepEqual(lines.map((l) => [l.product_id, Number(l.unit_price), l.is_gift, Number(l.line_total)]), [[food, 100, false, 200], [sticker, 0, true, 0]]);
  assert.equal((await db.query(`SELECT available FROM products WHERE id=$1`, [sticker])).rows[0].available, 4, 'a gift takes Available');
  await expectError(
    () => db.query(`SELECT * FROM create_order($1, $2::jsonb, $3::jsonb, null, 0, 30, '{}'::uuid[])`, [u1, JSON.stringify(items), addr]),
    'INVALID_DISCOUNT'
  );
  await expectError(
    () => db.query(`SELECT * FROM create_order($1, $2::jsonb, $3::jsonb, null, 0, 30, '{}'::uuid[])`, [u1, JSON.stringify([{ product_id: sticker, quantity: 1 }]), addr]),
    'PRODUCT_UNAVAILABLE'
  );
  await db.query(`SELECT * FROM cancel_order($1, 'customer_cancelled')`, [g.id]);
  assert.equal((await db.query(`SELECT available FROM products WHERE id=$1`, [sticker])).rows[0].available, 5, 'cancelling returns the gift too');
  console.log('OK   gifts: free lines, may be not for sale, take and return Available, need their Promotion');

  // Two Promotions giving the same gift product: one gift line each, so each keeps its Promotion
  {
    const otherGift = (await db.query(
      `INSERT INTO promotions (name_th, starts_at, ends_at, applies_to_all, gift_every, gift_quantity)
       VALUES ('ซื้อ 1 แถม 1', NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 day', true, 1, 1) RETURNING id`
    )).rows[0].id;
    const both = [
      { product_id: food, quantity: 2, promotion_id: giftPromo },
      { product_id: sticker, quantity: 1, is_gift: true, promotion_id: giftPromo },
      { product_id: sticker, quantity: 2, is_gift: true, promotion_id: otherGift },
    ];
    const o = (await db.query(`SELECT * FROM create_order($1, $2::jsonb, $3::jsonb, null, 0, 30, $4::uuid[])`, [u1, JSON.stringify(both), addr, [giftPromo, otherGift]])).rows[0];
    const giftLines = (await db.query(`SELECT promotion_id, quantity FROM order_items WHERE order_id=$1 AND is_gift ORDER BY quantity`, [o.id])).rows;
    assert.deepEqual(giftLines.map((l) => [l.promotion_id, l.quantity]), [[giftPromo, 1], [otherGift, 2]]);
    assert.equal((await db.query(`SELECT available FROM products WHERE id=$1`, [sticker])).rows[0].available, 2, 'both gift lines take Available');
    await db.query(`SELECT * FROM cancel_order($1, 'customer_cancelled')`, [o.id]);
    assert.equal((await db.query(`SELECT available FROM products WHERE id=$1`, [sticker])).rows[0].available, 5);
    await db.query(`DELETE FROM promotion_redemptions WHERE promotion_id=$1`, [otherGift]);
    await db.query(`DELETE FROM promotions WHERE id=$1`, [otherGift]);
    console.log('OK   gifts of the same product from two Promotions stay separate lines');
  }

  // A Promotion that has started is announced once to every active Customer
  await db.query(`UPDATE promotions SET announced_at = NOW()`); // the ones above are old news
  const soon = (await db.query(
    `INSERT INTO promotions (name_th, name_en, starts_at, ends_at, applies_to_all, discount_tiers)
     VALUES ('ลดต้นหนาว', 'Early winter sale', NOW() + INTERVAL '1 hour', NOW() + INTERVAL '2 days', true, '[{"min_units":1,"type":"percent","value":5}]') RETURNING id`
  )).rows[0].id;
  const customers = (await db.query(`SELECT count(*)::int AS n FROM profiles WHERE role = 'user' AND deactivated_at IS NULL`)).rows[0].n;
  assert.equal((await db.query(`SELECT announce_started_promotions() AS n`)).rows[0].n, 0, 'not before it starts');
  await db.query(`UPDATE promotions SET starts_at = NOW() - INTERVAL '1 minute' WHERE id=$1`, [soon]);
  await db.query(`UPDATE profiles SET deactivated_at = NOW() WHERE id = $1`, [legacyUser]);
  assert.equal((await db.query(`SELECT announce_started_promotions() AS n`)).rows[0].n, 1);
  assert.equal((await db.query(`SELECT announce_started_promotions() AS n`)).rows[0].n, 0, 'announced once');
  const sent = (await db.query(`SELECT user_id, data FROM notifications WHERE type = 'promotion'`)).rows;
  assert.equal(sent.length, customers - 1, 'every active Customer, not deactivated ones or admins');
  assert.deepEqual(sent[0].data, { promotion_id: soon, name_th: 'ลดต้นหนาว', name_en: 'Early winter sale' });
  await asUser(u1, () => expectError(() => db.query(`SELECT announce_started_promotions()`), 'permission denied'));
  console.log('OK   promotion start announced once to every active Customer');
}

// Overview numbers are counted in the database: every status, Confirmed orders, Revenue (refunds excluded)
{
  const before = (await db.query(`SELECT admin_order_stats() AS s`)).rows[0].s;
  const all = (await db.query(`SELECT status, count(*)::int AS n FROM orders GROUP BY status`)).rows;
  for (const { status, n } of all) assert.equal(before.by_status[status], n, status);
  const conf = (await db.query(`SELECT COALESCE(SUM(total),0)::numeric AS r, count(*)::int AS n FROM orders WHERE status='confirmed' AND refunded_at IS NULL`)).rows[0];
  assert.equal(Number(before.revenue), Number(conf.r));
  assert.equal(before.confirmed, (await db.query(`SELECT count(*)::int AS n FROM orders WHERE status='confirmed'`)).rows[0].n);
  const one = (await db.query(`SELECT id, total FROM orders WHERE status='confirmed' AND refunded_at IS NULL LIMIT 1`)).rows[0];
  await db.query(`UPDATE orders SET refunded_at = NOW() WHERE id=$1`, [one.id]);
  const after = (await db.query(`SELECT admin_order_stats() AS s`)).rows[0].s;
  assert.equal(Number(after.revenue), Number(before.revenue) - Number(one.total), 'a refunded order is not Revenue');
  await asUser(u1, () => expectError(() => db.query(`SELECT admin_order_stats()`), 'permission denied'));
  console.log('OK   admin_order_stats: exact counts and Revenue without refunds');
}

// Shipping Rule: tiers in their own table, replaced as a whole with the Free Shipping Threshold
{
  const rule = async () => {
    const tiers = (await db.query(`SELECT min_units, max_units, fee::float AS fee FROM shipping_tiers ORDER BY min_units`)).rows;
    const free = (await db.query(`SELECT value FROM app_settings WHERE key = 'free_shipping_threshold'`)).rows[0]?.value ?? null;
    return { tiers, free };
  };
  await db.query(`SELECT set_shipping_rule($1::jsonb, $2)`, [JSON.stringify([{ min_units: 1, max_units: 1, fee: 10 }, { min_units: 2, max_units: null, fee: 50 }]), 1000]);
  assert.deepEqual(await rule(), { tiers: [{ min_units: 1, max_units: 1, fee: 10 }, { min_units: 2, max_units: null, fee: 50 }], free: 1000 });
  await db.query(`SELECT set_shipping_rule($1::jsonb, NULL)`, [JSON.stringify([{ min_units: 1, max_units: null, fee: 40 }])]);
  assert.deepEqual(await rule(), { tiers: [{ min_units: 1, max_units: null, fee: 40 }], free: null }, 'saving replaces every tier');
  await expectError(() => db.query(`SELECT set_shipping_rule($1::jsonb, NULL)`, [JSON.stringify([{ min_units: 0, max_units: null, fee: 40 }])]), 'shipping_tiers');
  assert.deepEqual((await rule()).tiers, [{ min_units: 1, max_units: null, fee: 40 }], 'a refused save changes nothing');
  await expectError(() => db.query(`SELECT set_shipping_rule($1::jsonb, NULL)`, [JSON.stringify([{ min_units: 1, max_units: null, fee: -1 }])]), 'shipping_tiers');
  await asUser(u1, () => expectError(() => db.query(`SELECT set_shipping_rule('[]'::jsonb, NULL)`), 'permission denied'));
  await asUser(u1, () => expectError(() => db.query(`SELECT * FROM shipping_tiers`), 'permission denied'));
  console.log('OK   shipping tiers: own table, replaced atomically, guarded, service-only');
}

// 005 moves a Shipping Rule saved as JSON (earlier drafts) into the tiers table
{
  await db.query(`DELETE FROM shipping_tiers`);
  await db.query(`INSERT INTO app_settings (key, value) VALUES ('shipping_rule', $1::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify({ tiers: [{ min_units: 1, max_units: null, fee: 30 }], free_threshold: 500 })]);
  await run('migration 005 (re-run with a JSON shipping rule)', migration5);
  const tiers = (await db.query(`SELECT min_units, max_units, fee::float AS fee FROM shipping_tiers`)).rows;
  assert.deepEqual(tiers, [{ min_units: 1, max_units: null, fee: 30 }]);
  assert.equal((await db.query(`SELECT value FROM app_settings WHERE key = 'free_shipping_threshold'`)).rows[0].value, 500);
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM app_settings WHERE key = 'shipping_rule'`)).rows[0].n, 0);
  console.log('OK   005: JSON shipping rule moved into shipping_tiers');
}

console.log('\nALL MIGRATION TESTS PASSED');
