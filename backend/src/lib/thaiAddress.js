/**
 * Thai address helpers.
 *
 * An order stores an immutable snapshot of the shipping address (orders.shipping_address JSONB):
 * {
 *   recipient_name, phone, address_line,
 *   subdistrict_id, subdistrict, district, province, postal_code
 * }
 */

const BANGKOK_PROVINCE_ID = 1;

/** Turn a th_subdistricts row (with nested district + province) into flat names. */
function flattenGeo(sub) {
  if (!sub) return null;
  const district = sub.th_districts || {};
  const province = district.th_provinces || {};
  return {
    subdistrict_id: sub.id,
    subdistrict: sub.name_th,
    subdistrict_en: sub.name_en,
    district_id: district.id,
    district: district.name_th,
    district_en: district.name_en,
    province_id: province.id,
    province: province.name_th,
    province_en: province.name_en,
    default_postal_code: sub.postal_code,
  };
}

function buildSnapshot({ recipient_name, phone, address_line, postal_code }, geo) {
  return {
    recipient_name,
    phone,
    address_line,
    subdistrict_id: geo.subdistrict_id,
    subdistrict: geo.subdistrict,
    district: geo.district,
    province: geo.province,
    province_id: geo.province_id,
    postal_code: postal_code || geo.default_postal_code,
  };
}

/** Multi-line, human-readable Thai address (used in LINE messages and admin views). */
function formatAddress(a) {
  if (!a) return '-';
  if (typeof a === 'string') return a; // orders created before migration 001
  const isBangkok = a.province_id === BANGKOK_PROVINCE_ID || a.province === 'กรุงเทพมหานคร';
  const sub = a.subdistrict ? `${isBangkok ? 'แขวง' : 'ต.'}${a.subdistrict}` : '';
  const dist = a.district ? `${isBangkok ? 'เขต' : 'อ.'}${a.district}` : '';
  const prov = a.province ? (isBangkok ? a.province : `จ.${a.province}`) : '';
  return [
    `${a.recipient_name || ''}${a.phone ? ` (${a.phone})` : ''}`.trim(),
    a.address_line,
    [sub, dist].filter(Boolean).join(' '),
    [prov, a.postal_code].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join('\n');
}

module.exports = { flattenGeo, buildSnapshot, formatAddress, BANGKOK_PROVINCE_ID };
