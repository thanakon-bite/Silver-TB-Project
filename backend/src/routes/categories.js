const express = require('express');
const supabase = require('../config/supabase');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler, unwrap, badRequest, conflict, notFound } = require('../lib/http');
const v = require('../lib/validate');
const { slugFor, validateCategory, validateFamilyName } = require('../lib/categories');

// Categories and beetle Families (CONTEXT.md; ADR 0005): anyone reads them, Admins change them.
const router = express.Router();

const listCategories = async () =>
  unwrap(await supabase.from('categories').select('slug, name_th, name_en, sort_order, is_system').order('sort_order').order('slug'));
const listFamilies = async () => unwrap(await supabase.from('beetle_families').select('id, name, sort_order').order('sort_order').order('name'));

/** How many products (active or not) use a Category, or a Family on a beetle. */
async function productCount(filter) {
  const { count, error } = await filter(supabase.from('products').select('id', { count: 'exact', head: true }));
  if (error) throw error;
  return count || 0;
}

// GET /api/categories — the shop's Categories and Families, in the Admin's order
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [categories, families] = await Promise.all([listCategories(), listFamilies()]);
    res.json({ categories, families });
  })
);

// POST /api/categories — admin: add a Category; its slug comes from the English name and never changes
router.post(
  '/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const check = validateCategory(req.body);
    if (!check.ok) throw badRequest(check.reason, 'INVALID_CATEGORY');
    const existing = await listCategories();
    const row = {
      ...check.category,
      slug: slugFor(check.category.name_en, existing.map((c) => c.slug)),
      sort_order: check.category.sort_order ?? existing.reduce((n, c) => Math.max(n, c.sort_order), 0) + 1,
    };
    res.status(201).json(unwrap(await supabase.from('categories').insert(row).select().single()));
  })
);

// POST /api/categories/reorder — admin: { slugs: [...] } in their new order
router.post(
  '/reorder',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const slugs = Array.isArray(req.body.slugs) ? req.body.slugs.map(String) : [];
    const existing = await listCategories();
    if (slugs.length !== existing.length || existing.some((c) => !slugs.includes(c.slug))) {
      throw badRequest('List every Category once', 'INVALID_ORDER');
    }
    for (const [i, slug] of slugs.entries()) unwrap(await supabase.from('categories').update({ sort_order: i + 1 }).eq('slug', slug));
    res.json(await listCategories());
  })
);

// PATCH /api/categories/:slug — admin: rename (the slug stays)
router.patch(
  '/:slug',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const check = validateCategory(req.body, { partial: true });
    if (!check.ok) throw badRequest(check.reason, 'INVALID_CATEGORY');
    if (!Object.keys(check.category).length) throw badRequest('Nothing to update');
    const row = unwrap(await supabase.from('categories').update(check.category).eq('slug', String(req.params.slug)).select().maybeSingle());
    if (!row) throw notFound('Category not found');
    res.json(row);
  })
);

// DELETE /api/categories/:slug — admin: only a Category with no products, never the beetle one
router.delete(
  '/:slug',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug);
    const row = unwrap(await supabase.from('categories').select('slug, is_system').eq('slug', slug).maybeSingle());
    if (!row) throw notFound('Category not found');
    if (row.is_system) throw conflict('The beetle Category can be renamed but not deleted', 'SYSTEM_CATEGORY');
    const count = await productCount((q) => q.eq('category', slug));
    if (count) throw conflict(`${count} product(s) are still in this Category`, 'CATEGORY_IN_USE', { count });
    unwrap(await supabase.from('categories').delete().eq('slug', slug));
    res.json({ slug, deleted: true });
  })
);

// ---- Families

router.post(
  '/families',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const check = validateFamilyName(req.body.name);
    if (!check.ok) throw badRequest(check.reason, 'INVALID_FAMILY');
    const existing = await listFamilies();
    const sort_order = existing.reduce((n, f) => Math.max(n, f.sort_order), 0) + 1;
    res.status(201).json(unwrap(await supabase.from('beetle_families').insert({ name: check.name, sort_order }).select().single()));
  })
);

router.post(
  '/families/reorder',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(String) : [];
    const existing = await listFamilies();
    if (ids.length !== existing.length || existing.some((f) => !ids.includes(f.id))) throw badRequest('List every Family once', 'INVALID_ORDER');
    for (const [i, id] of ids.entries()) unwrap(await supabase.from('beetle_families').update({ sort_order: i + 1 }).eq('id', id));
    res.json(await listFamilies());
  })
);

// PATCH /api/categories/families/:id — admin: rename; every beetle with it is renamed too
router.patch(
  '/families/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = v.uuid(req.params.id, 'id');
    const check = validateFamilyName(req.body.name);
    if (!check.ok) throw badRequest(check.reason, 'INVALID_FAMILY');
    res.json(unwrap(await supabase.rpc('rename_beetle_family', { p_id: id, p_name: check.name })));
  })
);

router.delete(
  '/families/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = v.uuid(req.params.id, 'id');
    const row = unwrap(await supabase.from('beetle_families').select('id, name').eq('id', id).maybeSingle());
    if (!row) throw notFound('Family not found');
    const count = await productCount((q) => q.eq('attributes->>family', row.name));
    if (count) throw conflict(`${count} beetle(s) still have this Family`, 'FAMILY_IN_USE', { count });
    unwrap(await supabase.from('beetle_families').delete().eq('id', id));
    res.json({ id, deleted: true });
  })
);

module.exports = router;
