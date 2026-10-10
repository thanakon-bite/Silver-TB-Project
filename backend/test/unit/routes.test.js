// HTTP-level checks that need no database: auth guards and webhook signature verification.
process.env.SUPABASE_URL ||= 'http://127.0.0.1:9'; // unreachable on purpose
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-key';
process.env.STRIPE_SECRET_KEY ||= 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
process.env.LINE_CHANNEL_SECRET = 'line-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../../server');

let server;
let base;

test.before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const call = (path, opts = {}) => fetch(`${base}${path}`, opts);

test('protected endpoints require a session', async () => {
  for (const [method, path] of [
    ['POST', '/api/orders'],
    ['GET', '/api/orders'],
    ['GET', '/api/orders/admin/all'],
    ['GET', '/api/products/admin/all'],
    ['POST', '/api/products'],
    ['GET', '/api/admin/stats'],
    ['GET', '/api/addresses'],
    ['POST', '/api/payments/checkout-session'],
    ['POST', '/api/notifications/broadcast'],
  ]) {
    const res = await call(path, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : '{}' });
    assert.equal(res.status, 401, `${method} ${path}`);
  }
});

test('legacy password endpoints are gone (auth is Supabase-only)', async () => {
  const res = await call('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(res.status, 404);
});

test('Stripe webhook rejects unsigned / forged events', async () => {
  const body = JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded', data: { object: { metadata: { order_id: 'x' } } } });
  let res = await call('/api/payments/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  assert.equal(res.status, 400);
  res = await call('/api/payments/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 't=1,v1=deadbeef' },
    body,
  });
  assert.equal(res.status, 400);
});

test('LINE webhook rejects bad signatures', async () => {
  const res = await call('/api/notifications/line/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Line-Signature': 'nope' },
    body: JSON.stringify({ events: [{ type: 'join', source: { type: 'group', groupId: 'Cattacker' } }] }),
  });
  assert.equal(res.status, 401);
});

test('geo endpoints validate input', async () => {
  const res = await call('/api/geo/postal/12ab3');
  assert.equal(res.status, 400);
});

test('the Shipping Fee is public so the cart can show it before checkout', async () => {
  const res = await call('/api/orders/shipping-fee');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { shipping_fee: 0 });
});
