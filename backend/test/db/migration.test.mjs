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
const stockOf = async (id) => (await db.query(`SELECT stock FROM products WHERE id=$1`, [id])).rows[0].stock;

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
r = (await db.query(`SELECT status, payment_status, expires_at FROM orders WHERE id=$1`, [o1.id])).rows[0];
assert.deepEqual([r.status, r.payment_status, r.expires_at], ['confirmed', 'paid', null]);
console.log('OK   mark_order_paid: amount check, first-time "paid", idempotent');

// Cancel rules
await expectError(() => db.query(`SELECT * FROM cancel_order($1,'x')`, [o1.id]), 'REFUND_REQUIRED');
r = (await db.query(`SELECT * FROM cancel_order($1,'refunded by admin', true, true)`, [o1.id])).rows[0];
assert.equal(r.payment_status, 'refunded');
assert.equal(await stockOf(goliath.id), 1);
assert.equal(await stockOf(atlas.id), 7);
r = (await db.query(`SELECT * FROM cancel_order($1,'again', true, true)`, [o1.id])).rows[0];
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
await db.query(`UPDATE orders SET status='shipped' WHERE id=$1`, [o3.id]);
await expectError(() => db.query(`SELECT * FROM cancel_order($1,'x')`, [o3.id]), 'INVALID_STATUS');
console.log('OK   shipped orders cannot be cancelled');

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

// Refund webhook may land before cancel_order(p_refunded): admin's "don't restock" must still hold
const o4 = await createOrder(u2, [{ product_id: atlas.id, quantity: 1 }], null);
await db.query(`SELECT mark_order_paid($1,'pi_4',$2,'thb')`, [o4.id, Math.round(Number(o4.total) * 100)]);
const stockAfterSale = await stockOf(atlas.id);
await db.query(`UPDATE orders SET payment_status='refunded' WHERE id=$1`, [o4.id]);
await db.query(`SELECT * FROM cancel_order($1,'refund', false, true)`, [o4.id]);
assert.equal(await stockOf(atlas.id), stockAfterSale, 'no restock when admin chose not to');
console.log('OK   refunded order honours restock=false');

// adjust_product_stock
r = (await db.query(`SELECT * FROM adjust_product_stock($1, 3)`, [atlas.id])).rows[0];
const before = r.stock;
await expectError(() => db.query(`SELECT * FROM adjust_product_stock($1, $2)`, [atlas.id, -(before + 1)]), 'STOCK_BELOW_ZERO');
assert.equal(await stockOf(atlas.id), before, 'failed adjustment rolled back');
await asUser(u1, () => expectError(() => db.query(`SELECT * FROM adjust_product_stock('${atlas.id}', 5)`), 'permission denied'));
console.log('OK   adjust_product_stock: atomic, never negative, service-only');

console.log('\nALL MIGRATION TESTS PASSED');
