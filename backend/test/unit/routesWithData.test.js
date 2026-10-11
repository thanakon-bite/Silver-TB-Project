// Route behaviour that needs data, against an in-memory Supabase (fakeSupabase.js): who sees which
// Promotions, Category / Family deletes refused with a count, and LINE only on a customer's confirm.
process.env.SUPABASE_URL ||= 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-key';
process.env.STRIPE_SECRET_KEY ||= 'sk_test_dummy';

const test = require('node:test');
const assert = require('node:assert/strict');
const { installFakeSupabase } = require('./fakeSupabase');

const fake = installFakeSupabase();
const app = require('../../server');
const orders = require('../../src/services/orders');

let server;
let base;
test.before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const ALICE = '22222222-2222-4222-8222-222222222222';
const BOB = '33333333-3333-4333-8333-333333333333';
const OWNER = '44444444-4444-4444-8444-444444444444';
fake.users.alice = { id: ALICE, email: 'alice@example.com' };
fake.users.bob = { id: BOB, email: 'bob@example.com' };
fake.users.owner = { id: OWNER, email: 'owner@example.com' };
fake.tables.profiles = [
  { id: ALICE, role: 'user', full_name: 'Alice', phone: null, deactivated_at: null },
  { id: BOB, role: 'user', full_name: 'Bob', phone: null, deactivated_at: null },
  { id: OWNER, role: 'admin', full_name: 'Owner', phone: null, deactivated_at: null },
];

const call = (path, { token, method = 'GET', body } = {}) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

// ---- GET /api/rules/promotions -------------------------------------------------------------

const running = (id, over = {}) => ({
  id, name_th: id, name_en: null, starts_at: '2020-01-01T00:00:00.000Z', ends_at: '2999-01-01T00:00:00.000Z',
  applies_to_all: true, discount_tiers: [{ min_units: 1, type: 'percent', value: 5 }], gift_every: null, gift_quantity: null,
  per_customer_limit: null, customer_limit: null, is_active: true, stacking: 'exclusive', announced_at: null, created_at: '2020-01-01T00:00:00.000Z',
  promotion_products: [], promotion_gift_products: [], ...over,
});

test('running Promotions: a guest misses only full ones; a Customer also misses their used-up ones; one who redeemed a full one still sees it', async () => {
  fake.tables.promotions = [
    running('open', { stacking: 'stackable', gift_every: 2, gift_quantity: 1, promotion_gift_products: [{ product_id: 'g1' }, { product_id: 'g2' }] }),
    running('once', { per_customer_limit: 1 }),
    running('full', { customer_limit: 1 }),
    running('ended', { ends_at: '2020-06-01T00:00:00.000Z' }),
  ];
  fake.tables.promotion_redemptions = [
    { promotion_id: 'once', user_id: ALICE, released_at: null },
    { promotion_id: 'full', user_id: BOB, released_at: null },
  ];
  fake.tables.products = [
    { id: 'g1', price: 300 },
    { id: 'g2', price: 120 },
  ];
  const ids = async (token) => (await (await call('/api/rules/promotions', { token })).json()).map((p) => p.id);

  assert.deepEqual(await ids(), ['open', 'once'], 'guest');
  assert.deepEqual(await ids('alice'), ['open'], 'Alice used "once" up, and "full" is full');
  assert.deepEqual(await ids('bob'), ['open', 'once', 'full'], 'Bob redeemed "full" within his own cap');
  assert.deepEqual(await ids('expired-token'), ['open', 'once'], 'a bad token reads as a guest');

  const [open] = await (await call('/api/rules/promotions')).json();
  assert.equal(open.stacking, 'stackable');
  assert.deepEqual(open.gift_prices.sort((a, b) => a - b), [120, 300], 'gift prices, to value the Gift');
});

// ---- Categories and Families ----------------------------------------------------------------

test('a Category still holding products is refused with how many; the beetle one is never deleted; an empty one goes', async () => {
  fake.tables.categories = [
    { slug: 'beetle', name_th: 'ด้วง', name_en: 'Beetles', sort_order: 1, is_system: true },
    { slug: 'food', name_th: 'อาหาร', name_en: 'Food', sort_order: 2, is_system: false },
    { slug: 'gear', name_th: 'อุปกรณ์', name_en: 'Gear', sort_order: 3, is_system: false },
  ];
  fake.tables.products = [
    { id: 'p1', category: 'food', attributes: {} },
    { id: 'p2', category: 'food', attributes: {} },
  ];

  let res = await call('/api/categories/food', { token: 'alice', method: 'DELETE' });
  assert.equal(res.status, 403, 'Customers cannot');

  res = await call('/api/categories/food', { token: 'owner', method: 'DELETE' });
  assert.equal(res.status, 409);
  assert.deepEqual(await res.json(), { error: '2 product(s) are still in this Category', code: 'CATEGORY_IN_USE', params: { count: 2 } });

  res = await call('/api/categories/beetle', { token: 'owner', method: 'DELETE' });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'SYSTEM_CATEGORY');

  res = await call('/api/categories/gear', { token: 'owner', method: 'DELETE' });
  assert.equal(res.status, 200);
  assert.deepEqual(fake.tables.categories.map((c) => c.slug), ['beetle', 'food']);
});

