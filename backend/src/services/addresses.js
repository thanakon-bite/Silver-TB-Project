const supabase = require('../config/supabase');
const { badRequest, notFound, unwrap } = require('../lib/http');
const { flattenGeo } = require('../lib/thaiAddress');
const v = require('../lib/validate');

const MAX_ADDRESSES = 10;
const GEO_SELECT = 'id, name_th, name_en, postal_code, th_districts(id, name_th, name_en, th_provinces(id, name_th, name_en))';
const ADDRESS_SELECT = `*, th_subdistricts(${GEO_SELECT})`;

async function getGeo(subdistrictId) {
  const { data } = await supabase.from('th_subdistricts').select(GEO_SELECT).eq('id', subdistrictId).maybeSingle();
  if (!data) throw badRequest('Please choose a valid subdistrict (ตำบล/แขวง)');
  return flattenGeo(data);
}

/** Validates address fields from the client. Postal code defaults to the subdistrict's. */
async function parseAddressInput(body, { partial = false } = {}) {
  const has = (k) => body[k] !== undefined;
  const out = {};
  if (!partial || has('label')) out.label = v.str(body.label, 'label', { required: false, max: 50 });
  if (!partial || has('recipient_name')) out.recipient_name = v.str(body.recipient_name, 'recipient_name', { max: 120 });
  if (!partial || has('phone')) out.phone = v.phone(body.phone, 'phone');
  if (!partial || has('address_line')) out.address_line = v.str(body.address_line, 'address_line', { max: 300 });

  let geo = null;
  if (!partial || has('subdistrict_id')) {
    out.subdistrict_id = v.int(body.subdistrict_id, 'subdistrict_id', { min: 1 });
    geo = await getGeo(out.subdistrict_id);
    out.postal_code = has('postal_code') && body.postal_code ? v.postalCode(body.postal_code) : geo.default_postal_code;
  } else if (has('postal_code')) {
    out.postal_code = v.postalCode(body.postal_code);
  }
  return { fields: out, geo };
}

function present(row) {
  if (!row) return row;
  const { th_subdistricts: sub, ...rest } = row;
  return { ...rest, ...flattenGeo(sub) };
}

async function listAddresses(userId) {
  const rows = unwrap(
    await supabase
      .from('addresses')
      .select(ADDRESS_SELECT)
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
  );
  return rows.map(present);
}

async function getAddress(userId, id) {
  const row = unwrap(
    await supabase.from('addresses').select(ADDRESS_SELECT).eq('id', id).eq('user_id', userId).maybeSingle()
  );
  if (!row) throw notFound('Address not found');
  return present(row);
}

async function createAddress(userId, fields, { makeDefault = false } = {}) {
  const { count } = await supabase.from('addresses').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  if ((count || 0) >= MAX_ADDRESSES) throw badRequest(`You can save up to ${MAX_ADDRESSES} addresses`);

  const isDefault = makeDefault || (count || 0) === 0;
  if (isDefault) {
    unwrap(await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId).eq('is_default', true));
  }
  const row = unwrap(
    await supabase
      .from('addresses')
      .insert({ ...fields, user_id: userId, is_default: isDefault })
      .select(ADDRESS_SELECT)
      .single()
  );
  return present(row);
}

async function setDefault(userId, id) {
  await getAddress(userId, id);
  unwrap(await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId).eq('is_default', true));
  unwrap(await supabase.from('addresses').update({ is_default: true }).eq('id', id).eq('user_id', userId));
  return getAddress(userId, id);
}

module.exports = { parseAddressInput, listAddresses, getAddress, createAddress, setDefault, getGeo, ADDRESS_SELECT, present };
