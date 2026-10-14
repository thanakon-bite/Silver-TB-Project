/**
 * Categories and beetle Families as Admins edit them (CONTEXT.md: Category, Family; ADR 0005).
 * Pure: routes load and save.
 */

/** A Category's link slug, from its English name; a taken slug gets -2, -3, … It never changes after. */
function slugFor(nameEn, taken = []) {
  const base =
    String(nameEn || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 36)
      .replace(/-+$/, '') || 'category';
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

const text = (v, max) => (typeof v === 'string' ? v.trim() : '').slice(0, max + 1);

/**
 * @returns {{ ok: true, category: { name_th, name_en, sort_order? } } | { ok: false, reason: string }}
 */
function validateCategory(body, { partial = false } = {}) {
  const fail = (reason) => ({ ok: false, reason });
  if (!body || typeof body !== 'object') return fail('Category is required');
  const out = {};
  if (!partial || body.name_th !== undefined) {
    out.name_th = text(body.name_th, 60);
    if (!out.name_th || out.name_th.length > 60) return fail('A Thai name (up to 60 characters) is required');
  }
  if (!partial || body.name_en !== undefined) {
    out.name_en = text(body.name_en, 60);
    if (!out.name_en || out.name_en.length > 60) return fail('An English name (up to 60 characters) is required');
  }
  if (body.sort_order !== undefined) {
    const n = Number(body.sort_order);
    if (!Number.isInteger(n) || n < 0 || n > 10000) return fail('Order must be a whole number');
    out.sort_order = n;
  }
  return { ok: true, category: out };
}

/** @returns {{ ok: true, name: string } | { ok: false, reason: string }} */
function validateFamilyName(name) {
  const n = text(name, 60);
  if (!n || n.length > 60) return { ok: false, reason: 'A Family name (up to 60 characters) is required' };
  return { ok: true, name: n };
}

module.exports = { slugFor, validateCategory, validateFamilyName };
