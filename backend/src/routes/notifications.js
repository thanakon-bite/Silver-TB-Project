const express = require('express');
const axios = require('axios');
const supabase = require('../config/supabase');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler, badRequest, unwrap } = require('../lib/http');
const line = require('../lib/line');
const v = require('../lib/validate');

const router = express.Router();

const mask = (id) => (id && id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id);

// ---- The signed-in Member's bell (CONTEXT.md: Notification). Text is rendered by the frontend from type + data.

const PAGE_SIZE = 20;

/**
 * GET /api/notifications — a page of my notifications, newest first, and how many are unread.
 * Older pages: ?before=<created_at>&before_id=<id> of the last one shown (keyset, so new arrivals never shift a page).
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    let query = supabase
      .from('notifications')
      .select('id, type, order_id, data, read_at, created_at')
      .eq('user_id', req.user.id);
    if (req.query.before !== undefined || req.query.before_id !== undefined) {
      const before = v.timestamp(req.query.before, 'before');
      const beforeId = v.uuid(req.query.before_id, 'before_id');
      query = query.or(`created_at.lt."${before}",and(created_at.eq."${before}",id.lt.${beforeId})`);
    }
    const [list, unread] = await Promise.all([
      query
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(PAGE_SIZE + 1),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id).is('read_at', null),
    ]);
    if (list.error) throw list.error;
    if (unread.error) throw unread.error;
    res.json({
      notifications: list.data.slice(0, PAGE_SIZE),
      unread: unread.count || 0,
      has_more: list.data.length > PAGE_SIZE,
    });
  })
);

// POST /api/notifications/read-all — mark every one of mine read
router.post(
  '/read-all',
  authenticate,
  asyncHandler(async (req, res) => {
    unwrap(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', req.user.id).is('read_at', null));
    res.json({ unread: 0 });
  })
);

// POST /api/notifications/:id/read — mark one of mine read
router.post(
  '/:id/read',
  authenticate,
  asyncHandler(async (req, res) => {
    const id = v.uuid(req.params.id, 'id');
    unwrap(
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', req.user.id)
        .is('read_at', null)
    );
    res.json({ ok: true });
  })
);

// ---- LINE (admin)

// GET /api/notifications/line/status — admin: is LINE set up, and where do alerts go?
router.get(
  '/line/status',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { source, targets } = await line.getAdminTargets();
    res.json({
      configured: line.isConfigured(),
      webhook_secret_set: Boolean(process.env.LINE_CHANNEL_SECRET),
      source,
      targets: targets.map(mask),
    });
  })
);

// POST /api/notifications/line/test — admin: send a test message to the admin target(s)
router.post(
  '/line/test',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      const sent = await line.pushToAdmins(`✅ Silver Thief Bug: LINE notifications are working (sent by ${req.user.full_name}).`);
      res.json({ success: true, sent });
    } catch (err) {
      throw badRequest(err.message);
    }
  })
);

// POST /api/notifications/broadcast — admin: broadcast to all LINE OA followers
router.post(
  '/broadcast',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const message = v.str(req.body.message, 'message', { max: 2000 });
    if (!line.isConfigured()) throw badRequest('LINE is not configured');
    try {
      await axios.post(
        'https://api.line.me/v2/bot/message/broadcast',
        { messages: [{ type: 'text', text: message }] },
        {
          timeout: 10_000,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
        }
      );
      res.json({ success: true });
    } catch (err) {
      console.error('LINE broadcast failed:', err.response?.data || err.message);
      res.status(502).json({ error: 'LINE broadcast failed' });
    }
  })
);

/**
 * POST /api/notifications/line/webhook — LINE platform events (raw body, signature-verified).
 * Events are acknowledged only: alert recipients come from env vars, never from events
 * (anyone can invite the bot to a group).
 */
router.post('/line/webhook', async (req, res) => {
  if (!process.env.LINE_CHANNEL_SECRET) return res.status(503).json({ error: 'LINE webhook not configured' });

  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  if (!line.verifySignature(raw, req.headers['x-line-signature'])) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  res.sendStatus(200);
});

module.exports = router;
