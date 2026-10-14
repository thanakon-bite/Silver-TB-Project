import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The two hand-run scripts in src/db/scripts, against an in-process Postgres (PGlite) migrated to
// 006: clear_products.sql empties the catalogue and its Stock History but keeps past Orders readable;
// seed_demo_products.sql fills it with 100 demo products. Run with: npm run test:db
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/db');
const db = new PGlite({ extensions: { uuid_ossp } });

// Supabase's auth / storage schemas, as in migration006.test.mjs
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
CREATE PUBLICATION supabase_realtime;
`;

async function run(label, sql) {
  try { await db.exec(sql); console.log('OK  ', label); }
  catch (e) { console.error('FAIL', label, e.message, e.detail || '', e.where || ''); process.exit(1); }
}
const q = async (sql, params) => (await db.query(sql, params)).rows;
const one = async (sql, params) => (await q(sql, params))[0];
const script = (name) => fs.readFileSync(`${ROOT}/scripts/${name}`, 'utf8');

/** Supabase's pg-safeupdate refuses an UPDATE / DELETE without WHERE, commented-out lines aside. */
function assertEveryWriteHasWhere(name) {
  const sql = script(name).replace(/--[^\n]*/g, '');
  const bare = [...sql.matchAll(/\b(DELETE\s+FROM\s+\S+|UPDATE\s+public\.\w+\s+(\w+\s+)?SET)\b[^;]*;/gi)]
    .map((m) => m[0])
    .filter((st) => !/\bWHERE\b/i.test(st));
  assert.deepEqual(bare, [], `${name}: DELETE / UPDATE without WHERE`);
}

await run('stubs', stubs);
await run('schema.sql', fs.readFileSync(`${ROOT}/schema.sql`, 'utf8'));
await run('seed.sql', fs.readFileSync(`${ROOT}/seed.sql`, 'utf8'));
for (const f of ['001_secure_commerce', '002_spec_alignment', '003_product_categories', '004_favorites_rls', '005_order_flow', '006_categories_stock_history_stacking']) {
  await run(f, fs.readFileSync(`${ROOT}/migrations/${f}.sql`, 'utf8'));
}

// A Customer with an Order, a Favorite and a Promotion naming one product, before the clear
const alice = '22222222-2222-2222-2222-222222222222';
await db.exec(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ('${alice}', 'a@example.com', '{"full_name":"Alice"}')`);
const [first] = await q(`SELECT id, name FROM products ORDER BY name LIMIT 1`);
await db.query(`UPDATE products SET on_hand = 5, available = 5 WHERE id = $1`, [first.id]);
const addr = JSON.stringify({ recipient_name: 'Alice', phone: '0812345678', address_line: '1 Road', subdistrict: 'x', postal_code: '10200' });
const order = await one(`SELECT * FROM create_order($1, $2::jsonb, $3::jsonb, NULL, 0, 30, '{}'::uuid[])`, [alice, JSON.stringify([{ product_id: first.id, quantity: 1 }]), addr]);
await db.query(`INSERT INTO favorites (user_id, product_id) VALUES ($1, $2)`, [alice, first.id]);
const promo = await one(`INSERT INTO promotions (name_th, starts_at, ends_at, discount_tiers, applies_to_all)
  VALUES ('ลด', NOW(), NOW() + INTERVAL '2 days', '[{"min_units":1,"type":"percent","value":5}]', FALSE) RETURNING id`);
await db.query(`INSERT INTO promotion_products (promotion_id, product_id) VALUES ($1, $2)`, [promo.id, first.id]);

// ---- clear_products.sql ----
{
  assertEveryWriteHasWhere('clear_products.sql');
  await run('clear_products.sql', script('clear_products.sql'));
  for (const table of ['products', 'stock_changes', 'favorites', 'promotion_products', 'promotion_gift_products']) {
    assert.equal((await one(`SELECT count(*)::int AS n FROM ${table}`)).n, 0, `${table} emptied`);
  }
  const item = await one(`SELECT product_id, product_name FROM order_items WHERE order_id = $1`, [order.id]);
  assert.equal(item.product_id, null, 'the Order Item no longer points at a product');
  assert.equal(item.product_name, first.name, 'but still says what was bought');
  assert.equal((await one(`SELECT count(*)::int AS n FROM orders`)).n, 1, 'Orders stay');
  assert.equal((await one(`SELECT count(*)::int AS n FROM promotions WHERE id = $1`, [promo.id])).n, 1, 'Promotions stay');
  assert.ok((await one(`SELECT count(*)::int AS n FROM categories`)).n >= 4, 'Categories stay');
  console.log('OK   clear_products.sql: catalogue and Stock History gone, Orders still readable');
}

// ---- seed_demo_products.sql ----
{
  assertEveryWriteHasWhere('seed_demo_products.sql');
  await run('seed_demo_products.sql', script('seed_demo_products.sql'));
  const n = async (sql) => (await one(sql)).n;
  assert.equal(await n(`SELECT count(*)::int AS n FROM products`), 100);
  assert.deepEqual(
    (await q(`SELECT category, count(*)::int AS n FROM products GROUP BY 1 ORDER BY 1`)).map((r) => [r.category, r.n]),
    [['beetle', 64], ['food', 12], ['gear', 12], ['log', 12]]
  );
  assert.equal(await n(`SELECT count(*)::int AS n FROM products
    WHERE coalesce(btrim(name), '') = '' OR coalesce(btrim(name_th), '') = '' OR coalesce(btrim(description), '') = '' OR coalesce(btrim(description_th), '') = ''`), 0,
    'every product has a Thai and English name and description');
  assert.equal(await n(`SELECT count(*)::int AS n FROM products WHERE cardinality(images) = 0 OR EXISTS (SELECT 1 FROM unnest(images) u WHERE u NOT LIKE 'https://%')`), 0,
    'every product has https photos');
  assert.equal(await n(`SELECT count(*)::int AS n FROM products WHERE on_hand <> available OR on_hand <= 0 OR price <= 0`), 0, 'in stock, priced');
  // Beetles carry Beetle Attributes with a Family from the Admin's list; goods carry none
  assert.equal(await n(`SELECT count(*)::int AS n FROM products p WHERE category = 'beetle' AND NOT EXISTS
    (SELECT 1 FROM beetle_families f WHERE f.name = p.attributes ->> 'family')`), 0, 'every beetle Family is in beetle_families');
  assert.equal(await n(`SELECT count(*)::int AS n FROM products WHERE category = 'beetle' AND (
    attributes ->> 'species' IS NULL OR attributes ->> 'sex' NOT IN ('male','female','pair','trio','unsexed')
    OR attributes ->> 'stage' NOT IN ('egg','L1','L2','L3','pupa','adult'))`), 0, 'species, sex and stage are valid');
  assert.equal(await n(`SELECT count(*)::int AS n FROM products WHERE category <> 'beetle' AND attributes <> '{}'::jsonb`), 0);
  // Stock History starts with one "created" entry each
  assert.equal(await n(`SELECT count(*)::int AS n FROM stock_changes WHERE kind = 'created'`), 100);
  assert.ok(await n(`SELECT count(*)::int AS n FROM products WHERE is_best_seller`) >= 5, 'some Best Sellers to show');

  // Running it twice adds nothing (names are unique)
  await run('seed_demo_products.sql (re-run)', script('seed_demo_products.sql'));
  assert.equal(await n(`SELECT count(*)::int AS n FROM products`), 100, 're-running does not duplicate');
  console.log('OK   seed_demo_products.sql: 100 complete products, each with its first Stock History entry');
}

console.log('\nALL DEMO DATA SCRIPT TESTS PASSED');
