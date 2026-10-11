const express = require('express');
const supabase = require('../config/supabase');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler, unwrap, badRequest, conflict, notFound, HttpError } = require('../lib/http');
const { frontendBase } = require('../lib/frontend');
const v = require('../lib/validate');
const { ORDER_STATUSES, PAID_STATUSES } = require('../lib/orderStatus');
const { decideMemberRemoval } = require('../lib/memberRemoval');
const { validateShippingRule } = require('../lib/pricing');
const pricing = require('../services/pricing');
const promotionsService = require('../services/promotions');
const { validatePromotion, editablePromotionFields } = require('../lib/promotions');

const router = express.Router();
router.use(authenticate, requireAdmin);

const LOW_STOCK = 2;

const bangkokDay = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

// GET /api/admin/stats — dashboard overview
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const since = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
    since.setUTCHours(0, 0, 0, 0);

    const [statusRows, confirmedRecent, lowStock, attention, customers, catalogue] = await Promise.all([
      supabase.rpc('admin_order_stats'),
      supabase.from('orders').select('total, confirmed_at').eq('status', 'confirmed').is('refunded_at', null).gte('confirmed_at', since.toISOString()),
      supabase
        .from('products')
        .select('id, name, name_th, category, available')
        .eq('is_active', true)
        .lte('available', LOW_STOCK)
        .order('available', { ascending: true })
        .limit(20),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('needs_attention', true),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'user'),
      supabase.from('products').select('category').eq('is_active', true),
    ]);
    for (const r of [statusRows, confirmedRecent, lowStock, catalogue]) if (r.error) throw r.error;

    // Every Category appears, even with no products, so the chart's axis never shifts.
    const byCategory = Object.fromEntries(v.PRODUCT_CATEGORIES.map((c) => [c, 0]));
    for (const p of catalogue.data) byCategory[p.category] = (byCategory[p.category] || 0) + 1;

    // Counted in the database so the numbers stay exact at any number of orders
    const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, Number(statusRows.data.by_status?.[s] || 0)]));
    const confirmed = Number(statusRows.data.confirmed || 0);
    const revenue = Number(statusRows.data.revenue || 0);

    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
      days.push({ date: bangkokDay(d), revenue: 0, orders: 0 });
    }
    const dayIndex = Object.fromEntries(days.map((d, i) => [d.date, i]));
    // Revenue per day, by the day the order was Confirmed (CONTEXT.md: Revenue)
    for (const o of confirmedRecent.data) {
      const i = dayIndex[bangkokDay(o.confirmed_at)];
      if (i !== undefined) {
        days[i].revenue += Number(o.total);
        days[i].orders += 1;
      }
    }

    res.json({
      revenue_total: revenue,
      orders_by_status: byStatus,
      products_by_category: byCategory,
      confirmed_orders: confirmed,
      to_fulfil: byStatus.waiting_shipping,
      needs_attention: attention.count || 0,
      customers: customers.count || 0,
      low_stock: lowStock.data,
      daily: days,
    });
  })
);

// GET /api/admin/customers — customers with order count and total spent
router.get(
  '/customers',
  asyncHandler(async (req, res) => {
    const { page, limit, from, to } = v.pagination(req.query, { defaultLimit: 25, maxLimit: 100 });
    let query = supabase
      .from('profiles')
      .select('id, full_name, email, phone, role, created_at, deactivated_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (req.query.search) {
      // Only allow safe characters inside the PostgREST or() filter
      const term = String(req.query.search).replace(/[^\p{L}\p{N}@.\- ]/gu, '').trim().slice(0, 100);
      if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
    }
    const { data: profiles, error, count } = await query;
    if (error) throw error;

    const ids = profiles.map((p) => p.id);
    const orderRows = ids.length
      ? unwrap(await supabase.from('orders').select('user_id, total, status, refunded_at').in('user_id', ids))
      : [];
    const stats = {};
    for (const o of orderRows) {
      const s = (stats[o.user_id] ||= { orders: 0, spent: 0 });
      s.orders += 1;
      if (PAID_STATUSES.includes(o.status) && !o.refunded_at) s.spent += Number(o.total);
    }

    res.json({
      customers: profiles.map((p) => ({ ...p, orders: stats[p.id]?.orders || 0, total_spent: stats[p.id]?.spent || 0 })),
      total: count,
      page,
      limit,
    });
  })
);

