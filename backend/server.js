// backend/.env first; a monorepo-root .env can fill in anything not set there
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./src/routes/auth');
const productRoutes = require('./src/routes/products');
const orderRoutes = require('./src/routes/orders');
const paymentRoutes = require('./src/routes/payments');
const notificationRoutes = require('./src/routes/notifications');
const addressRoutes = require('./src/routes/addresses');
const geoRoutes = require('./src/routes/geo');
const adminRoutes = require('./src/routes/admin');
const ruleRoutes = require('./src/routes/rules');
const { startOrderJobs } = require('./src/services/orders');

const app = express();
const PORT = process.env.PORT || 5000;

// Behind a proxy/load balancer (Render, Railway, Nginx…) so rate limits see the real client IP
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
app.disable('x-powered-by');

// Security headers
app.use(helmet());

// CORS — only the storefront may call the API from a browser
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map((s) => s.trim());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: false,
  })
);

// Webhooks need the raw body for signature verification — register before express.json()
// and keep them out of the general rate limiter (Stripe/LINE retry on failures).
app.use('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }));
app.use('/api/notifications/line/webhook', express.raw({ type: '*/*', limit: '1mb' }));

const isWebhook = (req) => req.path === '/api/payments/webhook' || req.path === '/api/notifications/line/webhook';

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
  skip: isWebhook,
});
app.use(limiter);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rules', ruleRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler — client errors keep their message; server errors are logged, not leaked
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (err.type === 'StripeCardError' || err.type === 'StripeInvalidRequestError') {
    console.error('Stripe error:', err.message);
    return res.status(400).json({ error: 'Payment provider rejected the request' });
  }
  // Any other Stripe failure (bad key, rate limit, outage) is ours, not the customer's: never echo
  // Stripe's message (it can include part of the API key) or its status (a 401 would look like a lost session).
  if (typeof err.type === 'string' && err.type.startsWith('Stripe')) {
    console.error('Stripe error:', err.type, err.message);
    return res.status(502).json({ error: 'Payment provider is unavailable. Please try again shortly.', code: 'PAYMENT_PROVIDER' });
  }
  if (status >= 500) {
    console.error(err.stack || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
  res.status(status).json({ error: err.expose === false ? 'Request failed' : err.message, code: err.code });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 SilverTB Backend running on port ${PORT}`);
  });
  if (process.env.DISABLE_JOBS !== 'true') startOrderJobs();
}

module.exports = app;
