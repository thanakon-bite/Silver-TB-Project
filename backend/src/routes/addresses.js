const express = require('express');
const supabase = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, unwrap, badRequest, notFound } = require('../lib/http');
const v = require('../lib/validate');
const addresses = require('../services/addresses');

const router = express.Router();
router.use(authenticate);

// GET /api/addresses — my saved addresses (default first)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await addresses.listAddresses(req.user.id));
  })
);

// POST /api/addresses
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { fields } = await addresses.parseAddressInput(req.body);
    const created = await addresses.createAddress(req.user.id, fields, { makeDefault: req.body.is_default === true });
    res.status(201).json(created);
  })
);

// PATCH /api/addresses/:id
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = v.uuid(req.params.id, 'id');
    await addresses.getAddress(req.user.id, id);
    const { fields } = await addresses.parseAddressInput(req.body, { partial: true });
    if (!Object.keys(fields).length) throw badRequest('Nothing to update');
    unwrap(await supabase.from('addresses').update(fields).eq('id', id).eq('user_id', req.user.id));
    if (req.body.is_default === true) return res.json(await addresses.setDefault(req.user.id, id));
    res.json(await addresses.getAddress(req.user.id, id));
  })
);

// POST /api/addresses/:id/default
router.post(
  '/:id/default',
  asyncHandler(async (req, res) => {
    res.json(await addresses.setDefault(req.user.id, v.uuid(req.params.id, 'id')));
  })
);

// DELETE /api/addresses/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = v.uuid(req.params.id, 'id');
    const deleted = unwrap(
      await supabase.from('addresses').delete().eq('id', id).eq('user_id', req.user.id).select('id, is_default')
    );
    if (!deleted.length) throw notFound('Address not found');

    // Keep one default address if any remain
    if (deleted[0].is_default) {
      const { data: next } = await supabase
        .from('addresses')
        .select('id')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (next) await supabase.from('addresses').update({ is_default: true }).eq('id', next.id);
    }
    res.json({ message: 'Address deleted' });
  })
);

module.exports = router;