// POST /api/admin/customers — create a Member by invitation: Supabase emails them a link to set their own
// password, so the admin never knows it. The profile row comes from the on_auth_user_created trigger.
router.post(
  '/customers',
  asyncHandler(async (req, res) => {
    const full_name = v.str(req.body.full_name, 'full_name', { max: 120 });
    const email = v.email(req.body.email);
    const phone = v.phone(req.body.phone, 'phone', { required: false });
    const role = v.oneOf(req.body.role ?? 'user', 'role', ['user', 'admin']);

    const emailTaken = () => conflict('A member with this email already exists', 'EMAIL_TAKEN');
    const existing = unwrap(await supabase.from('profiles').select('id').eq('email', email).maybeSingle());
    if (existing) throw emailTaken();

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { full_name, phone },
      redirectTo: `${frontendBase()}/reset-password`,
    });
    if (error) {
      if (/already|registered|exists/i.test(error.message)) throw emailTaken();
      // Auth or email delivery failed: not the admin's input, so not a 400.
      console.error('inviteUserByEmail:', error.message);
      throw new HttpError(502, 'Could not send the invitation email. Try again later.', 'INVITE_FAILED');
    }

    const profile = unwrap(
      await supabase
        .from('profiles')
        .upsert({ id: data.user.id, full_name, phone, email, role }, { onConflict: 'id' })
        .select('id, full_name, email, phone, role, created_at')
        .single()
    );
    console.log(`MEMBER CREATED: ${req.user.id} invited ${profile.id} as ${role}`);
    res.status(201).json({ ...profile, orders: 0, total_spent: 0 });
  })
);

// GET /api/admin/customers/:id — profile, addresses and orders
router.get(
  '/customers/:id',
  asyncHandler(async (req, res) => {
    const id = v.uuid(req.params.id, 'id');
    const profile = unwrap(
      await supabase.from('profiles').select('id, full_name, email, phone, role, created_at').eq('id', id).maybeSingle()
    );
    if (!profile) throw notFound('Customer not found');
    const [addresses, orders] = await Promise.all([
      supabase.from('addresses').select('*').eq('user_id', id),
      supabase
        .from('orders')
        .select('id, order_number, total, status, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    res.json({ ...profile, addresses: addresses.data || [], orders: orders.data || [] });
  })
);

// PATCH /api/admin/customers/:id/role — promote/demote admins (cannot change your own role)
router.patch(
  '/customers/:id/role',
  asyncHandler(async (req, res) => {
    const id = v.uuid(req.params.id, 'id');
    const role = v.oneOf(req.body.role, 'role', ['user', 'admin']);
    if (id === req.user.id) throw badRequest('You cannot change your own role');
    const data = unwrap(await supabase.from('profiles').update({ role }).eq('id', id).select('id, role').maybeSingle());
    if (!data) throw notFound('Customer not found');
    console.log(`ROLE CHANGE: ${req.user.id} set ${id} to ${role}`);
    res.json(data);
  })
);

// DELETE /api/admin/customers/:id — remove a Member: deleted outright when they have no orders,
// otherwise Deactivated (banned in Auth + deactivated_at) so their order history stays.
router.delete(
  '/customers/:id',
  asyncHandler(async (req, res) => {
    const id = v.uuid(req.params.id, 'id');
    const target = unwrap(await supabase.from('profiles').select('id, role, deactivated_at').eq('id', id).maybeSingle());
    if (!target) throw notFound('Member not found');
    const [orderRows, adminRows] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', id),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin').is('deactivated_at', null),
    ]);
    if (orderRows.error) throw orderRows.error;
    if (adminRows.error) throw adminRows.error;

    const decision = decideMemberRemoval({ actorId: req.user.id, target, orderCount: orderRows.count || 0, activeAdmins: adminRows.count || 0 });
    if (!decision.ok) throw conflict(decision.reason, decision.code);

    if (decision.action === 'delete') {
      const { error } = await supabase.auth.admin.deleteUser(id);
      if (error) throw new HttpError(502, 'Could not delete this member. Try again later.', 'DELETE_FAILED');
    } else {
      const { error } = await supabase.auth.admin.updateUserById(id, { ban_duration: '876000h' });
      if (error) throw new HttpError(502, 'Could not deactivate this member. Try again later.', 'DEACTIVATE_FAILED');
      unwrap(await supabase.from('profiles').update({ deactivated_at: new Date().toISOString() }).eq('id', id));
    }
    console.log(`MEMBER REMOVED: ${req.user.id} ${decision.action}d ${id}`);
    res.json({ id, result: decision.action === 'delete' ? 'deleted' : 'deactivated' });
  })
);

