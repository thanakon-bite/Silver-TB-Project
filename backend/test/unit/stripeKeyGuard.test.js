// The backend must not boot with a live Stripe key in development: real cards would be charged.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const boot = (env) =>
  spawnSync(process.execPath, ['-e', "require('./server')"], {
    cwd: path.resolve(__dirname, '../..'),
    env: {
      PATH: process.env.PATH,
      SUPABASE_URL: 'http://127.0.0.1:9',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      STRIPE_WEBHOOK_SECRET: 'whsec_test',
      DISABLE_JOBS: '1',
      ...env,
    },
    encoding: 'utf8',
    timeout: 20000,
  });

test('refuses to start with a live key outside production', () => {
  const r = boot({ STRIPE_SECRET_KEY: 'sk_live_example', NODE_ENV: 'development' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Refusing to start: STRIPE_SECRET_KEY is a LIVE key/);
});

test('starts with a live key when ALLOW_LIVE_STRIPE=1', () => {
  const r = boot({ STRIPE_SECRET_KEY: 'sk_live_example', NODE_ENV: 'development', ALLOW_LIVE_STRIPE: '1' });
  assert.equal(r.status, 0, r.stderr);
});

test('starts with a live key in production', () => {
  const r = boot({ STRIPE_SECRET_KEY: 'sk_live_example', NODE_ENV: 'production' });
  assert.equal(r.status, 0, r.stderr);
});
