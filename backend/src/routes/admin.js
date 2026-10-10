const express = require('express');
const supabase = require('../config/supabase');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler, unwrap, badRequest, conflict, notFound, HttpError } = require('../lib/http');
const { frontendBase } = require('../lib/frontend');
const v = require('../lib/validate');

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

    const [statusRows, paidRecent, lowStock, attention, customers, catalogue] = await Promise.all([
      supabase.from('orders').select('status, payment_status, total'),
      supabase.from('orders').select('total, paid_at').eq('payment_status', 'paid').gte('paid_at', since.toISOString()),
      supabase
        .from('products')
        .select('id, name, name_th, category, stock')
        .eq('is_active', true)
        .lte('stock', LOW_STOCK)
        .order('stock', { ascending: true })
        .limit(20),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('needs_attention', true),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'user'),
      supabase.from('products').select('category').eq('is_active', true),
    ]);
    for (const r of [statusRows, paidRecent, lowStock, catalogue]) if (r.error) throw r.error;

    // Every Category appears, even with no products, so the chart's axis never shifts.
    const byCategory = Object.fromEntries(v.PRODUCT_CATEGORIES.map((c) => [c, 0]));
    for (const p of catalogue.data) byCategory[p.category] = (byCategory[p.category] || 0) + 1;

    const byStatus = Object.fromEntries(['pending', 'paid', 'shipped', 'delivered', 'cancelled'].map((s) => [s, 0]));
    let revenue = 0;
    for (const o of statusRows.data) {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
      if (o.payment_status === 'paid') revenue += Number(o.total);
    }

    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
      days.push({ date: bangkokDay(d), revenue: 0, orders: 0 });
    }
    const dayIndex = Object.fromEntries(days.map((d, i) => [d.date, i]));
    for (const o of paidRecent.data) {
      const i = dayIndex[bangkokDay(o.paid_at)];
      if (i !== undefined) {
        days[i].revenue += Number(o.total);
        days[i].orders += 1;
      }
    }

    res.json({
      revenue_total: revenue,
      orders_by_status: byStatus,
      products_by_category: byCategory,
      to_fulfil: byStatus.paid,
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
      .select('id, full_name, email, phone, role, created_at', { count: 'exact' })
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
      ? unwrap(await supabase.from('orders').select('user_id, total, payment_status').in('user_id', ids))
      : [];
    const stats = {};
    for (const o of orderRows) {
      const s = (stats[o.user_id] ||= { orders: 0, spent: 0 });
      s.orders += 1;
      if (o.payment_status === 'paid') s.spent += Number(o.total);
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
        .select('id, order_number, total, status, payment_status, created_at')
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
