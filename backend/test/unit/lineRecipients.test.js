// LINE Recipients (ADR 0002, amended): the Official Account's webhook learns its 1:1 friends, an
// Admin ticks which of them get order alerts, and alerts go to those plus the env-named Owner.
process.env.SUPABASE_URL ||= 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-key';
process.env.STRIPE_SECRET_KEY ||= 'sk_test_dummy';
process.env.LINE_CHANNEL_SECRET = 'line-secret';
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'line-token';
process.env.LINE_OWNER_USER_ID = `U${'0'.repeat(32)}`;
delete process.env.LINE_ADMIN_TARGET_IDS;

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { installFakeSupabase } = require('./fakeSupabase');

const fake = installFakeSupabase();
const app = require('../../server');
const line = require('../../src/lib/line');

let server;
let base;
test.before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const OWNER_ID = '44444444-4444-4444-8444-444444444444';
const ALICE = '22222222-2222-4222-8222-222222222222';
fake.users.owner = { id: OWNER_ID, email: 'owner@example.com' };
fake.users.alice = { id: ALICE, email: 'alice@example.com' };
fake.tables.profiles = [
  { id: OWNER_ID, role: 'admin', full_name: 'Owner', phone: null, deactivated_at: null },
  { id: ALICE, role: 'user', full_name: 'Alice', phone: null, deactivated_at: null },
];

const SOMCHAI = `U${'a'.repeat(32)}`;
const MALI = `U${'b'.repeat(32)}`;
const profiles = { [SOMCHAI]: { displayName: 'Somchai', pictureUrl: 'https://profile.line-scdn.net/s' }, [MALI]: { displayName: 'Mali' } };
line.getProfile = async (userId) => profiles[userId] || null;

