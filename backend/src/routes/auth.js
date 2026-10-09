const express = require('express');
const supabase = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, unwrap, badRequest } = require('../lib/http');
const v = require('../lib/validate');

const router = express.Router();

// Sign-up, sign-in, sign-out, email verification and password reset are handled by
// Supabase Auth directly from the frontend (see frontend/src/contexts/AuthContext.tsx).
// The backend only verifies the Supabase access token (middleware/auth.js).

// GET /api/auth/me — current user's profile (role comes from the database)
router.get('/me', authenticate, (req, res) => {
  const { id, email, full_name, phone, role } = req.user;
  res.json({ id, email, full_name, phone, role });
});

// PATCH /api/auth/profile — update own name / phone (never role)
router.patch(
  '/profile',
  authenticate,
  asyncHandler(async (req, res) => {
    const updates = {};
    if (req.body.full_name !== undefined) updates.full_name = v.str(req.body.full_name, 'full_name', { max: 120 });
    if (req.body.phone !== undefined) updates.phone = v.phone(req.body.phone, 'phone', { required: false });
    if (!Object.keys(updates).length) throw badRequest('Nothing to update');

    const data = unwrap(
      await supabase.from('profiles').update(updates).eq('id', req.user.id).select('id, full_name, phone, role').single()
    );
    res.json({ ...data, email: req.user.email });
  })
);

module.exports = router;