test('a Family still on a beetle is refused with how many; an unused one goes', async () => {
  const used = '55555555-5555-4555-8555-555555555555';
  const unused = '66666666-6666-4666-8666-666666666666';
  fake.tables.beetle_families = [
    { id: used, name: 'Rhinoceros', sort_order: 1 },
    { id: unused, name: 'Flower', sort_order: 2 },
  ];
  fake.tables.products = [{ id: 'b1', category: 'beetle', attributes: { family: 'Rhinoceros' } }];

  let res = await call(`/api/categories/families/${used}`, { token: 'owner', method: 'DELETE' });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.code, 'FAMILY_IN_USE');
  assert.deepEqual(body.params, { count: 1 });

  res = await call(`/api/categories/families/${unused}`, { token: 'owner', method: 'DELETE' });
  assert.equal(res.status, 200);
  assert.deepEqual(fake.tables.beetle_families.map((f) => f.name), ['Rhinoceros']);
});

// ---- Confirmed: LINE only when the customer confirms ------------------------------------------

test('LINE goes to the Owner when the customer confirms receipt, not when an Admin confirms for them', async () => {
  const ORDER = '77777777-7777-4777-8777-777777777777';
  const shippingOrder = () => ({
    id: ORDER, order_number: 'STB-261011-00001', user_id: ALICE, status: 'shipping', subtotal: 100, shipping_fee: 0, total: 100,
    currency: 'thb', shipping_address: null, order_items: [], expires_at: null, paid_at: '2026-10-01T00:00:00Z', shipped_at: '2026-10-02T00:00:00Z',
    confirmed_at: null, confirmed_by: null, refunded_at: null, cancelled_at: null, cancel_reason: null, carrier: 'Kerry', tracking_number: 'K1',
    created_at: '2026-10-01T00:00:00Z', profiles: { full_name: 'Alice', email: 'alice@example.com', phone: null },
  });
  fake.rpcHandlers.confirm_order = ({ p_order_id, p_by }) => {
    const o = fake.tables.orders.find((x) => x.id === p_order_id);
    Object.assign(o, { status: 'confirmed', confirmed_by: p_by, confirmed_at: new Date().toISOString() });
    return { data: o, error: null };
  };
  const told = [];
  const realNotify = orders.notifyAdminsOrderReceived;
  orders.notifyAdminsOrderReceived = async (id) => {
    told.push(id);
    return true;
  };
  try {
    fake.tables.orders = [shippingOrder()];
    let res = await call(`/api/orders/${ORDER}/confirm`, { token: 'alice', method: 'POST', body: {} });
    assert.equal(res.status, 200);
    assert.deepEqual(fake.rpcCalls.at(-1), { name: 'confirm_order', args: { p_order_id: ORDER, p_by: 'customer' } });
    assert.deepEqual(told, [ORDER], 'LINE for the customer confirm');

    fake.tables.orders = [shippingOrder()];
    res = await call(`/api/orders/${ORDER}/status`, { token: 'owner', method: 'PATCH', body: { status: 'confirmed' } });
    assert.equal(res.status, 200);
    assert.deepEqual(fake.rpcCalls.at(-1), { name: 'confirm_order', args: { p_order_id: ORDER, p_by: 'admin' } });
    assert.deepEqual(told, [ORDER], 'no LINE for an Admin confirm');

    // A LINE failure is only logged: the customer's confirm still succeeds
    orders.notifyAdminsOrderReceived = async () => {
      throw new Error('LINE down');
    };
    const quiet = console.error;
    console.error = () => {};
    try {
      fake.tables.orders = [shippingOrder()];
      res = await call(`/api/orders/${ORDER}/confirm`, { token: 'alice', method: 'POST', body: {} });
      assert.equal(res.status, 200);
    } finally {
      console.error = quiet;
    }
  } finally {
    orders.notifyAdminsOrderReceived = realNotify;
  }
});

// ---- Stock: set On Hand and Stock History ---------------------------------------------------

