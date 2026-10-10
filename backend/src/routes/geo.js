const express = require('express');
const supabase = require('../config/supabase');
const { asyncHandler, unwrap, badRequest } = require('../lib/http');
const { flattenGeo } = require('../lib/thaiAddress');
const v = require('../lib/validate');

const router = express.Router();

// Geography data changes very rarely — let browsers/CDNs cache it for a day.
// Empty results are never cached, so an unseeded table can't stick in browsers after seeding.
router.use((req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body) => {
    const empty = Array.isArray(body) && body.length === 0;
    res.set('Cache-Control', empty || res.statusCode >= 400 ? 'no-store' : 'public, max-age=86400');
    return json(body);
  };
  next();
});

// GET /api/geo/provinces
router.get(
  '/provinces',
  asyncHandler(async (req, res) => {
    res.json(unwrap(await supabase.from('th_provinces').select('id, name_th, name_en').order('name_th')));
  })
);

// GET /api/geo/provinces/:id/districts
router.get(
  '/provinces/:id/districts',
  asyncHandler(async (req, res) => {
    const id = v.int(req.params.id, 'province id', { min: 1 });
    res.json(
      unwrap(await supabase.from('th_districts').select('id, name_th, name_en').eq('province_id', id).order('name_th'))
    );
  })
);

// GET /api/geo/districts/:id/subdistricts
router.get(
  '/districts/:id/subdistricts',
  asyncHandler(async (req, res) => {
    const id = v.int(req.params.id, 'district id', { min: 1 });
    res.json(
      unwrap(
        await supabase
          .from('th_subdistricts')
          .select('id, name_th, name_en, postal_code')
          .eq('district_id', id)
          .order('name_th')
      )
    );
  })
);

// GET /api/geo/postal/:code — reverse lookup: postal code -> matching subdistricts
router.get(
  '/postal/:code',
  asyncHandler(async (req, res) => {
    if (!/^[0-9]{5}$/.test(req.params.code)) throw badRequest('Postal code must be 5 digits');
    const rows = unwrap(
      await supabase
        .from('th_subdistricts')
        .select('id, name_th, name_en, postal_code, th_districts(id, name_th, name_en, th_provinces(id, name_th, name_en))')
        .eq('postal_code', req.params.code)
        .limit(50)
    );
    res.json(rows.map(flattenGeo));
  })
);

module.exports = router;
