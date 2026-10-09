const Stripe = require('stripe');

const key = process.env.STRIPE_SECRET_KEY;

if (!key) {
  console.warn('⚠️  STRIPE_SECRET_KEY is not set — payment endpoints will fail.');
} else if (key.startsWith('sk_live_') && process.env.NODE_ENV !== 'production') {
  console.warn('⚠️  Using a LIVE Stripe key outside production. Use sk_test_… keys for development.');
}

const stripe = Stripe(key || 'sk_test_missing', { maxNetworkRetries: 2 });

module.exports = stripe;