test('setting On Hand sends the count, the note and who did it; below Reserved is refused with the minimum', async () => {
  const P = '88888888-8888-4888-8888-888888888888';
  fake.rpcHandlers.set_product_on_hand = ({ p_on_hand }) =>
    p_on_hand < 2 ? { data: null, error: { message: 'BELOW_RESERVED', details: '2' } } : { data: { id: P, on_hand: p_on_hand, available: p_on_hand - 2 }, error: null };

  let res = await call(`/api/products/${P}/stock`, { token: 'alice', method: 'POST', body: { on_hand: 5 } });
  assert.equal(res.status, 403, 'Customers cannot');

  res = await call(`/api/products/${P}/stock`, { token: 'owner', method: 'POST', body: { on_hand: 9, note: 'รับของเข้า' } });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { id: P, on_hand: 9, available: 7 });
  assert.deepEqual(fake.rpcCalls.at(-1), { name: 'set_product_on_hand', args: { p_product_id: P, p_on_hand: 9, p_actor: OWNER, p_note: 'รับของเข้า' } });

  res = await call(`/api/products/${P}/stock`, { token: 'owner', method: 'POST', body: { on_hand: 1 } });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.code, 'BELOW_RESERVED');
  assert.deepEqual(body.params, { reserved: 2 });

  res = await call(`/api/products/${P}/stock`, { token: 'owner', method: 'POST', body: { on_hand: -1 } });
  assert.equal(res.status, 400, 'a negative count never reaches the database');
});

test('Stock History is for Admins: each change with its Order Number and who made it', async () => {
  const P = '99999999-9999-4999-8999-999999999999';
  fake.tables.stock_changes = [
    { id: 3, product_id: P, kind: 'set_on_hand', on_hand_delta: 3, available_delta: 3, on_hand_after: 9, available_after: 8, note: 'รับของเข้า', created_at: '2026-10-11T03:00:00Z', order_id: null, orders: null, profiles: { full_name: 'Owner', email: 'owner@example.com' } },
    { id: 2, product_id: P, kind: 'order_created', on_hand_delta: 0, available_delta: -1, on_hand_after: 6, available_after: 5, note: null, created_at: '2026-10-10T03:00:00Z', order_id: 'o1', orders: { order_number: 'STB-261010-00007' }, profiles: null },
    { id: 1, product_id: 'other', kind: 'opening', on_hand_delta: 0, available_delta: 0, on_hand_after: 1, available_after: 1, note: null, created_at: '2026-10-09T03:00:00Z', order_id: null, orders: null, profiles: null },
  ];
  let res = await call(`/api/products/${P}/stock-history`, { token: 'alice' });
  assert.equal(res.status, 403);

  res = await call(`/api/products/${P}/stock-history?page=1`, { token: 'owner' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.total, 2);
  assert.deepEqual(body.changes.map((c) => [c.kind, c.order_number, c.actor]), [
    ['set_on_hand', null, 'Owner'],
    ['order_created', 'STB-261010-00007', null],
  ]);
});

test("the Overview counts products under the Admin's Categories, in their order, including a new empty one", async () => {
  fake.rpcHandlers.admin_order_stats = () => ({ data: { by_status: {}, confirmed: 0, revenue: 0 }, error: null });
  fake.tables.categories = [
    { slug: 'food', sort_order: 1 },
    { slug: 'beetle', sort_order: 2 },
    { slug: 'tools', sort_order: 3 },
  ];
  fake.tables.products = [
    { id: 'a', category: 'beetle', is_active: true, available: 9 },
    { id: 'b', category: 'beetle', is_active: true, available: 9 },
    { id: 'c', category: 'food', is_active: true, available: 9 },
  ];
  fake.tables.orders = [];
  const res = await call('/api/admin/stats', { token: 'owner' });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).products_by_category, { food: 1, beetle: 2, tools: 0 });
});

test("the LINE message goes out only for a Customer's own confirmation", async () => {
  const lineLib = require('../../src/lib/line');
  const realNotify = orders.notifyAdminsOrderReceived;
  const realPush = lineLib.pushToAdmins;
  const realToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const sent = [];
  process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
  lineLib.pushToAdmins = async (text) => sent.push(text);
  try {
    const ORDER = '12121212-1212-4212-8212-121212121212';
    const confirmed = (by) => ({
      id: ORDER, order_number: 'STB-261011-00002', user_id: ALICE, status: 'confirmed', confirmed_by: by, total: 100, shipping_fee: 0,
      order_items: [], profiles: { full_name: 'Alice', email: 'alice@example.com', phone: null },
    });
    fake.tables.orders = [confirmed('admin')];
    assert.equal(await realNotify(ORDER), false, 'an Admin confirmed it: no LINE');
    fake.tables.orders = [confirmed('auto')];
    assert.equal(await realNotify(ORDER), false, 'confirmed automatically: no LINE');
    fake.tables.orders = [confirmed('customer')];
    assert.equal(await realNotify(ORDER), true);
    assert.equal(sent.length, 1);
    assert.match(sent[0], /STB-261011-00002/);
  } finally {
    lineLib.pushToAdmins = realPush;
    if (realToken === undefined) delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    else process.env.LINE_CHANNEL_ACCESS_TOKEN = realToken;
  }
});
