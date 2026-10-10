const Stripe = require('stripe');

const key = process.env.STRIPE_SECRET_KEY;

if (!key) {
  console.warn('⚠️  STRIPE_SECRET_KEY is not set — payment endpoints will fail.');
} else if (/^(sk|rk)_live_/.test(key) && process.env.NODE_ENV !== 'production') {
  // A live key in development charges real cards. Refuse unless someone opts in on purpose.
  if (process.env.ALLOW_LIVE_STRIPE !== '1') {
    throw new Error(
      'Refusing to start: STRIPE_SECRET_KEY is a LIVE key but NODE_ENV is not "production". ' +
        'Use sk_test_… keys for development, or set ALLOW_LIVE_STRIPE=1 if you really mean it.'
    );
  }
  console.warn('⚠️  Using a LIVE Stripe key outside production (ALLOW_LIVE_STRIPE=1). Real cards will be charged.');
}

const stripe = Stripe(key || 'sk_test_missing', { maxNetworkRetries: 2 });

module.exports = stripe;