// GET /api/admin/rules/shipping — the Shipping Rule as stored
router.get(
  '/rules/shipping',
  asyncHandler(async (req, res) => {
    res.json(await pricing.shippingRuleView());
  })
);

// PUT /api/admin/rules/shipping — replace the Shipping Rule; tiers must run from 1 unit with no gaps
// or overlaps and end open ("N or more"). New orders use it; existing orders keep their fee.
router.put(
  '/rules/shipping',
  asyncHandler(async (req, res) => {
    const check = validateShippingRule(req.body);
    if (!check.ok) throw badRequest(check.reason, 'INVALID_SHIPPING_RULE');
    res.json(await pricing.saveShippingRule(check.rule));
  })
);

// ---- Promotions (CONTEXT.md: Promotion). Gifts are added in the same form.

/** Promotion fields from the validated form, ready for the promotions table. */
const promotionRow = (p) => ({
  name_th: p.name_th,
  name_en: p.name_en,
  starts_at: p.starts_at,
  ends_at: p.ends_at,
  applies_to_all: p.applies_to_all,
  discount_tiers: p.discount_tiers,
  gift_every: p.gift_every ?? null,
  gift_quantity: p.gift_quantity ?? null,
  per_customer_limit: p.per_customer_limit,
  customer_limit: p.customer_limit,
  is_active: p.is_active,
});

// GET /api/admin/promotions — every Promotion with its Redemption counts
router.get(
  '/promotions',
  asyncHandler(async (req, res) => {
    res.json(await promotionsService.listAll());
  })
);

// POST /api/admin/promotions — create a Promotion
router.post(
  '/promotions',
  asyncHandler(async (req, res) => {
    const check = validatePromotion(req.body);
    if (!check.ok) throw badRequest(check.reason, 'INVALID_PROMOTION');
    const p = check.promotion;
    const row = unwrap(await supabase.from('promotions').insert(promotionRow(p)).select('id').single());
    await promotionsService.setProducts(row.id, p.product_ids, p.gift_product_ids || []);
    res.status(201).json(await promotionsService.getOne(row.id));
  })
);

// PATCH /api/admin/promotions/:id — before it starts everything can change; after, only the names,
// end date and on/off (Customers may already have redeemed it).
router.patch(
  '/promotions/:id',
  asyncHandler(async (req, res) => {
    const id = v.uuid(req.params.id, 'id');
    const existing = await promotionsService.getOne(id);
    if (!existing) throw notFound('Promotion not found');
    const check = validatePromotion(req.body);
    if (!check.ok) throw badRequest(check.reason, 'INVALID_PROMOTION');
    const p = check.promotion;
    const locked = editablePromotionFields(existing, new Date());
    if (locked) {
      const updates = Object.fromEntries(locked.map((k) => [k, p[k]]));
      if (updates.ends_at < existing.starts_at) throw badRequest('The end date cannot be before the start date', 'INVALID_PROMOTION');
      unwrap(await supabase.from('promotions').update(updates).eq('id', id));
    } else {
      unwrap(await supabase.from('promotions').update(promotionRow(p)).eq('id', id));
      await promotionsService.setProducts(id, p.product_ids, p.gift_product_ids || []);
    }
    res.json(await promotionsService.getOne(id));
  })
);

// DELETE /api/admin/promotions/:id — only while nobody has redeemed it; otherwise turn it off
router.delete(
  '/promotions/:id',
  asyncHandler(async (req, res) => {
    const id = v.uuid(req.params.id, 'id');
    if ((await promotionsService.redemptionCount(id)) > 0) {
      throw conflict('Customers have used this promotion, so it can only be ended or turned off', 'PROMOTION_IN_USE');
    }
    unwrap(await supabase.from('promotions').delete().eq('id', id));
    res.json({ id, deleted: true });
  })
);

// GET /api/admin/payments — recent Stripe webhook events (audit trail)
router.get(
  '/payments',
  asyncHandler(async (req, res) => {
    const { from, to } = v.pagination(req.query, { defaultLimit: 50, maxLimit: 200 });
    const data = unwrap(
      await supabase
        .from('payment_events')
        .select('*, orders(order_number)')
        .order('created_at', { ascending: false })
        .range(from, to)
    );
    res.json(data);
  })
);

module.exports = router;
