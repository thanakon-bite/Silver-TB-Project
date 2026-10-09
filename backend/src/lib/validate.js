/**
 * Input validation helpers. Each helper returns a cleaned value or throws a 400 HttpError.
 * Kept dependency-free on purpose (matches the rest of the backend).
 */
const { badRequest } = require('./http');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_RE = /^(\+66|0)[0-9]{8,9}$/;
const POSTAL_RE = /^[0-9]{5}$/;

const isMissing = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

function str(value, field, { required = true, min = 1, max = 255, pattern, message } = {}) {
  if (isMissing(value)) {
    if (required) throw badRequest(`${field} is required`);
    return null;
  }
  if (typeof value !== 'string') throw badRequest(`${field} must be text`);
  const v = value.trim();
  if (v.length < min) throw badRequest(`${field} must be at least ${min} characters`);
  if (v.length > max) throw badRequest(`${field} must be at most ${max} characters`);
  if (pattern && !pattern.test(v)) throw badRequest(message || `${field} is invalid`);
  return v;
}

function int(value, field, { required = true, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (isMissing(value)) {
    if (required) throw badRequest(`${field} is required`);
    return null;
  }
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n)) throw badRequest(`${field} must be a whole number`);
  if (n < min || n > max) throw badRequest(`${field} must be between ${min} and ${max}`);
  return n;
}

/** Money: non-negative, at most 2 decimals. */
function money(value, field, { required = true, max = 10_000_000 } = {}) {
  if (isMissing(value)) {
    if (required) throw badRequest(`${field} is required`);
    return null;
  }
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > max) {
    throw badRequest(`${field} must be a number between 0 and ${max}`);
  }
  if (Math.round(n * 100) !== Number((n * 100).toFixed(6))) throw badRequest(`${field} can have at most 2 decimals`);
  return Math.round(n * 100) / 100;
}

function bool(value, field, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw badRequest(`${field} is required`);
    return null;
  }
  if (typeof value !== 'boolean') throw badRequest(`${field} must be true or false`);
  return value;
}

function uuid(value, field) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw badRequest(`${field} is invalid`);
  return value.toLowerCase();
}

/** Thai phone numbers: 0XXXXXXXX(X) or +66XXXXXXXX(X). Spaces and dashes are stripped. */
function phone(value, field = 'phone', { required = true } = {}) {
  if (isMissing(value)) {
    if (required) throw badRequest(`${field} is required`);
    return null;
  }
  if (typeof value !== 'string') throw badRequest(`${field} must be text`);
  const v = value.replace(/[\s-]/g, '');
  if (!PHONE_RE.test(v)) throw badRequest(`${field} must be a Thai phone number, e.g. 0812345678`);
  return v;
}

function postalCode(value, field = 'postal_code') {
  return str(value, field, { min: 5, max: 5, pattern: POSTAL_RE, message: `${field} must be 5 digits` });
}

function oneOf(value, field, allowed, { required = true } = {}) {
  if (isMissing(value)) {
    if (required) throw badRequest(`${field} is required`);
    return null;
  }
  if (!allowed.includes(value)) throw badRequest(`${field} must be one of: ${allowed.join(', ')}`);
  return value;
}

/** Cart lines from the client. Prices are NEVER accepted from the client. */
function cartItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw badRequest('items must be a non-empty array');
  if (items.length > 50) throw badRequest('Too many items in one order');
  return items.map((item, i) => {
    if (!item || typeof item !== 'object') throw badRequest(`items[${i}] is invalid`);
    return {
      product_id: uuid(item.product_id, `items[${i}].product_id`),
      quantity: int(item.quantity, `items[${i}].quantity`, { min: 1, max: 99 }),
    };
  });
}

/** Product images: only https URLs (Supabase Storage public URLs or other https hosts). */
function imageUrls(value, field = 'images') {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw badRequest(`${field} must be an array of URLs`);
  if (value.length > 10) throw badRequest(`${field} can have at most 10 images`);
  return value.map((u, i) => {
    const s = str(u, `${field}[${i}]`, { max: 1000 });
    let parsed;
    try {
      parsed = new URL(s);
    } catch {
      throw badRequest(`${field}[${i}] must be a valid URL`);
    }
    if (parsed.protocol !== 'https:') throw badRequest(`${field}[${i}] must use https`);
    return s;
  });
}

function pagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  const from = (page - 1) * limit;
  return { page, limit, from, to: from + limit - 1 };
}

/** Escape user input for use inside a PostgREST ilike pattern. */
function likePattern(value) {
  return `%${String(value).slice(0, 100).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

const PRODUCT_CATEGORIES = ['beetle', 'food', 'log', 'gear'];
const BEETLE_SEX = ['male', 'female', 'pair', 'trio', 'unsexed'];
const BEETLE_STAGE = ['egg', 'L1', 'L2', 'L3', 'pupa', 'adult'];

// Beetle-specific product data stored in products.attributes (JSONB). Unknown keys are rejected.
function productAttributes(value, field = 'attributes') {
  if (value === undefined) return undefined;
  if (value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw badRequest(`${field} must be an object`);
  const allowed = ['family', 'species', 'locality', 'sex', 'stage', 'size_mm'];
  const unknown = Object.keys(value).filter((k) => !allowed.includes(k));
  if (unknown.length) throw badRequest(`${field} has unknown keys: ${unknown.join(', ')}`);
  const out = {};
  for (const [key, max] of [['family', 50], ['species', 120], ['locality', 120]]) {
    const text = str(value[key], `${field}.${key}`, { required: false, max });
    if (text) out[key] = text;
  }
  const sex = oneOf(value.sex, `${field}.sex`, BEETLE_SEX, { required: false });
  if (sex) out.sex = sex;
  const stage = oneOf(value.stage, `${field}.stage`, BEETLE_STAGE, { required: false });
  if (stage) out.stage = stage;
  if (!isMissing(value.size_mm)) {
    const size = Number(value.size_mm);
    if (!Number.isFinite(size) || size <= 0 || size > 300) throw badRequest(`${field}.size_mm must be between 0 and 300`);
    out.size_mm = Math.round(size * 10) / 10;
  }
  return out;
}

module.exports = {
  PRODUCT_CATEGORIES,
  BEETLE_SEX,
  BEETLE_STAGE,
  productAttributes,
  UUID_RE,
  isUuid: (v) => typeof v === 'string' && UUID_RE.test(v),
  str,
  int,
  money,
  bool,
  uuid,
  phone,
  postalCode,
  oneOf,
  cartItems,
  imageUrls,
  pagination,
  likePattern,
};
