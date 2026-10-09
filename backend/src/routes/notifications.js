const express = require('express');
const axios = require('axios');
const supabase = require('../config/supabase');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler, badRequest } = require('../lib/http');
const line = require('../lib/line');
const v = require('../lib/validate');

const router = express.Router();

const mask = (id) => (id && id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id);

// GET /api/notifications/line/status — admin: is LINE set up, and where do alerts go?
router.get(
  '/line/status',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { source, targets, joined_at } = await line.getAdminTargets();
    res.json({
      configured: line.isConfigured(),
      webhook_secret_set: Boolean(process.env.LINE_CHANNEL_SECRET),
      source,
      targets: targets.map(mask),
      group_joined_at: joined_at || null,
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
 * When the OA bot is added to a group, that group becomes the admin notification target
 * (unless LINE_ADMIN_TARGET_IDS is set).
 */
router.post('/line/webhook', async (req, res) => {
  if (!process.env.LINE_CHANNEL_SECRET) return res.status(503).json({ error: 'LINE webhook not configured' });

  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  if (!line.verifySignature(raw, req.headers['x-line-signature'])) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  try {
    for (const event of payload.events || []) {
      const src = event.source || {};
      if (event.type === 'join' && (src.groupId || src.roomId)) {
        const id = src.groupId || src.roomId;
        await supabase.from('app_settings').upsert({
          key: 'line_admin_group',
          value: { id, type: src.type, joined_at: new Date(event.timestamp || Date.now()).toISOString() },
          updated_at: new Date().toISOString(),
        });
        console.log(`LINE: bot joined ${src.type} ${mask(id)} — set as admin notification target`);
      }
      if (event.type === 'leave' && (src.groupId || src.roomId)) {
        const id = src.groupId || src.roomId;
        const { data } = await supabase.from('app_settings').select('value').eq('key', 'line_admin_group').maybeSingle();
        if (data?.value?.id === id) await supabase.from('app_settings').delete().eq('key', 'line_admin_group');
      }
    }
  } catch (err) {
    console.error('LINE webhook handling failed:', err.message);
  }

  res.sendStatus(200);
});

module.exports = router;
