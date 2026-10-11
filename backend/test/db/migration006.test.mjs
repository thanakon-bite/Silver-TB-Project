import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Migration 006 on top of 001–005, against an in-process Postgres (PGlite) with stand-ins for
// Supabase's auth/storage schemas: Categories, Families, Stock History, set On Hand, Confirmed and
// Promotion Notifications, and orders using several Stackable Promotions. Run with: npm run test:db
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
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
`;

async function run(label, sql) {
  try { await db.exec(sql); console.log('OK  ', label); }
  catch (e) { console.error('FAIL', label, e.message, e.detail || '', e.where || ''); process.exit(1); }
}
async function expectError(fn, msg) {
  try { await fn(); } catch (e) { assert.match(`${e.message} ${e.detail || ''}`, new RegExp(msg)); return e; }
  assert.fail(`expected error ${msg}`);
}
const q = async (sql, params) => (await db.query(sql, params)).rows;
const one = async (sql, params) => (await q(sql, params))[0];

await run('stubs', stubs);
await run('schema.sql', fs.readFileSync(`${ROOT}/schema.sql`, 'utf8'));
await run('seed.sql', fs.readFileSync(`${ROOT}/seed.sql`, 'utf8'));
for (const f of ['001_secure_commerce', '002_spec_alignment', '003_product_categories', '004_favorites_rls', '005_order_flow']) {
  await run(f, fs.readFileSync(`${ROOT}/migrations/${f}.sql`, 'utf8'));
}

// A beetle with a typed Family, and a Promotion announced under 005, before 006 runs
const [beetle] = await q(`SELECT id FROM products WHERE category = 'beetle' ORDER BY name LIMIT 1`);
await db.query(`UPDATE products SET attributes = attributes || '{"family":"Rhinoceros"}'::jsonb WHERE id = $1`, [beetle.id]);
const oldPromo = await one(`INSERT INTO promotions (name_th, starts_at, ends_at, discount_tiers, announced_at)
  VALUES ('เก่า', NOW() - INTERVAL '2 days', NOW() + INTERVAL '2 days', '[{"min_units":1,"type":"percent","value":5}]', NOW()) RETURNING id`);

const migration6 = fs.readFileSync(`${ROOT}/migrations/006_categories_stock_history_stacking.sql`, 'utf8');
{
  // Supabase's pg-safeupdate refuses an UPDATE / DELETE without WHERE
  const sql = migration6.replace(/--[^\n]*/g, '');
  const bare = [...sql.matchAll(/\b(DELETE\s+FROM\s+\S+|UPDATE\s+public\.\w+\s+(\w+\s+)?SET)\b[^;]*;/gi)]
    .map((m) => m[0])
    .filter((st) => !/\bWHERE\b/i.test(st));
  assert.deepEqual(bare, [], 'DELETE / UPDATE without WHERE');
}
// Supabase has this publication; 006 adds notifications to it for the bell's Realtime
await run('realtime publication', 'CREATE PUBLICATION supabase_realtime');
await run('migration 006 (1st run)', migration6);
await run('migration 006 (re-run)', migration6);

{
  const rows = await q(`SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public'`);
  assert.deepEqual(rows.map((r) => r.tablename), ['notifications'], 'notifications published once for Realtime, also after a re-run');
  console.log('OK   006: notifications are published to Supabase Realtime');
}

