const express = require('express');
const supabase = require('../config/supabase');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler, unwrap, badRequest, notFound } = require('../lib/http');
const v = require('../lib/validate');

const router = express.Router();

const PUBLIC_FIELDS = 'id, name, description, price, stock, category, images, is_best_seller, is_active, views, created_at';

// GET /api/products — list with filter, search, pagination (active products only)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { search, category, min_price, max_price, sort = 'created_at', order = 'desc' } = req.query;
    const { page, limit, from, to } = v.pagination(req.query, { defaultLimit: 12, maxLimit: 100 });

    let query = supabase.from('products').select(PUBLIC_FIELDS, { count: 'exact' }).eq('is_active', true);

    if (search) query = query.ilike('name', v.likePattern(search));
    if (category) query = query.eq('category', String(category).slice(0, 50));
    if (min_price && Number.isFinite(Number(min_price))) query = query.gte('price', Number(min_price));
    if (max_price && Number.isFinite(Number(max_price))) query = query.lte('price', Number(max_price));

    const allowedSort = ['created_at', 'price', 'name', 'views'];
    const sortField = allowedSort.includes(sort) ? sort : 'created_at';
    query = query.order(sortField, { ascending: order === 'asc' }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ products: data, total: count, page, limit });
  })
);

// GET /api/products/categories
router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const data = unwrap(await supabase.from('products').select('category').eq('is_active', true));
    const categories = [...new Set(data.map((p) => p.category).filter(Boolean))].sort();
    res.json(categories);
  })
);

// GET /api/products/best-sellers
router.get(
  '/best-sellers',
  asyncHandler(async (req, res) => {
    const data = unwrap(
      await supabase.from('products').select(PUBLIC_FIELDS).eq('is_active', true).eq('is_best_seller', true).limit(6)
    );
    res.json(data);
  })
);

// GET /api/products/admin/all — admin: every product including inactive ones
router.get(
  '/admin/all',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, from, to } = v.pagination(req.query, { defaultLimit: 50, maxLimit: 200 });
    let query = supabase.from('products').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (req.query.search) query = query.ilike('name', v.likePattern(req.query.search));
    if (req.query.low_stock === 'true') query = query.lte('stock', 2);
    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    res.json({ products: data, total: count, page, limit });
  })
);

// GET /api/products/:id — active products only
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!v.isUuid(req.params.id)) throw notFound('Product not found');
    const { data } = await supabase
      .from('products')
      .select(PUBLIC_FIELDS)
      .eq('id', req.params.id)
      .eq('is_active', true)
      .maybeSingle();
    if (!data) throw notFound('Product not found');

    // Fire-and-forget view counter (atomic increment in SQL)
    supabase.rpc('increment_product_views', { p_product_id: data.id }).then(({ error }) => {
      if (error) console.error('increment_product_views:', error.message);
    });

    res.json(data);
  })
);

function productInput(body, { partial }) {
  const out = {};
  const has = (k) => body[k] !== undefined;
  if (!partial || has('name')) out.name = v.str(body.name, 'name', { max: 200 });
  if (!partial || has('description')) out.description = v.str(body.description, 'description', { required: false, max: 5000 });
  if (!partial || has('price')) out.price = v.money(body.price, 'price');
  if (!partial || has('category')) out.category = v.str(body.category, 'category', { required: false, max: 50 });
  if (has('images')) out.images = v.imageUrls(body.images);
  if (has('is_best_seller')) out.is_best_seller = v.bool(body.is_best_seller, 'is_best_seller');
  if (has('is_active')) out.is_active = v.bool(body.is_active, 'is_active');
  return out;
}

// POST /api/products — admin only
router.post(
  '/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = productInput(req.body, { partial: false });
    input.stock = v.int(req.body.stock, 'stock', { min: 0, max: 100000 });
    const data = unwrap(
      await supabase
        .from('products')
        .insert({ images: [], is_best_seller: false, is_active: true, views: 0, ...input })
        .select()
        .single()
    );
    res.status(201).json(data);
  })
);

// PATCH /api/products/:id — admin only (stock is changed via POST /:id/stock)
router.patch(
  '/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = v.uuid(req.params.id, 'id');
    if (req.body.stock !== undefined) throw badRequest('Use POST /api/products/:id/stock to adjust stock');
    const updates = productInput(req.body, { partial: true });
    if (!Object.keys(updates).length) throw badRequest('Nothing to update');
    const data = unwrap(await supabase.from('products').update(updates).eq('id', id).select().maybeSingle());
    if (!data) throw notFound('Product not found');
    res.json(data);
  })
);

// POST /api/products/:id/stock — admin: atomic +/- adjustment { delta }
router.post(
  '/:id/stock',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = v.uuid(req.params.id, 'id');
    const delta = v.int(req.body.delta, 'delta', { min: -100000, max: 100000 });
    const data = unwrap(await supabase.rpc('adjust_product_stock', { p_product_id: id, p_delta: delta }));
    res.json(data);
  })
);

// DELETE /api/products/:id — admin only (soft delete; order history keeps referencing it)
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = v.uuid(req.params.id, 'id');
    unwrap(await supabase.from('products').update({ is_active: false }).eq('id', id));
    res.json({ message: 'Product deactivated' });
  })
);

module.exports = router;
