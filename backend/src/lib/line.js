/**
 * LINE Messaging API — server-side only. The channel access token / secret never leave the backend.
 *
 * Paid-order alerts contain customer PII, so recipients come ONLY from env vars
 * (docs/adr/0002-line-target-from-env-only.md):
 *   LINE_OWNER_USER_ID     — the shop owner's LINE user ID ("U…", LINE Developers → Basic settings)
 *   LINE_ADMIN_TARGET_IDS  — optional extra user/group IDs, comma-separated
 */
const crypto = require('crypto');
const axios = require('axios');
const { formatAddress } = require('./thaiAddress');

const LINE_API = 'https://api.line.me/v2/bot/message';
const MAX_TEXT = 5000; // LINE text message limit

function isConfigured() {
  return Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN);
}

/** Validate the X-Line-Signature header (HMAC-SHA256 of the raw body, base64). */
function verifySignature(rawBody, signature, secret = process.env.LINE_CHANNEL_SECRET) {
  if (!secret || !signature || !rawBody) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function getAdminTargets() {
  const ids = [process.env.LINE_OWNER_USER_ID, ...(process.env.LINE_ADMIN_TARGET_IDS || '').split(',')]
    .map((s) => (s || '').trim())
    .filter(Boolean);
  const targets = [...new Set(ids)];
  return { source: targets.length ? 'env' : 'none', targets };
}

async function pushMessage(to, messages) {
  await axios.post(
    `${LINE_API}/push`,
    { to, messages },
    {
      timeout: 10_000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
    }
  );
}

/** Push text to every admin target. Throws if LINE is not configured or every push fails. */
async function pushToAdmins(text) {
  if (!isConfigured()) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set');
  const { targets } = await getAdminTargets();
  if (!targets.length) throw new Error('No LINE recipient configured (set LINE_OWNER_USER_ID)');

  const messages = [{ type: 'text', text: text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text }];
  const results = await Promise.allSettled(targets.map((to) => pushMessage(to, messages)));
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length === targets.length) {
    const reason = failed[0].reason;
    throw new Error(`LINE push failed: ${reason?.response?.data?.message || reason?.message}`);
  }
  return targets.length - failed.length;
}

const baht = (n) => `฿${Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function buildOrderPaidMessage(order, items, { frontendUrl = process.env.FRONTEND_URL } = {}) {
  const paidAt = order.paid_at ? new Date(order.paid_at) : new Date();
  const lines = (items || []).map((i) => `• ${i.product_name} x${i.quantity} — ${baht(i.unit_price * i.quantity)}`);
  return [
    '🪲 ออเดอร์ใหม่ชำระเงินแล้ว (New paid order)',
    `เลขที่: ${order.order_number}`,
    `ยอดชำระ: ${baht(order.total)}${Number(order.shipping_fee) > 0 ? ` (รวมค่าส่ง ${baht(order.shipping_fee)})` : ''}`,
    `เวลา: ${paidAt.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`,
    '',
    'สินค้า:',
    ...lines,
    '',
    'ที่อยู่จัดส่ง:',
    formatAddress(order.shipping_address),
    ...(order.needs_attention ? ['', '⚠️ ต้องตรวจสอบ: ดูหมายเหตุในหน้าแอดมิน'] : []),
    ...(frontendUrl ? ['', `จัดการ: ${frontendUrl.replace(/\/$/, '')}/admin?order=${order.id}`] : []),
  ].join('\n');
}

module.exports = {
  isConfigured,
  verifySignature,
  getAdminTargets,
  pushToAdmins,
  buildOrderPaidMessage,
  baht,
};