// Members: a Customer, two Admins, one deactivated Admin
const alice = '22222222-2222-2222-2222-222222222222';
const boss = '33333333-3333-3333-3333-333333333333';
const helper = '44444444-4444-4444-4444-444444444444';
const gone = '55555555-5555-5555-5555-555555555555';
const bea = '66666666-6666-6666-6666-666666666666';
await db.exec(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('${alice}', 'a@example.com', '{"full_name":"Alice"}'), ('${boss}', 'b@example.com', '{"full_name":"Boss"}'),
 ('${helper}', 'h@example.com', '{"full_name":"Helper"}'), ('${gone}', 'g@example.com', '{"full_name":"Gone"}'),
 ('${bea}', 'bea@example.com', '{"full_name":"Bea"}');
 UPDATE profiles SET role = 'admin' WHERE id IN ('${boss}', '${helper}', '${gone}');
 UPDATE profiles SET deactivated_at = NOW() WHERE id = '${gone}';`);

const addr = JSON.stringify({ recipient_name: 'Alice', phone: '0812345678', address_line: '1 Road', subdistrict: 'x', postal_code: '10200' });
const createOrder = async (items, redeem = []) =>
  one(`SELECT * FROM create_order($1, $2::jsonb, $3::jsonb, NULL, 0, 30, $4::uuid[])`, [alice, JSON.stringify(items), addr, redeem]);
const product = async () => one(`INSERT INTO products (name, price, on_hand, available, category) VALUES ('Jelly ' || gen_random_uuid(), 100, 10, 10, 'food') RETURNING *`);
const history = async (id) => q(`SELECT kind, on_hand_delta, available_delta, on_hand_after, available_after, order_id, actor_id, note FROM stock_changes WHERE product_id = $1 ORDER BY id`, [id]);

// ---- Categories ----
{
  const cats = await q(`SELECT slug, is_system FROM categories ORDER BY sort_order`);
  assert.deepEqual(cats.map((c) => c.slug), ['beetle', 'food', 'log', 'gear']);
  assert.deepEqual(cats.filter((c) => c.is_system).map((c) => c.slug), ['beetle']);
  await expectError(() => db.query(`DELETE FROM categories WHERE slug = 'beetle'`), 'SYSTEM_CATEGORY');
  await db.query(`UPDATE categories SET name_th = 'ด้วงมีชีวิต' WHERE slug = 'beetle'`);
  await product();
  await expectError(() => db.query(`DELETE FROM categories WHERE slug = 'food'`), 'products_category_fkey');
  await db.query(`INSERT INTO categories (slug, name_th, name_en, sort_order) VALUES ('books', 'หนังสือ', 'Books', 5)`);
  await db.query(`DELETE FROM categories WHERE slug = 'books'`);
  await expectError(() => db.query(`INSERT INTO products (name, price, on_hand, available, category) VALUES ('x', 1, 0, 0, 'nope')`), 'products_category_fkey');
  await expectError(() => db.query(`INSERT INTO categories (slug, name_th, name_en) VALUES ('Bad Slug', 'x', 'x')`), 'categories_slug_format');
  console.log('OK   006: categories seeded; beetle renamable, never deletable; in-use ones kept');
}

// ---- Families ----
{
  const fams = await q(`SELECT id, name FROM beetle_families`);
  assert.ok(fams.some((f) => f.name === 'Rhinoceros'), 'typed Families seed the list');
  const rhino = fams.find((f) => f.name === 'Rhinoceros');
  await db.query(`SELECT rename_beetle_family($1, 'Rhino beetles')`, [rhino.id]);
  const { family } = await one(`SELECT attributes ->> 'family' AS family FROM products WHERE id = $1`, [beetle.id]);
  assert.equal(family, 'Rhino beetles', 'renaming a Family renames it on its beetles');
  console.log('OK   006: families seeded from products; rename cascades');
}

// ---- Stock History ----
{
  const products = await one(`SELECT count(*)::int AS n FROM products p WHERE NOT EXISTS (SELECT 1 FROM stock_changes s WHERE s.product_id = p.id AND s.kind = 'created')`);
  const opening = await one(`SELECT count(*)::int AS n FROM stock_changes WHERE kind = 'opening'`);
  assert.equal(opening.n, products.n, 'one opening entry per product, even after a re-run');

  const jelly = await product();
  assert.deepEqual((await history(jelly.id)).map((h) => [h.kind, h.on_hand_after, h.available_after]), [['created', 10, 10]]);

  const order = await createOrder([{ product_id: jelly.id, quantity: 3 }]);
  await db.query(`SELECT * FROM set_product_on_hand($1, 12, $2, '  delivery  ')`, [jelly.id, boss]);
  await expectError(() => db.query(`SELECT * FROM set_product_on_hand($1, 2, NULL, NULL)`, [jelly.id]), 'BELOW_RESERVED.*3');
  await db.query(`UPDATE orders SET status = 'shipping', shipped_at = NOW() WHERE id = $1`, [order.id]);
  await db.query(`SELECT * FROM confirm_order($1, 'admin')`, [order.id]);
  const order2 = await createOrder([{ product_id: jelly.id, quantity: 2 }]);
  await db.query(`SELECT * FROM cancel_order($1, 'changed mind')`, [order2.id]);

  const h = await history(jelly.id);
  assert.deepEqual(h.map((x) => [x.kind, x.on_hand_delta, x.available_delta, x.on_hand_after, x.available_after]), [
    ['created', 10, 10, 10, 10],
    ['order_created', 0, -3, 10, 7],
    ['set_on_hand', 2, 2, 12, 9],
    ['order_confirmed', -3, 0, 9, 9],
    ['order_created', 0, -2, 9, 7],
    ['order_cancelled', 0, 2, 9, 9],
  ]);
  assert.deepEqual([h[1].order_id, h[3].order_id, h[4].order_id, h[5].order_id], [order.id, order.id, order2.id, order2.id]);
  assert.deepEqual([h[2].actor_id, h[2].note], [boss, 'delivery']);
  assert.equal(h[1].actor_id, null, 'context does not leak between transactions');
  console.log('OK   006: Stock History records create / order / set On Hand / confirm / cancel');
}

// ---- Confirmed notifications ----
{
  const jelly = await product();
  const notesFor = async (orderId) =>
    (await q(`SELECT user_id, type FROM notifications WHERE order_id = $1 AND type NOT IN ('awaiting_payment', 'shipping') ORDER BY type, user_id`, [orderId])).map((n) => [n.type, n.user_id]);
  const shipped = async () => {
    const o = await createOrder([{ product_id: jelly.id, quantity: 1 }]);
    await db.query(`UPDATE orders SET status = 'shipping', shipped_at = NOW() - INTERVAL '8 days' WHERE id = $1`, [o.id]);
    return o;
  };
  const byCustomer = await shipped();
  await db.query(`SELECT * FROM confirm_order($1, 'customer')`, [byCustomer.id]);
  assert.deepEqual(await notesFor(byCustomer.id), [['admin_confirmed_by_customer', boss], ['admin_confirmed_by_customer', helper]], 'every active Admin, not the customer');

  const byAdmin = await shipped();
  await db.query(`SELECT * FROM confirm_order($1, 'admin')`, [byAdmin.id]);
  assert.deepEqual(await notesFor(byAdmin.id), [['confirmed_by_admin', alice]]);

  const auto = await shipped();
  await db.query(`SELECT auto_confirm_orders(7)`);
  assert.deepEqual(await notesFor(auto.id), [['admin_confirmed_auto', boss], ['admin_confirmed_auto', helper], ['confirmed_auto', alice]]);
  const n = await one(`SELECT data FROM notifications WHERE order_id = $1 AND type = 'admin_confirmed_by_customer' LIMIT 1`, [byCustomer.id]);
  assert.equal(n.data.customer, 'Alice');
  console.log('OK   006: Confirmed notifies Admins (customer), the customer (Admin), or both (auto)');
}

// ---- Promotion announcements ----
{
  const promoNotes = async (id) => (await q(`SELECT type, count(*)::int AS n FROM notifications WHERE promotion_id = $1 GROUP BY type ORDER BY type`, [id])).map((r) => [r.type, r.n]);
  const customers = (await one(`SELECT count(*)::int AS n FROM profiles WHERE role = 'user' AND deactivated_at IS NULL`)).n;

  const backfilled = await one(`SELECT count(*)::int AS n FROM promotions WHERE id = $1 AND previewed_at IS NOT NULL`, [oldPromo.id]);
  assert.equal(backfilled.n, 1, 'a Promotion announced under 005 is not announced again');

  const future = await one(`INSERT INTO promotions (name_th, starts_at, ends_at, discount_tiers) VALUES ('อนาคต', NOW() + INTERVAL '3 days', NOW() + INTERVAL '9 days', '[{"min_units":1,"type":"percent","value":5}]') RETURNING id`);
  const today = await one(`INSERT INTO promotions (name_th, starts_at, ends_at, discount_tiers) VALUES ('วันนี้', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '9 days', '[{"min_units":1,"type":"percent","value":5}]') RETURNING id`);
  const off = await one(`INSERT INTO promotions (name_th, starts_at, ends_at, discount_tiers, is_active) VALUES ('ปิด', NOW() + INTERVAL '3 days', NOW() + INTERVAL '9 days', '[{"min_units":1,"type":"percent","value":5}]', FALSE) RETURNING id`);

  await db.query(`SELECT announce_promotions()`);
  await db.query(`SELECT announce_promotions()`);
  assert.equal(customers, 2, 'two Customers to announce to');
  assert.deepEqual(await promoNotes(future.id), [['promotion_new', customers]], 'coming: once, to every active Customer');
  const told = await q(`SELECT user_id FROM notifications WHERE promotion_id = $1 ORDER BY user_id`, [future.id]);
  assert.deepEqual(told.map((r) => r.user_id), [alice, bea], 'each Customer gets their own; Admins do not');
  assert.deepEqual(await promoNotes(today.id), [['promotion', customers]], 'starting today: only the start notification');
  assert.deepEqual(await promoNotes(off.id), [], 'switched off: not announced');
  assert.deepEqual(await promoNotes(oldPromo.id), []);
  const { data } = await one(`SELECT data FROM notifications WHERE promotion_id = $1 LIMIT 1`, [future.id]);
  assert.ok(data.starts_at && data.ends_at, 'the coming notification carries the dates');

  await db.query(`UPDATE promotions SET starts_at = NOW() - INTERVAL '1 minute' WHERE id = $1`, [future.id]);
  await db.query(`SELECT announce_promotions()`);
  await db.query(`SELECT announce_promotions()`);
  assert.deepEqual(await promoNotes(future.id), [['promotion', customers], ['promotion_new', customers]], 'then once more when it starts');

  await db.query(`UPDATE promotions SET is_active = TRUE WHERE id = $1`, [off.id]);
  await db.query(`SELECT announce_promotions()`);
  assert.deepEqual(await promoNotes(off.id), [['promotion_new', customers]], 'switched on: announced then');

  await db.query(`DELETE FROM promotions WHERE id = $1`, [off.id]);
  assert.equal((await one(`SELECT count(*)::int AS n FROM notifications WHERE data ->> 'promotion_id' = $1`, [off.id])).n, 0, 'deleting a Promotion removes its notifications');
  console.log('OK   006: Promotions announced when coming and when started, once each; FK cascades');
}

// ---- Stackable Promotions on an order ----
{
  const jelly = await product();
  const mk = async (name) => one(`INSERT INTO promotions (name_th, starts_at, ends_at, discount_tiers, stacking) VALUES ($1, NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 day', '[{"min_units":1,"type":"percent","value":10}]', 'stackable') RETURNING id`, [name]);
  const a = await mk('A');
  const b = await mk('B');
  const exclusiveDefault = await one(`SELECT stacking FROM promotions WHERE id = $1`, [oldPromo.id]);
  assert.equal(exclusiveDefault.stacking, 'exclusive', 'existing Promotions are Exclusive');

  const order = await createOrder([{ product_id: jelly.id, quantity: 1, discount_per_unit: 19, promotion_id: a.id, promotion_ids: [a.id, b.id] }], [a.id, b.id]);
  const item = await one(`SELECT promotion_id, promotion_ids FROM order_items WHERE order_id = $1`, [order.id]);
  assert.equal(item.promotion_id, a.id);
  assert.deepEqual(item.promotion_ids, [a.id, b.id]);
  const red = await q(`SELECT promotion_id FROM promotion_redemptions WHERE order_id = $1 ORDER BY promotion_id`, [order.id]);
  assert.equal(red.length, 2, 'one Redemption per Promotion the order used');

  await expectError(
    () => createOrder([{ product_id: jelly.id, quantity: 1, discount_per_unit: 19, promotion_id: a.id, promotion_ids: [a.id, b.id] }], [a.id]),
    'INVALID_DISCOUNT'
  );
  console.log('OK   006: a line may use several Stackable Promotions; each is redeemed');
}

console.log('\nALL MIGRATION 006 TESTS PASSED');