const call = (path, { token, method = 'GET', body } = {}) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const webhook = (events, { secret = 'line-secret' } = {}) => {
  const raw = JSON.stringify({ destination: 'Ubot', events });
  const signature = crypto.createHmac('sha256', secret).update(raw).digest('base64');
  return fetch(`${base}/api/notifications/line/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Line-Signature': signature },
    body: raw,
  });
};
const fromUser = (type, userId) => ({ type, source: { type: 'user', userId }, timestamp: Date.now() });

test('a friend who follows the Official Account is listed for the Admin, but gets no alerts until ticked', async () => {
  fake.tables.line_contacts = [];
  assert.equal((await webhook([fromUser('follow', SOMCHAI)])).status, 200);
  const [c] = fake.tables.line_contacts;
  assert.equal(c.line_user_id, SOMCHAI);
  assert.equal(c.display_name, 'Somchai');
  assert.equal(c.picture_url, 'https://profile.line-scdn.net/s');
  assert.equal(c.receives_alerts ?? false, false);
  assert.deepEqual((await line.getAdminTargets()).targets, [process.env.LINE_OWNER_USER_ID], 'only the env Owner so far');
});

test('groups and rooms are never stored, and a bad signature stores nothing', async () => {
  fake.tables.line_contacts = [];
  await webhook([{ type: 'join', source: { type: 'group', groupId: `C${'c'.repeat(32)}` } }, { type: 'follow', source: { type: 'room', roomId: 'R1' } }]);
  assert.equal((await webhook([fromUser('follow', MALI)], { secret: 'wrong' })).status, 401);
  assert.deepEqual(fake.tables.line_contacts, []);
});

test('a friend from before the webhook is learnt from their next message; unfollowing drops them', async () => {
  fake.tables.line_contacts = [];
  await webhook([{ ...fromUser('message', MALI), message: { type: 'text', text: 'hi' } }]);
  assert.equal(fake.tables.line_contacts[0].display_name, 'Mali');

  let res = await call('/api/notifications/line/contacts', { token: 'owner' });
  assert.deepEqual((await res.json()).contacts.map((c) => c.display_name), ['Mali']);

  await webhook([fromUser('unfollow', MALI)]);
  assert.ok(fake.tables.line_contacts[0].unfollowed_at);
  res = await call('/api/notifications/line/contacts', { token: 'owner' });
  assert.deepEqual((await res.json()).contacts, [], 'an unfollowed friend is no longer offered');

  await webhook([fromUser('follow', MALI)]);
  assert.equal(fake.tables.line_contacts.length, 1, 'following again revives the same row');
  assert.equal(fake.tables.line_contacts[0].unfollowed_at, null);
});

test('an Admin ticks friends as recipients, as many as they like; alerts go to them and the Owner', async () => {
  fake.tables.line_contacts = [];
  await webhook([fromUser('follow', SOMCHAI), fromUser('follow', MALI)]);

  assert.equal((await call(`/api/notifications/line/contacts/${SOMCHAI}`, { token: 'alice', method: 'PATCH', body: { receives_alerts: true } })).status, 403);
  for (const id of [SOMCHAI, MALI]) {
    const res = await call(`/api/notifications/line/contacts/${id}`, { token: 'owner', method: 'PATCH', body: { receives_alerts: true } });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).receives_alerts, true);
  }
  assert.deepEqual((await line.getAdminTargets()).targets.sort(), [process.env.LINE_OWNER_USER_ID, SOMCHAI, MALI].sort());

  const status = await (await call('/api/notifications/line/status', { token: 'owner' })).json();
  assert.equal(status.recipients, 2);

  // Unfollowing stops the alerts even while ticked
  await webhook([fromUser('unfollow', MALI)]);
  assert.deepEqual((await line.getAdminTargets()).targets.sort(), [process.env.LINE_OWNER_USER_ID, SOMCHAI].sort());

  // Unticking stops them too
  await call(`/api/notifications/line/contacts/${SOMCHAI}`, { token: 'owner', method: 'PATCH', body: { receives_alerts: false } });
  assert.deepEqual((await line.getAdminTargets()).targets, [process.env.LINE_OWNER_USER_ID]);
});

test('ticking someone who is not a friend is refused', async () => {
  fake.tables.line_contacts = [];
  assert.equal((await call(`/api/notifications/line/contacts/${SOMCHAI}`, { token: 'owner', method: 'PATCH', body: { receives_alerts: true } })).status, 404);
  assert.equal((await call('/api/notifications/line/contacts/not-a-line-id', { token: 'owner', method: 'PATCH', body: { receives_alerts: true } })).status, 400);
  assert.equal((await call(`/api/notifications/line/contacts/${SOMCHAI}`, { token: 'owner', method: 'PATCH', body: {} })).status, 400);
});

test('an Admin pulls the friends list from LINE itself, for when the webhook cannot reach the shop', async () => {
  fake.tables.line_contacts = [{ line_user_id: SOMCHAI, display_name: 'Somchai', receives_alerts: true, unfollowed_at: null, followed_at: '2026-10-01T00:00:00Z' }];
  const realIds = line.getFollowerIds;
  line.getFollowerIds = async () => [SOMCHAI, MALI, 'not-a-user-id'];
  try {
    assert.equal((await call('/api/notifications/line/contacts/sync', { token: 'alice', method: 'POST', body: {} })).status, 403);
    const res = await call('/api/notifications/line/contacts/sync', { token: 'owner', method: 'POST', body: {} });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { synced: 2 });
    const byId = Object.fromEntries(fake.tables.line_contacts.map((c) => [c.line_user_id, c]));
    assert.equal(byId[MALI].display_name, 'Mali');
    assert.equal(byId[SOMCHAI].receives_alerts, true, 'a friend already ticked stays ticked');
    assert.equal(byId[SOMCHAI].followed_at, '2026-10-01T00:00:00Z', 'and keeps the day they followed');
    assert.equal(byId[MALI].receives_alerts ?? false, false, 'a newly found friend is not a recipient yet');
  } finally {
    line.getFollowerIds = realIds;
  }
});

test("an Official Account LINE won't list followers for says so in words the Admin can act on", async () => {
  const realIds = line.getFollowerIds;
  line.getFollowerIds = async () => {
    const err = new Error('Request failed with status code 403');
    err.response = { status: 403, data: { message: 'Access to this API is not available for your account' } };
    throw err;
  };
  try {
    const res = await call('/api/notifications/line/contacts/sync', { token: 'owner', method: 'POST', body: {} });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).code, 'LINE_FOLLOWERS_UNAVAILABLE');
  } finally {
    line.getFollowerIds = realIds;
  }
});
